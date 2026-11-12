import type { Rooms } from '../src/server/rooms';

/** The guest joins, marks ready, the host starts: the old "join starts the game" flow in one call (Phase 3 made it three steps). */
export async function joinStart(rooms: Rooms, host: { code: string; token: string }, deck?: unknown, evo?: unknown, key?: string) {
  const b = await rooms.join(host.code, deck, evo, key);
  await rooms.view(host.code, b.token);                // the guest is "connected": presence is stamped on poll
  await rooms.ready(host.code, b.token, true);
  await rooms.start(host.code, host.token);
  return b;
}
