import { useEffect, useState } from 'react';
import { theme } from '../theme';
import { useIsMobile } from '../hooks/useIsMobile';
import { useToast } from './ToastContext';
import { IconClose, IconDownload, IconShare } from './icons';

interface PdfPreviewModalProps {
  open: boolean;
  url: string;
  title: string;
  onClose: () => void;
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match?.[1] ?? null;
}

const iconBtnBase = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '12px 16px',
  font: 'inherit',
  fontWeight: 600,
  fontSize: 13.5,
} as const;

/** Fetched once as a blob (not the raw <iframe src="/api/...">) so Download/Partilhar can reuse
 * the same bytes without a second request, and so Partilhar can hand a real File to the iOS
 * share sheet — that's the only reliable "save to Files" path from an installed PWA. */
export function PdfPreviewModal({ open, url, title, onClose }: PdfPreviewModalProps) {
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('postal.pdf');
  const [error, setError] = useState(false);
  const shareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBlob(null);
    setBlobUrl(null);
    setError(false);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('failed');
        const name = parseFilename(res.headers.get('content-disposition'));
        if (name) setFileName(name);
        return res.blob();
      })
      .then((b) => {
        if (cancelled) return;
        setBlob(b);
        setBlobUrl(URL.createObjectURL(b));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!open) return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShare = async () => {
    if (!blob) return;
    try {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        await navigator.share({ url, title });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      showToast('Não foi possível partilhar o postal.');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(70,55,20,.34)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 20,
        zIndex: 128,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 440,
          height: isMobile ? '100%' : '86vh',
          maxWidth: '100%',
          maxHeight: '100%',
          background: theme.color.surfaceWarm,
          borderRadius: isMobile ? 0 : theme.radius.modal,
          boxShadow: '0 24px 70px rgba(70,55,20,.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: `1px solid ${theme.color.border}`,
            display: 'flex',
            alignItems: 'center',
            flex: 'none',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: theme.font.serif,
              fontSize: 20,
              fontWeight: 400,
              color: theme.color.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="fx-ico"
            style={{
              marginLeft: 'auto',
              width: 36,
              height: 36,
              flex: 'none',
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

        <div style={{ flex: 1, minHeight: 0, background: '#e9e4d8' }}>
          {error && (
            <div style={{ padding: 40, textAlign: 'center', color: theme.color.textFaint, fontSize: 13.5 }}>
              Não foi possível carregar o postal.
            </div>
          )}
          {!error && !blobUrl && (
            <div style={{ padding: 40, textAlign: 'center', color: theme.color.textFaint, fontSize: 13.5 }}>
              A carregar…
            </div>
          )}
          {blobUrl && <iframe src={blobUrl} title={title} style={{ width: '100%', height: '100%', border: 'none' }} />}
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderTop: `1px solid ${theme.color.border}`,
            display: 'flex',
            gap: 10,
            flex: 'none',
          }}
        >
          <button
            type="button"
            onClick={handleDownload}
            disabled={!blobUrl}
            style={{
              ...iconBtnBase,
              border: `1px solid ${theme.color.borderInput}`,
              borderRadius: theme.radius.lg,
              background: theme.color.surface,
              color: theme.color.textSoft,
              cursor: blobUrl ? 'pointer' : 'default',
              opacity: blobUrl ? 1 : 0.5,
            }}
          >
            <IconDownload size={16} />
            Descarregar
          </button>
          {shareSupported && (
            <button
              type="button"
              onClick={handleShare}
              disabled={!blob}
              style={{
                ...iconBtnBase,
                border: 'none',
                borderRadius: theme.radius.lg,
                background: theme.color.gold,
                color: '#fff',
                cursor: blob ? 'pointer' : 'default',
                opacity: blob ? 1 : 0.5,
                boxShadow: '0 1px 2px rgba(166,124,0,.25)',
              }}
            >
              <IconShare size={16} />
              Partilhar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
