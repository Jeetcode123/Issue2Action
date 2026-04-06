require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { classifyIssue, duplicateDetector, composeEmail } = require('./aiService');
const { sendDispatchEmail } = require('./emailService');
const { logger, requestLogger } = require('./logger');

const app = express();

// CORS: explicitly allow frontend origin
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(requestLogger); // Log all API requests and responses

// app.get("/", (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: "Issue2Action API is running 🚀"
//   });
// });

// Global InsForge readiness guard — returns 503 if SDK not yet initialized
app.use('/api', (req, res, next) => {
  // Allow health check to always pass
  if (req.path === '/health') return next();
  if (!insforge) {
    return res.status(503).json({
      success: false,
      data: null,
      error: 'Server is still initializing. Please try again in a few seconds.'
    });
  }
  next();
});

let insforge;

(async () => {
  try {
    const { createClient } = await import('@insforge/sdk');
    insforge = createClient({
      baseUrl: process.env.INSFORGE_BASE_URL || '',
      anonKey: process.env.INSFORGE_ANON_KEY || ''
    });
    logger.info('Init', 'InsForge SDK client initialized successfully');

    // Skip persistent realtime connection in Vercel serverless (ephemeral functions)
    if (!process.env.VERCEL) {
      const connectRealtime = () => {
        insforge.realtime.connect().then(() => {
          insforge.realtime.subscribe('issues:feed').then(() => {
            logger.info('Realtime', 'Connected and subscribed to issues:feed');
          });
        }).catch(err => {
          logger.error('Realtime', 'Failed to connect, retrying in 5s...', { error: err.message });
          setTimeout(connectRealtime, 5000);
        });
      };
      connectRealtime();
    } else {
      logger.info('Init', 'Vercel serverless mode — skipping persistent realtime connection');
    }
  } catch (err) {
    logger.fatal('Init', 'Server initialization failed', { error: err.message, stack: err.stack });
  }
})();

// Helpers
const generateTicketId = () => {
  const year = new Date().getFullYear();
  const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
  return `I2A-${year}-${randomStr}`;
};

const sendResponse = (res, data = {}, error = null, status = 200) => {
  if (error) {
    return res.status(status).json({ success: false, data: null, error });
  }
  return res.status(status).json({ success: true, data, error: null });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  return sendResponse(res, {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    insforgeConnected: !!insforge,
  });
});

// Recent logs endpoint (for admin debugging)
app.get('/api/admin/logs', (req, res) => {
  const count = parseInt(req.query.count) || 50;
  const level = req.query.level?.toUpperCase();
  let logs = logger.getRecentLogs(count);
  if (level) logs = logs.filter(l => l.level === level);
  return sendResponse(res, logs);
});

// ==========================================
// Notification System
// ==========================================
const NOTIF_TYPES = {
  ISSUE_SUBMITTED: 'issue_submitted',
  AUTHORITY_DETECTED: 'authority_detected',
  EMAIL_SENT: 'email_sent',
  ISSUE_ESCALATED: 'issue_escalated',
  ISSUE_RESOLVED: 'issue_resolved',
  STATUS_UPDATE: 'status_update',
};

const createNotification = async ({ type, title, message, issue_id, user_id, channel = 'in_app' }) => {
  try {
    const { data: notifData, error: notifErr } = await insforge.database
      .from('notifications')
      .insert([{
        issue_id,
        user_id,
        type,
        title,
        channel,
        message,
        is_read: false
      }])
      .select()
      .single();

    if (notifErr) {
      logger.error('Notification', 'Failed to insert notification into DB', { error: notifErr, type, issue_id, user_id });
      return null;
    }

    // Publish realtime event so frontend can pick it up instantly
    try {
      insforge.realtime.publish('issues:feed', 'notification_update', {
        action: 'new_notification',
        user_id,
        notification: notifData
      });
    } catch (rtErr) {
      logger.warn('Realtime', 'Failed to publish notification event', { error: rtErr.message });
    }

    logger.info('Notification', `Created: type=${type} title="${title}"`, { user_id, issue_id });
    return notifData;
  } catch (error) {
    logger.error('Notification', 'createNotification failed', { error: error.message, type, issue_id, user_id });
    return null;
  }
};

const sendNotification = async (ticketId, newStatus) => {
  try {
    // 1. Fetch the issue + user email/phone from DB
    const { data: issue, error: issueErr } = await insforge.database
      .from('issues')
      .select('id, department, estimated_resolution, user_id, type')
      .eq('id', ticketId)
      .single();

    if (issueErr || !issue) throw new Error('Issue not found for notification');

    const { data: user, error: userErr } = await insforge.database
      .from('users')
      .select('id, email, phone')
      .eq('id', issue.user_id)
      .single();

    if (userErr || !user) throw new Error('User not found for notification');

    // 2. Compose notification message and determine type
    let message = '';
    let notifType = NOTIF_TYPES.STATUS_UPDATE;
    let notifTitle = 'Status Update';

    switch (newStatus) {
      case 'verified':
        message = `Your issue #${issue.id} has been verified by our team.`;
        notifType = NOTIF_TYPES.STATUS_UPDATE;
        notifTitle = 'Issue Verified';
        break;
      case 'assigned':
        message = `Your issue #${issue.id} has been assigned to ${issue.department || 'the appropriate department'}. Work begins soon.`;
        notifType = NOTIF_TYPES.AUTHORITY_DETECTED;
        notifTitle = 'Authority Assigned';
        break;
      case 'in_progress':
        message = `Work has started on your issue #${issue.id}. Estimated completion: ${issue.estimated_resolution || 'TBD'}.`;
        notifType = NOTIF_TYPES.STATUS_UPDATE;
        notifTitle = 'Work In Progress';
        break;
      case 'resolved':
        message = `Great news! Your issue #${issue.id} has been resolved. Please confirm.`;
        notifType = NOTIF_TYPES.ISSUE_RESOLVED;
        notifTitle = 'Issue Resolved! 🎉';
        break;
      default:
        message = `The status of your issue #${issue.id} has been updated to '${newStatus}'.`;
    }

    // 3. Send email to Citizen
    logger.info('CitizenEmail', `Sending status email to ${user.email}`, { ticketId, status: newStatus });
    try {
      const { initTransporter } = require('./emailService');
      const t = await initTransporter();
      await t.sendMail({
        from: '"Issue2Action Updates" <updates@issue2action.org>',
        to: user.email,
        subject: `Update on your Civic Ticket #${issue.id}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
             <h2 style="color: #4F46E5;">Issue2Action Status Update</h2>
             <p style="font-size: 16px;">${message}</p>
             <p style="color: #666; margin-top: 20px;">Log in to your dashboard to view the full tracking timeline.</p>
          </div>
        `
      });
    } catch (e) {
      logger.error('CitizenEmail', 'Failed to send citizen notification email', { error: e.message, email: user.email, ticketId });
    }

    // 4. Log the notification using createNotification
    const notifData = await createNotification({
      type: notifType,
      title: notifTitle,
      message,
      issue_id: issue.id,
      user_id: user.id,
      channel: 'email'
    });

    return notifData;
  } catch (error) {
    logger.error('Notification', 'sendNotification pipeline failed', { error: error.message, ticketId });
    return null;
  }
};

// ==========================================
// AI Department → DB issue_type mapping
// ==========================================
const DEPARTMENT_TO_ISSUE_TYPE = {
  'road': 'Road',
  'public works': 'Road',
  'pwd': 'Road',
  'pothole': 'Road',
  'road damage': 'Road',
  'water': 'Water',
  'water supply': 'Water',
  'kmc water': 'Water',
  'water leak': 'Water',
  'sanitation': 'Garbage',
  'garbage': 'Garbage',
  'sanitation dept': 'Garbage',
  'waste': 'Garbage',
  'electric': 'Electric',
  'electrical': 'Electric',
  'cesc': 'Electric',
  'lighting': 'Electric',
  'lighting dept': 'Electric',
  'street light': 'Electric',
  'electrical fault': 'Electric',
  'sewer': 'Sewer',
  'sewerage': 'Sewer',
  'drain': 'Sewer',
  'drainage': 'Sewer',
  'parks': 'Road', // Fallback for parks (often PWD)
  'noise': 'Road', // Fallback for noise (police/pwd)
};

