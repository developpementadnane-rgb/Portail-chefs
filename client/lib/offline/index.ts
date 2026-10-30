/**
 * Public surface of the offline module. Pages/components should
 * import from here rather than reaching into individual files, so
 * the internal split (db/deviceTrust/syncQueue/membersCache/
 * sessionsCache/orchestrator) can evolve without touching call sites.
 */

export {
  getOrCreateDeviceId,
  isDeviceTrusted,
  getDeviceTrustExpiry,
  clearDeviceTrust,
} from "./deviceTrust";

export {
  unlockFieldAccess,
  hasFieldAccess,
  clearFieldAccess,
  getFieldAccessHeaders,
} from "./teamAccess";

export {
  getOfflineAccessMode,
  hasAnyOfflineAccess,
  getOfflineAuthHeaders,
  getOfflineChefId,
  type OfflineAccessMode,
} from "./accessMode";

export {
  queueAttendance,
  getQueueLength,
  getCachedAttendanceForSession,
  flushQueue,
  refreshAttendanceCacheForSession,
  type AttendanceStatus,
  type AttendanceCacheEntry,
} from "./syncQueue";

export {
  downloadMembersForOffline,
  getCachedMembers,
  getCachedMemberById,
  getMembersLastSyncedAt,
  searchCachedMembers,
  type CachedMember,
} from "./membersCache";

export {
  downloadRelevantSessionsForOffline,
  getCachedSessions,
  getCachedSessionById,
  getSessionsLastSyncedAt,
  type CachedSession,
} from "./sessionsCache";

export { runInitialSync, runReconnectSync } from "./orchestrator";
export type { InitialSyncResult, ReconnectSyncResult } from "./orchestrator";
