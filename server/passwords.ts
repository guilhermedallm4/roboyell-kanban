/**
 * Credential storage for the Kanban login.
 * Only scrypt hashes are stored (server/users.json, never bundled into the front-end).
 */
import { pbkdf2Sync, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface UserRecord {
  username: string;
  name: string;
  salt: string;
  hash: string;
}

const KEYLEN = 64;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, KEYLEN, SCRYPT).toString('hex') };
}

export function verifyPassword(password: string, user: Pick<UserRecord, 'salt' | 'hash'>): boolean {
  const actual = scryptSync(password, user.salt, KEYLEN, SCRYPT);
  const expected = Buffer.from(user.hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

/** Used when the username doesn't exist, so the response time doesn't reveal valid usernames. */
export const DUMMY_USER = { salt: '00000000000000000000000000000000', hash: '00'.repeat(KEYLEN) };

export function normalizeLogin(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Accepts the username ("guilherme"), the full name ("Guilherme Lima") or the first name. */
export function findUser(users: UserRecord[], login: string): UserRecord | undefined {
  const n = normalizeLogin(login);
  if (!n) return undefined;
  return users.find((u) => u.username === n || normalizeLogin(u.name) === n);
}

export function readUsers(file: string): UserRecord[] {
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8')) as { users?: UserRecord[] };
  return data.users ?? [];
}

export function writeUsers(file: string, users: UserRecord[]): void {
  writeFileSync(file, `${JSON.stringify({ users }, null, 2)}\n`, { mode: 0o600 });
}

/**
 * PBKDF2-SHA256 hash for the static (GitHub Pages) build, where the check runs in the browser via
 * WebCrypto (which has no scrypt). Must match src/auth/staticAuth.ts.
 */
export const STATIC_ITERATIONS = 600_000;

export function hashPasswordStatic(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: pbkdf2Sync(password, Buffer.from(salt, 'hex'), STATIC_ITERATIONS, 32, 'sha256').toString('hex') };
}

/** Readable random password, e.g. "Kq7m-Xp4t-Wn9c" (~70 bits of entropy). */
export function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}
