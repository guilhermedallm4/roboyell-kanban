import type { BoardState, Task } from '../types';

/** Oldest first; the id breaks ties so every browser gets the same order. */
const byCreation = (a: Task, b: Task) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Highest number ever handed out (deleted tasks included, so numbers are never reused). */
export function highestNumber(state: BoardState): number {
  let max = state.seq ?? 0;
  for (const task of Object.values(state.tasks)) if (task.number && task.number > max) max = task.number;
  return max;
}

/**
 * Makes sure every task has a unique sequential number (#1, #2, …).
 * - Tasks without a number (boards from before numbering) get one in creation order.
 * - If two browsers created tasks offline and picked the same number, the older task keeps it and
 *   the newer one gets the next free number. Its updatedAt is bumped so that renumbering wins the
 *   next merge and both browsers converge on it.
 * Returns the same object when nothing needs to change.
 */
export function assignNumbers(state: BoardState): BoardState {
  const owners = new Map<number, Task>();
  const pending: Task[] = [];
  for (const task of Object.values(state.tasks).sort(byCreation)) {
    const n = task.number;
    if (!Number.isInteger(n) || n! < 1 || owners.has(n!)) pending.push(task);
    else owners.set(n!, task);
  }

  let seq = highestNumber(state);
  if (pending.length === 0) return seq === state.seq ? state : { ...state, seq };

  const now = Date.now();
  const tasks = { ...state.tasks };
  for (const task of pending) {
    seq += 1;
    tasks[task.id] = { ...task, number: seq, updatedAt: Math.max(now, task.updatedAt + 1) };
  }
  return { ...state, tasks, seq };
}

/** "#12" — or an empty string for a task that has no number yet. */
export const taskCode = (task: Pick<Task, 'number'>) => (task.number ? `#${task.number}` : '');
