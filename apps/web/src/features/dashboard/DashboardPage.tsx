import { MESES_ABBR, type SendStatus } from '@ffl/shared';
import { theme } from '../../theme';
import { usePageHeader } from '../../components/LayoutContext';
import { StatTile } from '../../components/StatTile';
import { ChannelBadge } from '../../components/ChannelBadge';
import { useDashboard } from './api';
import { MonthlyBarChart } from './MonthlyBarChart';

function dayMonthLabel(day: number, month: number): string {
  return `${String(day).padStart(2, '0')} ${MESES_ABBR[month - 1]}`;
}

function statusLabel(status: SendStatus): string {
  if (status === 'sent') return 'Enviado';
  if (status === 'failed') return 'Falhou';
  if (status === 'pending_manual') return 'Pendente';
  return 'Sem contacto';
}

function statusColor(status: SendStatus) {
  if (status === 'sent') return theme.statusBadge.enviado;
  if (status === 'failed') return theme.statusBadge.falhou;
  if (status === 'pending_manual') return theme.statusBadge.pendente;
  return theme.statusBadge.enviado;
}

const cardStyle = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.borderCard}`,
  borderRadius: theme.radius.xl,
  padding: '20px 22px',
  marginBottom: 20,
} as const;

const cardTitleStyle = {
  margin: '0 0 4px',
  fontFamily: theme.font.serif,
  fontSize: 18,
  fontWeight: 400,
  color: theme.color.text,
} as const;

export function DashboardPage() {
  usePageHeader('Dashboard');
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return <div style={{ padding: 34 }} />;
  }

  return (
    <div style={{ padding: '26px 34px', overflow: 'auto', height: '100%' }}>
      <h1 style={{ margin: 0, fontFamily: theme.font.serif, fontWeight: 400, fontSize: 30 }}>Dashboard</h1>
      <p style={{ color: theme.color.textMuted, marginTop: 8, marginBottom: 24 }}>
        Resumo dos envios de postais de aniversário.
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatTile label="E-mails enviados este ano" value={data.emailsSentThisYear} />
        <StatTile label="E-mails enviados (total)" value={data.emailsSentAllTime} />
        <StatTile label="Aniversários hoje" value={data.todayCount} accent={theme.color.goldBrand} />
        <StatTile label="Próximos" value={data.upcomingCount} />
        <StatTile
          label="WhatsApp pendente"
          value={data.pendingManualCount}
          accent={data.pendingManualCount > 0 ? theme.statusBadge.pendente.fg : undefined}
        />
        <StatTile label="Sócios sem contacto" value={data.membersWithoutContact} />
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 420px', minWidth: 320 }}>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Postais enviados por mês</h2>
            <p style={{ margin: '0 0 14px', color: theme.color.textMuted, fontSize: 12 }}>
              E-mails automáticos enviados com sucesso, {new Date().getFullYear()}.
            </p>
            <MonthlyBarChart data={data.sendsByMonth} />
          </div>

          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Envios recentes</h2>
            {data.recentSends.length === 0 ? (
              <div style={{ color: theme.color.textFaint, fontSize: 13, padding: '12px 0' }}>
                Ainda sem envios registados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.recentSends.map((s, i) => {
                  const sc = statusColor(s.status);
                  return (
                    <div
                      key={`${s.memberId}-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 0',
                        borderTop: i > 0 ? `1px solid ${theme.color.border}` : undefined,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: theme.color.text,
                            fontSize: 13.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.profaneName}
                        </div>
                      </div>
                      <ChannelBadge channel={s.channel} />
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: sc.bg,
                          color: sc.fg,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {statusLabel(s.status)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: '1 1 280px', minWidth: 260 }}>
          <div style={cardStyle}>
            <h2 style={{ ...cardTitleStyle, color: theme.color.goldBrand }}>Hoje</h2>
            {data.todayBirthdays.length === 0 ? (
              <div style={{ color: theme.color.textFaint, fontSize: 13 }}>Sem aniversários hoje.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.todayBirthdays.map((m) => (
                  <div key={m.memberId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13.5,
                          color: theme.color.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.profaneName}
                      </div>
                      {m.mysticName && (
                        <div
                          style={{
                            fontFamily: theme.font.serif,
                            fontStyle: 'italic',
                            fontSize: 13,
                            color: theme.color.goldActive,
                          }}
                        >
                          {m.mysticName}
                        </div>
                      )}
                    </div>
                    <ChannelBadge channel={m.channel} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Próximos aniversários</h2>
            {data.upcoming.length === 0 ? (
              <div style={{ color: theme.color.textFaint, fontSize: 13 }}>Sem aniversários próximos.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.upcoming.map((m) => (
                  <div key={m.memberId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 44,
                        flex: 'none',
                        fontSize: 12,
                        color: theme.color.textMuted,
                        fontFamily: 'ui-monospace,monospace',
                      }}
                    >
                      {dayMonthLabel(m.day, m.month)}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        color: theme.color.textSoft,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.profaneName}
                    </div>
                    <ChannelBadge channel={m.channel} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
