import { Journal } from '@/components/Journal'
import type { Trade } from '@/types'

interface JournalTabProps {
  trades: readonly Trade[]
}

export function JournalTab({ trades }: JournalTabProps) {
  return (
    <div style={{ height: 'calc(100vh - 88px)' }}>
      <Journal trades={trades} />
    </div>
  )
}
