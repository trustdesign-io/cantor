import { describe, it, expect } from 'vitest'
import { buildTeachSystemPrompt, getTeachContext, TEACH_TOPICS } from '@/lib/teachTopics'

describe('buildTeachSystemPrompt', () => {
  it('includes the element label in the prompt', () => {
    const prompt = buildTeachSystemPrompt('Funding Rate')
    expect(prompt).toContain('"Funding Rate"')
    expect(prompt).toContain('trading coach')
    expect(prompt).toContain('Never give buy/sell advice')
  })
})

describe('getTeachContext', () => {
  it('includes the current value in the context string', () => {
    const ctx = getTeachContext('funding-rate', '+0.0100%')
    expect(ctx).toContain('+0.0100%')
    expect(ctx).toContain('funding rate')
  })

  it('handles empty current value gracefully', () => {
    const ctx = getTeachContext('rsi', '')
    expect(ctx).toContain('RSI')
    expect(ctx).not.toContain('The current value is: .')
  })

  it('returns a non-empty string for every topic id', () => {
    const topicIds = Object.values(TEACH_TOPICS).map(t => t.id) as Parameters<typeof getTeachContext>[0][]
    for (const id of topicIds) {
      const ctx = getTeachContext(id, '42')
      expect(ctx.length).toBeGreaterThan(0)
    }
  })
})
