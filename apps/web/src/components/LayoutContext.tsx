import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface HeaderConfig {
  title: string;
  action?: ReactNode;
}

interface LayoutContextValue {
  header: HeaderConfig;
  setHeader: (header: HeaderConfig) => void;
  navOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

// Note on re-render safety: <Outlet/> (the routed page) is constructed once by the
// route's layout element and passed down as `children` — it never reads this context
// directly, so header/nav updates here re-render Sidebar/TopBar but never loop back
// into the page itself (React bails out of re-rendering unchanged `children` props).
export function LayoutProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HeaderConfig>({ title: '' });
  const [navOpen, setNavOpen] = useState(false);

  const value: LayoutContextValue = {
    header,
    setHeader,
    navOpen,
    openNav: () => setNavOpen(true),
    closeNav: () => setNavOpen(false),
  };

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

function useLayoutContext(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayoutContext must be used within a LayoutProvider');
  return ctx;
}

export function useLayoutChrome() {
  const { header, navOpen, openNav, closeNav } = useLayoutContext();
  return { header, navOpen, openNav, closeNav };
}

/** Pages call this to set the mobile top bar's title and optional right-side action. */
// `action` must be a referentially stable node (memoize it with useMemo at the call site) —
// this effect's dependency array will otherwise re-fire on every render of the calling page.
export function usePageHeader(title: string, action?: ReactNode) {
  const { setHeader } = useLayoutContext();
  useEffect(() => {
    setHeader({ title, action });
  }, [title, action, setHeader]);
}
