import type { RoomSnapshot, RoomSettings, PublicPlayer, RoundResult } from "@/server/rooms";
import type { PublicRound, RevealPayload } from "@/engine/types";

export type { RoomSnapshot, RoomSettings, PublicPlayer, RoundResult };

export interface RoundMsg {
  round: PublicRound;
  index: number;
  total: number;
  stage: number;
  deadline: number;
  serverNow: number;
  modifier?: { id: string; label: string; icon: string };
  notice?: string;
  paused: boolean;
}

export interface ChatMsg {
  id: string;
  playerId: string;
  name: string;
  avatar: string;
  photo?: string | null;
  color: string;
  text: string;
  at: number;
  system?: boolean;
}

export type RoomReveal = RevealPayload & { extra?: RevealPayload["extra"] & { results?: RoundResult[] } };
