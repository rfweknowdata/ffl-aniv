import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { getSendHour } from '../modules/settings/service.js';
import { runDailyJob } from '../modules/sends/service.js';

let task: ScheduledTask | null = null;

async function scheduleForCurrentHour(): Promise<void> {
  const hour = await getSendHour();
  if (task) task.stop();
  task = cron.schedule(
    `0 ${hour} * * *`,
    async () => {
      logger.info({ hour }, 'Running scheduled daily job');
      try {
        await runDailyJob();
      } catch (err) {
        logger.error({ err }, 'Daily job failed');
      }
    },
    { timezone: config.timezone },
  );
  logger.info({ hour, timezone: config.timezone }, 'Daily job scheduled');
}

export async function startScheduler(): Promise<void> {
  await scheduleForCurrentHour();
  // Startup catch-up — idempotent, so harmless even if today's birthdays were already handled.
  try {
    await runDailyJob();
  } catch (err) {
    logger.error({ err }, 'Startup catch-up run failed');
  }
}

/** Call after Settings.sendHour changes so the cron reflects the new time without a restart. */
export async function rescheduleForNewSendHour(): Promise<void> {
  await scheduleForCurrentHour();
}
