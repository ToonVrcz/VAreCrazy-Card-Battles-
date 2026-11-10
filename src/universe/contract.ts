// Local copy of the VAreCrazy Universe module contract (apps/game/src/games/types.ts in xaphdev/VAreCrazy_Project).
// Kept structural and dependency-free so this repo never imports the Universe code. When connecting, copy
// src/universe/module.ts into apps/game/src/games/card-battle/ and import these types from '../types' instead.
export interface Tri { en: string; th: string; key?: string }
export interface ModuleSeat { id: string; displayName: string; seatNumber: number }
export interface ModuleCtx { now: number; random: () => number; content?: unknown; live?: unknown }
export type ActResult = { ok: true } | { ok: false; error: string; save?: boolean };
export interface ModuleOutcome {
  winners: string[];
  roles: Record<string, { role: string; faction: string }>;
  winnerFaction: 'VILLAGE' | 'SOLO';
  points: Record<string, number>;
}
export interface GameModule<State, View, Settings> {
  id: string; minPlayers: number; maxPlayers: number;
  minPlayersFor?(settings: Settings): number;
  defaultSettings(): Settings;
  sanitizeSettings(input: unknown): Settings;
  start(seats: ModuleSeat[], settings: Settings, ctx: ModuleCtx): State;
  act(state: State, seats: ModuleSeat[], playerId: string, action: unknown, ctx: ModuleCtx): ActResult;
  tick(state: State, seats: ModuleSeat[], ctx: ModuleCtx): boolean;
  deadline(state: State): number | null;
  view(state: State, seats: ModuleSeat[], viewerId: string, live?: unknown): View;
  outcome(state: State): ModuleOutcome | null;
  silenced?(state: State, playerId: string): string | null;
}
