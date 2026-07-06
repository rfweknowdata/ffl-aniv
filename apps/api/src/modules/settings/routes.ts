import type { FastifyInstance } from 'fastify';
import { SettingsInputSchema, TestEmailInputSchema } from '@ffl/shared';
import { ValidationError } from '../../lib/errors.js';
import * as settingsService from './service.js';
import { sendTestEmail } from '../mail/service.js';
import { rescheduleForNewSendHour } from '../../jobs/scheduler.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', async () => settingsService.getSettings());

  app.put('/', async (request) => {
    const parsed = SettingsInputSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Dados inválidos', parsed.error.flatten());
    const updated = await settingsService.updateSettings(parsed.data);
    if (parsed.data.sendHour !== undefined) await rescheduleForNewSendHour();
    return updated;
  });

  app.post('/test-email', async (request) => {
    const parsed = TestEmailInputSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Dados inválidos', parsed.error.flatten());
    await sendTestEmail(parsed.data.to);
    return { ok: true };
  });
}
