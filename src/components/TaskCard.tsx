import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarClock, Sparkles } from 'lucide-react';
import type { Task } from '../types';
import { SEVERITY_BY_ID, TEAM_BY_ID, TYPE_BY_ID } from '../lib/meta';
import { dueLabel, initials } from '../lib/format';

interface CardBodyProps {
  task: Task;
  overlay?: boolean;
}

export const CardBody = memo(function CardBody({ task, overlay }: CardBodyProps) {
  const severity = SEVERITY_BY_ID[task.severity];
  const type = TYPE_BY_ID[task.type];
  const team = TEAM_BY_ID[task.team];
  const TypeIcon = type.icon!;
  const TeamIcon = team.icon!;
  const due = task.dueDate && task.status !== 'done' ? dueLabel(task.dueDate) : null;

  return (
    <article
      className={`card${overlay ? ' card--overlay' : ''}${task.status === 'done' ? ' card--done' : ''}`}
      style={{ '--sev': severity.color } as CSSProperties}
    >
      <header className="card__top">
        <span className={`sev sev--${task.severity}`}>
          <span className="sev__dot" aria-hidden="true" />
          {severity.label}
        </span>
        <span className="chip chip--type" style={{ '--c': type.color } as CSSProperties}>
          <TypeIcon size={12} aria-hidden="true" />
          {type.label}
        </span>
      </header>

      <h3 className="card__title">{task.title}</h3>
      {task.description && <p className="card__desc">{task.description}</p>}

      <footer className="card__foot">
        <span
          className="chip chip--team"
          style={{ '--c': team.color } as CSSProperties}
          title={`${team.label} — ${task.teamSource === 'auto' ? 'sugerida automaticamente pelo classificador' : 'definida manualmente'}`}
        >
          <TeamIcon size={12} aria-hidden="true" />
          <span className="chip__text">{team.short ?? team.label}</span>
          {task.teamSource === 'auto' && <Sparkles size={11} className="chip__auto" aria-label="(automático)" />}
        </span>
        <span className="card__meta">
          {due && (
            <span className={`due due--${due.tone}`} title={`Prazo: ${task.dueDate}`}>
              <CalendarClock size={12} aria-hidden="true" />
              {due.text}
            </span>
          )}
          {task.assignee && (
            <span className="avatar" title={task.assignee} aria-label={`Responsável: ${task.assignee}`}>
              {initials(task.assignee)}
            </span>
          )}
        </span>
      </footer>
    </article>
  );
});

interface SortableTaskCardProps {
  task: Task;
  onOpen: (id: string) => void;
}

export function SortableTaskCard({ task, onOpen }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', status: task.status },
  });

  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Space is reserved for dnd-kit's keyboard drag; Enter opens the editor.
    if (e.key === 'Enter' && !isDragging) {
      e.preventDefault();
      onOpen(task.id);
      return;
    }
    listeners?.onKeyDown?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-wrap${isDragging ? ' card-wrap--placeholder' : ''}`}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => onOpen(task.id)}
      aria-roledescription="cartão arrastável"
      aria-label={`${task.title}. Severidade ${SEVERITY_BY_ID[task.severity].label}, ${TYPE_BY_ID[task.type].label}, equipe ${TEAM_BY_ID[task.team].label}. Enter para editar, Espaço para mover.`}
    >
      <CardBody task={task} />
    </div>
  );
}
