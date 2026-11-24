import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Cloud, CloudOff, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { SYNC_FILE_URL, SYNC_TARGET, verifyToken } from '../sync/github';
import type { SyncStatus } from '../sync/useGitHubSync';
import { relativeTime } from '../lib/format';
import { SyncBadge } from './SyncBadge';

interface SyncDialogProps {
  status: SyncStatus;
  error: string | null;
  lastSyncAt: number | null;
  hasToken: boolean;
  onSaveToken: (token: string) => void;
  onDisconnect: () => void;
  onSyncNow: () => void;
  onClose: () => void;
}

const FINE_GRAINED_URL = 'https://github.com/settings/personal-access-tokens/new';
const CLASSIC_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Roboyell%20Kanban';

export function SyncDialog({ status, error, lastSyncAt, hasToken, onSaveToken, onDisconnect, onSyncNow, onClose }: SyncDialogProps) {
  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = { heading: useId(), token: useId(), err: useId() };
  const repo = `${SYNC_TARGET.owner}/${SYNC_TARGET.repo}`;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  // Listen on the document: focus can fall to <body> while the submit button is disabled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = token.trim();
    if (!value) return;
    setChecking(true);
    setFormError(null);
    const result = await verifyToken(value);
    setChecking(false);
    if (!result.ok) {
      setFormError(result.error);
      inputRef.current?.focus();
      return;
    }
    onSaveToken(value);
    setToken('');
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog dialog--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.heading}
      >
        <header className="dialog__head">
          <div>
            <h2 id={ids.heading}>Sincronização com GitHub</h2>
            <p className="dialog__sub">
              As tarefas ficam salvas neste navegador e são espelhadas em{' '}
              <a href={SYNC_FILE_URL} target="_blank" rel="noreferrer" className="link">{repo}/{SYNC_TARGET.path}</a>.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="sync">
          <div className="sync__status">
            <SyncBadge status={status} />
            {lastSyncAt && <span className="sync__muted">Última sincronização {relativeTime(lastSyncAt)}</span>}
            {hasToken && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onSyncNow}>
                <RefreshCw size={13} /> Sincronizar agora
              </button>
            )}
          </div>
          {error && <p className="login__error" role="alert">{error}</p>}

          <form onSubmit={submit} className="sync__form">
            <label className="field__label" htmlFor={ids.token}>
              {hasToken ? 'Trocar token do GitHub' : 'Token do GitHub'}
            </label>
            <div className="sync__row">
              <input
                ref={inputRef}
                id={ids.token}
                className="input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="github_pat_… ou ghp_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                aria-describedby={formError ? ids.err : undefined}
              />
              <button type="submit" className="btn btn--primary" disabled={checking || !token.trim()}>
                {checking ? <Loader2 size={15} className="spin" /> : <Cloud size={15} />}
                {checking ? 'Verificando…' : 'Conectar'}
              </button>
            </div>
            {formError && <p id={ids.err} className="field__error" role="alert">{formError}</p>}
            <p className="sync__muted">O token fica salvo só neste navegador e é enviado apenas para api.github.com.</p>
          </form>

          <details className="sync__help">
            <summary>Como gerar o token</summary>
            <ol>
              <li>
                <strong>Dono do repositório (Guilherme):</strong>{' '}
                <a className="link" href={FINE_GRAINED_URL} target="_blank" rel="noreferrer">
                  crie um token refinado <ExternalLink size={11} />
                </a>{' '}
                com acesso só a <code>{repo}</code> e permissão <em>Contents: Read and write</em>.
              </li>
              <li>
                <strong>Colaborador (Pedro):</strong> aceite o convite para o repositório e{' '}
                <a className="link" href={CLASSIC_URL} target="_blank" rel="noreferrer">
                  crie um token clássico com escopo <code>repo</code> <ExternalLink size={11} />
                </a>
                . Tokens refinados não acessam repositórios de outra conta.
              </li>
              <li>Cole o token acima e clique em Conectar. Na primeira conexão, este navegador passa a usar o quadro compartilhado.</li>
            </ol>
          </details>
        </div>

        {hasToken && (
          <footer className="dialog__foot">
            <button type="button" className="btn btn--danger" onClick={onDisconnect}>
              <CloudOff size={15} /> Desconectar
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>Fechar</button>
          </footer>
        )}
      </div>
    </div>
  );
}
