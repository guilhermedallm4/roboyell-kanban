/**
 * Reads and writes the shared board as a JSON file in a private GitHub repository (separate from the public code),
 * through the REST "contents" API, authenticated with each person's own token.
 */
import type { BoardState } from '../types';

const [OWNER, REPO] = (import.meta.env.VITE_SYNC_REPO ?? 'guilhermedallm4/roboyell-kanban-data').split('/');

export const SYNC_TARGET = {
  owner: OWNER,
  repo: REPO,
  branch: import.meta.env.VITE_SYNC_BRANCH ?? 'main',
  path: 'board.json',
};

export const SYNC_FILE_URL = `https://github.com/${OWNER}/${REPO}/blob/${SYNC_TARGET.branch}/${SYNC_TARGET.path}`;

const API = 'https://api.github.com';
const CONTENTS_URL = `${API}/repos/${OWNER}/${REPO}/contents/${SYNC_TARGET.path}`;

export class ConflictError extends Error {}
export class AuthError extends Error {}

const headers = (token: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

async function fail(res: Response): Promise<never> {
  if (res.status === 401) throw new AuthError('Token inválido ou expirado.');
  if (res.status === 403 || res.status === 404) throw new AuthError('O token não tem acesso ao repositório de dados.');
  if (res.status === 409 || res.status === 422) throw new ConflictError('O arquivo mudou no GitHub.');
  throw new Error(`GitHub respondeu ${res.status}.`);
}

export interface RemoteBoard {
  state: BoardState | null;
  sha: string | null;
}

export async function fetchRemoteBoard(token: string): Promise<RemoteBoard> {
  const res = await fetch(`${CONTENTS_URL}?ref=${encodeURIComponent(SYNC_TARGET.branch)}&t=${Date.now()}`, {
    headers: headers(token),
    cache: 'no-store',
  });
  if (res.status === 404) {
    // Distinguish "file not created yet" from "no access to the repo".
    const repo = await fetch(`${API}/repos/${OWNER}/${REPO}`, { headers: headers(token), cache: 'no-store' });
    if (repo.ok) return { state: null, sha: null };
    return fail(repo);
  }
  if (!res.ok) return fail(res);
  const data = (await res.json()) as { content: string; sha: string };
  return { state: JSON.parse(decodeBase64(data.content)) as BoardState, sha: data.sha };
}

export async function pushRemoteBoard(token: string, state: BoardState, sha: string | null, author: string): Promise<string> {
  const res = await fetch(CONTENTS_URL, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Atualiza quadro (${author})`,
      content: encodeBase64(`${JSON.stringify(state, null, 1)}\n`),
      branch: SYNC_TARGET.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) return fail(res);
  return ((await res.json()) as { content: { sha: string } }).content.sha;
}

/** Checks that the token can read and write the data repository. */
export async function verifyToken(token: string): Promise<{ ok: true; login: string } | { ok: false; error: string }> {
  try {
    const [user, repo] = await Promise.all([
      fetch(`${API}/user`, { headers: headers(token) }),
      fetch(`${API}/repos/${OWNER}/${REPO}`, { headers: headers(token) }),
    ]);
    if (user.status === 401) return { ok: false, error: 'Token inválido ou expirado.' };
    if (!repo.ok) return { ok: false, error: `O token não enxerga ${OWNER}/${REPO}. Confira o acesso ao repositório.` };
    const permissions = ((await repo.json()) as { permissions?: { push?: boolean } }).permissions;
    if (permissions && !permissions.push) return { ok: false, error: 'O token só tem leitura. Ele precisa de permissão de escrita (Contents: Read and write).' };
    return { ok: true, login: ((await user.json()) as { login: string }).login };
  } catch {
    return { ok: false, error: 'Sem conexão com o GitHub.' };
  }
}
