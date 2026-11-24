import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { BoardState, Status, Task } from '../types';
import { STATUSES, STATUS_BY_ID } from '../lib/meta';
import { Column } from './Column';
import { CardBody } from './TaskCard';

interface BoardProps {
  state: BoardState;
  isVisible: (task: Task) => boolean;
  filtered: boolean;
  onColumnsChange: (columns: Record<Status, string[]>) => void;
  onOpen: (id: string) => void;
  onAdd: (status: Status) => void;
}

const isStatus = (id: UniqueIdentifier): id is Status => typeof id === 'string' && id in STATUS_BY_ID;

/**
 * Pointer-first collision: the column under the cursor wins, and inside it the closest card.
 * Falls back to closestCorners for keyboard dragging (no pointer coordinates).
 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length === 0) return closestCorners(args);
  const column = hits.find((h) => isStatus(h.id));
  const cards = hits.filter((h) => !isStatus(h.id));
  if (cards.length) {
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => cards.some((h) => h.id === c.id)) });
  }
  if (column) {
    // Over a column's empty area: snap to its nearest card, or the column itself when empty.
    const inColumn = args.droppableContainers.filter((c) => c.data.current?.sortable?.containerId === column.id);
    return inColumn.length ? closestCenter({ ...args, droppableContainers: inColumn }) : [column];
  }
  return hits;
};

export function Board({ state, isVisible, filtered, onColumnsChange, onOpen, onAdd }: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshot = useRef<Record<Status, string[]> | null>(null);
  const { columns, tasks } = state;

  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  /** ←/→ jump to the adjacent column; ↑/↓ reorder within the column. */
  const coordinateGetter = useMemo<KeyboardCoordinateGetter>(
    () => (event, args) => {
      const { active, collisionRect, droppableRects } = args.context;
      if ((event.code === 'ArrowRight' || event.code === 'ArrowLeft') && active && collisionRect) {
        event.preventDefault();
        const cols = columnsRef.current;
        const from = STATUSES.findIndex(({ id }) => cols[id].includes(String(active.id)));
        const step = event.code === 'ArrowRight' ? 1 : -1;
        const target = STATUSES[from + step];
        const rect = target && droppableRects.get(target.id);
        if (!rect) return args.currentCoordinates;
        return { x: rect.left + (rect.width - collisionRect.width) / 2, y: rect.top + 4 };
      }
      return sortableKeyboardCoordinates(event, args);
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const visibleColumns = useMemo(() => {
    const out = {} as Record<Status, Task[]>;
    for (const { id } of STATUSES) out[id] = columns[id].map((tid) => tasks[tid]).filter((t) => t && isVisible(t));
    return out;
  }, [columns, tasks, isVisible]);

  const findContainer = (id: UniqueIdentifier): Status | undefined => {
    if (isStatus(id)) return id;
    return STATUSES.find(({ id: s }) => columns[s].includes(String(id)))?.id;
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    snapshot.current = columns;
    setActiveId(String(active.id));
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;

    const activeKey = String(active.id);
    const target = [...columns[to]];
    let index = target.length;
    if (!isStatus(over.id)) {
      const overIndex = target.indexOf(String(over.id));
      const translated = active.rect.current.translated;
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
      index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
    }
    target.splice(index, 0, activeKey);
    onColumnsChange({ ...columns, [from]: columns[from].filter((id) => id !== activeKey), [to]: target });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    snapshot.current = null;
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || from !== to || isStatus(over.id) || active.id === over.id) return;
    const list = columns[from];
    const oldIndex = list.indexOf(String(active.id));
    const newIndex = list.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onColumnsChange({ ...columns, [from]: arrayMove(list, oldIndex, newIndex) });
  };

  const handleDragCancel = () => {
    if (snapshot.current) onColumnsChange(snapshot.current);
    snapshot.current = null;
    setActiveId(null);
  };

  const title = (id: UniqueIdentifier) => tasks[String(id)]?.title ?? 'tarefa';
  const where = (id?: UniqueIdentifier) => {
    const s = id !== undefined ? findContainer(id) : undefined;
    return s ? STATUS_BY_ID[s].label : 'fora das colunas';
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tarefa "${title(active.id)}" selecionada em ${where(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `Tarefa "${title(active.id)}" sobre ${where(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Tarefa "${title(active.id)}" solta em ${where(over.id)}.` : `Movimento cancelado.`),
    onDragCancel: ({ active }) => `Movimento de "${title(active.id)}" cancelado.`,
  };

  const activeTask = activeId ? tasks[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Para mover uma tarefa, pressione Espaço. Use as setas para escolher a nova posição e Espaço novamente para soltar, ou Esc para cancelar.',
        },
      }}
    >
      <main className="board" aria-label="Quadro Kanban">
        {STATUSES.map(({ id }) => (
          <Column
            key={id}
            status={id}
            tasks={visibleColumns[id]}
            totalCount={columns[id].length}
            filtered={filtered}
            onOpen={onOpen}
            onAdd={onAdd}
          />
        ))}
      </main>
      <DragOverlay
        dropAnimation={{
          duration: 180,
          sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }),
        }}
      >
        {activeTask ? <CardBody task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