/**
 * Maps AI department output to the DB issue_type value.
 * AI returns things like "PWD", "Public Works Department", "Sanitation Dept"
 * but DB authorities table stores issue_type as "Road", "Water", "Garbage", etc.
 */
const mapDepartmentToIssueType = (aiDepartment, aiType) => {
  // First try the AI type directly (e.g. "Road Damage" → "Road")
  if (aiType) {
    const aiTypeLower = aiType.toLowerCase().trim();
    for (const [keyword, issueType] of Object.entries(DEPARTMENT_TO_ISSUE_TYPE)) {
      if (aiTypeLower.includes(keyword) || keyword.includes(aiTypeLower)) {
        console.log(`[Mapping] AI type "${aiType}" → issue_type "${issueType}"`);
        return issueType;
      }
    }
  }

  // Then try the AI department (e.g. "Public Works Department" → "Road")
  if (aiDepartment) {
    const deptLower = aiDepartment.toLowerCase().trim();
    for (const [keyword, issueType] of Object.entries(DEPARTMENT_TO_ISSUE_TYPE)) {
      if (deptLower.includes(keyword) || keyword.includes(deptLower)) {
        console.log(`[Mapping] AI department "${aiDepartment}" → issue_type "${issueType}"`);
        return issueType;
      }
    }
  }

  // Default fallback
  console.log(`[Mapping] No mapping found for dept="${aiDepartment}", type="${aiType}". Defaulting to "Other"`);
  return 'Other';
};

/**
 * Resolves authority email by querying the authorities table using issue_type + locality.
 * Returns the full authority object { email, name, ... } or null.
 */
const resolveAuthority = async (aiDepartment, locality, aiIssueType = null, minPriority = 1) => {
  const DEFAULT_FALLBACK_EMAIL = process.env.FALLBACK_AUTHORITY_EMAIL || 'admin@issue2action.org';

  try {
    // Step 1: Map AI output to DB issue_type
    const mappedIssueType = mapDepartmentToIssueType(aiDepartment, aiIssueType);
    const normalizedLocality = (locality || '').toLowerCase().trim();

    console.log('--- Authority Resolution Debug ---');
    console.log('AI Department:', aiDepartment);
    console.log('AI Issue Type:', aiIssueType);
    console.log('Mapped Issue Type:', mappedIssueType);
    console.log('Detected Locality:', normalizedLocality);
    console.log('Min Priority Level:', minPriority);

    // Step 2: Query authorities by issue_type (the correct column)
    const { data: auths, error: authErr } = await insforge.database
      .from('authorities')
      .select('*')
      .eq('is_active', true)
      .gte('priority_level', minPriority)
      .order('priority_level', { ascending: true });

    if (authErr) {
      logger.error('Authority', 'Database query failed', { error: authErr.message });
      throw authErr;
    }

    console.log('Total active authorities found:', auths?.length || 0);

    if (!auths || auths.length === 0) {
      logger.warn('Authority', 'No active authorities in database at all, using fallback', { mappedIssueType, locality: normalizedLocality });
      return { email: DEFAULT_FALLBACK_EMAIL, name: 'System Admin', matchType: 'fallback' };
    }

    // Step 3: Filter by mapped issue_type (case-insensitive)
    const issueTypeMatches = auths.filter(a =>
      a.issue_type && a.issue_type.toLowerCase().trim() === mappedIssueType.toLowerCase()
    );
    console.log(`Authorities matching issue_type "${mappedIssueType}":`, issueTypeMatches.length);

    // Step 4: Among issue_type matches, try locality partial match
    if (issueTypeMatches.length > 0 && normalizedLocality) {
      // 4a. Exact locality match
      let match = issueTypeMatches.find(a =>
        a.locality && a.locality.toLowerCase().trim() === normalizedLocality
      );
      if (match) {
        console.log('Matched Authority (exact locality):', match.email, match.name);
        logger.info('Authority', `Exact match: ${match.email}`, { mappedIssueType, locality: normalizedLocality, matchType: 'exact' });
        return { ...match, matchType: 'exact' };
      }

      // 4b. Partial locality match (LIKE '%locality%')
      match = issueTypeMatches.find(a =>
        a.locality && (
          a.locality.toLowerCase().trim().includes(normalizedLocality) ||
          normalizedLocality.includes(a.locality.toLowerCase().trim())
        )
      );
      if (match) {
        console.log('Matched Authority (partial locality):', match.email, match.name);
        logger.info('Authority', `Partial locality match: ${match.email}`, { mappedIssueType, locality: normalizedLocality, matchType: 'partial_locality' });
        return { ...match, matchType: 'partial_locality' };
      }

      // 4c. Issue type match with no locality restriction (general authority for that type)
      match = issueTypeMatches.find(a => !a.locality || a.locality.trim() === '');
      if (match) {
        console.log('Matched Authority (issue_type, no locality):', match.email, match.name);
        logger.info('Authority', `Issue type general match: ${match.email}`, { mappedIssueType, matchType: 'issueType_general' });
        return { ...match, matchType: 'issueType_general' };
      }

      // 4d. First issue type match regardless
      console.log('Matched Authority (first issue_type match):', issueTypeMatches[0].email);
      logger.info('Authority', `First issue_type match: ${issueTypeMatches[0].email}`, { mappedIssueType, matchType: 'issueType_first' });
      return { ...issueTypeMatches[0], matchType: 'issueType_first' };
    }

    // Step 5: If no issue_type match, try locality-only match across all authorities
    if (normalizedLocality) {
      const localityMatch = auths.find(a =>
        a.locality && (
          a.locality.toLowerCase().trim().includes(normalizedLocality) ||
          normalizedLocality.includes(a.locality.toLowerCase().trim())
        )
      );
      if (localityMatch) {
        console.log('Matched Authority (locality only):', localityMatch.email, localityMatch.name);
        logger.info('Authority', `Locality-only match: ${localityMatch.email}`, { locality: normalizedLocality, matchType: 'locality_only' });
        return { ...localityMatch, matchType: 'locality_only' };
      }
    }

    // Step 6: Issue type match found but no locality match required
    if (issueTypeMatches.length > 0) {
      console.log('Matched Authority (issue_type, no locality needed):', issueTypeMatches[0].email);
      logger.info('Authority', `Issue type match (no locality): ${issueTypeMatches[0].email}`, { mappedIssueType, matchType: 'issueType_no_locality' });
      return { ...issueTypeMatches[0], matchType: 'issueType_no_locality' };
    }

    // Step 7: Final Fallback to Admin Email
    logger.warn('Authority', `No issue_type or locality match found. Using default admin email.`, { mappedIssueType, locality: normalizedLocality, matchType: 'global_fallback' });
    console.log('WARN: No specific match. Using global fallback (admin).');
    return { email: DEFAULT_FALLBACK_EMAIL, name: 'System Admin', matchType: 'global_fallback' };
  } catch (err) {
    logger.error('Authority', 'resolveAuthority FAILED', { error: err.message, aiDepartment, locality, aiIssueType });
    console.error('resolveAuthority ERROR:', err.message);
    // ONLY use hardcoded fallback when the entire database query fails
    return { email: DEFAULT_FALLBACK_EMAIL, name: 'System Admin (Error Fallback)', matchType: 'error_fallback' };
  }
};

// ==========================================
// Smart Issue Merging System
// ==========================================

/**
 * Finds or creates a master issue for grouping similar reports.
 * Matches by issue_type + locality (partial, case-insensitive) + unresolved status.
 * Returns: { master_issue_id, total_reports, user_list, is_merged, priority_boost }
 */
