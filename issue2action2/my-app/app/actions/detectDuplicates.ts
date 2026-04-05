'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getPublicIssues } from '../../lib/api'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function detectDuplicates(type: string, ward: string, description: string) {
  try {
    // Call our existing API client (which fetches from InsForge-backed backend)
    const issues = await getPublicIssues({ type, ward });
    
    // Sort by recent and take top 5 for comparison
    const recentIssues = issues
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    if (recentIssues.length === 0) {
      return { is_duplicate: false, similar_count: 0, parent_issue_id: null };
    }

    const systemPrompt = `You are a duplicate issue detector.
Compare the new civic complaint with a list of recent complaints in the same area.
Determine if the new complaint refers to the *exact same underlying problem* as any of the recent ones.
Return ONLY valid JSON. No markdown. No explanation.
Schema: { "is_duplicate": boolean, "parent_issue_id": string | null }
(If it is a duplicate, use the ticketId of the matched issue as parent_issue_id, otherwise null)`;

    const recentContext = recentIssues.map(issue => 
      `Issue ticketId: ${issue.ticketId}\nDescription: ${issue.description}`
    ).join('\n---\n');

    const userMessage = `New complaint:\n"${description}"\n\nRecent complaints in this area:\n${recentContext}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const result = JSON.parse(text);

    return {
      is_duplicate: !!result.is_duplicate,
      similar_count: recentIssues.length,
      parent_issue_id: result.parent_issue_id || null
    };

  } catch (error) {
    console.error('Error detecting duplicates:', error);
    // Fail gracefully: if there's an error, just assume there's no duplicate
    return { is_duplicate: false, similar_count: 0, parent_issue_id: null };
  }
}
