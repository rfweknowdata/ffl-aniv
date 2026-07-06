import type { FastifyInstance } from 'fastify';
import * as sendsService from './service.js';

export async function sendsRoutes(app: FastifyInstance) {
  app.get('/agenda', async () => sendsService.getAgenda());

  app.post('/run', async () => sendsService.runNow());

  app.post('/:memberId/mark-sent', async (request) => {
    const { memberId } = request.params as { memberId: string };
    await sendsService.markSent(memberId);
    return { ok: true };
  });

  app.post('/:memberId/resend', async (request) => {
    const { memberId } = request.params as { memberId: string };
    await sendsService.resend(memberId);
    return { ok: true };
  });
}
