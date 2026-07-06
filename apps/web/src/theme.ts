// Design tokens ported verbatim from design-system/Canvas.dc.html — do not restyle.
export const theme = {
  font: {
    sans: "'Instrument Sans', system-ui, sans-serif",
    serif: "'Instrument Serif', Georgia, serif",
  },
  color: {
    appBg: '#f6f3ee',
    surface: '#ffffff',
    surfaceWarm: '#fffefb',
    headerBg: '#fffdf9',
    text: '#2a2621',
    textMuted: '#8a8175',
    textFaint: '#a89f90',
    textSubtle: '#6a6459',
    textSoft: '#4a463f',
    monoFaint: '#b0a794',
    gold: '#c69a2e',
    goldBrand: '#a67c00',
    goldActive: '#9a7a1e',
    goldMuted: '#6a5a20',
    navActiveBg: 'rgba(198,154,46,.15)',
    navHoverBg: 'rgba(198,154,46,.12)',
    focusRing: 'rgba(198,154,46,.16)',
    rowHover: '#faf7f0',
    danger: '#b4463c',
    success: '#1f7a52',
    border: '#ece5d8',
    borderMute: '#e7e1d7',
    borderInput: '#ded7ca',
    borderCard: '#ebe4d7',
    borderRow: '#eee6d9',
  },
  channelBadge: {
    email: { bg: '#eaf1f8', fg: '#3f6b96' },
    whatsapp: { bg: '#e7f4ec', fg: '#1f7a52' },
    none: { bg: '#f2ede3', fg: '#a89f90' },
  },
  statusBadge: {
    enviado: { bg: '#eef0ea', fg: '#6f7a5e', accent: '#c8cdbe' },
    hoje: { bg: '#f6ecc9', fg: '#8a6d12', accent: '#c69a2e' },
    agendado: { bg: '#eaf1f8', fg: '#3f6b96', accent: '#a9c3dd' },
    // Not in the original prototype (it had no real backend state) — added so the real
    // pending-manual / failed-send statuses are visually distinct from "handled" (enviado).
    pendente: { bg: '#fdf1d9', fg: '#96690f', accent: '#e8c98a' },
    falhou: { bg: '#fbe4e1', fg: '#a83b2f', accent: '#e3a89e' },
  },
  radius: { sm: 8, md: 9, lg: 10, xl: 14, modal: 16 },
  breakpointPx: 760,
} as const;

export type Theme = typeof theme;
