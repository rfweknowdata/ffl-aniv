import { z } from 'zod';
import type { Channel } from './channel.js';

/**
 * Structural validation only. Trimming / "" -> null normalization happens in the API's
 * members service (co-located with the Prisma write), not here — keeps this schema simple.
 */
export const MemberInputSchema = z.object({
  internalId: z.string().trim().optional(),
  profaneName: z.string().trim().min(1, 'Nome profano é obrigatório'),
  mysticName: z.string().trim().optional().nullable(),
  birthDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'), z.literal(''), z.null()])
    .optional(),
  nif: z.string().trim().optional().nullable(),
  phoneNumber: z.string().trim().optional().nullable(),
  email: z.union([z.string().trim(), z.literal(''), z.null()]).optional(),
  memberNumber: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export type MemberInput = z.infer<typeof MemberInputSchema>;

export interface MemberDTO {
  id: string;
  internalId: string;
  profaneName: string;
  mysticName: string | null;
  birthDate: string | null;
  nif: string | null;
  phoneNumber: string | null;
  email: string | null;
  memberNumber: string | null;
  notes: string | null;
  channel: Channel;
  createdAt: string;
  updatedAt: string;
}