const findMasterIssue = async (issueType, locationText, ward, newTicketId) => {
  const mergeResult = {
    master_issue_id: newTicketId, // Default: self is master
    total_reports: 1,
    user_list: [],
    is_merged: false,
    priority_boost: null
  };

  try {
    const normalizedLocation = (locationText || '').toLowerCase().trim();
    const normalizedType = (issueType || '').toLowerCase().trim();

    if (!normalizedType) return mergeResult;

    // Step 1: Find similar unresolved issues (same type, overlapping locality)
    const { data: candidates, error: queryErr } = await insforge.database
      .from('issues')
      .select('id, description, type, location_text, ward, user_id, master_issue_id, total_reports, priority, status, created_at')
      .neq('status', 'resolved')
      .neq('status', 'closed')
      .neq('id', newTicketId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (queryErr) {
      console.error('[MasterIssue] Query failed:', queryErr.message);
      return mergeResult;
    }

    if (!candidates || candidates.length === 0) {
      console.log('[MasterIssue] No existing issues to merge with. This issue is its own master.');
      return mergeResult;
    }

    // Step 2: Filter by type match (case-insensitive)
    const typeMatches = candidates.filter(c =>
      c.type && c.type.toLowerCase().trim() === normalizedType
    );

    if (typeMatches.length === 0) {
      console.log('[MasterIssue] No type matches found. This issue is its own master.');
      return mergeResult;
    }

    // Step 3: Filter by locality match (partial, case-insensitive)
    let localityMatches = typeMatches;
    if (normalizedLocation) {
      localityMatches = typeMatches.filter(c => {
        const cLoc = (c.location_text || '').toLowerCase().trim();
        const cWard = (c.ward || '').toLowerCase().trim();
        const nWard = (ward || '').toLowerCase().trim();
        // Match if locations overlap OR wards match
        return (
          (cLoc && normalizedLocation && (cLoc.includes(normalizedLocation) || normalizedLocation.includes(cLoc))) ||
          (nWard && cWard && cWard === nWard)
        );
      });
    }

    if (localityMatches.length === 0) {
      console.log('[MasterIssue] Type matched but locality did not. This issue is its own master.');
      return mergeResult;
    }

    // Step 4: Find the best master — prefer an existing master_issue_id, else pick the oldest/most reported
    let existingMaster = localityMatches.find(c => c.master_issue_id === c.id); // Already a master
    if (!existingMaster) {
      // Pick the one with highest total_reports, or oldest
      existingMaster = [...localityMatches].sort((a, b) => {
        const reportsA = a.total_reports || 1;
        const reportsB = b.total_reports || 1;
        if (reportsB !== reportsA) return reportsB - reportsA;
        return new Date(a.created_at) - new Date(b.created_at);
      })[0];
    }

    const masterId = existingMaster.master_issue_id || existingMaster.id;
    console.log('[MasterIssue] Found master issue:', masterId);

    // Step 5: Count all issues under this master
    const { data: groupedIssues, error: groupErr } = await insforge.database
      .from('issues')
      .select('id, user_id, location_text')
      .eq('master_issue_id', masterId);

    const allGrouped = groupedIssues || [];
    // +1 for the new issue being added
    const totalReports = allGrouped.length + 1;

    // Step 6: Fetch user details for the group
    const userIds = [...new Set(allGrouped.map(i => i.user_id).filter(Boolean))];
    let userList = [];
    if (userIds.length > 0) {
      const { data: users } = await insforge.database
        .from('users')
        .select('id, name, email, ward')
        .in('id', userIds);

      if (users) {
        userList = users.map(u => ({
          name: u.name || 'Citizen',
          email: u.email,
          locality: u.ward || 'Unknown'
        }));
      }
    }

    // Step 7: Determine priority boost
    let priorityBoost = null;
    if (totalReports >= 10) {
      priorityBoost = 'critical';
    } else if (totalReports >= 3) {
      priorityBoost = 'high';
    }

    // Step 8: Update the master issue's total_reports count
    try {
      await insforge.database
        .from('issues')
        .update({ total_reports: totalReports })
        .eq('id', masterId);
    } catch (updateErr) {
      console.error('[MasterIssue] Failed to update master total_reports:', updateErr.message);
    }

    // Step 9: If priority boost, also update master issue priority
    if (priorityBoost) {
      try {
        await insforge.database
          .from('issues')
          .update({ priority: priorityBoost })
          .eq('id', masterId);
        console.log(`[MasterIssue] Priority auto-boosted to "${priorityBoost}" for master ${masterId} (${totalReports} reports)`);
      } catch (boostErr) {
        console.error('[MasterIssue] Priority boost update failed:', boostErr.message);
      }
    }

    mergeResult.master_issue_id = masterId;
    mergeResult.total_reports = totalReports;
    mergeResult.user_list = userList;
    mergeResult.is_merged = true;
    mergeResult.priority_boost = priorityBoost;

    // Debug logging
    console.log('--- Smart Issue Merge Debug ---');
    console.log('Master Issue ID:', masterId);
    console.log('Total Reports:', totalReports);
    console.log('User List:', userList.slice(0, 5).map(u => `${u.name} (${u.locality})`).join(', '));
    if (userList.length > 5) console.log(`  ...and ${userList.length - 5} more users`);
    console.log('Priority Boost:', priorityBoost || 'none');

    return mergeResult;
  } catch (err) {
    console.error('[MasterIssue] Smart merge failed:', err.message);
    logger.error('MasterIssue', 'Smart merge failed', { error: err.message, issueType, locationText });
    return mergeResult;
  }
};

/**
 * Formats user list for display/email.
 * Shows first 5 users, then "...and X more users".
 */
const formatUserList = (userList, totalReports) => {
  if (!userList || userList.length === 0) return 'No additional reporters yet.';

  const displayed = userList.slice(0, 5);
  const lines = displayed.map((u, i) => `${i + 1}. ${u.name} (${u.locality})`);

  if (userList.length > 5) {
    lines.push(`...and ${userList.length - 5} more users`);
  }

  return lines.join('\n');
};

// ==========================================
// API Endpoints
// ==========================================

// 1. Create Issue
app.post('/api/issues/create', async (req, res) => {
  try {
    const { description, location_text, latitude, longitude, ward, image_url, image_urls, user_id } = req.body;

    if (!description || !location_text || !user_id) {
      return sendResponse(res, null, 'Missing required fields', 400);
    }

    // Call AI to classify the issue
    const classification = await classifyIssue(description);

    let aiSummary = classification.summary || description.substring(0, 50);
    let issueType = classification.type || 'Other';
    let priority = classification.priority || 'medium';
    let department = classification.department || 'Municipal Corporation';
    let eta = classification.estimated_resolution || '48 hours';
    let confidence = classification.confidence || 50;

    // Fallback: If AI returned defaults (confidence=50), try keyword-based classification from description
    if (confidence <= 50 && (issueType === 'Other' || department === 'Municipal Corporation')) {
      const descLower = description.toLowerCase();
      const keywordMap = [
        { keywords: ['road', 'pothole', 'crack', 'broken road', 'highway', 'street damage'], type: 'Road', dept: 'PWD' },
        { keywords: ['water', 'leak', 'pipeline', 'pipe burst', 'flooding', 'water supply'], type: 'Water', dept: 'KMC Water Supply' },
        { keywords: ['garbage', 'trash', 'waste', 'dump', 'sanitation', 'smell', 'dirty'], type: 'Garbage', dept: 'Sanitation Dept' },
        { keywords: ['light', 'electric', 'power', 'wire', 'streetlight', 'lamp', 'bulb'], type: 'Electric', dept: 'CESC' },
        { keywords: ['sewer', 'drain', 'drainage', 'sewerage', 'overflow'], type: 'Sewer', dept: 'Municipal Corporation' },
      ];
      for (const entry of keywordMap) {
        if (entry.keywords.some(kw => descLower.includes(kw))) {
          issueType = entry.type;
          department = entry.dept;
          confidence = 40; // Mark as keyword-based
          console.log(`[Fallback Classification] Description keywords matched: type="${issueType}", dept="${department}"`);
          logger.info('AI', 'Fallback keyword classification applied', { issueType, department });
          break;
        }
      }
    }

    // Checking for duplicates intelligently via AI
    const dupResult = await duplicateDetector(issueType, ward, description);
    logger.info('AI', 'Issue classified and duplicate check complete', { issueType, priority, department, confidence, isDuplicate: dupResult.is_duplicate });

    // Generate ticket ID
    const ticketId = generateTicketId();

    const newIssue = {
      id: ticketId,
      user_id: user_id,
      description,
      type: issueType,
      priority,
      department,
      location_text,
      latitude,
      longitude,
      ward,
      image_urls: image_urls && image_urls.length > 0 ? image_urls : (image_url ? [image_url] : null),
      ai_summary: aiSummary,
      ai_confidence: confidence,
      estimated_resolution: eta,
      is_duplicate: dupResult.is_duplicate,
      parent_issue_id: dupResult.parent_issue_id,
      master_issue_id: ticketId,  // Default: self is master (updated after insert by merge logic)
      total_reports: 1
    };

    // Insert Issue
    const { error: insertIssueErr } = await insforge.database
      .from('issues')
      .insert([newIssue]);

    if (insertIssueErr) throw insertIssueErr;

    // === SMART ISSUE MERGING ===
    let mergeData = { master_issue_id: ticketId, total_reports: 1, user_list: [], is_merged: false, priority_boost: null };
    try {
      mergeData = await findMasterIssue(issueType, location_text, ward, ticketId);

      // Update this issue's master_issue_id if merged into an existing master
      if (mergeData.is_merged && mergeData.master_issue_id !== ticketId) {
        await insforge.database
          .from('issues')
          .update({ master_issue_id: mergeData.master_issue_id })
          .eq('id', ticketId);

        logger.info('MasterIssue', `Issue ${ticketId} merged into master ${mergeData.master_issue_id}`, {
          totalReports: mergeData.total_reports,
          priorityBoost: mergeData.priority_boost
        });
      }

      // Apply priority boost to the new issue if applicable
      if (mergeData.priority_boost) {
        priority = mergeData.priority_boost;
        await insforge.database
          .from('issues')
          .update({ priority: mergeData.priority_boost })
          .eq('id', ticketId);
      }

      // Add timeline event for merge
      if (mergeData.is_merged) {
        await insforge.database
          .from('timeline_events')
          .insert([{
            issue_id: ticketId,
            message: `This issue was merged with master issue ${mergeData.master_issue_id}. Total reports for this problem: ${mergeData.total_reports}.`,
            event_type: 'updated',
            created_by: 'system'
          }]);
      }
    } catch (mergeErr) {
      console.error('[MasterIssue] Merge integration failed (non-fatal):', mergeErr.message);
      logger.error('MasterIssue', 'Merge integration failed (non-fatal)', { error: mergeErr.message, ticketId });
    }

    // Before inserting timeline, if it IS a duplicate, we must increment the parent's upvotes and trigger bulk alert
    if (dupResult.is_duplicate && dupResult.parent_issue_id) {
      try {
        const { data: parentIssue } = await insforge.database
          .from('issues')
          .select('upvotes, department, ward, type, priority, location_text, description')
          .eq('id', dupResult.parent_issue_id)
          .single();

        if (parentIssue) {
          const currentUpvotes = (parentIssue.upvotes || 0) + 1;
          await insforge.database
            .from('issues')
            .update({ upvotes: currentUpvotes })
            .eq('id', dupResult.parent_issue_id);

          // Bulk Reporting Smart Dispatch: Only trigger on specific thresholds to prevent spam
          // e.g., 2, 5, 10, 50
          const thresholds = [2, 5, 10, 25, 50];
          if (thresholds.includes(currentUpvotes)) {
            let bulkAuth = await resolveAuthority(parentIssue.department, parentIssue.location_text || parentIssue.ward || ward, parentIssue.type);
            let targetEmail = bulkAuth.email;
            console.log('Bulk dispatch → authority:', targetEmail, '| matchType:', bulkAuth.matchType);

            const bulkSubject = `[URGENT BULK REPORT] Reported by ${currentUpvotes} citizens: ${parentIssue.type}`;
            const bulkBody = `
              <h2>CRITICAL: Multiple Reports Detected</h2>
              <p>This same issue has now been reported by <strong>${currentUpvotes} citizens</strong>.</p>
              <p><strong>Priority:</strong> <span style="color:red; font-weight:bold;">${parentIssue.priority}</span></p>
              <p><strong>Location:</strong> ${parentIssue.location_text}</p>
              <p><strong>Original Description:</strong> ${parentIssue.description}</p>
              <br/>
              <p>Please address this cluster immediately.</p>
           `;
            sendDispatchEmail(insforge, targetEmail, bulkSubject, bulkBody, dupResult.parent_issue_id, 0).catch(err => logger.error('BulkDispatch', 'Failed to send bulk email', { error: err.message, parentId: dupResult.parent_issue_id }));
          }
        }
      } catch (err) {
        logger.error('Duplicate', 'Failed to increment parent upvotes or dispatch bulk email', { error: err.message, parentId: dupResult.parent_issue_id });
      }
    }

    // Insert Timeline Event
    const { error: eventErr } = await insforge.database
      .from('timeline_events')
      .insert([{
        issue_id: ticketId,
        message: 'Issue reported and classified by AI',
        event_type: 'created',
        created_by: 'system'
      }]);

    if (eventErr) throw eventErr;

    // Publish Realtime Event
    insforge.realtime.publish('issues:feed', 'issue_update', { action: 'created', ticketId }).catch(err => logger.error('Realtime', 'Failed to publish event', { error: err.message, ticketId }));

    // === NOTIFICATION: ISSUE_SUBMITTED ===
    createNotification({
      type: NOTIF_TYPES.ISSUE_SUBMITTED,
      title: 'Issue Submitted Successfully',
      message: `Your issue #${ticketId} has been submitted and classified as "${issueType}" with ${priority} priority.`,
      issue_id: ticketId,
      user_id: user_id,
      channel: 'in_app'
    }).catch(err => logger.error('Notification', 'Failed to create ISSUE_SUBMITTED notification', { error: err.message, ticketId }));

    // === MERGED EMAIL DISPATCH SYSTEM ===
    try {
      console.log('--- Merged Email Dispatch Debug ---');
      console.log('AI Output:', { issueType, department, priority, confidence });
      console.log('Merge Data:', { master_issue_id: mergeData.master_issue_id, total_reports: mergeData.total_reports, is_merged: mergeData.is_merged });

      const effectiveMasterId = mergeData.master_issue_id || ticketId;
      const totalReports = mergeData.total_reports || 1;
      const userList = mergeData.user_list || [];

      // Step 1: Check if email was already sent recently for this master issue (prevent duplicates)
      let skipEmail = false;
      if (mergeData.is_merged && effectiveMasterId !== ticketId) {
        try {
          const { data: recentLogs } = await insforge.database
            .from('email_logs')
            .select('id, sent_at, status')
            .eq('issue_id', effectiveMasterId)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(1);

          if (recentLogs && recentLogs.length > 0) {
            const lastSent = new Date(recentLogs[0].sent_at);
            const minutesSinceLastSend = (Date.now() - lastSent.getTime()) / (1000 * 60);
            // Skip if email was sent in the last 30 minutes for this master issue
            if (minutesSinceLastSend < 30) {
              console.log(`[MergedEmail] Skipping duplicate email — last sent ${Math.round(minutesSinceLastSend)}min ago for master ${effectiveMasterId}`);
              skipEmail = true;
            }
          }
        } catch (logCheckErr) {
          console.error('[MergedEmail] Failed to check recent logs (continuing):', logCheckErr.message);
        }
      }

      // Step 2: Resolve authority
      const mappedType = mapDepartmentToIssueType(department, issueType);
      console.log('Mapped Issue Type:', mappedType);
      console.log('Detected Locality:', location_text);

      logger.info('SmartRouting', `Finding authority for mappedType: ${mappedType}, locality: ${location_text}`);
      const authority = await resolveAuthority(department, location_text, issueType);

      console.log('Matched Authority:', authority);
      console.log('Sending to:', authority?.email);
      console.log('Total Users:', totalReports);

      const targetEmail = authority.email;
      logger.info('SmartRouting', `Using authority email: ${targetEmail}`, { mappedType, locality: location_text, matchType: authority.matchType });

      // === NOTIFICATION: AUTHORITY_DETECTED ===
      createNotification({
        type: NOTIF_TYPES.AUTHORITY_DETECTED,
        title: 'Authority Identified',
        message: `Your issue #${ticketId} has been routed to ${authority.name || department}. Authority contact: ${targetEmail}`,
        issue_id: ticketId,
        user_id: user_id,
        channel: 'in_app'
      }).catch(err => logger.error('Notification', 'Failed to create AUTHORITY_DETECTED notification', { error: err.message, ticketId }));

      if (!skipEmail) {
        // Step 3: Generate merged email subject
        let emailSubject;
        if (totalReports > 5) {
          emailSubject = `🚨 URGENT: ${issueType} Issue Reported by ${totalReports} Citizens — ${location_text || ward || 'Your Area'}`;
        } else if (totalReports > 1) {
          emailSubject = `⚠️ Civic Issue: ${issueType} — ${totalReports} Reports — ${location_text || ward || 'Your Area'}`;
        } else {
          emailSubject = `⚠️ Civic Issue Reported: ${issueType} in ${location_text || ward || 'Your Area'}`;
        }

        // Step 4: Determine effective priority for display
        let displayPriority = priority;
        let priorityColor = '#f59e0b';
        if (totalReports >= 10 || priority === 'critical') {
          displayPriority = 'CRITICAL';
          priorityColor = '#dc2626';
        } else if (totalReports >= 3 || priority === 'high') {
          displayPriority = 'HIGH';
          priorityColor = '#ea580c';
        } else if (priority === 'medium') {
          displayPriority = 'MEDIUM';
          priorityColor = '#f59e0b';
        } else {
          displayPriority = 'LOW';
          priorityColor = '#22c55e';
        }

        // Step 5: Format user list for the email
        const displayedUsers = userList.slice(0, 5);
        let userListHtml = '';
        if (displayedUsers.length > 0) {
          userListHtml = displayedUsers.map((u, i) =>
            `<li style="padding: 4px 0; color: #374151;">${i + 1}. <strong>${u.name}</strong> (${u.locality})</li>`
          ).join('');
          if (userList.length > 5) {
            userListHtml += `<li style="padding: 4px 0; color: #6b7280; font-style: italic;">...and ${userList.length - 5} more citizens</li>`;
          }
        }

        // Step 6: Generate merged email body (professional HTML)
        const emailBody = `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 28px 32px;">
            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">⚡ Issue2Action</h1>
            <p style="margin: 8px 0 0; color: #e0e7ff; font-size: 14px;">Smart Civic Issue Management Platform</p>
          </div>

          <!-- Priority Banner -->
          <div style="background: ${priorityColor}15; border-left: 4px solid ${priorityColor}; padding: 16px 32px; display: flex; align-items: center;">
            <span style="font-size: 14px; font-weight: 700; color: ${priorityColor}; text-transform: uppercase; letter-spacing: 1px;">
              ● PRIORITY: ${displayPriority}
            </span>
            ${totalReports > 1 ? `<span style="margin-left: 16px; background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${totalReports} REPORTS</span>` : ''}
          </div>

          <!-- Body -->
          <div style="padding: 32px;">
            <!-- Issue Details -->
            <h2 style="margin: 0 0 20px; color: #111827; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
              📋 Issue Details
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 12px; background: #f9fafb; color: #6b7280; font-size: 13px; font-weight: 600; width: 140px; border: 1px solid #e5e7eb;">Issue Type</td>
                <td style="padding: 10px 12px; color: #111827; font-size: 14px; border: 1px solid #e5e7eb;">${issueType}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; background: #f9fafb; color: #6b7280; font-size: 13px; font-weight: 600; border: 1px solid #e5e7eb;">Location</td>
                <td style="padding: 10px 12px; color: #111827; font-size: 14px; border: 1px solid #e5e7eb;">${location_text || 'Not specified'}${ward ? ` (Ward: ${ward})` : ''}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; background: #f9fafb; color: #6b7280; font-size: 13px; font-weight: 600; border: 1px solid #e5e7eb;">Department</td>
                <td style="padding: 10px 12px; color: #111827; font-size: 14px; border: 1px solid #e5e7eb;">${department}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; background: #f9fafb; color: #6b7280; font-size: 13px; font-weight: 600; border: 1px solid #e5e7eb;">Ticket ID</td>
                <td style="padding: 10px 12px; color: #111827; font-size: 14px; font-family: monospace; border: 1px solid #e5e7eb;">${effectiveMasterId}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; background: #f9fafb; color: #6b7280; font-size: 13px; font-weight: 600; border: 1px solid #e5e7eb;">ETA</td>
                <td style="padding: 10px 12px; color: #111827; font-size: 14px; border: 1px solid #e5e7eb;">${eta || '48 hours'}</td>
              </tr>
            </table>

            <!-- Description -->
            <h3 style="margin: 0 0 10px; color: #374151; font-size: 15px;">📝 Description</h3>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${description}</p>
            </div>

            ${totalReports > 1 ? `
            <!-- Citizen Impact -->
            <h3 style="margin: 0 0 10px; color: #374151; font-size: 15px;">👥 Citizen Impact (${totalReports} Reports)</h3>
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px; color: #92400e; font-size: 14px; font-weight: 600;">
                This issue has been independently reported by <strong>${totalReports} citizens</strong>, indicating a widespread problem requiring immediate attention.
              </p>
              ${userListHtml ? `
              <p style="margin: 0 0 8px; color: #78350f; font-size: 13px; font-weight: 600;">Reporting Citizens:</p>
              <ul style="margin: 0; padding-left: 0; list-style: none;">
                ${userListHtml}
              </ul>
              ` : ''}
            </div>
            ` : ''}

            <!-- Required Action -->
            <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 8px; color: #1e40af; font-size: 15px;">🔧 Required Action</h3>
              <p style="margin: 0; color: #1e3a5f; font-size: 14px; line-height: 1.6;">
                Please investigate and resolve this ${issueType.toLowerCase()} issue at the earliest. 
                ${totalReports >= 3 ? 'Given the volume of citizen complaints, this requires <strong>urgent priority handling</strong>.' : 'Citizens are awaiting resolution.'}
              </p>
            </div>

            ${totalReports >= 5 ? `
            <!-- Escalation Warning -->
            <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 8px; color: #991b1b; font-size: 15px;">⚠️ Escalation Warning</h3>
              <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.6;">
                This issue has received <strong>${totalReports} independent complaints</strong>. If not addressed within ${eta || '48 hours'}, 
                it will be automatically escalated to higher authorities and the municipal commission office.
              </p>
            </div>
            ` : ''}
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center;">
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px;">This is an automated notification from Issue2Action civic platform.</p>
            <p style="margin: 0; color: #9ca3af; font-size: 11px;">Master Ticket: ${effectiveMasterId} | Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          </div>
        </div>`;

        // Step 7: Send email
        console.log('========================================');
        console.log('  MERGED EMAIL DISPATCH');
        console.log('========================================');
        console.log('Sending to:', targetEmail);
        console.log('Total Users:', totalReports);
        console.log('Master Issue:', effectiveMasterId);
        console.log('Subject:', emailSubject);

        sendDispatchEmail(insforge, targetEmail, emailSubject, emailBody, effectiveMasterId, 0, totalReports)
          .then(async (result) => {
            const emailStatus = result.success ? 'sent' : 'failed';
            console.log('Email Status:', emailStatus);

            if (result.success) {
              console.log('✅ Merged email dispatched successfully to:', targetEmail);

              // === UPDATE STATUS: email_sent ===
              // Update the current issue status
              try {
                await insforge.database
                  .from('issues')
                  .update({ status: 'email_sent', updated_at: new Date().toISOString() })
                  .eq('id', ticketId);
                console.log(`[Status] Issue ${ticketId} status → email_sent`);

                // Also update the master issue status if different
                if (effectiveMasterId !== ticketId) {
                  await insforge.database
                    .from('issues')
                    .update({ status: 'email_sent', updated_at: new Date().toISOString() })
                    .eq('id', effectiveMasterId);
                  console.log(`[Status] Master issue ${effectiveMasterId} status → email_sent`);
                }
              } catch (statusErr) {
                console.error('[Status] Failed to update issue status to email_sent:', statusErr.message);
                logger.error('MergedEmail', 'Failed to update status to email_sent', { error: statusErr.message, ticketId, effectiveMasterId });
              }

              // === NOTIFICATION: EMAIL_SENT ===
              createNotification({
                type: NOTIF_TYPES.EMAIL_SENT,
                title: 'Authority Notified via Email',
                message: `An official merged email (${totalReports} reports) has been dispatched to ${authority.name || department} (${targetEmail}) regarding issue #${effectiveMasterId}.`,
                issue_id: ticketId,
                user_id: user_id,
                channel: 'in_app'
              }).catch(err => logger.error('Notification', 'Failed to create EMAIL_SENT notification', { error: err.message, ticketId }));

              // Add a timeline event for the merged email
              await insforge.database
                .from('timeline_events')
                .insert([{
                  issue_id: effectiveMasterId,
                  message: totalReports > 1
                    ? `Merged email sent to ${authority.name || department} (${targetEmail}) covering ${totalReports} citizen reports.`
                    : `Email dispatched to ${authority.name || department} (${targetEmail}).`,
                  event_type: 'updated',
                  created_by: 'system'
                }]).catch(() => { });

            } else {
              console.error('❌ Email dispatch returned failure for:', targetEmail);
              logger.error('MergedEmailDispatch', 'sendDispatchEmail returned failure', { error: result.error, ticketId, targetEmail, totalReports });
            }

            console.log('========================================');
          })
          .catch(err => {
            console.error('❌ Merged email dispatch failed to:', targetEmail, err.message);
            console.log('Email Status: failed');
            logger.error('MergedEmailDispatch', 'Merged email dispatch failed', { error: err.message, ticketId, targetEmail, totalReports });
          });
      } else {
        console.log('========================================');
        console.log('  EMAIL SKIPPED (DUPLICATE PREVENTION)');
        console.log('========================================');
        console.log(`[MergedEmail] Email skipped — last sent recently for master ${effectiveMasterId}`);
        console.log('Sending to:', targetEmail);
        console.log('Total Users:', totalReports);
        console.log('Email Status: skipped (recent send exists)');

        // Still notify the user their issue was merged
        createNotification({
          type: NOTIF_TYPES.EMAIL_SENT,
          title: 'Issue Merged — Authority Already Notified',
          message: `Your issue #${ticketId} has been merged with master issue #${effectiveMasterId}. The authority has already been notified (${totalReports} total reports).`,
          issue_id: ticketId,
          user_id: user_id,
          channel: 'in_app'
        }).catch(err => logger.error('Notification', 'Failed to create merge notification', { error: err.message, ticketId }));
      }

    } catch (dispatchErr) {
      console.error('❌ Merged email dispatch pipeline FAILED:', dispatchErr.message);
      logger.error('MergedEmailDispatch', 'Merged email dispatch pipeline failed', { error: dispatchErr.message, ticketId });
    }

    return sendResponse(res, {
      ticket_id: ticketId,
      type: issueType,
      priority,
      department,
      eta,
      summary: aiSummary,
      confidence,
      is_duplicate: dupResult.is_duplicate,
      similarity_score: dupResult.similarity_score,
      similar_count: dupResult.similar_count,
      master_issue_id: mergeData.master_issue_id,
      total_reports: mergeData.total_reports,
      is_merged: mergeData.is_merged,
      priority_boost: mergeData.priority_boost
    });
  } catch (error) {
    logger.error('CreateIssue', 'Issue creation failed', { error: error.message, stack: error.stack });
    return sendResponse(res, null, error.message || 'Internal Server Error', 500);
  }
});

