const nodemailer = require('nodemailer');
const { logger } = require('./logger');

let transporterConfigured = false;
let transporter = null;

const initTransporter = async () => {
  if (transporterConfigured) return transporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // STRICT GMAIL CONFIG
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: user,
      pass: pass
    }
  });

  console.log('[EmailService] Configured with Gmail SMTP.');
  logger.info('EmailService', 'Gmail SMTP initialized', { user });
  
  transporterConfigured = true;
  return transporter;
};

/**
 * Sends an email and logs it to Supabase/InsForge
 * @param {object} insforge Client instance
 * @param {string} to Authority email
 * @param {string} subject Email subject
 * @param {string} htmlBody Email body (HTML)
 * @param {string} issueId the related Issue ID
 * @param {number} startEscalationLevel Current escalation level
 * @param {number} totalReports Number of merged citizen reports
 * @returns {object} result
 */
const sendDispatchEmail = async (insforge, to, subject, htmlBody, issueId, startEscalationLevel = 0, totalReports = 1) => {
  let logId = null;
  try {
    const t = await initTransporter();

    // Insert 'pending' record in email_logs
    const { data: logRecord, error: logErr } = await insforge.database
      .from('email_logs')
      .insert([{
        issue_id: issueId,
        authority_email: to,
        subject: subject || 'Civic Issue Alert',
        status: 'pending',
        escalation_level: startEscalationLevel,
        total_reports: totalReports
      }])
      .select()
      .single();

    if (logErr) throw new Error(`Log creation failed: ${logErr.message}`);
    logId = logRecord.id;

    const safeSubject = subject || 'Civic Issue Alert';
    const safeHtmlBody = htmlBody ? htmlBody : `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #4F46E5;">Issue2Action Alert</h2>
        <p>A civic issue alert was generated but no specific details were provided.</p>
      </div>
    `;

    let info = null;
    let attempts = 0;
    const maxRetries = 3;

    // Retry Mechanism Wrapper
    while (attempts <= maxRetries) {
      try {
        // Send actual email
        info = await t.sendMail({
          from: `"Issue2Action" <${process.env.SMTP_USER}>`,
          to: to,
          subject: safeSubject,
          html: safeHtmlBody,
        });
        break; // Success
      } catch (err) {
        attempts++;
        if (attempts > maxRetries) throw err;
        logger.warn('EmailService', `Send attempt ${attempts}/${maxRetries} failed, retrying...`, { error: err.message, to });
        console.log(`[EmailService] Send failed, retrying (${attempts}/${maxRetries})... Delaying 2s`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log("Email sent successfully to:", to);
    logger.info('EmailService', `Email sent successfully`, { to, messageId: info.messageId, issueId, escalationLevel: startEscalationLevel });

    // Update status to 'sent'
    await insforge.database
      .from('email_logs')
      .update({ 
         status: 'sent', 
         external_message_id: info.messageId,
         sent_at: new Date().toISOString()
      })
      .eq('id', logId);

    // Also push a record to the public 'notifications' timeline
    await insforge.database
      .from('notifications')
      .insert([{
         issue_id: issueId,
         channel: 'email',
         message: `Email dispatched to authority at ${to}`
      }]);
      
    // Timeline event
    await insforge.database
      .from('timeline_events')
      .insert([{
        issue_id: issueId,
        message: `Alert sent locally to ${to}`,
        event_type: 'updated',
        created_by: 'system'
      }]);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email failed:", error.message);
    logger.error('EmailService', `Email dispatch failed`, { to, error: error.message, issueId, logId });
    
    // Update log status to 'failed'
    if (logId) {
      try {
        await insforge.database
          .from('email_logs')
          .update({ status: 'failed' })
          .eq('id', logId);
      } catch (dbErr) {
        console.error(`[EmailService] Failed to update log state to failed:`, dbErr.message);
      }
    }
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendDispatchEmail,
  initTransporter
};
