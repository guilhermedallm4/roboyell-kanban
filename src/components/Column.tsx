import type { CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Inbox, AlertTriangle } from 'lucide-react';
import type { Status, Task } from '../types';
import { STATUS_BY_ID, WIP_LIMITS } from '../lib/meta';
import { SortableTaskCard } from './TaskCard';

interface ColumnProps {
  status: Status;
  tasks: Task[];
  totalCount: number;
  filtered: boolean;
  onOpen: (id: string) => void;
  onAdd: (status: Status) => void;
}

export function Column({ status, tasks, totalCount, filtered, onOpen, onAdd }: ColumnProps) {
  const meta = STATUS_BY_ID[status];
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column' } });
  const limit = WIP_LIMITS[status];
  const overLimit = limit !== undefined && totalCount > limit;
  const headingId = `col-${status}-title`;

  return (
    <section
      className={`column${isOver ? ' column--over' : ''}`}
      style={{ '--col': meta.color } as CSSProperties}
      aria-labelledby={headingId}
    >
      <header className="column__head">
        <div className="column__title">
          <span className="column__dot" aria-hidden="true" />
          <h2 id={headingId}>{meta.label}</h2>
          <span
            className={`count${overLimit ? ' count--warn' : ''}`}
            title={limit ? `Limite WIP: ${limit}` : undefined}
            aria-label={`${filtered ? `${tasks.length} de ${totalCount}` : totalCount} tarefas${overLimit ? `, acima do limite de ${limit}` : ''}`}
          >
            {overLimit && <AlertTriangle size={11} aria-hidden="true" />}
            {filtered ? `${tasks.length}/${totalCount}` : totalCount}
            {limit !== undefined && !filtered && <span className="count__limit">/{limit}</span>}
          </span>
        </div>
        <button className="icon-btn icon-btn--sm" onClick={() => onAdd(status)} aria-label={`Nova tarefa em ${meta.label}`} title="Nova tarefa nesta coluna">
          <Plus size={16} />
        </button>
      </header>
      <p className="column__desc">{meta.description}</p>

      <SortableContext id={status} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="column__list" role="list">
          {tasks.map((task) => (
            <div role="listitem" key={task.id}>
              <SortableTaskCard task={task} onOpen={onOpen} />
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="column__empty">
              <Inbox size={20} aria-hidden="true" />
              <span>{filtered && totalCount > 0 ? 'Nenhuma tarefa corresponde aos filtros' : 'Arraste tarefas para cá'}</span>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
