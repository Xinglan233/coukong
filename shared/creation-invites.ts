/** Creation capability only: never a member, group invitation or admin login. */
export interface CreationInviteDTO {
 id: string
 eventId: string
 eventTitle: string
 maxUses: 1
 usedCount: 0 | 1
 status: 'available' | 'used' | 'revoked' | 'expired'
 createdAt: string
 expiresAt: string
 usedGroupId: string | null
 revision: number
}
export interface CreateCreationInviteRequest {
 /** Client generates and retains 32 random bytes as 64 lowercase hex characters. */
 token: string
 operationId: string
 eventId: string
 /** Integer 1–168. Omitted means 24 hours. */
 ttlHours?: number
}
export interface RevokeCreationInviteRequest {
 operationId: string
 expectedRevision: number
}