// 5a. Get Grouped Users for a Master Issue
app.get('/api/issues/:ticketId/grouped', async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Find the master issue (could be the ticket itself or its master)
    const { data: issue, error: issueErr } = await insforge.database
      .from('issues')
      .select('id, master_issue_id, total_reports, type, priority, location_text, ward, status')
      .eq('id', ticketId)
      .single();

    if (issueErr || !issue) {
      return sendResponse(res, null, 'Issue not found', 404);
    }

    const masterId = issue.master_issue_id || issue.id;

    // Get all issues under this master
    const { data: groupedIssues, error: groupErr } = await insforge.database
      .from('issues')
      .select('id, user_id, description, location_text, ward, priority, status, created_at')
      .eq('master_issue_id', masterId)
      .order('created_at', { ascending: true });

    if (groupErr) throw groupErr;

    const allIssues = groupedIssues || [];
    const totalReports = allIssues.length;

    // Get user details
    const userIds = [...new Set(allIssues.map(i => i.user_id).filter(Boolean))];
    let userList = [];

    if (userIds.length > 0) {
      const { data: users } = await insforge.database
        .from('users')
        .select('id, name, email, ward')
        .in('id', userIds);

      if (users) {
        userList = users.map(u => ({
          name: u.name || 'Citizen',
          email: u.email,
          locality: u.ward || 'Unknown'
        }));
      }
    }

    // Format display list
    const displayList = formatUserList(userList, totalReports);

    // Determine current effective priority
    let effectivePriority = issue.priority;
    if (totalReports >= 10) effectivePriority = 'critical';
    else if (totalReports >= 3) effectivePriority = 'high';

    console.log('--- Grouped Issue Debug ---');
    console.log('Master Issue ID:', masterId);
    console.log('Total Reports:', totalReports);
    console.log('User List:', displayList);

    return sendResponse(res, {
      master_issue_id: masterId,
      total_reports: totalReports,
      effective_priority: effectivePriority,
      user_list: userList,
      user_list_formatted: displayList,
      related_issues: allIssues.map(i => ({
        id: i.id,
        description: i.description?.substring(0, 100),
        location: i.location_text,
        status: i.status,
        created_at: i.created_at
      }))
    });
  } catch (error) {
    logger.error('GroupedIssues', 'Failed to fetch grouped issues', { error: error.message, ticketId: req.params.ticketId });
    return sendResponse(res, null, error.message, 500);
  }
});

