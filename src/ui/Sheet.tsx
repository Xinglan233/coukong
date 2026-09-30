import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { X } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  const reduce = useReducedMotion()
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]).filter(element=>element.getClientRects().length>0)
    const frame = requestAnimationFrame(()=>focusable()[0]?.focus())
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault();close.current();return }
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items[items.length-1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault();last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault();first?.focus() }
    }
    document.addEventListener('keydown',keyboard)
    return () => { cancelAnimationFrame(frame);document.removeEventListener('keydown',keyboard);previous?.focus() }
  },[open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{ x: "-50%" }}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: "spring", damping: 30, stiffness: 320 }
            }
          >
            <div className="sheet-grab" />
            <div className="sheet-head">
              <span className="sheet-title">{title}</span>
              <button className="icon-btn" onClick={onClose} aria-label="关闭">
                <X size={20} />
              </button>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
