import webpush from 'web-push';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { getSettings, setPushEnabled } from '../settings/service.js';
import type { PushDeviceDTO } from '@ffl/shared';

webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export async function subscribe(input: PushSubscriptionInput): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent,
    },
    update: { p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent },
  });
  // A device subscribing is a clear signal push should be (re)activated — the admin can
  // still pause it globally later via Definições without losing device registrations.
  await setPushEnabled(true);
}

/** Self-service unsubscribe — used by the device that owns the subscription (knows its own endpoint). */
export async function unsubscribe(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/** Admin-initiated removal from the device list — identified by DB id, not the raw endpoint. */
export async function removeDevice(id: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { id } });
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export async function listDevices(): Promise<PushDeviceDTO[]> {
  const subs = await prisma.pushSubscription.findMany({ orderBy: { createdAt: 'desc' } });
  return subs.map((s) => ({
    id: s.id,
    endpointHost: safeHost(s.endpoint),
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
  }));
}

export interface NotifyPayload {
  title: string;
  body: string;
}

export async function notifyAll(payload: NotifyPayload): Promise<void> {
  const settings = await getSettings();
  if (!settings.pushEnabled) return;
  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return;
  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, data);
      } catch (err) {
        const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          logger.error({ err, subId: sub.id }, 'Push notification failed');
        }
      }
    }),
  );
}
