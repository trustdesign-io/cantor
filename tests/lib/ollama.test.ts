import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamChat } from '@/lib/ollama'

describe('streamChat', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeNdjsonStream(chunks: object[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
        }
        controller.close()
      },
    })
  }

  it('parses NDJSON chunks and calls onToken for each delta', async () => {
    const ndjson = makeNdjsonStream([
      { message: { content: 'Hello' }, done: false },
      { message: { content: ' world' }, done: false },
      { message: { content: '' }, done: true },
    ])

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(ndjson, { status: 200 })
    )

    const tokens: string[] = []
    let finalText = ''

    await streamChat({
      system: 'system',
      user: 'user',
      onToken: d => tokens.push(d),
      onDone: t => { finalText = t },
    })

    expect(tokens).toEqual(['Hello', ' world'])
    expect(finalText).toBe('Hello world')
  })

  it('calls onDone with full text when done: true chunk arrives', async () => {
    const ndjson = makeNdjsonStream([
      { message: { content: 'Hi' }, done: false },
      { message: { content: '!' }, done: true },
    ])

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(ndjson, { status: 200 })
    )

    let doneText = ''
    await streamChat({
      system: 's',
      user: 'u',
      onToken: () => {},
      onDone: t => { doneText = t },
    })

    expect(doneText).toBe('Hi!')
  })

  it('throws when the server returns a non-200 status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: 'Internal Server Error' })
    )

    await expect(
      streamChat({ system: 's', user: 'u', onToken: () => {}, onDone: () => {} })
    ).rejects.toThrow('Ollama error: 500')
  })

  it('respects an AbortSignal — fetch rejects with AbortError when signal is aborted', async () => {
    const controller = new AbortController()

    // Simulate fetch being aborted (the browser aborts the fetch when signal fires)
    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    )

    const promise = streamChat({
      system: 's',
      user: 'u',
      signal: controller.signal,
      onToken: () => {},
      onDone: () => {},
    })

    controller.abort()

    // streamChat should re-throw the AbortError
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('skips malformed NDJSON lines without throwing', async () => {
    const encoder = new TextEncoder()
    const ndjson = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encoder.encode('not-json\n'))
        ctrl.enqueue(encoder.encode(JSON.stringify({ message: { content: 'ok' }, done: true }) + '\n'))
        ctrl.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(ndjson, { status: 200 })
    )

    const tokens: string[] = []
    await streamChat({ system: 's', user: 'u', onToken: d => tokens.push(d), onDone: () => {} })

    expect(tokens).toEqual(['ok'])
  })
})
