import { useMemo, useState } from 'react';
import type { MemberDTO, MemberInput } from '@ffl/shared';
import { formatDisplayDate } from '@ffl/shared';
import { theme } from '../../theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePageHeader } from '../../components/LayoutContext';
import { useToast } from '../../components/ToastContext';
import { ChannelBadge } from '../../components/ChannelBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PdfPreviewModal } from '../../components/PdfPreviewModal';
import { IconDownload, IconEdit, IconPlus, IconSearch, IconTrash } from '../../components/icons';
import { useCreateMember, useDeleteMember, useMembers, useMembersCount, useUpdateMember } from './api';
import { MemberModal } from './MemberModal';

function toFormValues(m?: MemberDTO | null): MemberInput {
  return {
    internalId: m?.internalId ?? '',
    profaneName: m?.profaneName ?? '',
    mysticName: m?.mysticName ?? '',
    birthDate: m?.birthDate ?? '',
    nif: m?.nif ?? '',
    phoneNumber: m?.phoneNumber ?? '',
    email: m?.email ?? '',
    memberNumber: m?.memberNumber ?? '',
    notes: m?.notes ?? '',
  };
}

const iconBtnStyle = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${theme.color.borderMute}`,
  borderRadius: 8,
  background: theme.color.surface,
  color: theme.color.textSubtle,
  cursor: 'pointer',
  textDecoration: 'none',
} as const;

export function MembersPage() {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberDTO | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MemberDTO | null>(null);
  const [pdfPreview, setPdfPreview] = useState<MemberDTO | null>(null);

  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const { data: members = [], isLoading } = useMembers(query);
  const totalCount = useMembersCount();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();

  const openAdd = () => {
    setEditingMember(null);
    setModalOpen(true);
  };
  const openEdit = (m: MemberDTO) => {
    setEditingMember(m);
    setModalOpen(true);
  };

  // Memoized: usePageHeader's effect depends on this reference, so an unmemoized element here
  // (a fresh object every render) fires that effect every render and loops.
  const headerAction = useMemo(
    () =>
      isMobile ? (
        <button
          onClick={openAdd}
          title="Adicionar sócio"
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 10,
            background: theme.color.gold,
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(166,124,0,.25)',
          }}
        >
          <IconPlus />
        </button>
      ) : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMobile],
  );

  usePageHeader('Sócios', headerAction);

  const handleSave = (input: MemberInput) => {
    if (editingMember) {
      updateMember.mutate(
        { id: editingMember.id, input },
        {
          onSuccess: () => {
            setModalOpen(false);
            showToast('Alterações guardadas.');
          },
        },
      );
    } else {
      createMember.mutate(input, {
        onSuccess: () => {
          setModalOpen(false);
          showToast('Sócio adicionado.');
        },
      });
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const name = pendingDelete.profaneName;
    deleteMember.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        showToast('Sócio eliminado.');
      },
    });
    void name;
  };

  const countLabel =
    totalCount === undefined
      ? ''
      : members.length === totalCount
        ? `${totalCount} sócios ativos`
        : `${members.length} de ${totalCount} sócios`;

  return (
    <div>
      <header
        style={{
          padding: isMobile ? '16px 16px 12px' : '26px 34px 18px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'flex-end',
          gap: isMobile ? 14 : 20,
          borderBottom: `1px solid ${theme.color.borderMute}`,
          background: theme.color.headerBg,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: theme.font.serif,
              fontSize: isMobile ? 25 : 30,
              fontWeight: 400,
              color: theme.color.text,
            }}
          >
            Sócios
          </h1>
          <p style={{ margin: '6px 0 0', color: theme.color.textMuted, fontSize: 13.5 }}>{countLabel}</p>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 10 : 12,
            alignItems: 'center',
            marginLeft: isMobile ? undefined : 'auto',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: isMobile ? 1 : undefined, width: isMobile ? '100%' : undefined }}>
            <span style={{ position: 'absolute', left: 12, pointerEvents: 'none', display: 'flex' }}>
              <IconSearch />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar nome, NIF, e-mail…"
              style={{
                width: isMobile ? '100%' : 260,
                padding: '11px 12px 11px 34px',
                border: `1px solid ${theme.color.borderInput}`,
                borderRadius: theme.radius.lg,
                background: theme.color.surface,
                font: 'inherit',
                fontSize: 14,
                color: theme.color.text,
              }}
            />
          </div>
          {!isMobile && (
            <button
              onClick={openAdd}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                padding: '11px 16px',
                border: 'none',
                borderRadius: theme.radius.lg,
                background: theme.color.gold,
                color: '#fff',
                font: 'inherit',
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(166,124,0,.25)',
                whiteSpace: 'nowrap',
              }}
            >
              <IconPlus size={16} />
              Adicionar sócio
            </button>
          )}
        </div>
      </header>

      {!isMobile && (
        <div style={{ padding: '0 34px 40px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  color: theme.color.textMuted,
                  fontSize: 11.5,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '16px 12px 12px', fontWeight: 600 }}>Nome Profano</th>
                <th style={{ padding: '16px 12px 12px', fontWeight: 600 }}>Nome Místico</th>
                <th style={{ padding: '16px 12px 12px', fontWeight: 600 }}>Nascimento</th>
                <th style={{ padding: '16px 12px 12px', fontWeight: 600 }}>NIF</th>
                <th style={{ padding: '16px 12px 12px', fontWeight: 600 }}>Telemóvel</th>
                <th style={{ padding: '16px 12px 12px', fontWeight: 600 }}>E-mail</th>
                <th style={{ padding: '16px 12px 12px', fontWeight: 600 }}>Canal</th>
                <th style={{ padding: '16px 12px 12px', fontWeight: 600, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="fx-row" style={{ borderTop: `1px solid ${theme.color.borderRow}`, transition: 'background .12s' }}>
                  <td style={{ padding: '13px 12px' }}>
                    <div style={{ fontWeight: 600, color: theme.color.text }}>{m.profaneName}</div>
                    <div style={{ fontSize: 11.5, color: theme.color.monoFaint, fontFamily: 'ui-monospace,monospace', marginTop: 2 }}>
                      {m.internalId}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '13px 12px',
                      fontFamily: theme.font.serif,
                      fontStyle: 'italic',
                      fontSize: 16,
                      color: m.mysticName ? theme.color.goldActive : '#cfc7b6',
                    }}
                  >
                    {m.mysticName || '—'}
                  </td>
                  <td style={{ padding: '13px 12px', color: theme.color.textSoft, whiteSpace: 'nowrap' }}>
                    {formatDisplayDate(m.birthDate)}
                  </td>
                  <td style={{ padding: '13px 12px', color: theme.color.textSubtle, fontFamily: 'ui-monospace,monospace', fontSize: 12.5 }}>
                    {m.nif || '—'}
                  </td>
                  <td style={{ padding: '13px 12px', color: theme.color.textSoft, whiteSpace: 'nowrap' }}>
                    {m.phoneNumber || '—'}
                  </td>
                  <td
                    style={{
                      padding: '13px 12px',
                      color: theme.color.textSoft,
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.email || '—'}
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    <ChannelBadge channel={m.channel} />
                  </td>
                  <td style={{ padding: '13px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setPdfPreview(m)}
                        className="fx-ico"
                        title="Ver postal"
                        style={
                          m.channel === 'whatsapp'
                            ? { ...iconBtnStyle, border: '1px solid #cfe6d8', background: '#f0f8f3', color: theme.color.success }
                            : iconBtnStyle
                        }
                      >
                        <IconDownload />
                      </button>
                      <button onClick={() => openEdit(m)} className="fx-ico" title="Editar" style={iconBtnStyle}>
                        <IconEdit />
                      </button>
                      <button
                        onClick={() => setPendingDelete(m)}
                        className="fx-ico"
                        title="Eliminar"
                        style={{ ...iconBtnStyle, color: theme.color.danger }}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && members.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: theme.color.textFaint }}>
              Nenhum sócio corresponde à procura.
            </div>
          )}
        </div>
      )}

      {isMobile && (
        <div style={{ padding: '14px 14px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{
                background: theme.color.surface,
                border: `1px solid ${theme.color.borderCard}`,
                borderRadius: theme.radius.xl,
                padding: '15px 16px',
                boxShadow: '0 1px 2px rgba(90,75,30,.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, color: theme.color.text, fontSize: 15, lineHeight: 1.25 }}>
                    {m.profaneName}
                  </div>
                  <div style={{ fontSize: 11.5, color: theme.color.monoFaint, fontFamily: 'ui-monospace,monospace', marginTop: 3 }}>
                    {m.internalId}
                  </div>
                </div>
                <ChannelBadge channel={m.channel} />
              </div>
              {m.mysticName && (
                <div style={{ fontFamily: theme.font.serif, fontStyle: 'italic', fontSize: 18, color: theme.color.goldActive, marginTop: 6 }}>
                  {m.mysticName}
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px 14px',
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: `1px solid ${theme.color.border}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: theme.color.textFaint }}>
                    Nascimento
                  </div>
                  <div style={{ color: theme.color.textSoft, marginTop: 2 }}>{formatDisplayDate(m.birthDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: theme.color.textFaint }}>
                    NIF
                  </div>
                  <div style={{ color: theme.color.textSoft, marginTop: 2, fontFamily: 'ui-monospace,monospace', fontSize: 12.5 }}>
                    {m.nif || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: theme.color.textFaint }}>
                    Telemóvel
                  </div>
                  <div style={{ color: theme.color.textSoft, marginTop: 2 }}>{m.phoneNumber || '—'}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: theme.color.textFaint }}>
                    E-mail
                  </div>
                  <div style={{ color: theme.color.textSoft, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.email || '—'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setPdfPreview(m)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    height: 42,
                    border: '1px solid #cfe6d8',
                    borderRadius: theme.radius.lg,
                    background: '#f0f8f3',
                    color: theme.color.success,
                    font: 'inherit',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <IconDownload />
                  PDF
                </button>
                <button
                  onClick={() => openEdit(m)}
                  title="Editar"
                  style={{
                    width: 48,
                    height: 42,
                    flex: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${theme.color.borderMute}`,
                    borderRadius: theme.radius.lg,
                    background: theme.color.surface,
                    color: theme.color.textSubtle,
                    cursor: 'pointer',
                  }}
                >
                  <IconEdit size={17} />
                </button>
                <button
                  onClick={() => setPendingDelete(m)}
                  title="Eliminar"
                  style={{
                    width: 48,
                    height: 42,
                    flex: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #f0d9d5',
                    borderRadius: theme.radius.lg,
                    background: '#fdf5f4',
                    color: theme.color.danger,
                    cursor: 'pointer',
                  }}
                >
                  <IconTrash size={17} />
                </button>
              </div>
            </div>
          ))}
          {!isLoading && members.length === 0 && (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: theme.color.textFaint }}>
              Nenhum sócio corresponde à procura.
            </div>
          )}
        </div>
      )}

      <MemberModal
        open={modalOpen}
        title={editingMember ? 'Editar sócio' : 'Novo sócio'}
        defaultValues={toFormValues(editingMember)}
        onCancel={() => setModalOpen(false)}
        onSave={handleSave}
        saving={createMember.isPending || updateMember.isPending}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Eliminar sócio?"
        message={
          <>
            Vai eliminar <strong style={{ color: theme.color.text }}>{pendingDelete?.profaneName}</strong>. Esta ação
            não pode ser anulada.
          </>
        }
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <PdfPreviewModal
        open={!!pdfPreview}
        url={pdfPreview ? `/api/members/${pdfPreview.id}/postcard.pdf` : ''}
        title={pdfPreview ? `Postal — ${pdfPreview.profaneName}` : ''}
        onClose={() => setPdfPreview(null)}
      />
    </div>
  );
}
