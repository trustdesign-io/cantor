/**
 * Centralised definitions for "teach me" topics.
 *
 * Each topic has an id, a human-readable label, and a `getContext` function
 * that returns the user-prompt string given the element's current value.
 * Adding a new teachable element is a one-file change here.
 *
 * The system prompt enforces length (~150 words) and forbids buy/sell advice.
 */

export interface TeachTopic {
  readonly id: string
  readonly label: string
}

/**
 * System prompt used for all "teach me" explanations.
 * The {element} placeholder is replaced with the topic label before sending.
 */
export function buildTeachSystemPrompt(elementLabel: string): string {
  return `You are a trading coach. The user clicked on "${elementLabel}" in their dashboard and wants a full explanation. Cover: what this is (plain English), what the current value means, why it matters for trading decisions, and one concrete example. ~150 words. Never give buy/sell advice.`
}

/** All teachable topics in the dashboard. */
export const TEACH_TOPICS = {
  fundingRate: { id: 'funding-rate', label: 'Funding Rate' },
  fearGreed:   { id: 'fear-greed',   label: 'Fear & Greed Index' },
  emaFast:     { id: 'ema-fast',     label: 'EMA 20 (Fast EMA)' },
  emaSlow:     { id: 'ema-slow',     label: 'EMA 50 (Slow EMA)' },
  rsi:         { id: 'rsi',          label: 'RSI (Relative Strength Index)' },
  filterVeto:  { id: 'filter-veto',  label: 'Filter Veto' },
  tradeResult: { id: 'trade-result', label: 'Trade Result' },
} as const satisfies Record<string, TeachTopic>

export type TeachTopicId = (typeof TEACH_TOPICS)[keyof typeof TEACH_TOPICS]['id']

/**
 * Build the user-facing context string for a given topic and current value.
 * This is what gets sent to Ollama as the user message.
 */
export function getTeachContext(topicId: TeachTopicId, currentValue: string): string {
  const valueStr = currentValue ? ` The current value is: ${currentValue}.` : ''
  const labels: Record<TeachTopicId, string> = {
    'funding-rate': `The funding rate element${valueStr}`,
    'fear-greed':   `The Fear & Greed Index element${valueStr}`,
    'ema-fast':     `The EMA 20 (fast exponential moving average) indicator${valueStr}`,
    'ema-slow':     `The EMA 50 (slow exponential moving average) indicator${valueStr}`,
    'rsi':          `The RSI (Relative Strength Index) indicator${valueStr}`,
    'filter-veto':  `The filter veto system${valueStr}`,
    'trade-result': `A completed trade${valueStr}`,
  }
  return labels[topicId]
}
