import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Top-level error boundary. Without this, any render exception unmounts the
 * whole React tree and the page goes black — which is exactly what was
 * happening whenever a signal fired into a code path with a bad value.
 *
 * Catches render-time errors only. Async errors (streamChat failures, WS
 * parse errors) are handled locally in their own hooks.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the full stack + component stack to the console so dev tools can
    // surface the true origin. Without this, React 18 swallows component
    // stacks in production builds.
    console.error('[ErrorBoundary] Render crash:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
    this.setState({ errorInfo })
  }

  handleReset = (): void => {
    this.setState({ error: null, errorInfo: null })
  }

  render(): ReactNode {
    const { error, errorInfo } = this.state

    if (error === null) {
      return this.props.children
    }

    return (
      <div
        role="alert"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          gap: '16px',
          backgroundColor: 'var(--bg-base, #0b0e14)',
          color: 'var(--text-primary, #e6e9ef)',
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          overflow: 'auto',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--loss, #ef4444)' }}>
          Cantor crashed
        </div>
        <div style={{ fontSize: '13px', maxWidth: '720px', textAlign: 'center' }}>
          A render error took down the app. The details below come from the React
          error boundary — paste them to Claude and it can fix the root cause.
        </div>
        <pre
          style={{
            maxWidth: '90vw',
            maxHeight: '35vh',
            overflow: 'auto',
            padding: '12px',
            background: 'var(--bg-surface, #131720)',
            border: '1px solid var(--border, #2a3040)',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {error.name}: {error.message}
          {'\n\n'}
          {error.stack ?? '(no stack)'}
        </pre>
        {errorInfo?.componentStack && (
          <pre
            style={{
              maxWidth: '90vw',
              maxHeight: '25vh',
              overflow: 'auto',
              padding: '12px',
              background: 'var(--bg-surface, #131720)',
              border: '1px solid var(--border, #2a3040)',
              borderRadius: '6px',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--text-secondary, #8892a4)',
            }}
          >
            Component stack:
            {errorInfo.componentStack}
          </pre>
        )}
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            padding: '8px 16px',
            background: 'var(--bg-surface, #131720)',
            color: 'var(--text-primary, #e6e9ef)',
            border: '1px solid var(--border, #2a3040)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Try again
        </button>
      </div>
    )
  }
}
