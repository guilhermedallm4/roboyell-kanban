import { useCallback, useEffect, useReducer } from 'react';
import type { BoardState, Status, Task, TaskDraft } from '../types';
import { ASSIGNEES, STATUSES } from '../lib/meta';
import { EMPTY_COLUMNS, createSeedState, makeId } from '../lib/seed';

const STORAGE_KEY = 'roboyell-kanban:v1';

type Action =
  | { type: 'create'; task: Task }
  | { type: 'update'; id: string; patch: Partial<TaskDraft> }
  | { type: 'delete'; id: string }
  | { type: 'restore'; task: Task; index: number }
  | { type: 'setColumns'; columns: Record<Status, string[]> }
  /** local=true: a person replaced the board (import/reset); false: state applied from sync. */
  | { type: 'replace'; state: BoardState; local: boolean };

const TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function reducer(state: BoardState, action: Action): BoardState {
  const next = apply(state, action);
  if (next === state || (action.type === 'replace' && !action.local)) return next;
  return { ...next, updatedAt: Date.now() };
}

function apply(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case 'create': {
      const { task } = action;
      return {
        ...state,
        tasks: { ...state.tasks, [task.id]: task },
        columns: { ...state.columns, [task.status]: [task.id, ...state.columns[task.status]] },
      };
    }
    case 'update': {
      const prev = state.tasks[action.id];
      if (!prev) return state;
      const next: Task = { ...prev, ...action.patch, updatedAt: Date.now() };
      let columns = state.columns;
      if (next.status !== prev.status) {
        columns = {
          ...columns,
          [prev.status]: columns[prev.status].filter((id) => id !== prev.id),
          [next.status]: [prev.id, ...columns[next.status]],
        };
      }
      return { ...state, tasks: { ...state.tasks, [prev.id]: next }, columns };
    }
    case 'delete': {
      const task = state.tasks[action.id];
      if (!task) return state;
      const tasks = { ...state.tasks };
      delete tasks[action.id];
      return {
        ...state,
        tasks,
        columns: { ...state.columns, [task.status]: state.columns[task.status].filter((id) => id !== action.id) },
        deleted: { ...state.deleted, [action.id]: Date.now() },
      };
    }
    case 'restore': {
      const task = { ...action.task, updatedAt: Date.now() };
      const col = [...state.columns[task.status]];
      col.splice(Math.min(action.index, col.length), 0, task.id);
      const deleted = { ...state.deleted };
      delete deleted[task.id];
      return { ...state, tasks: { ...state.tasks, [task.id]: task }, columns: { ...state.columns, [task.status]: col }, deleted };
    }
    case 'setColumns': {
      // Keep each task's status in sync with the column it lives in.
      const tasks = { ...state.tasks };
      for (const status of Object.keys(action.columns) as Status[]) {
        for (const id of action.columns[status]) {
          if (tasks[id] && tasks[id].status !== status) tasks[id] = { ...tasks[id], status, updatedAt: Date.now() };
        }
      }
      return { ...state, tasks, columns: action.columns };
    }
    case 'replace': {
      if (!action.local) return action.state;
      // Tasks that disappear in a local replace are tombstoned so the sync doesn't bring them back.
      const now = Date.now();
      const deleted = { ...state.deleted, ...action.state.deleted };
      for (const id of Object.keys(state.tasks)) if (!action.state.tasks[id]) deleted[id] = now;
      return { ...action.state, deleted };
    }
  }
}

/** Validates and repairs a state loaded from storage or an imported file. */
export function sanitizeState(raw: unknown): BoardState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<BoardState>;
  if (!r.tasks || typeof r.tasks !== 'object') return null;
  const columns = EMPTY_COLUMNS();
  const seen = new Set<string>();
  for (const { id: status } of STATUSES) {
    for (const id of r.columns?.[status] ?? []) {
      const task = r.tasks[id];
      if (task && !seen.has(id)) {
        columns[status].push(id);
        seen.add(id);
        task.status = status;
      }
    }
  }
  // Tasks missing from every column go to the column their status says.
  for (const task of Object.values(r.tasks)) {
    if (!seen.has(task.id) && task.status in columns) columns[task.status].push(task.id);
    // Only the allowed people can stay assigned.
    if (task.assignee && !(ASSIGNEES as readonly string[]).includes(task.assignee)) task.assignee = undefined;
  }
  const deleted: Record<string, number> = {};
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  for (const [id, at] of Object.entries(r.deleted ?? {})) {
    if (typeof at === 'number' && at > cutoff && !r.tasks[id]) deleted[id] = at;
  }
  return { tasks: r.tasks, columns, deleted, updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0 };
}

function loadInitial(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = sanitizeState(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt — fall back to seed */
  }
  return createSeedState();
}

export function useBoard() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state]);

  const createTask = useCallback((draft: TaskDraft) => {
    const now = Date.now();
    const task: Task = { ...draft, id: makeId(), createdAt: now, updatedAt: now };
    dispatch({ type: 'create', task });
    return task;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<TaskDraft>) => dispatch({ type: 'update', id, patch }), []);

  const deleteTask = useCallback(
    (id: string) => {
      const task = state.tasks[id];
      if (!task) return null;
      const index = state.columns[task.status].indexOf(id);
      dispatch({ type: 'delete', id });
      return () => dispatch({ type: 'restore', task, index });
    },
    [state],
  );

  const setColumns = useCallback((columns: Record<Status, string[]>) => dispatch({ type: 'setColumns', columns }), []);
  /** A person replaced the board (import, undo of a reset). */
  const replaceState = useCallback((next: BoardState) => dispatch({ type: 'replace', state: next, local: true }), []);
  /** State that came from the sync (remote or merged): not a new local change. */
  const applySynced = useCallback((next: BoardState) => dispatch({ type: 'replace', state: next, local: false }), []);
  const resetDemo = useCallback(() => dispatch({ type: 'replace', state: createSeedState(), local: true }), []);

  return { state, createTask, updateTask, deleteTask, setColumns, replaceState, applySynced, resetDemo };
}
