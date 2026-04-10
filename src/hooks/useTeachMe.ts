import { useState, useRef, useCallback } from 'react'
import { streamChat } from '@/lib/ollama'
import { getPreferredModel } from '@/lib/modelPreference'
import { buildTeachSystemPrompt, getTeachContext } from '@/lib/teachTopics'
import type { TeachTopicId, TeachTopic } from '@/lib/teachTopics'

export interface TeachEntry {
  text: string
  streaming: boolean
}

export interface UseTeachMeReturn {
  isOpen: boolean
  topic: TeachTopic | null
  contextLabel: string
  entry: TeachEntry | null
  model: string
  open: (topic: TeachTopic, topicId: TeachTopicId, currentValue: string) => void
  close: () => void
}

/**
 * Module-level cache so explanations persist across re-renders and survive
 * component unmounts within the same page session. Invalidated on full page reload.
 */
const explanationCache = new Map<string, string>()

function cacheKey(topicId: TeachTopicId, currentValue: string): string {
  return `${topicId}:${currentValue}`
}

export function useTeachMe(): UseTeachMeReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [topic, setTopic] = useState<TeachTopic | null>(null)
  const [contextLabel, setContextLabel] = useState('')
  const [entry, setEntry] = useState<TeachEntry | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const close = useCallback(() => {
    abortRef.current?.abort()
    setIsOpen(false)
  }, [])

  const open = useCallback((t: TeachTopic, topicId: TeachTopicId, currentValue: string) => {
    // Cancel any in-flight generation
    abortRef.current?.abort()

    const key = cacheKey(topicId, currentValue)
    const cached = explanationCache.get(key)
    const userContext = getTeachContext(topicId, currentValue)

    setTopic(t)
    setContextLabel(userContext)
    setIsOpen(true)

    if (cached !== undefined) {
      setEntry({ text: cached, streaming: false })
      return
    }

    setEntry({ text: '', streaming: true })

    const controller = new AbortController()
    abortRef.current = controller

    let full = ''

    streamChat({
      model: getPreferredModel(),
      system: buildTeachSystemPrompt(t.label),
      user: userContext,
      signal: controller.signal,
      onToken: (delta) => {
        full += delta
        setEntry({ text: full, streaming: true })
      },
      onDone: (fullText) => {
        explanationCache.set(key, fullText)
        setEntry({ text: fullText, streaming: false })
      },
    }).catch((err: unknown) => {
      if (err instanceof Error && err.name === 'AbortError') return
      const errorText = 'Explanation unavailable — is Ollama running on localhost:11434?'
      setEntry({ text: errorText, streaming: false })
    })
  }, [])

  return { isOpen, topic, contextLabel, entry, model: getPreferredModel(), open, close }
}
