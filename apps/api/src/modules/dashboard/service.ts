import { prisma } from '../../db.js';
import { todayInTz, toTz } from '../../lib/tz.js';
import type {
  AgendaItemDTO,
  Channel,
  DashboardMemberSummary,
  DashboardResponse,
  DashboardSendSummary,
  SendStatus,
} from '@ffl/shared';
import { getAgenda } from '../sends/service.js';

function toDashboardMemberSummary(item: AgendaItemDTO): DashboardMemberSummary {
  return {
    memberId: item.memberId,
    profaneName: item.profaneName,
    mysticName: item.mysticName,
    day: item.day,
    month: item.month,
    channel: item.channel,
  };
}

const UPCOMING_LIMIT = 10;
const RECENT_SENDS_LIMIT = 10;

export async function getDashboard(): Promise<DashboardResponse> {
  const { year } = todayInTz();

  const [membersTotal, membersWithoutContact, emailsSentThisYear, emailsSentAllTime, pendingManualCount, agenda] =
    await Promise.all([
      prisma.member.count(),
      prisma.member.count({ where: { email: null, phoneNumber: null } }),
      prisma.sendLog.count({ where: { year, channel: 'email', status: 'sent' } }),
      prisma.sendLog.count({ where: { channel: 'email', status: 'sent' } }),
      prisma.sendLog.count({ where: { year, status: 'pending_manual' } }),
      getAgenda(),
    ]);

  const recentLogs = await prisma.sendLog.findMany({
    where: { year },
    orderBy: { createdAt: 'desc' },
    take: RECENT_SENDS_LIMIT,
    include: { member: true },
  });
  const recentSends: DashboardSendSummary[] = recentLogs.map((l) => ({
    memberId: l.memberId,
    profaneName: l.member.profaneName,
    channel: l.channel as Channel,
    status: l.status as SendStatus,
    sentAt: l.sentAt ? l.sentAt.toISOString() : null,
  }));

  const sentLogsThisYear = await prisma.sendLog.findMany({
    where: { year, status: 'sent', channel: 'email', sentAt: { not: null } },
    select: { sentAt: true },
  });
  const sendsByMonth = new Array(12).fill(0) as number[];
  for (const log of sentLogsThisYear) {
    if (log.sentAt) sendsByMonth[toTz(log.sentAt).month()]++;
  }

  return {
    emailsSentThisYear,
    emailsSentAllTime,
    sentCount: agenda.enviados.length,
    todayCount: agenda.hoje.length,
    upcomingCount: agenda.proximos.length,
    pendingManualCount,
    membersTotal,
    membersWithoutContact,
    todayBirthdays: agenda.hoje.map(toDashboardMemberSummary),
    upcoming: agenda.proximos.slice(0, UPCOMING_LIMIT).map(toDashboardMemberSummary),
    recentSends,
    sendsByMonth,
  };
}
