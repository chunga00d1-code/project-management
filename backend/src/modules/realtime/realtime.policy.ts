import type { RealtimeEvent } from "./realtime.service.js";
export function canReceiveRealtimeEvent(event: RealtimeEvent, context: { isAdmin: boolean; userId: string; projectIds: Set<string> }) { return context.isAdmin || event.userId === context.userId || Boolean(event.projectId && context.projectIds.has(event.projectId)); }
