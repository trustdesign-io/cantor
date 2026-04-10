import { OLLAMA_MODEL } from '@/lib/ollama'

const STORAGE_KEY = 'cantor.ollamaModel'

/**
 * Returns the user's preferred Ollama model.
 * Reads from localStorage; falls back to the OLLAMA_MODEL constant when
 * localStorage is unavailable (e.g. SSR, tests) or the key is unset.
 */
export function getPreferredModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? OLLAMA_MODEL
  } catch {
    return OLLAMA_MODEL
  }
}

/**
 * Persists the user's model preference to localStorage.
 * Silently swallows storage errors (private browsing, quota exceeded, etc.)
 */
export function setPreferredModel(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // Silently ignore — in-memory model selection still works via the hook
  }
}
