/**
 * Ollama streaming client.
 *
 * Swap the base URL or model by editing the two constants below — no other
 * changes required. The default targets a locally-running Ollama instance.
 */

/** Base URL of the local Ollama server. Change this if Ollama is on a different port/host. */
export const OLLAMA_BASE_URL = 'http://localhost:11434'

/** Default model to use for commentary and teaching. Must be pulled via `ollama pull <model>`. */
export const OLLAMA_MODEL = 'llama3.2:3b'

export interface StreamChatOptions {
  model?: string
  system: string
  user: string
  onToken: (delta: string) => void
  onDone: (fullText: string) => void
  signal?: AbortSignal
}

/**
 * Stream a chat completion from the local Ollama API.
 *
 * POSTs to `{OLLAMA_BASE_URL}/api/chat` with `stream: true`, parses the
 * newline-delimited JSON response, calls `onToken` for each text delta,
 * and `onDone` with the full assembled text when the stream ends.
 *
 * Pass an `AbortSignal` to cancel in-flight generations — e.g. when a new
 * event fires before the previous one finishes streaming.
 *
 * @throws Will re-throw non-abort errors so callers can handle them.
 */
export async function streamChat({
  model = OLLAMA_MODEL,
  system,
  user,
  onToken,
  onDone,
  signal,
}: StreamChatOptions): Promise<void> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('Ollama returned an empty response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Split on newlines — each line is a complete JSON chunk
      const lines = buffer.split('\n')
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        let chunk: { message?: { content?: string }; done?: boolean }
        try {
          chunk = JSON.parse(trimmed) as typeof chunk
        } catch {
          // Malformed line — skip
          continue
        }

        const delta = chunk.message?.content ?? ''
        if (delta) {
          fullText += delta
          onToken(delta)
        }

        if (chunk.done) {
          onDone(fullText)
          return
        }
      }
    }

    // Stream ended without a `done: true` chunk — still call onDone
    if (fullText) onDone(fullText)
  } finally {
    reader.releaseLock()
  }
}
