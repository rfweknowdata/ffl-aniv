import type { FastifyInstance } from 'fastify';
import { MemberInputSchema } from '@ffl/shared';
import { ValidationError } from '../../lib/errors.js';
import * as membersService from './service.js';
import { postcardFilename, renderPostcardPdf } from '../postcard/render.js';

export async function membersRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const { query } = request.query as { query?: string };
    return membersService.listMembers(query);
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return membersService.getMember(id);
  });

  app.post('/', async (request, reply) => {
    const parsed = MemberInputSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Dados inválidos', parsed.error.flatten());
    const member = await membersService.createMember(parsed.data);
    reply.code(201);
    return member;
  });

  app.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const parsed = MemberInputSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Dados inválidos', parsed.error.flatten());
    return membersService.updateMember(id, parsed.data);
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await membersService.deleteMember(id);
    reply.code(204).send();
  });

  app.get('/:id/postcard.pdf', async (request, reply) => {
    const { id } = request.params as { id: string };
    const member = await membersService.getMemberOrThrow(id);
    const pdf = await renderPostcardPdf({
      profaneName: member.profaneName,
      mysticName: member.mysticName,
      birthDate: member.birthDate,
    });
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${postcardFilename(member.profaneName)}"`)
      .send(pdf);
  });
}
