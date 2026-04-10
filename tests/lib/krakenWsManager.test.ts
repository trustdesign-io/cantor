import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { krakenWsManager } from '@/lib/krakenWsManager'
import type { KrakenSubscriber } from '@/lib/krakenWsManager'

// ── Mock WebSocket ────────────────────────────────────────────────────────────

type WsHandler = ((event: MessageEvent | Event | CloseEvent) => void) | null

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: WsHandler = null
  onmessage: WsHandler = null
  onclose: WsHandler = null
  onerror: WsHandler = null
  sentMessages: string[] = []

  static lastInstance: MockWebSocket | null = null

  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.lastInstance = this
  }

  send(data: string) { this.sentMessages.push(data) }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.({} as Event)
  }
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', MockWebSocket)
  MockWebSocket.lastInstance = null
  krakenWsManager._reset()
})

afterEach(() => {
  krakenWsManager._reset()
  vi.unstubAllGlobals()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSub(overrides: Partial<KrakenSubscriber> = {}): KrakenSubscriber {
  return {
    channel: 'ohlc',
    pair: 'XBT/USDT',
    onMessage: vi.fn(),
    onConnected: vi.fn(),
    ...overrides,
  }
}

function sentPayloads(ws: MockWebSocket) {
  return ws.sentMessages.map((m) => JSON.parse(m) as Record<string, unknown>)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KrakenWsManager subscribe/unsubscribe interval payload', () => {
  it('uses interval from subscriber in subscribe payload', () => {
    const sub = makeSub({ interval: 5 })
    krakenWsManager.subscribe(sub)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    const payloads = sentPayloads(ws)
    const subscribePayload = payloads.find((p) => p.event === 'subscribe')
    expect(subscribePayload).toBeDefined()
    expect((subscribePayload!.subscription as { interval: number }).interval).toBe(5)
  })

  it('uses interval from subscriber in unsubscribe payload', () => {
    const sub = makeSub({ interval: 15 })
    const unsubscribe = krakenWsManager.subscribe(sub)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    // Clear subscribe messages, then unsubscribe
    ws.sentMessages = []
    unsubscribe()

    const payloads = sentPayloads(ws)
    const unsubPayload = payloads.find((p) => p.event === 'unsubscribe')
    expect(unsubPayload).toBeDefined()
    expect((unsubPayload!.subscription as { interval: number }).interval).toBe(15)
  })

  it('defaults interval to 1 when subscriber omits it (backwards compatibility)', () => {
    const sub = makeSub() // no interval field
    krakenWsManager.subscribe(sub)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    const payloads = sentPayloads(ws)
    const subscribePayload = payloads.find((p) => p.event === 'subscribe')
    expect(subscribePayload).toBeDefined()
    expect((subscribePayload!.subscription as { interval: number }).interval).toBe(1)
  })

  it('does not include interval in ticker subscribe payload', () => {
    const sub = makeSub({ channel: 'ticker', interval: undefined })
    krakenWsManager.subscribe(sub)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    const payloads = sentPayloads(ws)
    const subscribePayload = payloads.find((p) => p.event === 'subscribe')
    expect(subscribePayload).toBeDefined()
    expect((subscribePayload!.subscription as Record<string, unknown>).interval).toBeUndefined()
  })

  it('sends correct pair in subscribe payload', () => {
    const sub = makeSub({ pair: 'ETH/USDT', interval: 60 })
    krakenWsManager.subscribe(sub)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    const payloads = sentPayloads(ws)
    const subscribePayload = payloads.find((p) => p.event === 'subscribe')
    expect(subscribePayload!.pair).toEqual(['ETH/USDT'])
  })
})
