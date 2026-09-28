import LZString from 'lz-string'
import type { Booking, DayKey, SharePayload } from '../types'

const PAYLOAD_VERSION = 1

export function makePayload(name: string, days: DayKey[], bookings: Booking[]): SharePayload {
  return { v: PAYLOAD_VERSION, name, days, bookings, generatedAt: Date.now() }
}

export function encodePayload(payload: SharePayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodePayload(encoded: string): SharePayload | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded.trim())
    if (!json) return null
    const data = JSON.parse(json)
    if (!data || typeof data.name !== 'string' || !Array.isArray(data.bookings) || !Array.isArray(data.days)) {
      return null
    }
    return data as SharePayload
  } catch {
    return null
  }
}

export function shareUrl(encoded: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#d=${encoded}`
}

export function readHashPayload(): string | null {
  const m = window.location.hash.match(/d=([^&]+)/)
  return m ? m[1] : null
}

export function clearHash(): void {
  window.history.replaceState(null, '', window.location.pathname)
}
