import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy } from 'lucide-react'
import { encodePayload, makePayload, shareUrl } from '../lib/codec'
import { useStore } from '../store'

type ShareTab = 'qr' | 'link' | 'text'

export function ShareSheet() {
  const profile = useStore((s) => s.profile)
  const bookings = useStore((s) => s.bookings)
  const showToast = useStore((s) => s.showToast)
  const [tab, setTab] = useState<ShareTab>('qr')

  const payload = useMemo(
    () => makePayload(profile.name, profile.days, bookings),
    [profile, bookings]
  )
  const encoded = useMemo(() => encodePayload(payload), [payload])
  const url = useMemo(() => shareUrl(encoded), [encoded])

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${label}已复制`)
    } catch {
      showToast('复制失败，请长按选择文本')
    }
  }

  return (
    <>
      <div className="segmented" style={{ marginBottom: 18 }}>
        <button className={tab === 'qr' ? 'on' : ''} onClick={() => setTab('qr')}>
          二维码
        </button>
        <button className={tab === 'link' ? 'on' : ''} onClick={() => setTab('link')}>
          链接
        </button>
        <button className={tab === 'text' ? 'on' : ''} onClick={() => setTab('text')}>
          字符串
        </button>
      </div>

      {tab === 'qr' && (
        <div className="qr-box">
          <QRCodeSVG value={url} size={218} bgColor="#ffffff" fgColor="#171a1f" includeMargin />
        </div>
      )}

      {tab === 'link' && (
        <>
          <textarea className="textarea code-area" rows={3} readOnly value={url} />
          <button className="btn btn-primary btn-block" onClick={() => copy(url, '链接')}>
            <Copy size={16} />
            复制链接
          </button>
        </>
      )}

      {tab === 'text' && (
        <>
          <textarea className="textarea code-area" rows={7} readOnly value={encoded} />
          <button className="btn btn-primary btn-block" onClick={() => copy(encoded, '字符串')}>
            <Copy size={16} />
            复制字符串
          </button>
        </>
      )}
    </>
  )
}
