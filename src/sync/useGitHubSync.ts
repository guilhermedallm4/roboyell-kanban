import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardState } from '../types';
import { sanitizeState } from '../hooks/useBoard';
import { AuthError, ConflictError, SYNC_TARGET, fetchRemoteBoard, pushRemoteBoard } from './github';
import { mergeBoards } from './merge';

export type SyncStatus = 'disabled' | 'connecting' | 'synced' | 'saving' | 'offline' | 'error';

const TOKEN_KEY = 'roboyell-kanban:gh-token';
const META_KEY = 'roboyell-kanban:sync-meta';
const PUSH_DELAY_MS = 1500;
const POLL_MS = 15_000;
const REPO_ID = `${SYNC_TARGET.owner}/${SYNC_TARGET.repo}:${SYNC_TARGET.branch}`;

interface SyncMeta {
  repo: string;
  /** sha of board.json we last read or wrote */
  sha: string | null;
  /** serialized board as it is on GitHub at `sha` */
  synced: string | null;
}

const fingerprint = (s: BoardState) => JSON.stringify([s.tasks, s.columns, s.deleted ?? {}]);

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readMeta(): SyncMeta {
  try {
    const meta = JSON.parse(storageGet(META_KEY) ?? 'null') as SyncMeta | null;
    if (meta && meta.repo === REPO_ID) return meta;
  } catch {
    /* ignore */
  }
  return { repo: REPO_ID, sha: null, synced: null };
}

interface Options {
  state: BoardState;
  applySynced: (state: BoardState) => void;
  author: string;
}

/**
 * Keeps the local board (always saved in the browser) mirrored with board.json in the private data repository.
 * - Local edits are pushed after a short pause.
 * - The remote file is polled every 15 s and when the tab regains focus.
 * - If both sides changed, the boards are merged (see merge.ts) and the result is pushed.
 */
export function useGitHubSync({ state, applySynced, author }: Options) {
  const [token, setTokenState] = useState<string | null>(() => storageGet(TOKEN_KEY));
  const [status, setStatus] = useState<SyncStatus>(token ? 'connecting' : 'disabled');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const authorRef = useRef(author);
  authorRef.current = author;
  const meta = useRef<SyncMeta>(readMeta());
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pushTimer = useRef<number | undefined>(undefined);
  const halted = useRef(false); // stop after an auth error until the token changes

  const saveMeta = () => storageSet(META_KEY, JSON.stringify(meta.current));

  const settle = useCallback(() => {
    setError(null);
    setLastSyncAt(Date.now());
    setStatus(meta.current.synced === fingerprint(stateRef.current) ? 'synced' : 'saving');
  }, []);

  const onFailure = useCallback((e: unknown) => {
    if (e instanceof AuthError) {
      halted.current = true;
      setStatus('error');
      setError(e.message);
    } else if (e instanceof TypeError) {
      setStatus('offline'); // network: retry on the next poll
    } else {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Erro de sincronização.');
    }
  }, []);

  /** Runs sync operations one at a time. */
  const enqueue = useCallback(
    (op: () => Promise<void>) => {
      chain.current = chain.current.then(async () => {
        if (!tokenRef.current || halted.current) return;
        try {
          await op();
          settle();
        } catch (e) {
          onFailure(e);
        }
      });
      return chain.current;
    },
    [settle, onFailure],
  );

  const pushNow = useCallback(async (): Promise<void> => {
    const token = tokenRef.current!;
    const local = stateRef.current;
    const fp = fingerprint(local);
    if (fp === meta.current.synced) return;
    setStatus('saving');
    try {
      meta.current.sha = await pushRemoteBoard(token, local, meta.current.sha, authorRef.current);
      meta.current.synced = fp;
      saveMeta();
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      await pullNow(); // someone else saved first: merge, then the effect pushes the result
    }
  }, []);

  const pullNow = useCallback(async (): Promise<void> => {
    const token = tokenRef.current!;
    const remote = await fetchRemoteBoard(token);
    if (!remote.state) {
      // File doesn't exist yet: this browser's board becomes the shared one.
      meta.current = { repo: REPO_ID, sha: null, synced: null };
      await pushNow();
      return;
    }
    if (remote.sha === meta.current.sha) return;

    const remoteState = sanitizeState(remote.state);
    if (!remoteState) throw new Error('O board.json no GitHub está inválido.');
    const local = stateRef.current;
    const neverSynced = meta.current.sha === null;
    const clean = meta.current.synced === fingerprint(local);
    // First sync in this browser: adopt the shared board (local data is just the demo seed).
    const next = neverSynced || clean ? remoteState : mergeBoards(local, remoteState);

    meta.current = { repo: REPO_ID, sha: remote.sha, synced: fingerprint(remoteState) };
    saveMeta();
    stateRef.current = next;
    applySynced(next);
  }, [applySynced, pushNow]);

  const sync = useCallback(() => enqueue(pullNow), [enqueue, pullNow]);

  // Connect / reconnect when the token changes.
  useEffect(() => {
    halted.current = false;
    if (!token) {
      setStatus('disabled');
      setError(null);
      return;
    }
    setStatus('connecting');
    void sync();
  }, [token, sync]);

  // Push local changes after a short pause.
  useEffect(() => {
    if (!token || halted.current) return;
    if (fingerprint(state) === meta.current.synced) return;
    setStatus((s) => (s === 'connecting' ? s : 'saving'));
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void enqueue(pushNow), PUSH_DELAY_MS);
    return () => window.clearTimeout(pushTimer.current);
  }, [state, token, enqueue, pushNow]);

  // Poll for the other person's changes.
  useEffect(() => {
    if (!token) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    const id = window.setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    window.addEventListener('online', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      window.removeEventListener('online', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [token, sync]);

  // Flush pending changes when the page is closed.
  useEffect(() => {
    const flush = () => {
      if (tokenRef.current && fingerprint(stateRef.current) !== meta.current.synced) void enqueue(pushNow);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [enqueue, pushNow]);

  const setToken = useCallback((next: string | null) => {
    storageSet(TOKEN_KEY, next);
    setTokenState(next);
  }, []);

  return { status, error, lastSyncAt, hasToken: !!token, setToken, syncNow: sync };
}
