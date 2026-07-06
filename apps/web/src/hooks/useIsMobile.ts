import { useEffect, useState } from 'react';
import { theme } from '../theme';

/** Mirrors design-system/Canvas.dc.html's componentDidMount resize logic (breakpoint 760px). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < theme.breakpointPx,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < theme.breakpointPx);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
}
