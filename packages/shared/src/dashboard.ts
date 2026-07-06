import type { Channel } from './channel.js';
import type { SendStatus } from './send.js';

export interface DashboardMemberSummary {
  memberId: string;
  profaneName: string;
  mysticName: string | null;
  day: number;
  month: number;
  channel: Channel;
}

export interface DashboardSendSummary {
  memberId: string;
  profaneName: string;
  channel: Channel;
  status: SendStatus;
  sentAt: string | null;
}

export interface DashboardResponse {
  emailsSentThisYear: number;
  emailsSentAllTime: number;
  sentCount: number;
  todayCount: number;
  upcomingCount: number;
  pendingManualCount: number;
  membersTotal: number;
  membersWithoutContact: number;
  todayBirthdays: DashboardMemberSummary[];
  upcoming: DashboardMemberSummary[];
  recentSends: DashboardSendSummary[];
  /** 12 numbers, Jan..Dec, count of successful e-mail sends this year by calendar month sent. */
  sendsByMonth: number[];
}
