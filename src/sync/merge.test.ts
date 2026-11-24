import { describe, expect, it } from 'vitest';
import type { BoardState, Status, Task } from '../types';
import { mergeBoards } from './merge';

const task = (id: string, status: Status, updatedAt: number, title = id): Task => ({
  id, title, description: '', severity: 'medium', type: 'feature', status, team: 'backend', teamSource: 'auto',
  createdAt: 0, updatedAt,
});

const board = (tasks: Task[], extra: Partial<BoardState> = {}): BoardState => {
  const columns = { backlog: [], analysis: [], todo: [], doing: [], review: [], done: [] } as Record<Status, string[]>;
  for (const t of tasks) columns[t.status].push(t.id);
  return { tasks: Object.fromEntries(tasks.map((t) => [t.id, t])), columns, deleted: {}, updatedAt: 0, ...extra };
};

describe('mergeBoards', () => {
  it('keeps tasks created on each side', () => {
    const m = mergeBoards(board([task('a', 'backlog', 1)]), board([task('b', 'backlog', 1)]));
    expect(Object.keys(m.tasks).sort()).toEqual(['a', 'b']);
    expect(m.columns.backlog.sort()).toEqual(['a', 'b']);
  });

  it('newest edit of the same task wins, including its column', () => {
    const local = board([task('a', 'doing', 5, 'local')]);
    const remote = board([task('a', 'backlog', 9, 'remote')]);
    const m = mergeBoards(local, remote);
    expect(m.tasks.a.title).toBe('remote');
    expect(m.columns.backlog).toEqual(['a']);
    expect(m.columns.doing).toEqual([]);
  });

  it('deletion wins over older edits and is not resurrected', () => {
    const local = board([], { deleted: { a: 10 } });
    const remote = board([task('a', 'backlog', 5)]);
    const m = mergeBoards(local, remote);
    expect(m.tasks.a).toBeUndefined();
    expect(m.columns.backlog).toEqual([]);
    expect(m.deleted?.a).toBe(10);
  });

  it('an edit after the deletion brings the task back', () => {
    const m = mergeBoards(board([], { deleted: { a: 10 } }), board([task('a', 'backlog', 20)]));
    expect(m.tasks.a).toBeDefined();
    expect(m.deleted?.a).toBeUndefined();
  });

  it('uses the most recently changed board for ordering', () => {
    const tasks = [task('a', 'backlog', 1), task('b', 'backlog', 1)];
    const local = board(tasks, { updatedAt: 50 });
    local.columns.backlog = ['b', 'a'];
    const remote = board(tasks, { updatedAt: 10 });
    expect(mergeBoards(local, remote).columns.backlog).toEqual(['b', 'a']);
    expect(mergeBoards(remote, local).columns.backlog).toEqual(['b', 'a']);
  });
});
