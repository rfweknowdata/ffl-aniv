import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../../config.js';
import { ValidationError } from '../../lib/errors.js';
import * as pushService from './service.js';

const SubscribeSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const UnsubscribeSchema = z.object({ endpoint: z.string().min(1) });

export async function pushRoutes(app: FastifyInstance) {
  app.get('/vapid', async () => ({ publicKey: config.vapidPublicKey }));

  app.post('/subscribe', async (request) => {
    const parsed = SubscribeSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Dados inválidos', parsed.error.flatten());
    const userAgent = request.headers['user-agent'];
    await pushService.subscribe({ ...parsed.data, userAgent });
    return { ok: true };
  });

  app.post('/unsubscribe', async (request) => {
    const parsed = UnsubscribeSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Dados inválidos', parsed.error.flatten());
    await pushService.unsubscribe(parsed.data.endpoint);
    return { ok: true };
  });

  app.get('/devices', async () => pushService.listDevices());

  app.delete('/devices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await pushService.removeDevice(id);
    reply.code(204).send();
  });
}
