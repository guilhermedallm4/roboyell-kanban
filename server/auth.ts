/**
 * Login API served by the Vite dev/preview server.
 *
 *   GET  /api/auth/me      → 200 { user } | 401
 *   POST /api/auth/login   → 200 { user } + session cookie | 400 | 401 | 429
 *   POST /api/auth/logout  → 204, clears the cookie
 *
 * - Passwords are checked against scrypt hashes in server/users.json (never sent to the browser).
 * - The session is an HMAC-signed, HttpOnly, SameSite=Strict cookie, so page scripts can't read it.
 * - Changing a user's password invalidates their existing sessions.
 * - 5 failed attempts for the same user from the same IP lock that pair for 5 minutes.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Connect, Plugin } from 'vite';
import { DUMMY_USER, findUser, normalizeLogin, readUsers, verifyPassword, type UserRecord } from './passwords.ts';

const COOKIE = 'ry_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;

interface SessionPayload {
  u: string; // username
  v: string; // password fingerprint — changes when the password changes
  exp: number;
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
const fingerprint = (user: UserRecord) => user.hash.slice(0, 16);
const publicUser = (user: UserRecord) => ({ username: user.username, name: user.name });

function loadSecret(file: string): Buffer {
  if (existsSync(file)) return Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
  const secret = randomBytes(32);
  writeFileSync(file, secret.toString('hex'), { mode: 0o600 });
  return secret;
}

function parseCookies(header = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string | string[]> = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage, limit = 4096): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function createAuthMiddleware(root: string): Connect.NextHandleFunction {
  const usersFile = join(root, 'server', 'users.json');
  const secret = loadSecret(join(root, 'server', '.session-secret'));
  const failures = new Map<string, { count: number; lockedUntil: number }>();

  const sign = (payload: SessionPayload) => {
    const body = b64(JSON.stringify(payload));
    return `${body}.${b64(createHmac('sha256', secret).update(body).digest())}`;
  };

  const readSession = (req: IncomingMessage): UserRecord | null => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (!token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', secret).update(body).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
      if (payload.exp < Date.now()) return null;
      const user = readUsers(usersFile).find((u) => u.username === payload.u);
      return user && fingerprint(user) === payload.v ? user : null;
    } catch {
      return null;
    }
  };

  const cookie = (req: IncomingMessage, value: string, maxAgeSec?: number) => {
    const secure = (req.socket as { encrypted?: boolean }).encrypted || req.headers['x-forwarded-proto'] === 'https';
    return [
      `${COOKIE}=${value}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      ...(maxAgeSec !== undefined ? [`Max-Age=${maxAgeSec}`] : []),
      ...(secure ? ['Secure'] : []),
    ].join('; ');
  };

  /** Rejects cross-site POSTs (defence in depth on top of SameSite=Strict). */
  const sameOrigin = (req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  };

  return async (req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';
    if (!url.startsWith('/api/auth/')) return next();

    if (url === '/api/auth/me' && req.method === 'GET') {
      const user = readSession(req);
      return user ? send(res, 200, { user: publicUser(user) }) : send(res, 401, { error: 'Não autenticado.' });
    }

    if (req.method !== 'POST' || !sameOrigin(req) || !req.headers['content-type']?.includes('application/json')) {
      return send(res, 400, { error: 'Requisição inválida.' });
    }

    if (url === '/api/auth/logout') {
      return send(res, 204, undefined, { 'Set-Cookie': cookie(req, '', 0) });
    }

    if (url === '/api/auth/login') {
      let body: { username?: unknown; password?: unknown; remember?: unknown };
      try {
        body = (await readJson(req)) as typeof body;
      } catch {
        return send(res, 400, { error: 'Requisição inválida.' });
      }
      const login = typeof body.username === 'string' ? body.username : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!login || !password) return send(res, 400, { error: 'Informe usuário e senha.' });

      const key = `${req.socket.remoteAddress}|${normalizeLogin(login)}`;
      const state = failures.get(key);
      if (state && state.lockedUntil > Date.now()) {
        const retryAfter = Math.ceil((state.lockedUntil - Date.now()) / 1000);
        return send(res, 429, { error: `Muitas tentativas. Tente novamente em ${Math.ceil(retryAfter / 60)} min.`, retryAfter }, { 'Retry-After': String(retryAfter) });
      }

      const user = findUser(readUsers(usersFile), login);
      const ok = verifyPassword(password, user ?? DUMMY_USER) && !!user;
      if (!ok || !user) {
        const count = (state?.count ?? 0) + 1;
        if (count >= MAX_FAILURES) {
          failures.set(key, { count: 0, lockedUntil: Date.now() + LOCK_MS });
          return send(res, 429, { error: `Muitas tentativas. Tente novamente em ${LOCK_MS / 60_000} min.`, retryAfter: LOCK_MS / 1000 }, {
            'Retry-After': String(LOCK_MS / 1000),
          });
        }
        failures.set(key, { count, lockedUntil: 0 });
        const left = MAX_FAILURES - count;
        return send(res, 401, {
          error: left > 0 && left <= 2 ? `Usuário ou senha inválidos. ${left} tentativa(s) restante(s).` : 'Usuário ou senha inválidos.',
        });
      }

      failures.delete(key);
      const remember = body.remember === true;
      const ttl = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
      const token = sign({ u: user.username, v: fingerprint(user), exp: Date.now() + ttl });
      return send(res, 200, { user: publicUser(user) }, {
        'Set-Cookie': cookie(req, token, remember ? Math.floor(ttl / 1000) : undefined),
      });
    }

    return send(res, 404, { error: 'Não encontrado.' });
  };
}

export function authPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'roboyell-auth',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use(createAuthMiddleware(root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createAuthMiddleware(root));
    },
  };
}
