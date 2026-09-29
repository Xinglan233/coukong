import { useState } from 'react'
import { decodeShareText } from '../lib/codec'
import { useStore } from '../store'

interface ImportManualProps {
  onClose: () => void
}

export function ImportManual({ onClose }: ImportManualProps) {
  const showToast = useStore((s) => s.showToast)
  const openModal = useStore((s) => s.openModal)
  const [text, setText] = useState('')

  function handleImport() {
    const payload = decodeShareText(text)
    if (!payload) {
      showToast('没有识别出有效内容')
      return
    }
    onClose()
    openModal({ type: 'importPreview', payload })
  }

  return (
    <>
      <textarea
        className="textarea"
        rows={6}
        placeholder="粘贴朋友发给你的字符串"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="btn btn-primary btn-block"
        disabled={!text.trim()}
        onClick={handleImport}
      >
        预览
      </button>
    </>
  )
}
