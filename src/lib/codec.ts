import LZString from 'lz-string'
import type { Booking, DayKey, SharePayload } from '../types'

const PAYLOAD_VERSION = 1

export function makePayload(name: string, days: DayKey[], bookings: Booking[]): SharePayload {
  return { v: PAYLOAD_VERSION, name, days, bookings, generatedAt: Date.now() }
}

export function encodePayload(payload: SharePayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodePayload(encoded: string): Promise<SharePayload | null> {
  if (typeof encoded !== 'string' || encoded.length > 65536) return Promise.resolve(null)
  return new Promise(resolve => {
    const worker = new Worker(new URL('../online/legacy-worker.ts', import.meta.url), {type: 'module'})
    const finish = (value: SharePayload | null) => { clearTimeout(timeout); worker.terminate(); resolve(value) }
    const timeout = setTimeout(() => finish(null), 1500)
    worker.onmessage = event => finish(event.data)
    worker.onerror = () => finish(null)
    worker.postMessage(encoded)
  })
}

export async function decodeShareText(text: string): Promise<SharePayload | null> {
  if (text.length > 70000) return null
  const match = text.match(/(?:#|[&?])d=([^&\s]+)/)
  return decodePayload(match ? match[1] : text.trim())
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
