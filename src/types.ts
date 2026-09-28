export type DayKey = '10-02' | '10-03' | '10-04' | '10-05' | '10-06'

export const DAY_KEYS: DayKey[] = ['10-02', '10-03', '10-04', '10-05', '10-06']

export type BookingSource = 'catalog' | 'manual' | 'ocr'

export interface Booking {
  id: string
  day: DayKey
  start: string
  end: string
  booth?: string
  ip?: string
  title: string
  note?: string
  source: BookingSource
}

export interface Profile {
  name: string
  days: DayKey[]
}

export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Settings {
  bufferMinutes: number
  themeMode: ThemeMode
  openHour: number
  closeHour: number
  minSlotMinutes: number
}

export interface Friend {
  id: string
  name: string
  days: DayKey[]
  bookings: Booking[]
  importedAt: number
  generatedAt?: number
}

export interface SharePayload {
  v: number
  name: string
  days: DayKey[]
  bookings: Booking[]
  generatedAt: number
}

export interface CatalogSession {
  start: string
  end: string
}

export interface CatalogActivity {
  id: string
  booth: string
  ip: string
  title: string
  sessions: Partial<Record<DayKey, CatalogSession[]>>
}

export interface Interval {
  start: number
  end: number
}

export interface RawBooking extends Omit<Booking, 'id' | 'day' | 'source'> {
  day: DayKey | null
  confidence: number
}

export interface RecognitionGroup {
  fileName: string
  bookings: RawBooking[]
  multiDay: boolean
}
