import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Filters, Status, Task, TaskDraft } from './types';
import { useBoard, sanitizeState } from './hooks/useBoard';
import { buildFeedbackModel, normalize } from './lib/classifier';
import { STATUS_BY_ID, TEAM_BY_ID } from './lib/meta';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { Board } from './components/Board';
import { TaskModal, type ModalState } from './components/TaskModal';
import { Toasts, type Toast } from './components/Toasts';
import type { User } from './auth/api';
import { useGitHubSync } from './sync/useGitHubSync';
import { SyncDialog } from './components/SyncDialog';

const EMPTY_FILTERS: Filters = { query: '', teams: [], severities: [], types: [] };

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

interface KanbanAppProps {
  user: User;
  onLogout: () => void;
}

export default function KanbanApp({ user, onLogout }: KanbanAppProps) {
  const { state, createTask, updateTask, deleteTask, setColumns, replaceState, applySynced, resetDemo } = useBoard();
  const sync = useGitHubSync({ state, applySynced, author: user.name });
  const [syncOpen, setSyncOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastSeq = useRef(0);

  const allTasks = useMemo(() => Object.values(state.tasks), [state.tasks]);
  const feedbackModel = useMemo(() => buildFeedbackModel(allTasks), [allTasks]);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastSeq.current;
    setToasts((list) => [...list.slice(-3), { ...t, id }]);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  // Global shortcuts: N = new task, / = search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal || e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setModal({ mode: 'create', status: 'backlog' });
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const normalizedQuery = useMemo(() => normalize(filters.query), [filters.query]);
  const isVisible = useCallback(
    (t: Task) => {
      if (filters.teams.length && !filters.teams.includes(t.team)) return false;
      if (filters.severities.length && !filters.severities.includes(t.severity)) return false;
      if (filters.types.length && !filters.types.includes(t.type)) return false;
      if (normalizedQuery) {
        // "#12" or "12" finds task number 12.
        const num = /^#?(\d+)$/.exec(filters.query.trim());
        if (num && t.number === Number(num[1])) return true;
        const hay = normalize(`${t.title} ${t.description} ${t.assignee ?? ''} ${TEAM_BY_ID[t.team].label}`);
        return normalizedQuery.split(' ').every((w) => hay.includes(w));
      }
      return true;
    },
    [filters, normalizedQuery],
  );
  const isFiltered = filters !== EMPTY_FILTERS && (filters.query !== '' || filters.teams.length + filters.severities.length + filters.types.length > 0);
  const visibleCount = useMemo(() => allTasks.filter(isVisible).length, [allTasks, isVisible]);

  const openTask = useCallback(
    (id: string) => {
      const task = state.tasks[id];
      if (task) setModal({ mode: 'edit', task });
    },
    [state.tasks],
  );
  const addInColumn = useCallback((status: Status) => setModal({ mode: 'create', status }), []);

  const handleSave = (draft: TaskDraft) => {
    if (modal?.mode === 'edit') {
      const before = modal.task;
      updateTask(before.id, draft);
      const moved = before.status !== draft.status ? ` e movida para "${STATUS_BY_ID[draft.status].label}"` : '';
      pushToast({ message: `Tarefa atualizada${moved}.` });
    } else {
      createTask(draft);
      const via = draft.teamSource === 'auto' ? ' (classificação automática)' : '';
      pushToast({ message: `Tarefa criada e direcionada para ${TEAM_BY_ID[draft.team].label}${via}.` });
    }
    setModal(null);
  };

  const handleDelete = (id: string) => {
    const title = state.tasks[id]?.title;
    const undo = deleteTask(id);
    setModal(null);
    if (undo) pushToast({ message: `"${title}" excluída.`, tone: 'info', action: { label: 'Desfazer', run: undo } });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roboyell-kanban-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ message: 'Quadro exportado.' });
  };

  const handleImport = async (file: File) => {
    try {
      const parsed = sanitizeState(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid');
      replaceState(parsed);
      pushToast({ message: `Quadro importado: ${Object.keys(parsed.tasks).length} tarefas.` });
    } catch {
      pushToast({ message: 'Arquivo inválido. Use um JSON exportado por este quadro.', tone: 'info' });
    }
  };

  const handleReset = () => {
    if (!window.confirm(sync.hasToken
      ? 'Substituir o quadro COMPARTILHADO pelos dados de exemplo? A mudança será sincronizada para todos. Exporte antes se quiser manter as tarefas.'
      : 'Substituir o quadro atual pelos dados de exemplo? Exporte antes se quiser manter suas tarefas.')) return;
    const backup = state;
    resetDemo();
    pushToast({ message: 'Dados de exemplo restaurados.', tone: 'info', action: { label: 'Desfazer', run: () => replaceState(backup) } });
  };

  return (
    <>
      <a href="#board" className="skip-link">Pular para o quadro</a>
      <div className="app">
        <Header
          query={filters.query}
          onQuery={(query) => setFilters((f) => ({ ...f, query }))}
          searchRef={searchRef}
          onNew={() => setModal({ mode: 'create', status: 'backlog' })}
          onExport={handleExport}
          onImport={handleImport}
          onReset={handleReset}
          user={user}
          onLogout={onLogout}
          syncStatus={sync.status}
          onOpenSync={() => setSyncOpen(true)}
        />
        <FilterBar filters={filters} onChange={setFilters} tasks={allTasks} visibleCount={visibleCount} />
        <div id="board" className="board-wrap">
          <Board
            state={state}
            isVisible={isVisible}
            filtered={isFiltered}
            onColumnsChange={setColumns}
            onOpen={openTask}
            onAdd={addInColumn}
          />
        </div>
      </div>

      {modal && (
        <TaskModal
          key={modal.mode === 'edit' ? modal.task.id : `new-${modal.status}`}
          state={modal}
          feedbackModel={feedbackModel}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
      {syncOpen && (
        <SyncDialog
          status={sync.status}
          error={sync.error}
          lastSyncAt={sync.lastSyncAt}
          hasToken={sync.hasToken}
          onSaveToken={(token) => {
            sync.setToken(token);
            pushToast({ message: 'GitHub conectado. Sincronizando o quadro…' });
          }}
          onDisconnect={() => {
            sync.setToken(null);
            pushToast({ message: 'Sincronização desligada. As tarefas continuam salvas neste navegador.', tone: 'info' });
          }}
          onSyncNow={() => void sync.syncNow()}
          onClose={() => setSyncOpen(false)}
        />
      )}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
