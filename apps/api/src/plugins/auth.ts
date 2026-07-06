import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Auth seam: every /api route runs through this hook. It currently allows all
 * requests through — v1 ships with no login (product decision, PLAN.md §0).
 * Real authentication (session/JWT/etc.) plugs in here later without touching
 * any individual route handler.
 */
export async function requireAuth(_request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  // no-op for now — this is the seam.
}
