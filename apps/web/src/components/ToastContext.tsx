import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { theme } from '../theme';
import { IconCheck } from './icons';

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setMessage(''), 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          style={{
            position: 'fixed',
            bottom: 26,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '90vw',
            background: theme.color.surfaceWarm,
            color: theme.color.goldMuted,
            padding: '12px 20px',
            borderRadius: 10,
            border: '1px solid #ece0c2',
            boxShadow: '0 12px 34px rgba(120,100,40,.18)',
            fontSize: 13.5,
            fontWeight: 500,
            zIndex: 140,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <IconCheck />
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
