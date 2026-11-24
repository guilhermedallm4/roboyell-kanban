import { AlertTriangle, CheckCircle2, CloudOff, HardDrive, Loader2, type LucideIcon } from 'lucide-react';
import type { SyncStatus } from '../sync/useGitHubSync';

const VIEW: Record<SyncStatus, { label: string; icon: LucideIcon; tone: string; spin?: boolean }> = {
  disabled: { label: 'Só neste navegador', icon: HardDrive, tone: 'idle' },
  connecting: { label: 'Conectando…', icon: Loader2, tone: 'busy', spin: true },
  saving: { label: 'Salvando…', icon: Loader2, tone: 'busy', spin: true },
  synced: { label: 'Sincronizado', icon: CheckCircle2, tone: 'ok' },
  offline: { label: 'Offline', icon: CloudOff, tone: 'warn' },
  error: { label: 'Erro na sincronização', icon: AlertTriangle, tone: 'err' },
};

export function SyncBadge({ status, onClick }: { status: SyncStatus; onClick?: () => void }) {
  const { label, icon: Icon, tone, spin } = VIEW[status];
  const content = (
    <>
      <Icon size={14} className={spin ? 'spin' : undefined} aria-hidden="true" />
      <span className="sync-badge__label">{label}</span>
    </>
  );
  if (!onClick) return <span className={`sync-badge sync-badge--${tone}`}>{content}</span>;
  return (
    <button type="button" className={`sync-badge sync-badge--${tone}`} onClick={onClick} title="Sincronização com GitHub" aria-label={`Sincronização: ${label}`}>
      {content}
    </button>
  );
}
