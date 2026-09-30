import type { EventPackage, ParticipantResponse } from './types'
export type EventType = 'generic' | 'comic_convention'
export type EventStatus = 'draft' | 'published' | 'archived' | 'cancelled'
export interface Point { x: number; y: number }
export interface MapData { id: string; title: string; assetKey: string; width: number; height: number; revision: number; coordinateSpace: 'normalized-image-top-left'; sourceNote?: string; needsReview?: boolean }
export interface Position extends Point { mapId: string; mapRevision: number }
export type POIKind = 'booth' | 'stage' | 'entrance' | 'exit' | 'service' | 'toilet' | 'food' | 'medical' | 'rest' | 'meeting'
export interface POI { id: string; name: string; kind: POIKind; boothCode?: string; tags?: string[]; description?: string; position?: Position; routeNodeId?: string; sourceNote?: string; closed?: boolean }
export interface RouteNode extends Point { id: string }
export interface RouteEdge { id: string; from: string; to: string; bidirectional: boolean; enabled: boolean; reviewed: boolean; geometry?: Point[]; closedDates?: string[]; distanceMeters?: number; estimatedTravelSeconds?: number }
export interface RoutingGraph { id: string; mapId: string; mapRevision: number; revision: number; nodes: RouteNode[]; edges: RouteEdge[]; sourceNote?: string }
export interface ConventionData { maps: MapData[]; pois: POI[]; routingGraphs: RoutingGraph[] }
export interface AssetManifestEntry { assetKey: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number; sizeBytes: number; sha256: string }
export interface ActivityDTO { id: string; revision: number; scheduleRevision: number; spatialRevision: number; status: EventStatus; eventPackage: EventPackage; updatedAt: string }
export interface Favorite { poiId: string; visited: boolean }
export interface RouteStop { poiId: string; visited: boolean; stayMinutes?: number; queueMinutes?: number }
export interface PersonalRoute { date: string; mapId?: string; startPoiId?: string; stops: RouteStop[]; spatialRevision: number }
export interface PersonalPlan { response: ParticipantResponse; favorites: Favorite[]; routes: PersonalRoute[] }
export interface PersonalDTO { id: string; eventId: string; revision: number; scheduleRevision: number; spatialRevision: number; plan: PersonalPlan; updatedAt: string }
export interface PersonalCapability { eventId: string; personId?: string; token: string; operationId: string }
export interface MediaAssetDTO { id: string; eventId: string; assetKey: string; state: 'pending' | 'processing' | 'ready' | 'failed' | 'revoked'; mimeType?: string; width?: number; height?: number; sizeBytes?: number; sha256?: string; displaySizeBytes?: number; revision: number }
export const ACTIVITY_LIMITS = { packageBytes: 1024 * 1024, maps: 5, pois: 1000, nodes: 2000, edges: 4000, sourceBytes: 12 * 1024 * 1024, pixels: 24_000_000, routeStops: 100, favorites: 1000, personalPlanBytes: 1536 * 1024, visitorStorageBytes: 128 * 1024 * 1024, idempotencyReceipts: 64, idempotencyTTLSeconds: 24 * 60 * 60 } as const
