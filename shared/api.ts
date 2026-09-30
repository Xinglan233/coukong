export const API_PREFIX = '/api/v1'
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('')
}
export function operationId(): string { return crypto.randomUUID() }
export const GROUP_ROUTES = { group: '', members: '/members', availability: '/availability', join: '/join', preview: '/event-import/preview', commit: '/event-import/commit', export: '/event-export', rotate: '/invite/rotate' } as const
