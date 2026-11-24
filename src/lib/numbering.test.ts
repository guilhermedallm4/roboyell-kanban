import { describe, expect, it } from 'vitest';
import type { BoardState, Status, Task } from '../types';
import { assignNumbers } from './numbering';
import { mergeBoards } from '../sync/merge';
import { boardReducer, sanitizeState } from '../hooks/useBoard';

const task = (id: string, createdAt: number, number?: number, status: Status = 'backlog'): Task => ({
  id, number, title: id, description: '', severity: 'medium', type: 'feature', status, team: 'backend',
  teamSource: 'auto', createdAt, updatedAt: createdAt,
});

const board = (tasks: Task[], extra: Partial<BoardState> = {}): BoardState => {
  const columns = { backlog: [], analysis: [], todo: [], doing: [], review: [], done: [] } as Record<Status, string[]>;
  for (const t of tasks) columns[t.status].push(t.id);
  return { tasks: Object.fromEntries(tasks.map((t) => [t.id, t])), columns, deleted: {}, updatedAt: 0, ...extra };
};

const numbers = (s: BoardState) => Object.fromEntries(Object.values(s.tasks).map((t) => [t.id, t.number]));

const create = (s: BoardState, id: string) =>
  boardReducer(s, { type: 'create', task: { ...task(id, Date.now()), number: undefined } });

describe('task numbering', () => {
  it('numbers old boards in creation order', () => {
    const s = assignNumbers(board([task('c', 30), task('a', 10), task('b', 20)]));
    expect(numbers(s)).toEqual({ a: 1, b: 2, c: 3 });
    expect(s.seq).toBe(3);
  });

  it('is a no-op when every task already has a unique number', () => {
    const s = board([task('a', 1, 1), task('b', 2, 2)], { seq: 2 });
    expect(assignNumbers(s)).toBe(s);
  });

  it('new tasks get the next number, and numbers of deleted tasks are never reused', () => {
    let s = assignNumbers(board([task('a', 1), task('b', 2)]));
    s = create(s, 'c');
    expect(s.tasks.c.number).toBe(3);
    s = boardReducer(s, { type: 'delete', id: 'c' });
    s = create(s, 'd');
    expect(s.tasks.d.number).toBe(4);
  });

  it('editing a task does not change its number', () => {
    let s = assignNumbers(board([task('a', 1)]));
    s = boardReducer(s, { type: 'update', id: 'a', patch: { title: 'novo' } });
    expect(s.tasks.a.number).toBe(1);
  });

  it('sanitize (load/import/sync) fills in missing numbers', () => {
    const s = sanitizeState(JSON.parse(JSON.stringify(board([task('a', 1), task('b', 2, 7)]))))!;
    expect(numbers(s)).toEqual({ a: 8, b: 7 });
  });

  it('two browsers creating the same number offline converge on unique numbers', () => {
    const shared = board([task('a', 1, 1)], { seq: 1 });
    const local = board([...Object.values(shared.tasks), task('x', 100, 2)], { seq: 2 });
    const remote = board([...Object.values(shared.tasks), task('y', 200, 2)], { seq: 2 });

    const onA = mergeBoards(local, remote);
    expect(numbers(onA)).toEqual({ a: 1, x: 2, y: 3 });

    // B still has y = #2 locally; merging A's pushed board must give the same result.
    const onB = mergeBoards(remote, onA);
    expect(numbers(onB)).toEqual({ a: 1, x: 2, y: 3 });
    expect(onB.seq).toBe(3);
    // And it is stable: merging again changes nothing.
    expect(numbers(mergeBoards(onA, onB))).toEqual(numbers(onB));
  });
});
