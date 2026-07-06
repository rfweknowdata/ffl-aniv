import nodemailer from 'nodemailer';
import { getDecryptedSmtpConfig } from '../settings/service.js';
import { AppError } from '../../lib/errors.js';

export class MailNotConfiguredError extends AppError {
  constructor() {
    super(422, 'SMTP não está configurado. Defina as credenciais em Definições.');
  }
}

async function buildTransport() {
  const cfg = await getDecryptedSmtpConfig();
  if (!cfg) throw new MailNotConfiguredError();
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
  });
  return { transport, cfg };
}

export interface SendPostcardEmailInput {
  to: string;
  subject: string;
  text: string;
  attachmentBuffer: Buffer;
  attachmentFilename: string;
}

export async function sendPostcardEmail(opts: SendPostcardEmailInput): Promise<void> {
  const { transport, cfg } = await buildTransport();
  await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: opts.to,
    replyTo: cfg.replyTo,
    subject: opts.subject,
    text: opts.text,
    attachments: [
      { filename: opts.attachmentFilename, content: opts.attachmentBuffer, contentType: 'application/pdf' },
    ],
  });
}

export async function sendTestEmail(to: string): Promise<void> {
  const { transport, cfg } = await buildTransport();
  await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to,
    subject: 'Teste de configuração SMTP — Fiat Lux',
    text: 'Este é um e-mail de teste. Se o recebeu, a configuração SMTP está a funcionar corretamente.',
  });
}
