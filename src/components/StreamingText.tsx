import type { CSSProperties } from 'react'

/**
 * Renders text that may still be streaming from an LLM.
 * Shows a blinking cursor while `streaming` is true.
 */
interface StreamingTextProps {
  text: string
  streaming: boolean
  className?: string
  style?: CSSProperties
}

export function StreamingText({ text, streaming, className, style }: StreamingTextProps) {
  return (
    <span className={className} style={style}>
      {text}
      {streaming && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '0.5ch',
            height: '1em',
            backgroundColor: 'currentColor',
            marginLeft: '0.1ch',
            verticalAlign: 'text-bottom',
            animation: 'blink 1s step-start infinite',
          }}
        />
      )}
    </span>
  )
}
