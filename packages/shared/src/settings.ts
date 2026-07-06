import { z } from 'zod';

export const SettingsInputSchema = z.object({
  smtpHost: z.string().trim().optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().trim().optional().nullable(),
  /** Write-only. Omit or send "" to keep the currently stored password unchanged. */
  smtpPassword: z.string().optional(),
  fromName: z.string().trim().optional(),
  fromEmail: z.string().trim().optional().nullable(),
  replyTo: z.string().trim().optional().nullable(),
  sendHour: z.number().int().min(0).max(23).optional(),
  pushEnabled: z.boolean().optional(),
});

export type SettingsInput = z.infer<typeof SettingsInputSchema>;

/** Never includes the raw SMTP password — only whether one is currently set. */
export interface SettingsDTO {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPasswordSet: boolean;
  fromName: string;
  fromEmail: string | null;
  replyTo: string | null;
  sendHour: number;
  pushEnabled: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TestEmailInputSchema = z.object({
  to: z
    .string()
    .trim()
    .min(1, 'E-mail é obrigatório')
    .refine((v) => EMAIL_RE.test(v), 'E-mail inválido'),
});
export type TestEmailInput = z.infer<typeof TestEmailInputSchema>;
