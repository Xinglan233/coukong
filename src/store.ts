import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Booking,
  DayKey,
  Friend,
  Profile,
  RawBooking,
  RecognitionGroup,
  Settings,
  SharePayload
} from './types'
import { uid } from './lib/dates'
import { findConflicts } from './lib/availability'
import { matchSession } from './lib/catalog'

export type Tab = 'schedule' | 'match' | 'me'

export type Modal =
  | { type: 'bookingForm'; bookingId?: string; presetDay?: DayKey }
  | { type: 'review' }
  | { type: 'share' }
  | { type: 'friends' }
  | { type: 'importPreview'; payload: SharePayload }
  | { type: 'importManual' }
  | null

interface State {
  onboarded: boolean
  profile: Profile
  settings: Settings
  bookings: Booking[]
  friends: Friend[]
  tab: Tab
  modal: Modal
  reviewGroups: RecognitionGroup[]
  ocrProgress: number
  toast: string | null

  finishOnboarding: (profile: Profile) => void
  updateProfile: (patch: Partial<Profile>) => void
  updateSettings: (patch: Partial<Settings>) => void
  setTab: (tab: Tab) => void
  openModal: (modal: Modal) => void
  closeModal: () => void
  setReviewGroups: (groups: RecognitionGroup[]) => void
  setOcrProgress: (progress: number) => void
  showToast: (text: string) => void
  clearToast: () => void

  saveBooking: (data: Omit<Booking, 'id'>, id?: string) => void
  deleteBooking: (id: string) => void
  addRawBookings: (raws: RawBooking[]) => { saved: number; skipped: number }

  importFriend: (payload: SharePayload) => 'added' | 'replaced'
  deleteFriend: (id: string) => void

  exportBackup: () => string
  importBackup: (raw: string) => boolean
  resetAll: () => void
}

const DEFAULT_PROFILE: Profile = { name: 'CN', days: [] }

const DEFAULT_SETTINGS: Settings = {
  bufferMinutes: 10,
  themeMode: 'auto',
  openHour: 9,
  closeHour: 21,
  minSlotMinutes: 30
}

function toBooking(raw: RawBooking): Booking {
  return {
    id: uid(),
    day: raw.day as DayKey,
    start: raw.start,
    end: raw.end,
    booth: raw.booth,
    ip: raw.ip,
    title: raw.title,
    note: raw.note,
    source: raw.confidence >= 1 ? 'catalog' : 'ocr'
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      onboarded: false,
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      bookings: [],
      friends: [],
      tab: 'schedule',
      modal: null,
      reviewGroups: [],
      ocrProgress: -1,
      toast: null,

      finishOnboarding: (profile) => set({ onboarded: true, profile }),
      updateProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

      setTab: (tab) => set({ tab }),
      openModal: (modal) => set({ modal }),
      closeModal: () => set({ modal: null }),
      setReviewGroups: (groups) => set({ reviewGroups: groups }),
      setOcrProgress: (progress) => set({ ocrProgress: progress }),
      showToast: (text) => set({ toast: text }),
      clearToast: () => set({ toast: null }),

      saveBooking: (data, id) => {
        if (id) {
          set({ bookings: get().bookings.map((b) => (b.id === id ? { ...data, id } : b)) })
        } else {
          set({ bookings: [...get().bookings, { ...data, id: uid() }] })
        }
      },

      deleteBooking: (id) => set({ bookings: get().bookings.filter((b) => b.id !== id) }),

      addRawBookings: (raws) => {
        let saved = 0
        let skipped = 0
        const added: Booking[] = []
        for (const raw of raws) {
          if (!raw.day) {
            skipped++
            continue
          }
          const matched = matchSession(raw.day, raw.booth, raw.start)
          const enriched: RawBooking = matched
            ? {
                ...raw,
                booth: matched.activity.booth,
                ip: matched.activity.ip,
                title: matched.activity.title,
                confidence: 1
              }
            : raw
          const booking = toBooking(enriched)
          const conflicts = findConflicts([...get().bookings, ...added], {
            day: booking.day,
            start: booking.start,
            end: booking.end
          })
          if (conflicts.length) {
            skipped++
            continue
          }
          added.push(booking)
          saved++
        }
        if (added.length) set({ bookings: [...get().bookings, ...added] })
        return { saved, skipped }
      },

      importFriend: (payload) => {
        const existing = get().friends.find((f) => f.name === payload.name)
        if (existing) {
          set({
            friends: get().friends.map((f) =>
              f.id === existing.id
                ? { ...f, days: payload.days, bookings: payload.bookings, generatedAt: payload.generatedAt }
                : f
            )
          })
          return 'replaced'
        }
        const friend: Friend = {
          id: uid(),
          name: payload.name,
          days: payload.days,
          bookings: payload.bookings,
          importedAt: Date.now(),
          generatedAt: payload.generatedAt
        }
        set({ friends: [...get().friends, friend] })
        return 'added'
      },

      deleteFriend: (id) => set({ friends: get().friends.filter((f) => f.id !== id) }),

      exportBackup: () =>
        JSON.stringify(
          {
            app: 'coukong',
            exportedAt: Date.now(),
            profile: get().profile,
            settings: get().settings,
            bookings: get().bookings,
            friends: get().friends
          },
          null,
          2
        ),

      importBackup: (raw) => {
        try {
          const data = JSON.parse(raw)
          if (data.app !== 'coukong' || !Array.isArray(data.bookings)) return false
          set({
            onboarded: true,
            profile: { ...DEFAULT_PROFILE, ...data.profile },
            settings: { ...DEFAULT_SETTINGS, ...data.settings },
            bookings: data.bookings,
            friends: Array.isArray(data.friends) ? data.friends : []
          })
          return true
        } catch {
          return false
        }
      },

      resetAll: () =>
        set({
          onboarded: false,
          profile: DEFAULT_PROFILE,
          settings: DEFAULT_SETTINGS,
          bookings: [],
          friends: [],
          modal: null
        })
    }),
    {
      name: 'coukong',
      partialize: (s) => ({
        onboarded: s.onboarded,
        profile: s.profile,
        settings: s.settings,
        bookings: s.bookings,
        friends: s.friends
      })
    }
  )
)