// 5. Get Public Mapping Issues
app.get('/api/issues/public', async (req, res) => {
  try {
    const { ward, type, status, time, limit = 50 } = req.query;

    // InsForge readiness is now handled by global middleware

    let query = insforge.database
      .from('issues')
      .select('id, description, type, priority, status, location_text, latitude, longitude, upvotes, created_at, email_logs(status)')
      .limit(parseInt(limit, 10))
      .order('created_at', { ascending: false });

    if (ward) query = query.eq('ward', ward);
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);

    if (time && time !== 'all') {
      const now = new Date();
      if (time === 'today') {
        now.setHours(now.getHours() - 24);
      } else if (time === 'week') {
        now.setDate(now.getDate() - 7);
      } else if (time === 'month') {
        now.setMonth(now.getMonth() - 1);
      }
      query = query.gte('created_at', now.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const mappedData = data.map(issue => {
      const isNotified = issue.email_logs && issue.email_logs.some(log => log.status === 'sent');
      const { email_logs, ...rest } = issue;
      return { ...rest, authority_notified: isNotified };
    });

    return sendResponse(res, mappedData);
  } catch (error) {
    logger.error('PublicIssues', 'Failed to fetch public issues', { error: error.message });
    return sendResponse(res, null, error.message, 500);
  }
});

// 2. Get Issue by Ticket ID
app.get('/api/issues/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const { data: issue, error: issueErr } = await insforge.database
      .from('issues')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (issueErr || !issue) {
      return sendResponse(res, null, 'Issue not found', 404);
    }

    const { data: timeline, error: timelineErr } = await insforge.database
      .from('timeline_events')
      .select('*')
      .eq('issue_id', ticketId)
      .order('created_at', { ascending: false });

    return sendResponse(res, { ...issue, timeline: timeline || [] });
  } catch (error) {
    logger.error('GetIssue', 'Failed to fetch issue', { error: error.message, ticketId: req.params.ticketId });
    return sendResponse(res, null, error.message, 500);
  }
});

