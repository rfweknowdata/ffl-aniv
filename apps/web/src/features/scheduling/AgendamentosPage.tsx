import type { CSSProperties } from 'react';
import { MESES_ABBR, type AgendaItemDTO, type SendStatus } from '@ffl/shared';
import { theme } from '../../theme';
import { usePageHeader } from '../../components/LayoutContext';
import { useToast } from '../../components/ToastContext';
import { ChannelBadge } from '../../components/ChannelBadge';
import { IconDownload } from '../../components/icons';
import { useAgenda, useMarkSent, useResend, useRunNow } from './api';

type Bucket = 'hoje' | 'proximos' | 'enviados';

function statusInfo(bucket: Bucket, status?: SendStatus) {
  if (status === 'sent') return { label: 'Enviado', ...theme.statusBadge.enviado };
  if (status === 'failed') return { label: 'Falhou', ...theme.statusBadge.falhou };
  if (status === 'pending_manual') return { label: 'Pendente', ...theme.statusBadge.pendente };
  if (status === 'skipped') return { label: 'Sem contacto', ...theme.statusBadge.enviado };
  if (bucket === 'hoje') return { label: 'Hoje', ...theme.statusBadge.hoje };
  // A past birthday with no log (e.g. imported after the fact, or predates the app) isn't
  // "scheduled" — that would wrongly imply it's still upcoming. Be honest that there's no record.
  if (bucket === 'enviados') return { label: 'Sem registo', ...theme.statusBadge.agendado };
  return { label: 'Agendado', ...theme.statusBadge.agendado };
}

function badgeStyle(bg: string, fg: string): CSSProperties {
  return {
    display: 'inline-block',
    padding: '4px 11px',
    borderRadius: 20,
    fontSize: 11.5,
    fontWeight: 600,
    background: bg,
    color: fg,
    whiteSpace: 'nowrap',
  };
}

const actionBtnStyle: CSSProperties = {
  padding: '8px 12px',
  border: `1px solid ${theme.color.borderInput}`,
  borderRadius: 9,
  background: theme.color.surface,
  color: theme.color.textSoft,
  font: 'inherit',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function AgendamentosPage() {
  usePageHeader('Agendamentos');
  const { data, isLoading } = useAgenda();
  const runNow = useRunNow();
  const markSent = useMarkSent();
  const resend = useResend();
  const { showToast } = useToast();

  const handleRunNow = () => {
    runNow.mutate(undefined, {
      onSuccess: (result) => {
        showToast(
          `Envio concluído: ${result.emailed} e-mail(s), ${result.pendingManual} pendente(s), ${result.failed} falha(s).`,
        );
      },
    });
  };

  const handleMarkSent = (memberId: string) => {
    markSent.mutate(memberId, { onSuccess: () => showToast('Marcado como enviado.') });
  };

  const handleResend = (memberId: string) => {
    resend.mutate(memberId, {
      onSuccess: () => showToast('E-mail reenviado.'),
      onError: (err) => showToast(err instanceof Error ? err.message : 'Falha ao reenviar.'),
    });
  };

  if (isLoading || !data) {
    return <div style={{ padding: 34 }} />;
  }

  const groups = (
    [
      { key: 'hoje', label: 'Hoje', color: theme.color.goldBrand, items: data.hoje },
      { key: 'proximos', label: 'Próximos', color: '#3f6b96', items: data.proximos },
      { key: 'enviados', label: 'Enviados', color: theme.color.textMuted, items: data.enviados },
    ] satisfies { key: Bucket; label: string; color: string; items: AgendaItemDTO[] }[]
  ).filter((g) => g.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header
        style={{
          padding: '26px 34px 18px',
          borderBottom: `1px solid ${theme.color.borderMute}`,
          background: theme.color.headerBg,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontFamily: theme.font.serif, fontSize: 30, fontWeight: 400 }}>Agendamentos</h1>
          <p style={{ margin: '6px 0 0', color: theme.color.textMuted, fontSize: 13.5 }}>
            Aniversários de {data.year} — envios por e-mail são automáticos; WhatsApp é manual.
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={runNow.isPending}
          style={{
            marginLeft: 'auto',
            padding: '11px 18px',
            border: 'none',
            borderRadius: theme.radius.lg,
            background: theme.color.gold,
            color: '#fff',
            font: 'inherit',
            fontWeight: 600,
            fontSize: 13.5,
            cursor: runNow.isPending ? 'default' : 'pointer',
            opacity: runNow.isPending ? 0.6 : 1,
            boxShadow: '0 1px 2px rgba(166,124,0,.25)',
          }}
        >
          {runNow.isPending ? 'A processar…' : 'Enviar agora'}
        </button>
      </header>

      <div className="fx-scroll" style={{ flex: 1, overflow: 'auto', padding: '24px 34px 48px' }}>
        {groups.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: theme.color.textFaint }}>
            Nenhum aniversário registado este ano.
          </div>
        )}
        {groups.map((g) => (
          <section key={g.key} style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 13,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: g.color,
                  fontWeight: 700,
                }}
              >
                {g.label}
              </h2>
              <span style={{ fontSize: 12, color: theme.color.textFaint }}>{g.items.length}</span>
              <div style={{ flex: 1, height: 1, background: theme.color.borderMute }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.items.map((item) => {
                const info = statusInfo(g.key, item.status);
                // Only actionable once the birthday has arrived — marking a future birthday as
                // sent would make the daily job's idempotency check skip it when it actually happens.
                const isDue = g.key !== 'proximos';
                const canMarkSent = isDue && item.channel === 'whatsapp' && item.status !== 'sent';
                const canResend = isDue && item.channel === 'email' && (item.status === 'sent' || item.status === 'failed');
                return (
                  <div
                    key={item.memberId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px 14px',
                      padding: '14px 16px',
                      background: theme.color.surface,
                      border: `1px solid ${theme.color.borderCard}`,
                      borderLeft: `3px solid ${info.accent}`,
                      borderRadius: theme.radius.xl,
                    }}
                  >
                    <div style={{ width: 48, textAlign: 'center', flex: 'none' }}>
                      <div style={{ fontFamily: theme.font.serif, fontSize: 23, lineHeight: 1, color: theme.color.text }}>
                        {String(item.day).padStart(2, '0')}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '.05em',
                          color: theme.color.textFaint,
                          marginTop: 3,
                        }}
                      >
                        {MESES_ABBR[item.month - 1]}
                      </div>
                    </div>
                    <div style={{ minWidth: 140, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: theme.color.text }}>{item.profaneName}</div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: theme.color.textMuted,
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {(item.mysticName ? item.mysticName + ' · ' : '') +
                          (item.channel === 'email' ? item.email : item.phoneNumber || '—')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <ChannelBadge channel={item.channel} />
                      <span style={badgeStyle(info.bg, info.fg)}>{info.label}</span>
                      {item.channel === 'whatsapp' && (
                        <a
                          href={`/api/members/${item.memberId}/postcard.pdf`}
                          download
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 12px',
                            border: '1px solid #cfe6d8',
                            borderRadius: 9,
                            background: '#f0f8f3',
                            color: theme.color.success,
                            font: 'inherit',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            textDecoration: 'none',
                          }}
                        >
                          <IconDownload size={14} />
                          PDF
                        </a>
                      )}
                      {canMarkSent && (
                        <button onClick={() => handleMarkSent(item.memberId)} disabled={markSent.isPending} style={actionBtnStyle}>
                          Marcar como enviado
                        </button>
                      )}
                      {canResend && (
                        <button onClick={() => handleResend(item.memberId)} disabled={resend.isPending} style={actionBtnStyle}>
                          Reenviar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
