import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Import after clearing localStorage so module-level state is consistent
import { getPreferredModel, setPreferredModel } from '@/lib/modelPreference'

describe('getPreferredModel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('falls back to OLLAMA_MODEL constant when key is unset', () => {
    expect(getPreferredModel()).toBe('llama3.2:3b')
  })

  it('returns the stored value when present', () => {
    localStorage.setItem('cantor.ollamaModel', 'qwen2.5:7b')
    expect(getPreferredModel()).toBe('qwen2.5:7b')
  })
})

describe('setPreferredModel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists the model name to localStorage', () => {
    setPreferredModel('qwen2.5:7b')
    expect(localStorage.getItem('cantor.ollamaModel')).toBe('qwen2.5:7b')
  })

  it('getPreferredModel reads back the value set by setPreferredModel', () => {
    setPreferredModel('qwen2.5:7b')
    expect(getPreferredModel()).toBe('qwen2.5:7b')
  })
})
