import { useRef, useState } from 'react'
import {
  ChevronRight,
  ClipboardPaste,
  Download,
  PencilLine,
  Share2,
  Trash2,
  Upload,
  Users
} from 'lucide-react'
import type { DayKey, ThemeMode } from '../types'
import { DAY_META } from '../lib/dates'
import { useStore } from '../store'
import { Sheet } from '../ui/Sheet'
import { DaySelect } from '../ui/DaySelect'

const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30]
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)
const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'auto', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' }
]

export function Me() {
  const profile = useStore((s) => s.profile)
  const settings = useStore((s) => s.settings)
  const friends = useStore((s) => s.friends)
  const updateProfile = useStore((s) => s.updateProfile)
  const updateSettings = useStore((s) => s.updateSettings)
  const openModal = useStore((s) => s.openModal)
  const exportBackup = useStore((s) => s.exportBackup)
  const importBackup = useStore((s) => s.importBackup)
  const resetAll = useStore((s) => s.resetAll)
  const showToast = useStore((s) => s.showToast)

  const [profileOpen, setProfileOpen] = useState(false)
  const [editName, setEditName] = useState(profile.name)
  const [editDays, setEditDays] = useState<DayKey[]>(profile.days)
  const backupInput = useRef<HTMLInputElement>(null)

  function openProfile() {
    setEditName(profile.name)
    setEditDays(profile.days)
    setProfileOpen(true)
  }

  function saveProfile() {
    if (!editName.trim()) return
    updateProfile({ name: editName.trim(), days: editDays })
    setProfileOpen(false)
    showToast('已保存')
  }

  function handleExport() {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'coukong-backup.json'
    a.click()
    URL.revokeObjectURL(blob.url)
    showToast('备份已导出')
  }

  async function handleBackupFile(file: File) {
    const text = await file.text()
    const ok = importBackup(text)
    showToast(ok ? '备份已导入' : '文件内容无效')
  }

  function handleReset() {
    if (window.confirm('确定清空全部数据？')) {
      resetAll()
    }
  }

  return (
    <div className='page'>
      <h1 className='page-title'>我的</h1>

      <button className='me-profile' onClick={openProfile}>
        <div>
          <div className='me-name'>{profile.name}</div>
          <div className='me-days'>
            {profile.days.map((d) => DAY_META[d].label).join(' ') || '未选择参展日'}
          </div>
        </div>
        <PencilLine size={17} className='me-edit-icon' />
      </button>

      <div className='card me-card'>
        <button className='me-row' onClick={() => openModal({ type: 'share' })}>
          <span className='me-row-label'>
            <Share2 size={17} />
            生成分享码
          </span>
          <ChevronRight size={17} />
        </button>
        <button className='me-row' onClick={() => openModal({ type: 'friends' })}>
          <span className='me-row-label'>
            <Users size={17} />
            朋友
          </span>
          <span className='me-row-value'>
            {friends.length}
            <ChevronRight size={17} />
          </span>
        </button>
        <button className='me-row' onClick={() => openModal({ type: 'importManual' })}>
          <span className='me-row-label'>
            <ClipboardPaste size={17} />
            导入朋友码
          </span>
          <ChevronRight size={17} />
        </button>
      </div>

      <div className='section-label'>设置</div>
      <div className='card me-card'>
        <div className='me-row me-col'>
          <span className='me-row-label'>主题</span>
          <div className='segmented' style={{ width: '100%' }}>
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.key}
                className={settings.themeMode === t.key ? 'on' : ''}
                onClick={() => updateSettings({ themeMode: t.key })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className='me-row'>
          <span className='me-row-label'>移动时间</span>
          <select
            className='select'
            style={{ width: 110 }}
            value={settings.bufferMinutes}
            onChange={(e) => updateSettings({ bufferMinutes: Number(e.target.value) })}
          >
            {BUFFER_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b} 分钟
              </option>
            ))}
          </select>
        </div>

        <div className='me-row'>
          <span className='me-row-label'>开放时间</span>
          <span className='me-hours'>
            <select
              className='select'
              value={settings.openHour}
              onChange={(e) => updateSettings({ openHour: Number(e.target.value) })}
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
            <span className='me-hours-sep'>至</span>
            <select
              className='select'
              value={settings.closeHour}
              onChange={(e) => updateSettings({ closeHour: Number(e.target.value) })}
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </span>
        </div>
      </div>

      <div className='section-label'>数据</div>
      <div className='card me-card'>
        <button className='me-row' onClick={handleExport}>
          <span className='me-row-label'>
            <Download size={17} />
            导出备份
          </span>
          <ChevronRight size={17} />
        </button>
        <button className='me-row' onClick={() => backupInput.current?.click()}>
          <span className='me-row-label'>
            <Upload size={17} />
            导入备份
          </span>
          <ChevronRight size={17} />
        </button>
        <button className='me-row me-danger' onClick={handleReset}>
          <span className='me-row-label'>
            <Trash2 size={17} />
            清空全部
          </span>
          <ChevronRight size={17} />
        </button>
      </div>

      <input
        ref={backupInput}
        type='file'
        accept='application/json,.json'
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void handleBackupFile(f)
        }}
      />

      <Sheet open={profileOpen} title='个人资料' onClose={() => setProfileOpen(false)}>
        <div className='field'>
          <label className='field-label'>名字</label>
          <input
            className='input'
            value={editName}
            maxLength={12}
            onChange={(e) => setEditName(e.target.value)}
          />
        </div>
        <div className='field'>
          <label className='field-label'>参展日</label>
          <DaySelect value={editDays} onChange={setEditDays} />
        </div>
        <button
          className='btn btn-primary btn-block'
          disabled={!editName.trim()}
          onClick={saveProfile}
        >
          保存
        </button>
      </Sheet>
    </div>
  )
}
