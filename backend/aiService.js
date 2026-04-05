const { logger } = require('./logger');
let insforge = null;

const getInsforge = async () => {
  if (insforge) return insforge;
  const { createClient } = await import('@insforge/sdk');
  insforge = createClient({
    baseUrl: process.env.INSFORGE_BASE_URL || '',
    anonKey: process.env.INSFORGE_ANON_KEY || ''
  });
  return insforge;
};

/**
 * Classifies a civic complaint dynamically using Claude via InsForge.
 * 
 * @param {string} description
 * @param {string} [imageDescription]
 * @returns {Promise<Object>}
 */
const classifyIssue = async (description, imageDescription = '') => {
  const fallback = {
    type: 'Other',
    priority: 'medium',
    department: 'Municipal Corporation',
    estimated_resolution: '48 hours',
    summary: description,
    confidence: 50,
    urgency_reason: 'Manual review required'
  };

  try {
    const systemPrompt = `You are an AI classifier for a civic issue reporting platform in India. 
Analyze the complaint and return ONLY a valid JSON object. No extra text.

Strictly classify the issue into EXACTLY ONE of these categories:
- Road (Road damage, potholes, expansion joints, broken dividers)
- Water (Water leak, pipe burst, no water supply, contaminated water)
- Garbage (Dumped trash, overflow bins, sanitation issues, smell)
- Electric (Streetlights, power lines, transformer issues, sparks)
- Sewer (Sewer overflow, drainage clog, open manholes)

JSON schema:
{
  "type": "Road" | "Water" | "Garbage" | "Electric" | "Sewer",
  "priority": "low" | "medium" | "high" | "critical",
  "department": "string",     // e.g. 'PWD', 'KMC Water Supply', 'Sanitation Dept', 'CESC', 'Police'
  "estimated_resolution": "string",   // e.g. '24 hours', '48 hours', '72 hours', '1 week'
  "summary": "string",        // One sentence, professional civic ticket summary
  "confidence": "number",     // 0-100
  "urgency_reason": "string"  // Why this priority level was assigned
}`;

    const userMessage = `Classify this civic complaint: ${description}\n${imageDescription ? 'Image context: ' + imageDescription : ''}`;

    const client = await getInsforge();
    const aiResponse = await client.ai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-20250514',
      maxTokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    if (aiResponse && aiResponse.choices && aiResponse.choices[0]) {
      const content = aiResponse.choices[0].message.content;
      // Strip potential markdown fencing around JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      return JSON.parse(jsonStr);
    }
    
    return fallback;
  } catch (error) {
    console.error('Claude API classification failed:', error.message);
    logger.warn('AI', 'Classification failed, returning fallback', { error: error.message });
    return fallback;
  }
};

/**
 * Detects duplicates using database query + AI comparison.
 * 
 * @param {string} type
 * @param {string} ward
 * @param {string} description
 * @returns {Promise<Object>}
 */
const duplicateDetector = async (type, ward, description) => {
  const result = {
    is_duplicate: false,
    similar_count: 0,
    parent_issue_id: null,
    similarity_score: 0
  };

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const client = await getInsforge();
    // 1. Query issues table
    const { data: issues, error } = await client.database
      .from('issues')
      .select('id, description, upvotes')
      .eq('type', type)
      .eq('ward', ward)
      .neq('status', 'resolved')
      .neq('status', 'closed')
      .gte('created_at', sevenDaysAgo.toISOString())
      .limit(5);

    if (error) throw error;

    if (!issues || issues.length === 0) {
      return result;
    }
    
    result.similar_count = issues.length;

    // 2. Pass found descriptions + new description to Claude API
    const systemPrompt = `You are a civic issue duplicate detector. 
Are these complaints about the same physical problem?
Return ONLY a valid JSON object without extra text or markdown.
Format: { "is_duplicate": boolean, "similarity_score": number (0-100), "parent_issue_id": string or null }`;

    const existingIssuesStr = issues.map(i => `ID: ${i.id} | Desc: ${i.description}`).join('\n');
    const userMessage = `New complaint description: "${description}"\n\nExisting nearby unresolved complaints of same type:\n${existingIssuesStr}\n\nAnalyze and return JSON.`;

    const aiResponse = await client.ai.chat.completions.create({
      model: 'anthropic/claude-haiku-4-5-20251001',
      maxTokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    if (aiResponse && aiResponse.choices && aiResponse.choices[0]) {
      const content = aiResponse.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr);

      result.is_duplicate = !!parsed.is_duplicate;
      result.similarity_score = typeof parsed.similarity_score === 'number' ? parsed.similarity_score : 0;
      result.parent_issue_id = parsed.parent_issue_id || null;
      
      // Safety check: if Claude hallucinated an ID not in the list, nullify it
      if (result.parent_issue_id && !issues.find(i => i.id === result.parent_issue_id)) {
        const highestUpvoted = [...issues].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))[0];
        result.parent_issue_id = highestUpvoted.id;
      }
    }

    return result;
  } catch (error) {
    console.error('Duplicate detection failed:', error.message);
    logger.warn('AI', 'Duplicate detection failed, treating as non-duplicate', { error: error.message, type, ward });
    return result; // Fallback to not duplicate
  }
};

/**
 * Creates a structured, polite, and urgent email body using Claude.
 * 
 * @param {Object} issueData
 * @returns {Promise<Object>} { subject, htmlBody }
 */
const composeEmail = async (issueData) => {
  const fallback = {
    subject: `Civic Issue Reported: ${issueData.type || 'General'} in ${issueData.ward || 'your area'}`,
    htmlBody: `
      <h2>Civic Issue: ${issueData.type || 'General'}</h2>
      <p><strong>Priority:</strong> ${issueData.priority || 'Medium'}</p>
      <p><strong>Location:</strong> ${issueData.location_text || 'Unknown'}</p>
      <p><strong>Description:</strong> ${issueData.description}</p>
      <p>Please kindly review and take necessary action to resolve this issue. A citizen has reported it via Issue2Action.</p>
    `
  };

  try {
    const client = await getInsforge();
    const systemPrompt = `You are a professional assistant generating official email dispatches for a civic platform (Issue2Action).
Generate an email to the relevant city authority alerting them of a reported issue.
The tone must be professional, urgent if high priority, and official. 

Return ONLY a valid JSON object matching this schema without extra text or markdown:
{
  "subject": "string (Short, clear subject line including urgency)",
  "htmlBody": "string (Well-formatted HTML body with headings, strong tags, and clear paragraphs complaining about the issue. Format nicely with a citizen impact statement.)"
}`;

    const userMessage = `Issue Details:
Type: ${issueData.type}
Priority: ${issueData.priority}
Location: ${issueData.location_text} (Ward: ${issueData.ward})
Description: ${issueData.description}
Assigned Dept: ${issueData.department}

Generate the email body in HTML format.`;

    const aiResponse = await client.ai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-20250514', // Use sonnet for high quality text formatting
      maxTokens: 800,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    if (aiResponse && aiResponse.choices && aiResponse.choices[0]) {
      const content = aiResponse.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      return JSON.parse(jsonStr);
    }

    return fallback;
  } catch (error) {
    console.error('Claude API email composition failed:', error.message);
    logger.warn('AI', 'Email composition with AI failed, using fallback', { error: error.message, type: issueData.type });
    return fallback;
  }
};

module.exports = { classifyIssue, duplicateDetector, composeEmail };
