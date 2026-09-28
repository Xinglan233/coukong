import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { clearHash, decodePayload, readHashPayload } from './lib/codec'
import { BookingForm } from './pages/BookingForm'
import { FriendsSheet } from './pages/FriendsSheet'
import { ImportManual } from './pages/ImportManual'
import { ImportPreview } from './pages/ImportPreview'
import { Match } from './pages/Match'
import { Me } from './pages/Me'
import { Onboarding } from './pages/Onboarding'
import { Review } from './pages/Review'
import { Schedule } from './pages/Schedule'
import { ShareSheet } from './pages/ShareSheet'
import { useStore } from './store'
import { Sheet } from './ui/Sheet'
import { TabBar } from './ui/TabBar'
import { Toast } from './ui/Toast'

const SHEET_TITLES: Record<string, string> = {
  bookingForm: '预约',
  review: '识别结果',
  share: '我的分享码',
  friends: '朋友',
  importManual: '导入朋友码'
}

export default function App() {
  const onboarded = useStore((s) => s.onboarded)
  const tab = useStore((s) => s.tab)
  const modal = useStore((s) => s.modal)
  const openModal = useStore((s) => s.openModal)
  const closeModal = useStore((s) => s.closeModal)
  const themeMode = useStore((s) => s.settings.themeMode)

  useEffect(() => {
    const root = document.documentElement
    function apply() {
      const dark =
        themeMode === 'dark' ||
        (themeMode === 'auto' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    if (themeMode === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [themeMode])

  useEffect(() => {
    const encoded = readHashPayload()
    if (!encoded) return
    const payload = decodePayload(encoded)
    clearHash()
    if (payload) {
      setTimeout(() => openModal({ type: 'importPreview', payload }), 400)
    }
  }, [openModal])

  if (!onboarded) {
    return (
      <div className="app-shell">
        <Onboarding />
      </div>
    )
  }

  const sheetOpen = modal !== null && modal.type !== 'importPreview'

  return (
    <div className="app-shell">
      {tab === 'schedule' && <Schedule />}
      {tab === 'match' && <Match />}
      {tab === 'me' && <Me />}

      <TabBar />
      <Toast />

      <Sheet
        open={sheetOpen}
        title={modal ? SHEET_TITLES[modal.type] : ''}
        onClose={closeModal}
      >
        {modal?.type === 'bookingForm' && (
          <BookingForm
            bookingId={modal.bookingId}
            presetDay={modal.presetDay}
            onClose={closeModal}
          />
        )}
        {modal?.type === 'review' && <Review onClose={closeModal} />}
        {modal?.type === 'share' && <ShareSheet />}
        {modal?.type === 'friends' && <FriendsSheet onClose={closeModal} />}
        {modal?.type === 'importManual' && <ImportManual onClose={closeModal} />}
      </Sheet>

      <AnimatePresence>
        {modal?.type === 'importPreview' && (
          <ImportPreview payload={modal.payload} onClose={closeModal} />
        )}
      </AnimatePresence>
    </div>
  )
}
