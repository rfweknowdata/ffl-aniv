import type { ReactNode } from 'react';
import { theme } from '../theme';
import { IconMenu } from './icons';

interface TopBarProps {
  title: string;
  action?: ReactNode;
  onOpenNav: () => void;
}

export function TopBar({ title, action, onOpenNav }: TopBarProps) {
  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: theme.color.surfaceWarm,
        borderBottom: `1px solid ${theme.color.border}`,
      }}
    >
      <button
        onClick={onOpenNav}
        title="Menu"
        style={{
          width: 40,
          height: 40,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${theme.color.borderMute}`,
          borderRadius: 10,
          background: theme.color.surface,
          color: theme.color.textSubtle,
          cursor: 'pointer',
        }}
      >
        <IconMenu />
      </button>
      <div
        style={{
          fontFamily: theme.font.serif,
          fontStyle: 'italic',
          fontSize: 21,
          color: theme.color.goldBrand,
          lineHeight: 1,
        }}
      >
        {title}
      </div>
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
    </div>
  );
}
