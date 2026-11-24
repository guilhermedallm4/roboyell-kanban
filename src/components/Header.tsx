import { useEffect, useRef, useState, type RefObject } from 'react';
import { Cloud, Download, LogOut, MoreVertical, Plus, RotateCcw, Search, Upload, X } from 'lucide-react';
import type { SyncStatus } from '../sync/useGitHubSync';
import { SyncBadge } from './SyncBadge';
import type { User } from '../auth/api';
import { initials } from '../lib/format';

interface HeaderProps {
  query: string;
  onQuery: (q: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  user: User;
  onLogout: () => void;
  syncStatus: SyncStatus;
  onOpenSync: () => void;
}

export function Header({ query, onQuery, searchRef, onNew, onExport, onImport, onReset, user, onLogout, syncStatus, onOpenSync }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <header className="topbar">
      <div className="brand">
        <a href="https://www.roboyell.com/" target="_blank" rel="noreferrer" className="brand__logo" aria-label="Roboyell (abre o site em nova aba)">
          <img src={`${import.meta.env.BASE_URL}logo_roboyell.png`} alt="Roboyell" width={175} height={33} />
        </a>
        <span className="brand__divider" aria-hidden="true" />
        <div className="brand__text">
          <h1>Kanban de Projetos</h1>
          <span>KAyla · Visão computacional & IA</span>
        </div>
      </div>

      <div className="search" role="search">
        <Search size={16} className="search__icon" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          className="search__input"
          placeholder="Buscar tarefas, #nº, responsáveis…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (onQuery(''), e.currentTarget.blur())}
          aria-label="Buscar tarefas"
        />
        {query ? (
          <button className="icon-btn icon-btn--sm search__clear" onClick={() => onQuery('')} aria-label="Limpar busca">
            <X size={14} />
          </button>
        ) : (
          <kbd className="search__kbd" aria-hidden="true">/</kbd>
        )}
      </div>

      <div className="topbar__actions">
        <SyncBadge status={syncStatus} onClick={onOpenSync} />

        <div className="fmenu" ref={menuRef} onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}>
          <button
            className="user-btn"
            aria-label={`Menu de ${user.name}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="avatar avatar--lg" aria-hidden="true">{initials(user.name)}</span>
            <span className="user-btn__name hide-sm">{user.name.split(' ')[0]}</span>
            <MoreVertical size={16} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="fmenu__pop fmenu__pop--right" role="menu">
              <div className="menu-user">
                <span className="avatar avatar--lg" aria-hidden="true">{initials(user.name)}</span>
                <div>
                  <strong>{user.name}</strong>
                  <span>@{user.username}</span>
                </div>
              </div>
              <div className="menu-sep" role="separator" />
              <button role="menuitem" className="menu-item" onClick={() => { onOpenSync(); setMenuOpen(false); }}>
                <Cloud size={15} /> Sincronização com GitHub
              </button>
              <button role="menuitem" className="menu-item" onClick={() => { onExport(); setMenuOpen(false); }}>
                <Download size={15} /> Exportar JSON
              </button>
              <button role="menuitem" className="menu-item" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /> Importar JSON
              </button>
              <button role="menuitem" className="menu-item menu-item--danger" onClick={() => { onReset(); setMenuOpen(false); }}>
                <RotateCcw size={15} /> Restaurar dados de exemplo
              </button>
              <div className="menu-sep" role="separator" />
              <button role="menuitem" className="menu-item" onClick={() => { setMenuOpen(false); onLogout(); }}>
                <LogOut size={15} /> Sair
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
              setMenuOpen(false);
            }}
          />
        </div>

        <button className="btn btn--primary" onClick={onNew} title="Nova tarefa (N)">
          <Plus size={16} /> <span className="hide-sm">Nova tarefa</span>
          <kbd className="btn__kbd hide-sm" aria-hidden="true">N</kbd>
        </button>
      </div>
    </header>
  );
}
