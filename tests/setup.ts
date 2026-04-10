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

// jsdom does not implement scrollIntoView — stub it globally so components
// that use scroll-to-bottom (CommentatorPanel) can mount in tests.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = function () {}
}
