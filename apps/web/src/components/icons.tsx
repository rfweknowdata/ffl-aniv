import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, strokeWidth: number, props: IconProps) {
  const { size: _s, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
}

export function IconMembers({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.7, props)}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconSchedule({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.7, props)}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function IconDashboard({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.7, props)}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

export function IconSettings({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.7, props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function IconMenu({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.9, props)}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function IconClose({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, 2, props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconPlus({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size, 2.1, props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconDownload({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.8, props)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export function IconEdit({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.8, props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconTrash({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.8, props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

export function IconSearch({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, 1.8, props)} stroke="#a89f90">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconCheck({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, 2.2, props)} stroke="#1f7a52">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
