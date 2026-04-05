'use server'

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function classifyIssue(description: string, imageDescription?: string) {
  
  const systemPrompt = `You are a civic issue classifier for Indian cities.
Analyze the complaint and return ONLY valid JSON. No markdown. No explanation.
Schema: { type, priority, department, estimated_resolution, summary, confidence, urgency_reason }`

  const userMessage = `Classify this civic complaint: "${description}"${imageDescription ? '\nImage shows: ' + imageDescription : ''}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: userMessage }],
    system: systemPrompt
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  
  try {
    return JSON.parse(text)
  } catch {
    return {
      type: 'Other', priority: 'medium', department: 'Municipal Corporation',
      estimated_resolution: '48 hours', summary: description,
      confidence: 50, urgency_reason: 'Manual review required'
    }
  }
}
