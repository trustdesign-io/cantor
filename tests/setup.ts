import '@testing-library/jest-dom'

// jsdom does not implement ResizeObserver — stub it globally so chart components
// (PriceChart, RsiChart) can mount in tests without crashing.
if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
