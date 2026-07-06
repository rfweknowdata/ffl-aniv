import { prisma } from '../../db.js';
import { logger } from '../../lib/logger.js';
import { todayInTz } from '../../lib/tz.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { channelOf, type AgendaItemDTO, type AgendaResponse, type RunDailyJobResult, type SendStatus } from '@ffl/shared';
import { postcardFilename, renderPostcardPdf } from '../postcard/render.js';
import { sendPostcardEmail } from '../mail/service.js';
import { notifyAll } from '../push/service.js';

/**
 * True once a member's birthday has arrived this year (today or earlier). Manual actions
 * (mark-sent, resend) are only meaningful for birthdays that are actually due — allowing
 * them for a future birthday would let the daily job's idempotency check skip it when the
 * real date arrives. Enforced server-side too, not just hidden in the UI.
 */
function isBirthdayDue(member: { birthMonth: number | null; birthDay: number | null }): boolean {
  if (member.birthMonth == null || member.birthDay == null) return false;
  const { month, day } = todayInTz();
  return member.birthMonth * 100 + member.birthDay <= month * 100 + day;
}

const POSTCARD_SUBJECT = 'Feliz Aniversário 🎉';

function postcardBody(profaneName: string): string {
  const firstName = profaneName.trim().split(/\s+/)[0] ?? profaneName;
  return `Caro(a) ${firstName},\n\nFeliz aniversário! Em anexo o seu postal.\n\nNamastê.`;
}

export async function runDailyJob(): Promise<RunDailyJobResult> {
  const { month, day, year } = todayInTz();
  const members = await prisma.member.findMany({ where: { birthMonth: month, birthDay: day } });

  let emailed = 0;
  let pendingManual = 0;
  let skipped = 0;
  let failed = 0;
  const emailedNames: string[] = [];

  for (const member of members) {
    const existing = await prisma.sendLog.findUnique({ where: { memberId_year: { memberId: member.id, year } } });
    if (existing && (existing.status === 'sent' || existing.status === 'pending_manual')) continue;

    const channel = channelOf(member);

    if (channel === 'email') {
      try {
        const pdf = await renderPostcardPdf(
          { profaneName: member.profaneName, mysticName: member.mysticName, birthDate: member.birthDate },
          year,
        );
        await sendPostcardEmail({
          to: member.email!,
          subject: POSTCARD_SUBJECT,
          text: postcardBody(member.profaneName),
          attachmentBuffer: pdf,
          attachmentFilename: postcardFilename(member.profaneName),
        });
        await prisma.sendLog.upsert({
          where: { memberId_year: { memberId: member.id, year } },
          create: { memberId: member.id, year, channel: 'email', status: 'sent', sentAt: new Date() },
          update: { status: 'sent', sentAt: new Date(), error: null },
        });
        emailed++;
        emailedNames.push(member.profaneName);
      } catch (err) {
        logger.error({ err, memberId: member.id }, 'Failed to send postcard email');
        await prisma.sendLog.upsert({
          where: { memberId_year: { memberId: member.id, year } },
          create: { memberId: member.id, year, channel: 'email', status: 'failed', error: String(err) },
          update: { status: 'failed', error: String(err) },
        });
        failed++;
      }
    } else if (channel === 'whatsapp') {
      await prisma.sendLog.upsert({
        where: { memberId_year: { memberId: member.id, year } },
        create: { memberId: member.id, year, channel: 'whatsapp', status: 'pending_manual' },
        update: { status: 'pending_manual' },
      });
      pendingManual++;
    } else {
      await prisma.sendLog.upsert({
        where: { memberId_year: { memberId: member.id, year } },
        create: { memberId: member.id, year, channel: 'none', status: 'skipped' },
        update: { status: 'skipped' },
      });
      skipped++;
    }
  }

  if (emailedNames.length > 0) {
    if (emailedNames.length <= 5) {
      for (const name of emailedNames) {
        await notifyAll({ title: 'Postal enviado 🎉', body: `Enviado a ${name} por e-mail` });
      }
    } else {
      await notifyAll({
        title: 'Postais enviados 🎉',
        body: `${emailedNames.length} postais enviados por e-mail hoje`,
      });
    }
  }

  logger.info({ emailed, pendingManual, skipped, failed }, 'Daily job finished');
  return { emailed, pendingManual, skipped, failed };
}

export async function getAgenda(): Promise<AgendaResponse> {
  const { month, day, year } = todayInTz();
  const todayKey = month * 100 + day;

  const members = await prisma.member.findMany({
    where: { birthMonth: { not: null }, birthDay: { not: null } },
    orderBy: [{ birthMonth: 'asc' }, { birthDay: 'asc' }],
  });
  const logs = await prisma.sendLog.findMany({ where: { year } });
  const logByMember = new Map(logs.map((l) => [l.memberId, l]));

  const hoje: AgendaItemDTO[] = [];
  const proximos: AgendaItemDTO[] = [];
  const enviados: AgendaItemDTO[] = [];

  for (const m of members) {
    const key = m.birthMonth! * 100 + m.birthDay!;
    const log = logByMember.get(m.id);
    const item: AgendaItemDTO = {
      memberId: m.id,
      internalId: m.internalId,
      profaneName: m.profaneName,
      mysticName: m.mysticName,
      day: m.birthDay!,
      month: m.birthMonth!,
      channel: channelOf(m),
      email: m.email,
      phoneNumber: m.phoneNumber,
      status: (log?.status as SendStatus | undefined) ?? undefined,
    };
    if (key === todayKey) hoje.push(item);
    else if (key > todayKey) proximos.push(item);
    else enviados.push(item);
  }

  return { year, hoje, proximos, enviados };
}

export async function markSent(memberId: string): Promise<void> {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new NotFoundError('Sócio não encontrado');
  if (!isBirthdayDue(member)) throw new ValidationError('O aniversário deste sócio ainda não chegou.');
  const { year } = todayInTz();
  await prisma.sendLog.upsert({
    where: { memberId_year: { memberId, year } },
    create: { memberId, year, channel: 'whatsapp', status: 'sent', sentAt: new Date() },
    update: { status: 'sent', sentAt: new Date(), error: null },
  });
}

export async function resend(memberId: string): Promise<void> {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new NotFoundError('Sócio não encontrado');
  if (!member.email) throw new ValidationError('Sócio não tem e-mail.');
  if (!isBirthdayDue(member)) throw new ValidationError('O aniversário deste sócio ainda não chegou.');
  const { year } = todayInTz();
  const pdf = await renderPostcardPdf(
    { profaneName: member.profaneName, mysticName: member.mysticName, birthDate: member.birthDate },
    year,
  );
  await sendPostcardEmail({
    to: member.email,
    subject: POSTCARD_SUBJECT,
    text: postcardBody(member.profaneName),
    attachmentBuffer: pdf,
    attachmentFilename: postcardFilename(member.profaneName),
  });
  await prisma.sendLog.upsert({
    where: { memberId_year: { memberId, year } },
    create: { memberId, year, channel: 'email', status: 'sent', sentAt: new Date() },
    update: { status: 'sent', sentAt: new Date(), error: null },
  });
}

export async function runNow(): Promise<RunDailyJobResult> {
  return runDailyJob();
}
