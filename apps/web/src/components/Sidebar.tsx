import { NavLink } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { theme } from '../theme';
import { IconClose, IconDashboard, IconMembers, IconSchedule, IconSettings } from './icons';

interface SidebarProps {
  isMobile: boolean;
  open: boolean;
  onClose: () => void;
  membersCount?: number;
  agendaCount?: number;
}

const navBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  width: '100%',
  padding: '12px 12px',
  border: 'none',
  borderRadius: 9,
  background: 'transparent',
  color: theme.color.textMuted,
  font: 'inherit',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all .12s',
  textDecoration: 'none',
};

const navActive: CSSProperties = {
  ...navBase,
  background: theme.color.navActiveBg,
  color: theme.color.goldActive,
  boxShadow: `inset 3px 0 0 ${theme.color.gold}`,
};

function NavItem({
  to,
  icon,
  label,
  count,
  onNavigate,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={to}
      end
      onClick={onNavigate}
      className="fx-nav"
      style={({ isActive }) => (isActive ? navActive : navBase)}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>{count}</span>
      )}
    </NavLink>
  );
}

export function Sidebar({ isMobile, open, onClose, membersCount, agendaCount }: SidebarProps) {
  const asideStyle: CSSProperties = isMobile
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100%',
        width: 270,
        maxWidth: '82vw',
        zIndex: 120,
        background: theme.color.surfaceWarm,
        color: theme.color.textMuted,
        display: 'flex',
        flexDirection: 'column',
        padding: '22px 16px',
        borderRight: `1px solid ${theme.color.border}`,
        boxShadow: '0 0 44px rgba(70,55,20,.22)',
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        transform: `translateX(${open ? '0' : '-106%'})`,
      }
    : {
        width: 250,
        flex: 'none',
        background: theme.color.surfaceWarm,
        color: theme.color.textMuted,
        display: 'flex',
        flexDirection: 'column',
        padding: '26px 18px',
        borderRight: `1px solid ${theme.color.border}`,
      };

  return (
    <aside style={asideStyle}>
      <div
        style={{
          padding: '4px 10px 22px',
          borderBottom: `1px solid ${theme.color.border}`,
          marginBottom: 18,
          display: 'flex',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: theme.font.serif,
              fontStyle: 'italic',
              fontSize: 26,
              color: theme.color.goldBrand,
              lineHeight: 1,
            }}
          >
            Fiat Lux
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '.18em',
              textTransform: 'uppercase',
              color: theme.color.textMuted,
              marginTop: 8,
            }}
          >
            Backoffice · Postais
          </div>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            title="Fechar menu"
            className="fx-ico"
            style={{
              marginLeft: 'auto',
              width: 34,
              height: 34,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${theme.color.borderMute}`,
              borderRadius: 9,
              background: theme.color.surface,
              color: theme.color.textSubtle,
              cursor: 'pointer',
            }}
          >
            <IconClose />
          </button>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NavItem to="/" icon={<IconDashboard />} label="Dashboard" onNavigate={onClose} />
        <NavItem
          to="/socios"
          icon={<IconMembers />}
          label="Sócios"
          count={membersCount}
          onNavigate={onClose}
        />
        <NavItem
          to="/agendamentos"
          icon={<IconSchedule />}
          label="Agendamentos"
          count={agendaCount}
          onNavigate={onClose}
        />
        <NavItem to="/definicoes" icon={<IconSettings />} label="Definições" onNavigate={onClose} />
      </nav>

      <div
        style={{
          marginTop: 'auto',
          padding: '14px 12px',
          borderRadius: 10,
          background: '#faf5ea',
          border: '1px solid #f0e6cf',
          fontSize: 12,
          lineHeight: 1.5,
          color: theme.color.textMuted,
        }}
      >
        Envio automático por <span style={{ color: theme.color.goldActive }}>e-mail</span>.
        Sócios só com telemóvel são enviados à mão por{' '}
        <span style={{ color: theme.color.success }}>WhatsApp</span> — descarregue o PDF.
      </div>
    </aside>
  );
}
