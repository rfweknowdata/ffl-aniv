import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MemberInputSchema, channelOf, channelPreview, type MemberInput } from '@ffl/shared';
import { theme } from '../../theme';
import { IconClose } from '../../components/icons';

interface MemberModalProps {
  open: boolean;
  title: string;
  defaultValues: MemberInput;
  onCancel: () => void;
  onSave: (input: MemberInput) => void;
  saving: boolean;
}

const inputStyle: CSSProperties = {
  padding: '11px 12px',
  border: `1px solid ${theme.color.borderInput}`,
  borderRadius: theme.radius.md,
  font: 'inherit',
  fontSize: 13.5,
  background: theme.color.surface,
  width: '100%',
};
const monoInputStyle: CSSProperties = { ...inputStyle, fontFamily: 'ui-monospace,monospace', fontSize: 13 };
const labelStyle: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: theme.color.textSubtle };
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };

export function MemberModal({ open, title, defaultValues, onCancel, onSave, saving }: MemberModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isValid },
  } = useForm<MemberInput>({
    resolver: zodResolver(MemberInputSchema),
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const email = watch('email');
  const phoneNumber = watch('phoneNumber');

  if (!open) return null;

  const kind = channelOf({ email, phoneNumber });
  const preview = channelPreview(kind);
  const dotColor = kind === 'email' ? '#3f6b96' : kind === 'whatsapp' ? '#1f7a52' : '#c9bfad';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(70,55,20,.34)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 20px',
        zIndex: 125,
        overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '100%',
          background: theme.color.surfaceWarm,
          borderRadius: theme.radius.modal,
          boxShadow: '0 24px 70px rgba(70,55,20,.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.color.border}`,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontFamily: theme.font.serif, fontSize: 22, fontWeight: 400 }}>{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="fx-ico"
            style={{
              marginLeft: 'auto',
              width: 36,
              height: 36,
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
        </div>

        <form onSubmit={handleSubmit(onSave)}>
          <div
            className="fx-scroll"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '15px 18px',
              padding: '20px 22px',
              maxHeight: '70vh',
              overflow: 'auto',
            }}
          >
            <label style={fieldStyle}>
              <span style={labelStyle}>ID Interno</span>
              <input {...register('internalId')} placeholder="FFL-000" style={monoInputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Data de Nascimento</span>
              <input type="date" {...register('birthDate')} style={{ ...inputStyle, color: theme.color.text }} />
            </label>
            <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <span style={labelStyle}>
                Nome Profano <span style={{ color: theme.color.danger }}>*</span>
              </span>
              <input
                {...register('profaneName')}
                placeholder="Nome completo"
                style={{ ...inputStyle, textTransform: 'uppercase' }}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Nome Místico</span>
              <input {...register('mysticName')} placeholder="(opcional)" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>NIF</span>
              <input {...register('nif')} placeholder="000000000" style={monoInputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Telemóvel</span>
              <input {...register('phoneNumber')} placeholder="+351 900 000 000" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>E-mail</span>
              <input {...register('email')} placeholder="nome@exemplo.pt" style={inputStyle} />
            </label>
            <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Observações</span>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Notas internas…"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </label>
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '10px 14px',
                borderRadius: 9,
                background: '#f4f0e7',
                fontSize: 12.5,
                color: '#7a7265',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flex: 'none' }} />
              Canal de envio: <strong style={{ color: theme.color.text }}>{preview}</strong>
            </div>
          </div>
          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${theme.color.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              background: theme.color.rowHover,
            }}
          >
            <button
              type="button"
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || saving}
              style={{
                padding: '12px 22px',
                border: 'none',
                borderRadius: theme.radius.lg,
                font: 'inherit',
                fontWeight: 600,
                fontSize: 13.5,
                background: isValid && !saving ? theme.color.gold : '#e7ddc8',
                color: '#fff',
                cursor: isValid && !saving ? 'pointer' : 'not-allowed',
                boxShadow: isValid && !saving ? '0 1px 2px rgba(166,124,0,.25)' : 'none',
              }}
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
