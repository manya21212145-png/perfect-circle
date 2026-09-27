// Duel rooms: 4-character codes, plus the messages sent between phone and PC server.

import type { Shape } from '../scoring/templates';
import type { Mode } from '../modes';
import type { Stroke } from '../scoring/types';
import type { RejectReason } from '../scoring/validate';

/** No O, 0, I or 1: they are easy to mix up when typing a code. */
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

export function makeRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_CHARS[Math.floor(random() * ROOM_CODE_CHARS.length)];
  return code;
}

export function isRoomCode(text: string): boolean {
  return new RegExp(`^[${ROOM_CODE_CHARS}]{${ROOM_CODE_LENGTH}}$`).test(text);
}

export type Seat = 'host' | 'guest';

// ---- Socket.IO events (Technical Design: join, ready, countdown, progress, stroke,
//      round_result, match_result) ----

export interface JoinRequest { code?: string; nickname: string; seatToken?: string }
export interface JoinReply { ok: boolean; error?: string; code?: string; seat?: Seat; seatToken?: string }

export interface RoomState {
  code: string;
  players: { host: string | null; guest: string | null };
  connected: { host: boolean; guest: boolean };
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  wins: { host: number; guest: number };
  round: number;
}

export interface Countdown {
  round: number;
  shape: Shape;
  mode: Mode;
  limitS?: number;
  startAt: number;   // server time the drawing starts (same for both players)
  serverNow: number; // server time when this message was sent
}

export interface StrokeMessage {
  round: number;
  /** 128 points relative to the dot's resting place, t = ms since round start. Empty if failed. */
  stroke: Stroke;
  failed?: RejectReason;
}

export interface RoundResult {
  round: number;
  scores: { host: number; guest: number };
  reasons: { host?: string; guest?: string };
  finishMs: { host: number; guest: number };
  winner: Seat;
  wins: { host: number; guest: number };
}

export interface MatchResult {
  winner: Seat;
  wins: { host: number; guest: number };
  reason: 'wins' | 'disconnect';
  players: { host: string | null; guest: string | null };
}
