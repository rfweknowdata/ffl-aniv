import type { ReactNode } from 'react';
import { theme } from '../theme';
import { useIsMobile } from '../hooks/useIsMobile';
import { LayoutProvider, useLayoutChrome } from './LayoutContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useMembersCount } from '../features/members/api';
import { useAgendaCount } from '../features/scheduling/api';

function LayoutInner({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { header, navOpen, openNav, closeNav } = useLayoutChrome();
  const membersCount = useMembersCount();
  const agendaCount = useAgendaCount();

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100vh',
        minHeight: 600,
        background: theme.color.appBg,
        color: theme.color.text,
        fontFamily: theme.font.sans,
        fontSize: 14,
        position: 'relative',
      }}
    >
      {isMobile && navOpen && (
        <div
          onClick={closeNav}
          style={{ position: 'fixed', inset: 0, background: 'rgba(50,42,20,.34)', zIndex: 110 }}
        />
      )}

      <Sidebar
        isMobile={isMobile}
        open={navOpen}
        onClose={closeNav}
        membersCount={membersCount}
        agendaCount={agendaCount}
      />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {isMobile && <TopBar title={header.title} action={header.action} onOpenNav={openNav} />}
        {children}
      </main>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <LayoutProvider>
      <LayoutInner>{children}</LayoutInner>
    </LayoutProvider>
  );
}
