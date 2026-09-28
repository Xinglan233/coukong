import type { CatalogActivity, CatalogSession, DayKey } from '../types'
import { toMinute } from './dates'

// 活动场次库：各活动准确场次截图给全后按此格式补全
export const CATALOG: CatalogActivity[] = [
  {
    id: 'a10-ys-checkin',
    booth: 'A-10',
    ip: '原神',
    title: '打卡活动',
    sessions: {
      '10-03': [{ start: '14:30', end: '15:30' }]
    }
  },
  {
    id: 'a09-sr-booth',
    booth: 'A-09',
    ip: '崩坏：星穹铁道',
    title: '展台活动',
    sessions: {
      '10-03': [{ start: '16:30', end: '17:30' }]
    }
  },
  {
    id: 'a11-zzz-night',
    booth: 'A-11',
    ip: '绝区零',
    title: '「布连邦」落地签-夜场',
    sessions: {
      '10-03': [{ start: '18:00', end: '21:00' }]
    }
  }
]

export function activitiesForDay(day: DayKey): CatalogActivity[] {
  return CATALOG.filter((a) => (a.sessions[day]?.length ?? 0) > 0)
}

export function findActivity(id: string): CatalogActivity | undefined {
  return CATALOG.find((a) => a.id === undefined ? false : a.id === id)
}

export function normalizeBooth(s: string): string {
  return s.replace(/[\s–—-]/g, '').toUpperCase()
}

export interface MatchedSession {
  activity: CatalogActivity
  session: CatalogSession
}

export function matchSession(
  day: DayKey,
  booth: string | undefined,
  start: string
): MatchedSession | null {
  let best: { hit: MatchedSession; delta: number } | null = null
  for (const activity of CATALOG) {
    const sessions = activity.sessions[day]
    if (!sessions) continue
    for (const session of sessions) {
      const delta = Math.abs(toMinute(session.start) - toMinute(start))
      const boothOk = !booth || normalizeBooth(activity.booth) === normalizeBooth(booth)
      if (boothOk && delta <= 20 && (!best || delta < best.delta)) {
        best = { hit: { activity, session }, delta }
      }
    }
  }
  return best ? best.hit : null
}
