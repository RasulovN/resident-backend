import type { WebSocket } from '@fastify/websocket';

const pool = new Map<string, Set<WebSocket>>();

export function wsAdd(userId: string, ws: WebSocket) {
  if (!pool.has(userId)) pool.set(userId, new Set());
  pool.get(userId)!.add(ws);
}

export function wsRemove(userId: string, ws: WebSocket) {
  const set = pool.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) pool.delete(userId);
}

export function wsSend(userId: string, data: unknown) {
  const sockets = pool.get(userId);
  if (!sockets) return;
  const json = JSON.stringify(data);
  for (const ws of sockets) {
    if (ws.readyState === 1) ws.send(json);
  }
}

export function wsBroadcast(userIds: string[], data: unknown) {
  for (const id of userIds) wsSend(id, data);
}
