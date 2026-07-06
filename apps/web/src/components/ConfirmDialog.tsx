import type { ReactNode } from 'react';
import { theme } from '../theme';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(70,55,20,.34)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 130,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          maxWidth: '100%',
          background: theme.color.surfaceWarm,
          borderRadius: theme.radius.modal,
          boxShadow: '0 24px 70px rgba(70,55,20,.28)',
          padding: '24px 26px',
        }}
      >
        <h2
          style={{
            margin: '0 0 8px',
            fontFamily: theme.font.serif,
            fontSize: 22,
            fontWeight: 400,
          }}
        >
          {title}
        </h2>
        <p style={{ margin: '0 0 22px', color: theme.color.textSubtle, lineHeight: 1.5, fontSize: 13.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '12px 18px',
              border: `1px solid ${theme.color.borderInput}`,
              borderRadius: theme.radius.lg,
              background: theme.color.surface,
              color: theme.color.textSoft,
              font: 'inherit',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '12px 18px',
              border: 'none',
              borderRadius: theme.radius.lg,
              background: theme.color.danger,
              color: '#fff',
              font: 'inherit',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
