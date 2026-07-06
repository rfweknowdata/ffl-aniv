import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../theme';

interface StatTileProps {
  label: string;
  value: ReactNode;
  accent?: string;
}

export function StatTile({ label, value, accent }: StatTileProps) {
  const valueStyle: CSSProperties = {
    fontFamily: theme.font.sans,
    fontSize: 28,
    fontWeight: 600,
    color: accent ?? theme.color.text,
    marginTop: 6,
    fontVariantNumeric: 'proportional-nums',
  };

  return (
    <div
      style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.borderCard}`,
        borderRadius: theme.radius.xl,
        padding: '16px 18px',
        minWidth: 140,
        flex: '1 1 140px',
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          letterSpacing: '.04em',
          textTransform: 'uppercase',
          color: theme.color.textMuted,
        }}
      >
        {label}
      </div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}
