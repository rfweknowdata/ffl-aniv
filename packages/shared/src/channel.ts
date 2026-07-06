export type Channel = 'email' | 'whatsapp' | 'none';

export interface ChannelInput {
  email?: string | null;
  phoneNumber?: string | null;
}

/**
 * Ported verbatim from design-system/Canvas.dc.html (channelOf, lines 365-369):
 * e-mail present -> automatic e-mail; else phone present -> manual WhatsApp; else no channel.
 */
export function channelOf(m: ChannelInput): Channel {
  if (m.email && m.email.trim()) return 'email';
  if (m.phoneNumber && m.phoneNumber.trim()) return 'whatsapp';
  return 'none';
}

export const channelLabel = (c: Channel): string =>
  c === 'email' ? 'E-mail · auto' : c === 'whatsapp' ? 'WhatsApp' : 'Sem contacto';

export const channelPreview = (c: Channel): string =>
  c === 'email'
    ? 'E-mail (automático)'
    : c === 'whatsapp'
      ? 'WhatsApp (manual — PDF)'
      : 'Sem contacto definido';
