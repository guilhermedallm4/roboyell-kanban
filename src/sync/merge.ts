import type { BoardState, Status, Task } from '../types';
import { STATUSES } from '../lib/meta';
import { assignNumbers } from '../lib/numbering';

/**
 * Two-way merge of boards edited in different browsers.
 * - Per task, the most recently updated version wins.
 * - A deletion (tombstone) wins over any edit made before it.
 * - Column order comes from whichever board changed last; tasks it doesn't know about are
 *   placed where the other board had them.
 * - Task numbers stay unique: if both browsers created a task with the same number offline, the
 *   newer task is renumbered (see assignNumbers).
 */
export function mergeBoards(local: BoardState, remote: BoardState): BoardState {
  const deleted: Record<string, number> = { ...remote.deleted };
  for (const [id, at] of Object.entries(local.deleted ?? {})) deleted[id] = Math.max(at, deleted[id] ?? 0);

  const tasks: Record<string, Task> = {};
  const ids = new Set([...Object.keys(local.tasks), ...Object.keys(remote.tasks)]);
  for (const id of ids) {
    const l = local.tasks[id];
    const r = remote.tasks[id];
    const winner = !l ? r : !r ? l : l.updatedAt >= r.updatedAt ? l : r;
    if (deleted[id] !== undefined && deleted[id] >= winner.updatedAt) continue;
    tasks[id] = winner;
    delete deleted[id];
  }

  const localNewer = (local.updatedAt ?? 0) >= (remote.updatedAt ?? 0);
  const [base, other] = localNewer ? [local, remote] : [remote, local];

  const columns = {} as Record<Status, string[]>;
  const placed = new Set<string>();
  for (const { id: status } of STATUSES) {
    columns[status] = (base.columns[status] ?? []).filter((id) => tasks[id]?.status === status && !placed.has(id));
    columns[status].forEach((id) => placed.add(id));
  }
  for (const task of Object.values(tasks)) {
    if (placed.has(task.id)) continue;
    const col = columns[task.status];
    const index = (other.columns[task.status] ?? []).indexOf(task.id);
    col.splice(index >= 0 ? Math.min(index, col.length) : col.length, 0, task.id);
    placed.add(task.id);
  }

  return assignNumbers({
    tasks,
    columns,
    deleted,
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0),
    seq: Math.max(local.seq ?? 0, remote.seq ?? 0),
  });
}
