import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Trash2, X, Sparkles } from 'lucide-react';
import type { Severity, Status, Task, TaskDraft, TaskType, TeamId } from '../types';
import { ASSIGNEES, SEVERITIES, SEVERITY_BY_ID, STATUSES, TEAMS, TYPES, TYPE_BY_ID } from '../lib/meta';
import { classifyTeam, suggestSeverity, suggestType, type FeedbackModel } from '../lib/classifier';
import { relativeTime } from '../lib/format';
import { ChoiceGroup } from './ChoiceGroup';
import { ClassifierPanel } from './ClassifierPanel';

export type ModalState = { mode: 'create'; status: Status } | { mode: 'edit'; task: Task };

interface TaskModalProps {
  state: ModalState;
  feedbackModel: FeedbackModel;
  onSave: (draft: TaskDraft) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const blankDraft = (status: Status): TaskDraft => ({
  title: '', description: '', severity: 'medium', type: 'feature', status,
  team: 'backend', teamSource: 'auto', assignee: '', dueDate: '',
});

export function TaskModal({ state, feedbackModel, onSave, onDelete, onClose }: TaskModalProps) {
  const isEdit = state.mode === 'edit';
  const initial = useMemo<TaskDraft>(() => {
    if (state.mode === 'create') return blankDraft(state.status);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = state.task;
    return { assignee: '', dueDate: '', ...rest };
  }, [state]);

  const [draft, setDraft] = useState<TaskDraft>(initial);
  // In create mode, type & severity follow the suggestions until the person picks one.
  const [touched, setTouched] = useState({ type: isEdit, severity: isEdit });
  const [showErrors, setShowErrors] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), desc: useId(), status: useId(), assignee: useId(), due: useId(), heading: useId(), err: useId() };

  const deferredTitle = useDeferredValue(draft.title);
  const deferredDesc = useDeferredValue(draft.description);
  const prediction = useMemo(
    () => classifyTeam(deferredTitle, deferredDesc, feedbackModel),
    [deferredTitle, deferredDesc, feedbackModel],
  );
  const typeSuggestion = useMemo(() => suggestType(deferredTitle, deferredDesc), [deferredTitle, deferredDesc]);
  const sevSuggestion = useMemo(() => suggestSeverity(deferredTitle, deferredDesc), [deferredTitle, deferredDesc]);

  const team: TeamId = draft.teamSource === 'auto' ? prediction.team : draft.team;
  const type: TaskType = !touched.type && typeSuggestion ? typeSuggestion.value : draft.type;
  const severity: Severity = !touched.severity && sevSuggestion ? sevSuggestion.value : draft.severity;

  const titleError = draft.title.trim().length < 3 ? 'Informe um título com pelo menos 3 caracteres.' : null;
  const hasText = (deferredTitle + deferredDesc).trim().length > 0;

  const isDirty =
    JSON.stringify({ ...draft, team, type, severity }) !==
    JSON.stringify({ ...initial, team: initial.team, type: initial.type, severity: initial.severity });

  // Focus management: focus the title on open, restore focus to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
      previouslyFocused?.focus?.();
    };
  }, []);

  const requestClose = () => {
    if (isDirty && draft.title.trim() && !window.confirm('Descartar as alterações desta tarefa?')) return;
    onClose();
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (titleError) {
      setShowErrors(true);
      titleRef.current?.focus();
      return;
    }
    onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      assignee: draft.assignee?.trim() || undefined,
      dueDate: draft.dueDate || undefined,
      team,
      type,
      severity,
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      submit();
    } else if (e.key === 'Tab') {
      // Focus trap
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const list = Array.from(focusables).filter((el) => el.offsetParent !== null || el === document.activeElement);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const chooseTeam = (t: TeamId) =>
    setDraft((d) => ({ ...d, team: t, teamSource: t === prediction.team ? 'auto' : 'manual' }));

  const suggestionHint = (label: string, keywords: string[], applied: boolean, onApply: () => void) => (
    <p className="field__hint">
      <Sparkles size={12} aria-hidden="true" />
      {applied ? (
        <>Sugerido automaticamente: <strong>{label}</strong> ({keywords.slice(0, 3).join(', ')})</>
      ) : (
        <>
          Sugestão: <strong>{label}</strong>{' '}
          <button type="button" className="link" onClick={onApply}>aplicar</button>
        </>
      )}
    </p>
  );

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.heading}
        onKeyDown={onKeyDown}
      >
        <form onSubmit={submit} noValidate>
          <header className="dialog__head">
            <div>
              <h2 id={ids.heading}>{isEdit ? 'Editar tarefa' : 'Nova tarefa'}</h2>
              {isEdit && state.mode === 'edit' && (
                <p className="dialog__sub">Criada {relativeTime(state.task.createdAt)} · atualizada {relativeTime(state.task.updatedAt)}</p>
              )}
            </div>
            <button type="button" className="icon-btn" onClick={requestClose} aria-label="Fechar">
              <X size={18} />
            </button>
          </header>

          <div className="dialog__body">
            <div className="dialog__main">
              <div className="field">
                <label className="field__label" htmlFor={ids.title}>Título <span aria-hidden="true">*</span></label>
                <input
                  ref={titleRef}
                  id={ids.title}
                  className={`input input--lg${showErrors && titleError ? ' input--error' : ''}`}
                  value={draft.title}
                  onChange={(e) => set('title', e.target.value)}
                  onBlur={() => draft.title && setShowErrors(true)}
                  placeholder="Ex.: Endpoint de câmeras retorna erro 500"
                  maxLength={140}
                  required
                  aria-invalid={showErrors && !!titleError}
                  aria-describedby={showErrors && titleError ? ids.err : undefined}
                />
                {showErrors && titleError && <p id={ids.err} className="field__error" role="alert">{titleError}</p>}
              </div>

              <div className="field">
                <label className="field__label" htmlFor={ids.desc}>Descrição</label>
                <textarea
                  id={ids.desc}
                  className="input textarea"
                  value={draft.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Contexto, passos para reproduzir, critérios de aceite…"
                  rows={6}
                />
              </div>

              <ClassifierPanel
                prediction={prediction}
                hasText={hasText}
                currentTeam={team}
                teamSource={draft.teamSource}
                onUseSuggestion={() => setDraft((d) => ({ ...d, teamSource: 'auto' }))}
              />

              <ChoiceGroup
                name="team"
                legend="Equipe responsável"
                variant="tile"
                options={TEAMS}
                value={team}
                suggested={prediction.fallback ? null : prediction.team}
                onChange={chooseTeam}
              />
            </div>

            <aside className="dialog__side">
              <div className="field">
                <label className="field__label" htmlFor={ids.status}>Status</label>
                <select id={ids.status} className="input" value={draft.status} onChange={(e) => set('status', e.target.value as Status)}>
                  {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              <ChoiceGroup
                name="severity"
                legend="Severidade"
                options={SEVERITIES}
                value={severity}
                suggested={sevSuggestion?.value}
                onChange={(v) => { setTouched((t) => ({ ...t, severity: true })); set('severity', v); }}
                hint={sevSuggestion && sevSuggestion.value !== (touched.severity ? draft.severity : null)
                  ? suggestionHint(SEVERITY_BY_ID[sevSuggestion.value].label, sevSuggestion.keywords, !touched.severity,
                      () => set('severity', sevSuggestion.value))
                  : null}
              />

              <ChoiceGroup
                name="type"
                legend="Tipo"
                options={TYPES}
                value={type}
                suggested={typeSuggestion?.value}
                onChange={(v) => { setTouched((t) => ({ ...t, type: true })); set('type', v); }}
                hint={typeSuggestion && typeSuggestion.value !== (touched.type ? draft.type : null)
                  ? suggestionHint(TYPE_BY_ID[typeSuggestion.value].label, typeSuggestion.keywords, !touched.type,
                      () => set('type', typeSuggestion.value))
                  : null}
              />

              <div className="field">
                <label className="field__label" htmlFor={ids.assignee}>Responsável</label>
                <select
                  id={ids.assignee}
                  className="input"
                  value={draft.assignee ?? ''}
                  onChange={(e) => set('assignee', e.target.value)}
                >
                  <option value="">Sem responsável</option>
                  {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor={ids.due}>Prazo</label>
                <input id={ids.due} type="date" className="input" value={draft.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value)} />
              </div>
            </aside>
          </div>

          <footer className="dialog__foot">
            {isEdit && state.mode === 'edit' ? (
              <button type="button" className="btn btn--danger" aria-label="Excluir tarefa" onClick={() => onDelete(state.task.id)}>
                <Trash2 size={15} /> <span className="hide-sm">Excluir</span>
              </button>
            ) : <span />}
            <div className="dialog__actions">
              <span className="kbd-hint" aria-hidden="true"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
              <button type="button" className="btn btn--ghost" onClick={requestClose}>Cancelar</button>
              <button type="submit" className="btn btn--primary">{isEdit ? 'Salvar alterações' : 'Criar tarefa'}</button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
