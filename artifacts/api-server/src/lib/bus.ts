/**
 * Process-local event bus. Socket.IO registers the real emitter on startup;
 * until then (and for tests without sockets) events are no-ops. This keeps
 * REST handlers free of circular imports and lets the same code paths emit
 * realtime updates regardless of transport.
 */
type Emit = (userId: string, event: string, payload: unknown) => void;

let emit: Emit = () => {};

export function setEmitter(fn: Emit): void {
  emit = fn;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!userId) return;
  try {
    emit(userId, event, payload);
  } catch {
    /* realtime must never break the main flow */
  }
}

export function emitToProviders(providerIds: string[], event: string, payload: unknown): void {
  for (const id of providerIds) emitToUser(id, event, payload);
}