// 3. Patch Issue Status
app.patch('/api/issues/:ticketId/status', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, message, updated_by } = req.body;

    if (!status || !message) {
      return sendResponse(res, null, 'Status and message are required', 400);
    }
    // Auth role check should be injected in middleware, bypassing for now

    // Update the issue
    const { error: updateErr } = await insforge.database
      .from('issues')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    if (updateErr) throw updateErr;

    // Add timeline event
    const { error: timelineErr } = await insforge.database
      .from('timeline_events')
      .insert([{
        issue_id: ticketId,
        message: message,
        event_type: 'updated',
        created_by: updated_by || 'authority'
      }]);

    if (timelineErr) throw timelineErr;

    // Publish Realtime Event
    insforge.realtime.publish('issues:feed', 'issue_update', { action: 'status_updated', ticketId, status }).catch(err => logger.error('Realtime', 'Failed to publish status update', { error: err.message, ticketId }));

    // Trigger the notification service
    await sendNotification(ticketId, status);
    logger.info('StatusUpdate', `Issue ${ticketId} status updated to ${status}`, { ticketId, status });

    return sendResponse(res, { message: 'Status updated successfully' });
  } catch (error) {
    logger.error('StatusUpdate', 'Failed to update status', { error: error.message, ticketId: req.params.ticketId });
    return sendResponse(res, null, error.message, 500);
  }
});

