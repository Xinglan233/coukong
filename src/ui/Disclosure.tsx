import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

/** Shared advanced sections keep their contents mounted so closing cannot discard edits. */
export function Disclosure({ title, children, className = '', open, onToggle }: {
  title: ReactNode
  children: ReactNode
  className?: string
  open?: boolean
  onToggle?: (open: boolean) => void
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const expanded = open ?? localOpen
  const panelId = useId()
  function toggle() {
    setLocalOpen(!expanded)
    onToggle?.(!expanded)
  }
  return <section className={`disclosure ${className}`}>
    <button type="button" className="me-row disclosure-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={toggle}>
      <span className="me-row-label">{title}</span>
      {expanded ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
    </button>
    <div id={panelId} className="disclosure-panel" hidden={!expanded}>{children}</div>
  </section>
}
