import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className='sheet-backdrop'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className='sheet'
            style={{ x: '-50%' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className='sheet-grab' />
            <div className='sheet-head'>
              <span className='sheet-title'>{title}</span>
              <button className='icon-btn' onClick={onClose} aria-label='关闭'>
                <X size={20} />
              </button>
            </div>
            <div className='sheet-body'>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