// Authority Response Endpoint
app.post('/api/issues/:ticketId/authority-reply', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, message, authority_email } = req.body;

    if (status) {
      await insforge.database.from('issues').update({ status }).eq('id', ticketId);
    }

    await insforge.database.from('timeline_events').insert([{
      issue_id: ticketId,
      message: message,
      event_type: 'authority_reply',
      created_by: authority_email || 'Authority'
    }]);

    if (authority_email) {
      await insforge.database.from('email_logs')
        .update({ response_received: true })
        .eq('issue_id', ticketId)
        .eq('authority_email', authority_email);
    }

    insforge.realtime.publish('issues:feed', 'issue_update', { action: 'authority_reply', ticketId, status }).catch(err => logger.error('Realtime', 'Failed to publish authority reply', { error: err.message, ticketId }));

    return sendResponse(res, { success: true });
  } catch (error) {
    logger.error('AuthorityReply', 'Failed to process authority reply', { error: error.message, ticketId: req.params.ticketId });
    return sendResponse(res, null, error.message, 500);
  }
});

// User Reply Endpoint
app.post('/api/issues/:ticketId/reply', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, user_id } = req.body;

    if (!message || !user_id) {
      return sendResponse(res, null, 'Message and user ID required', 400);
    }

    // Add timeline event
    const { error: timelineErr } = await insforge.database
      .from('timeline_events')
      .insert([{
        issue_id: ticketId,
        message: message,
        event_type: 'user_reply',
        created_by: 'system' // or pass user type
      }]);

    if (timelineErr) throw timelineErr;

    // Trigger notification to authority if needed
    // Not strictly required for the assignment, but we publish realtime event to UI
    insforge.realtime.publish('issues:feed', 'issue_update', { action: 'user_reply', ticketId }).catch(err => logger.error('Realtime', 'Failed to publish user reply', { error: err.message, ticketId }));

    return sendResponse(res, { success: true });
  } catch (error) {
    logger.error('UserReply', 'Failed to process user reply', { error: error.message, ticketId: req.params.ticketId });
    return sendResponse(res, null, error.message, 500);
  }
});

// 4. Upvote Issue
app.post('/api/issues/:ticketId/upvote', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { user_id } = req.body;

    if (!user_id) return sendResponse(res, null, 'User ID missing', 400);

    // Insert to Upvotes (Ignored duplicate logic since UNIQUE combo in DB)
    const { error: upvoteErr } = await insforge.database
      .from('upvotes')
      .insert([{ issue_id: ticketId, user_id }])
      // This will throw error if duplicate constraint hits, so handle it
      .select();

    if (upvoteErr && upvoteErr.code === '23505') {
      return sendResponse(res, null, 'Already upvoted', 400);
    } else if (upvoteErr) {
      throw upvoteErr;
    }

    // Increment upvotes in issue using RPC or fetching and updating
    // Fetching the current upvote safely is ideal for standard SDK, unless we have RPC
    const { data: issue, error: getErr } = await insforge.database
      .from('issues')
      .select('upvotes, priority')
      .eq('id', ticketId)
      .single();

    if (getErr || !issue) throw getErr || new Error('Issue missing');

    const newUpvotes = (issue.upvotes || 0) + 1;
    let newPriority = issue.priority;

    // Check upgrade priority
    if (newUpvotes > 10 && issue.priority === 'low') {
      newPriority = 'medium';
    }

    const { error: updateErr } = await insforge.database
      .from('issues')
      .update({ upvotes: newUpvotes, priority: newPriority })
      .eq('id', ticketId);

    if (updateErr) throw updateErr;

    // Publish Realtime Event
    insforge.realtime.publish('issues:feed', 'issue_update', { action: 'upvoted', ticketId, upvotes: newUpvotes }).catch(err => logger.error('Realtime', 'Failed to publish upvote', { error: err.message, ticketId }));

    return sendResponse(res, { upvotes: newUpvotes });
  } catch (error) {
    logger.error('Upvote', 'Failed to process upvote', { error: error.message, ticketId: req.params.ticketId });
    return sendResponse(res, null, error.message, 500);
  }
});



// 6. Get Users specific issues
app.get('/api/users/:userId/issues', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await insforge.database
      .from('issues')
      .select('id, status, type, priority, created_at, description, location_text, ward, upvotes, email_logs(status)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mappedData = data.map(issue => {
      const isNotified = issue.email_logs && issue.email_logs.some(log => log.status === 'sent');
      const { email_logs, ...rest } = issue;
      return { ...rest, authority_notified: isNotified };
    });

    return sendResponse(res, mappedData);
  } catch (error) {
    logger.error('UserIssues', 'Failed to fetch user issues', { error: error.message, userId: req.params.userId });
    return sendResponse(res, null, error.message, 500);
  }
});

// User Notifications
app.get('/api/users/:userId/notifications', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await insforge.database
      .from('notifications')
      .select('id, issue_id, type, title, channel, message, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return sendResponse(res, data);
  } catch (error) {
    logger.error('Notifications', 'Failed to fetch notifications', { error: error.message, userId: req.params.userId });
    return sendResponse(res, null, error.message, 500);
  }
});

// Unread Notification Count
app.get('/api/users/:userId/notifications/unread-count', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await insforge.database
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    return sendResponse(res, { count: data ? data.length : 0 });
  } catch (error) {
    logger.error('Notifications', 'Failed to fetch unread count', { error: error.message, userId: req.params.userId });
    return sendResponse(res, null, error.message, 500);
  }
});

app.patch('/api/users/:userId/notifications/:notifId/read', async (req, res) => {
  try {
    const { notifId, userId } = req.params;
    const { error } = await insforge.database
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId)
      .eq('user_id', userId);

    if (error) throw error;
    return sendResponse(res, { success: true });
  } catch (error) {
    logger.error('Notifications', 'Failed to mark notification as read', { error: error.message, notifId: req.params.notifId });
    return sendResponse(res, null, error.message, 500);
  }
});

app.post('/api/users/:userId/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.params;
    const { error } = await insforge.database
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) throw error;
    return sendResponse(res, { success: true });
  } catch (error) {
    logger.error('Notifications', 'Failed to mark all notifications as read', { error: error.message, userId: req.params.userId });
    return sendResponse(res, null, error.message, 500);
  }
});

// 7. Store support messages
app.post('/api/support/message', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return sendResponse(res, null, 'Missing required fields', 400);
    }

    const { error } = await insforge.database
      .from('support_messages')
      .insert([{ name, email, message }]);

    if (error) throw error;

    // Mock Mailer Logic
    logger.info('Support', `Support message received from ${email}`);

    return sendResponse(res, { success: true, message: 'Support message received' });
  } catch (error) {
    logger.error('Support', 'Failed to store support message', { error: error.message });
    return sendResponse(res, null, error.message, 500);
  }
});

// 8. Test Notification Pipeline
app.post('/api/notify/test', async (req, res) => {
  try {
    const { issue_id } = req.body;
    if (!issue_id) return sendResponse(res, null, 'issue_id is required', 400);

    const { data: issue } = await insforge.database
      .from('issues')
      .select('status')
      .eq('id', issue_id)
      .single();

    if (!issue) return sendResponse(res, null, 'Issue not found', 404);

    const result = await sendNotification(issue_id, issue.status);
    if (!result) return sendResponse(res, null, 'Notification Pipeline failed internally', 500);

    return sendResponse(res, { success: true, data: result, message: 'Notification test successful' });
  } catch (error) {
    logger.error('NotificationTest', 'Notification test failed', { error: error.message, issue_id: req.body.issue_id });
    return sendResponse(res, null, error.message, 500);
  }
});

