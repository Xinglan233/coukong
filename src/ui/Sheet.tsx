import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { X } from "lucide-react"
import type { ReactNode } from "react"

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  const reduce = useReducedMotion()

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
