import { useState, useEffect, useCallback } from 'react'
import { listModels } from '@/lib/ollama'

export interface UseOllamaModelsResult {
  models: string[]
  loading: boolean
  error: boolean
  /** Re-run the /api/tags fetch — call this when the dropdown is opened. */
  refetch: () => void
}

/**
 * Fetches the list of locally-installed Ollama models on mount.
 * `models` is empty (not null) when Ollama is unreachable; `error` is true
 * in that case so the UI can show a tooltip or disabled state.
 */
export function useOllamaModels(): UseOllamaModelsResult {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Exposed refetch function — called from user interactions (e.g. dropdown onFocus)
  const refetch = useCallback(() => {
    setLoading(true)
    setError(false)
    listModels().then((result) => {
      setModels(result)
      setError(result.length === 0)
      setLoading(false)
    })
  }, [])

  // Initial fetch on mount — state setters are only called inside the async callback,
  // not synchronously in the effect body, so no cascading render risk.
  useEffect(() => {
    let cancelled = false
    listModels().then((result) => {
      if (!cancelled) {
        setModels(result)
        setError(result.length === 0)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  return { models, loading, error, refetch }
}
