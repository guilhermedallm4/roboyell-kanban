import { staticCurrentUser, staticLogin, staticLogout } from './staticAuth';

export interface User {
  username: string;
  name: string;
}

export type LoginResult = { ok: true; user: User } | { ok: false; error: string };

/**
 * Two login backends:
 * - server (default, `npm run dev` / `npm run preview`): API in server/auth.ts, HttpOnly cookie.
 * - static (`VITE_STATIC_AUTH=true`, used for GitHub Pages): checked in the browser, see staticAuth.ts.
 */
export const STATIC_AUTH = import.meta.env.VITE_STATIC_AUTH === 'true';

const json = { 'Content-Type': 'application/json' };

async function serverCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    return ((await res.json()) as { user: User }).user;
  } catch {
    return null;
  }
}

async function serverLogin(username: string, password: string, remember: boolean): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: json,
      credentials: 'same-origin',
      body: JSON.stringify({ username, password, remember }),
    });
    const data = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
    if (res.ok && data.user) return { ok: true, user: data.user };
    return { ok: false, error: data.error ?? 'Não foi possível entrar. Tente novamente.' };
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor. Verifique se ele está rodando.' };
  }
}

async function serverLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', headers: json, credentials: 'same-origin', body: '{}' }).catch(() => {});
}

export const fetchCurrentUser = STATIC_AUTH ? staticCurrentUser : serverCurrentUser;
export const login = STATIC_AUTH ? staticLogin : serverLogin;
export const logout = STATIC_AUTH ? staticLogout : serverLogout;
