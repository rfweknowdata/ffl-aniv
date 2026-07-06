import { useEffect, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import type { SettingsDTO, SettingsInput } from '@ffl/shared';
import { theme } from '../../theme';
import { usePageHeader } from '../../components/LayoutContext';
import { useToast } from '../../components/ToastContext';
import { enablePush, getCurrentSubscription, isPushSupported } from '../../pwa/push';
import { useDevices, useRemoveDevice, useSettings, useTestEmail, useUpdateSettings } from './api';

const cardStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.borderCard}`,
  borderRadius: theme.radius.xl,
  padding: '22px 24px',
  marginBottom: 20,
  maxWidth: 640,
};
const labelStyle: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: theme.color.textSubtle };
const inputStyle: CSSProperties = {
  padding: '11px 12px',
  border: `1px solid ${theme.color.borderInput}`,
  borderRadius: theme.radius.md,
  font: 'inherit',
  fontSize: 13.5,
  background: theme.color.surface,
  width: '100%',
};
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const sectionTitleStyle: CSSProperties = {
  margin: '0 0 4px',
  fontFamily: theme.font.serif,
  fontSize: 20,
  fontWeight: 400,
  color: theme.color.text,
};
const primaryBtnStyle: CSSProperties = {
  padding: '11px 18px',
  border: 'none',
  borderRadius: theme.radius.lg,
  background: theme.color.gold,
  color: '#fff',
  font: 'inherit',
  fontWeight: 600,
  fontSize: 13.5,
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(166,124,0,.25)',
};
const secondaryBtnStyle: CSSProperties = {
  padding: '11px 16px',
  border: `1px solid ${theme.color.borderInput}`,
  borderRadius: theme.radius.lg,
  background: theme.color.surface,
  color: theme.color.textSoft,
  font: 'inherit',
  fontWeight: 600,
  fontSize: 13.5,
  cursor: 'pointer',
};

function toFormValues(s?: SettingsDTO): SettingsInput {
  return {
    smtpHost: s?.smtpHost ?? '',
    smtpPort: s?.smtpPort ?? undefined,
    smtpSecure: s?.smtpSecure ?? true,
    smtpUser: s?.smtpUser ?? '',
    smtpPassword: '',
    fromName: s?.fromName ?? 'Fraternidade Fiat Lux',
    fromEmail: s?.fromEmail ?? '',
    replyTo: s?.replyTo ?? '',
    sendHour: s?.sendHour ?? 8,
  };
}

export function SettingsPage() {
  usePageHeader('Definições');
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const testEmail = useTestEmail();
  const { data: devices = [] } = useDevices();
  const removeDevice = useRemoveDevice();
  const { showToast } = useToast();

  const [testAddress, setTestAddress] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);

  const { register, handleSubmit, reset } = useForm<SettingsInput>({ defaultValues: toFormValues(settings) });

  useEffect(() => {
    reset(toFormValues(settings));
  }, [settings, reset]);

  useEffect(() => {
    getCurrentSubscription().then((sub) => setDeviceSubscribed(!!sub));
  }, []);

  const onSubmit = (values: SettingsInput) => {
    const payload: SettingsInput = { ...values };
    if (!payload.smtpPassword) delete payload.smtpPassword;
    updateSettings.mutate(payload, { onSuccess: () => showToast('Definições guardadas.') });
  };

  const handleTestEmail = () => {
    if (!testAddress.trim()) {
      showToast('Indique um e-mail de destino.');
      return;
    }
    testEmail.mutate(testAddress.trim(), {
      onSuccess: () => showToast('E-mail de teste enviado.'),
      onError: (err) => showToast(err instanceof Error ? err.message : 'Falha ao enviar e-mail de teste.'),
    });
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      await enablePush();
      setDeviceSubscribed(true);
      showToast('Notificações ativadas neste dispositivo.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao ativar notificações.');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div style={{ padding: '26px 34px', overflow: 'auto', height: '100%' }}>
      <h1 style={{ margin: 0, fontFamily: theme.font.serif, fontWeight: 400, fontSize: 30 }}>Definições</h1>
      <p style={{ color: theme.color.textMuted, marginTop: 8, marginBottom: 24 }}>
        Configuração de SMTP e notificações push.
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>SMTP &amp; Remetente</h2>
          <p style={{ margin: '0 0 16px', color: theme.color.textMuted, fontSize: 12.5 }}>
            Usado para enviar automaticamente o postal por e-mail.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Servidor SMTP</span>
              <input {...register('smtpHost')} placeholder="smtp.exemplo.pt" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Porta</span>
              <input type="number" {...register('smtpPort', { valueAsNumber: true })} placeholder="587" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Utilizador</span>
              <input {...register('smtpUser')} placeholder="utilizador@exemplo.pt" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>
                Palavra-passe{' '}
                {settings?.smtpPasswordSet && <span style={{ color: theme.color.success }}>(configurada)</span>}
              </span>
              <input type="password" {...register('smtpPassword')} placeholder="••••••••" style={inputStyle} />
            </label>
            <label style={{ ...fieldStyle, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
              <input type="checkbox" {...register('smtpSecure')} />
              <span style={labelStyle}>Ligação segura (SSL — porta 465)</span>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Hora de envio diário (0-23)</span>
              <input
                type="number"
                min={0}
                max={23}
                {...register('sendHour', { valueAsNumber: true })}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Nome do remetente</span>
              <input {...register('fromName')} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>E-mail do remetente</span>
              <input {...register('fromEmail')} placeholder="postais@exemplo.pt" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Responder para (opcional)</span>
              <input {...register('replyTo')} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" style={primaryBtnStyle}>
              Guardar
            </button>
            <input
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              placeholder="destino@exemplo.pt"
              style={{ ...inputStyle, width: 200 }}
            />
            <button type="button" onClick={handleTestEmail} disabled={testEmail.isPending} style={secondaryBtnStyle}>
              {testEmail.isPending ? 'A enviar…' : 'Enviar e-mail de teste'}
            </button>
          </div>
        </div>
      </form>

      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Notificações push</h2>
        <p style={{ margin: '0 0 16px', color: theme.color.textMuted, fontSize: 12.5 }}>
          Recebe uma notificação neste dispositivo sempre que um postal é enviado por e-mail. No
          iPhone só funciona depois de instalar a aplicação no ecrã principal (Partilhar → Adicionar
          ao ecrã principal).
        </p>
        <button
          type="button"
          onClick={handleEnablePush}
          disabled={pushBusy || deviceSubscribed || !isPushSupported()}
          style={{ ...primaryBtnStyle, opacity: deviceSubscribed ? 0.6 : 1 }}
        >
          {deviceSubscribed
            ? 'Ativado neste dispositivo'
            : pushBusy
              ? 'A ativar…'
              : 'Ativar notificações neste dispositivo'}
        </button>

        {devices.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.color.textMuted, marginBottom: 8 }}>
              Dispositivos registados
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {devices.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    border: `1px solid ${theme.color.border}`,
                    borderRadius: theme.radius.md,
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ color: theme.color.text, fontWeight: 600 }}>{d.endpointHost}</div>
                    <div style={{ color: theme.color.textFaint }}>{d.userAgent || '—'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDevice.mutate(d.id)}
                    style={{ ...secondaryBtnStyle, color: theme.color.danger, borderColor: '#f0d9d5' }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