// Follow-up ESCALATION Endpoint
app.post('/api/cron/escalate', async (req, res) => {
  try {
    // 1. Find emails sent > 24 hours ago where response is not received and issue isn't resolved
    // Since SQL requires date math, we'll fetch all unresolved and filter in JS if needed
    // Or we just query email_logs that are pending/sent and old
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { data: logs, error: logsErr } = await insforge.database
      .from('email_logs')
      .select('id, issue_id, authority_email, escalation_level, sent_at')
      .eq('response_received', false)
      .lte('sent_at', yesterday.toISOString());

    if (logsErr) throw logsErr;

    if (!logs || logs.length === 0) {
      return sendResponse(res, { message: 'No emails to escalate.' });
    }

    const escalatedLogs = [];

    for (const log of logs) {
      // Check if original issue is still unresolved
      const { data: issue } = await insforge.database
        .from('issues')
        .select('*')
        .eq('id', log.issue_id)
        .single();

      if (!issue || issue.status === 'resolved' || issue.status === 'closed') {
        // Mark as no longer needing escalation
        await insforge.database.from('email_logs').update({ response_received: true }).eq('id', log.id);
        continue;
      }

      // Time to escalate! Find a higher priority authority
      const nextLevel = (log.escalation_level || 0) + 1;

      const escalationAuthority = await resolveAuthority(issue.department, issue.location_text || issue.ward, issue.type, nextLevel);
      let targetEmail = escalationAuthority.email;
      console.log('Escalation authority resolved:', targetEmail, '| matchType:', escalationAuthority.matchType);
      // If the resolver fell back to error/fallback, keep the original authority email
      if (escalationAuthority.matchType === 'error_fallback' || escalationAuthority.matchType === 'fallback') {
        targetEmail = log.authority_email;
        console.log('Escalation: keeping original authority email:', targetEmail);
      }

      const subject = `[URGENT REMINDER/ESCALATION] Civic Issue Reported: ${issue.type} in ${issue.ward}`;
      const htmlBody = `
        <h2 style="color:red;">Escalation Level: ${nextLevel}</h2>
        <p>This is a formal automated reminder. A severe civic issue was reported ${nextLevel} days ago and remains unresolved.</p>
        <p><strong>Priority:</strong> ${issue.priority}</p>
        <p><strong>Location:</strong> ${issue.location_text}</p>
        <p><strong>Description:</strong> ${issue.description}</p>
        <p>Please log in to the portal and update the ticket status immediately.</p>
      `;

      await sendDispatchEmail(insforge, targetEmail, subject, htmlBody, issue.id, nextLevel);

      // === NOTIFICATION: ISSUE_ESCALATED ===
      if (issue.user_id) {
        createNotification({
          type: NOTIF_TYPES.ISSUE_ESCALATED,
          title: 'Issue Escalated ⚠️',
          message: `Your issue #${issue.id} has been escalated to level ${nextLevel} due to no response from the authority.`,
          issue_id: issue.id,
          user_id: issue.user_id,
          channel: 'in_app'
        }).catch(err => logger.error('Notification', 'Failed to create ISSUE_ESCALATED notification', { error: err.message, issueId: issue.id }));
      }

      // Update original log as well
      await insforge.database.from('email_logs').update({ escalation_level: nextLevel, sent_at: new Date().toISOString() }).eq('id', log.id);
      escalatedLogs.push(log.id);
    }

    return sendResponse(res, { message: 'Escalated ' + escalatedLogs.length + ' issues.' });
  } catch (error) {
    logger.error('Escalation', 'Escalation cron failed', { error: error.message });
    return sendResponse(res, null, error.message, 500);

  }
});

// 10. Admin Authority Endpoints
app.get('/api/admin/authorities', async (req, res) => {
  try {
    const { data, error } = await insforge.database
      .from('authorities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return sendResponse(res, data);
  } catch (error) {
    logger.error('Admin', 'Failed to fetch authorities', { error: error.message });
    return sendResponse(res, null, error.message, 500);
  }
});

app.post('/api/admin/authorities', async (req, res) => {
  try {
    const { name, department, locality, issue_type, email, phone, priority_level, is_active } = req.body;

    if (!email || !department) {
      return sendResponse(res, null, 'Email and department are required', 400);
    }

    const { data, error } = await insforge.database
      .from('authorities')
      .insert([{
        name,
        department,
        locality,
        issue_type,
        email,
        phone,
        priority_level: priority_level || 1,
        is_active: is_active !== undefined ? is_active : true
      }])
      .select()
      .single();

    if (error) throw error;
    return sendResponse(res, data);
  } catch (error) {
    logger.error('Admin', 'Failed to create authority', { error: error.message });
    return sendResponse(res, null, error.message, 500);
  }
});

app.put('/api/admin/authorities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
    }

    const { data, error } = await insforge.database
      .from('authorities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return sendResponse(res, data);
  } catch (error) {
    logger.error('Admin', 'Failed to update authority', { error: error.message, id: req.params.id });
    return sendResponse(res, null, error.message, 500);
  }
});

app.delete('/api/admin/authorities/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await insforge.database
      .from('authorities')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return sendResponse(res, { success: true });
  } catch (error) {
    logger.error('Admin', 'Failed to delete authority', { error: error.message, id: req.params.id });
    return sendResponse(res, null, error.message, 500);
  }
});

// 9. Auth Routes

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendResponse(res, null, 'Email and password required', 400);
    }

    const { data, error } = await insforge.auth.signInWithPassword({ email, password });
    if (error) {
      return sendResponse(res, null, error.message || 'Invalid credentials', 401);
    }

    return sendResponse(res, { token: data.accessToken, userId: data.user?.id });
  } catch (error) {
    logger.error('Auth', 'Login failed', { error: error.message });
    return sendResponse(res, null, error.message, 500);
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, cityWard, password } = req.body;
    if (!email || !password) {
      return sendResponse(res, null, 'Email and password required', 400);
    }

    const name = `${firstName || ''} ${lastName || ''}`.trim();
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name
    });

    if (error) {
      return sendResponse(res, null, error.message || 'Registration failed', 400);
    }

    const userId = data.user?.id;
    if (userId) {
      try {
        await insforge.database.from('users').upsert([{
          id: userId,
          email: email,
          name: name,
          city_ward: cityWard,
          created_at: new Date().toISOString()
        }]);
      } catch (dbErr) {
        logger.error('Auth', 'Failed to sync user to database after signup', { error: dbErr.message, userId });
      }
    }

    return sendResponse(res, {
      token: data.accessToken || null,
      userId: userId,
      requireEmailVerification: data.requireEmailVerification
    });
  } catch (error) {
    return sendResponse(res, null, error.message, 500);
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await insforge.auth.signOut();
    return sendResponse(res, { message: 'Logged out successfully' });
  } catch (error) {
    return sendResponse(res, null, error.message, 500);
  }
});

// ==========================================
// Global Error Handling
// ==========================================

// 404 handler for undefined routes
app.use((req, res) => {
  logger.warn('HTTP', `Route not found: ${req.method} ${req.originalUrl}`);
  return sendResponse(res, null, `Route not found: ${req.method} ${req.originalUrl}`, 404);
});

// Global Express error handler (catches sync/async errors that bubble up)
app.use((err, req, res, _next) => {
  logger.error('UncaughtMiddleware', 'Unhandled error in request pipeline', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });
  return sendResponse(res, null, 'An internal server error occurred. Our team has been notified.', 500);
});

// Process-level crash handlers
process.on('uncaughtException', (err) => {
  logger.fatal('Process', 'UNCAUGHT EXCEPTION — Server will continue but this must be fixed', {
    error: err.message,
    stack: err.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Process', 'UNHANDLED PROMISE REJECTION', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

const PORT = process.env.NEXT_PUBLIC_API_BASE_URL || 3001;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    logger.info('Server', `REST API Server active on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' });
  });
}

// Export for Vercel serverless function
module.exports = app;
