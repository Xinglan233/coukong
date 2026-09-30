export const LIMITS = { packageBytes: 512 * 1024, days: 31, activities: 1000, sessions: 1000, intervals: 24, busy: 500, members: 50 } as const
export type SelectionStep = 5 | 10 | 15 | 30
export interface TimeInterval { start: string; end: string }
export interface DatedInterval extends TimeInterval { date: string }
export interface EventSession extends DatedInterval { id: string; location?: string }
export interface EventActivity { id: string; title: string; description?: string; location?: string; tags?: string[]; sessions: EventSession[] }
export interface EventData {
  id: string; title: string; description?: string; location?: string; timezone: string
  startDate: string; endDate: string; defaultBufferMinutes: number; defaultMinSlotMinutes: number
  defaultSelectionStepMinutes: SelectionStep
  days: { date: string; openIntervals: TimeInterval[] }[]; activities: EventActivity[]
}
export interface EventPackage { kind: 'coukong.event'; schemaVersion: 1; event: EventData; meta?: { isExample?: boolean; sourceNote?: string } }
export interface BusyItem extends DatedInterval { id: string; title: string; location?: string; note?: string; source: 'manual' | 'session' | 'legacy'; sessionId?: string }
export interface ParticipantResponse { name: string; presence: { date: string; intervals: TimeInterval[] }[]; busy: BusyItem[]; bufferMinutes: number }
export type ParticipantStatus = 'unsubmitted' | 'confirmed' | 'needs_review'
export interface MemberSummary { id: string; name: string; status: ParticipantStatus; revision: number; confirmedScheduleRevision: number | null; updatedAt: string; submittedAt: string | null }
export interface MemberResponseDTO { member: MemberSummary; response: ParticipantResponse | null }
export interface GroupDTO { id: string; title: string; status: 'open' | 'closed' | 'archived'; revision: number; scheduleRevision: number; eventPackage: EventPackage; createdAt: string; updatedAt: string }
export interface AvailabilityPerson extends MemberSummary { availability: DatedInterval[] }
export interface AvailabilityDTO { members: AvailabilityPerson[]; scheduleRevision: number; updatedAt: string }
export interface EventPreview { eventPackage: EventPackage; changed: boolean; scheduleChanged: boolean; warnings: string[]; added: string[]; removed: string[]; modified: string[]; expectedRevision: number }
export interface TemplateDTO { id: string; revision: number; published: boolean; eventPackage: EventPackage; updatedAt: string }
export interface CapabilityRecord { groupId: string; token: string; role: 'invite' | 'manager' | 'member'; memberId?: string; title?: string }
export interface ApiErrorBody { error: { code: string; message: string; fields?: { path: string; message: string }[] } }
export interface SubmitRequest { operationId: string; expectedRevision: number; scheduleRevision: number; response: ParticipantResponse }
export interface CreateRequest { operationId: string; managerToken: string; inviteToken: string; creationCode: string; eventPackage: EventPackage }
export interface JoinRequest { operationId: string; memberToken: string; name: string }
