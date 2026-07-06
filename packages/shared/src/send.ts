import type { Channel } from './channel.js';

export type SendStatus = 'sent' | 'failed' | 'pending_manual' | 'skipped';

export interface SendLogDTO {
  id: string;
  memberId: string;
  year: number;
  /** 'none' shows up here for members with no contact channel — see the "skipped" case. */
  channel: Channel;
  status: SendStatus;
  sentAt: string | null;
  error: string | null;
}

export type AgendaGroup = 'hoje' | 'proximos' | 'enviados';

export interface AgendaItemDTO {
  memberId: string;
  internalId: string;
  profaneName: string;
  mysticName: string | null;
  day: number;
  month: number;
  channel: Channel;
  email: string | null;
  phoneNumber: string | null;
  /** Present once a SendLog row exists for this member/year; absent for pure "upcoming" items. */
  status?: SendStatus;
}

export interface AgendaResponse {
  year: number;
  hoje: AgendaItemDTO[];
  proximos: AgendaItemDTO[];
  enviados: AgendaItemDTO[];
}

export interface RunDailyJobResult {
  emailed: number;
  pendingManual: number;
  skipped: number;
  failed: number;
}
