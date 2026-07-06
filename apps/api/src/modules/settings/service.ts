import { prisma } from '../../db.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import type { SettingsDTO, SettingsInput } from '@ffl/shared';
import type { Prisma } from '../../generated/prisma/client.js';

const SETTINGS_ID = 1;

async function ensureSettingsRow() {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

function toDTO(s: Awaited<ReturnType<typeof ensureSettingsRow>>): SettingsDTO {
  return {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpSecure: s.smtpSecure,
    smtpUser: s.smtpUser,
    smtpPasswordSet: !!s.smtpPassword,
    fromName: s.fromName,
    fromEmail: s.fromEmail,
    replyTo: s.replyTo,
    sendHour: s.sendHour,
    pushEnabled: s.pushEnabled,
  };
}

export async function getSettings(): Promise<SettingsDTO> {
  return toDTO(await ensureSettingsRow());
}

function strOrNull(v?: string | null): string | null | undefined {
  if (v === undefined) return undefined;
  const t = (v ?? '').trim();
  return t ? t : null;
}

export async function updateSettings(input: SettingsInput): Promise<SettingsDTO> {
  await ensureSettingsRow();

  const data: Prisma.SettingsUpdateInput = {
    smtpHost: strOrNull(input.smtpHost),
    smtpPort: input.smtpPort ?? undefined,
    smtpSecure: input.smtpSecure ?? undefined,
    smtpUser: strOrNull(input.smtpUser),
    fromName: input.fromName?.trim() || undefined,
    fromEmail: strOrNull(input.fromEmail),
    replyTo: strOrNull(input.replyTo),
    sendHour: input.sendHour ?? undefined,
    pushEnabled: input.pushEnabled ?? undefined,
  };

  if (input.smtpPassword && input.smtpPassword.trim()) {
    data.smtpPassword = encrypt(input.smtpPassword.trim());
  }

  const updated = await prisma.settings.update({ where: { id: SETTINGS_ID }, data });
  return toDTO(updated);
}

export async function setPushEnabled(enabled: boolean): Promise<void> {
  await ensureSettingsRow();
  await prisma.settings.update({ where: { id: SETTINGS_ID }, data: { pushEnabled: enabled } });
}

/** Internal use only (mail service) — decrypted credentials never cross the HTTP boundary. */
export interface DecryptedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
}

export async function getDecryptedSmtpConfig(): Promise<DecryptedSmtpConfig | null> {
  const s = await ensureSettingsRow();
  if (!s.smtpHost || !s.smtpPort || !s.smtpUser || !s.smtpPassword) return null;
  return {
    host: s.smtpHost,
    port: s.smtpPort,
    secure: s.smtpSecure,
    user: s.smtpUser,
    password: decrypt(s.smtpPassword),
    fromName: s.fromName,
    fromEmail: s.fromEmail || s.smtpUser,
    replyTo: s.replyTo || undefined,
  };
}

export async function getSendHour(): Promise<number> {
  const s = await ensureSettingsRow();
  return s.sendHour;
}
