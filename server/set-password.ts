/**
 * Creates a user or changes their password.
 *
 *   npm run user:password -- guilherme                  # new random password for an existing user
 *   npm run user:password -- pedro "Pedro Rosa"         # create user (random password)
 *   RY_PASSWORD='...' npm run user:password -- pedro    # chosen password via env (keeps it out of argv)
 *
 * Writes two files:
 *   server/users.json            scrypt hashes for the local server login (private, gitignored)
 *   src/auth/static-users.json   PBKDF2 hashes for the GitHub Pages build (public, committed)
 *
 * Changing a password immediately signs that user out of every browser.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  STATIC_ITERATIONS,
  generatePassword,
  hashPassword,
  hashPasswordStatic,
  normalizeLogin,
  readUsers,
  writeUsers,
} from './passwords.ts';

const FILE = join(import.meta.dirname, 'users.json');
const STATIC_FILE = join(import.meta.dirname, '..', 'src', 'auth', 'static-users.json');
const [rawUsername, name, argPassword] = process.argv.slice(2);
const chosen = argPassword ?? process.env.RY_PASSWORD;

if (!rawUsername) {
  console.error('Uso: npm run user:password -- <usuario> ["Nome Completo"] [senha]');
  process.exit(1);
}

const username = normalizeLogin(rawUsername);
const users = readUsers(FILE);
const existing = users.find((u) => u.username === username);

if (!existing && !name) {
  console.error(`Usuário "${username}" não existe. Informe o nome completo para criá-lo.`);
  process.exit(1);
}
if (chosen !== undefined && chosen.length < 10) {
  console.error('A senha precisa ter pelo menos 10 caracteres.');
  process.exit(1);
}

const password = chosen ?? generatePassword();
const record = { username, name: name ?? existing!.name, ...hashPassword(password) };
writeUsers(FILE, existing ? users.map((u) => (u.username === username ? record : u)) : [...users, record]);

type StaticUser = { username: string; name: string; salt: string; hash: string };
const staticData = existsSync(STATIC_FILE)
  ? (JSON.parse(readFileSync(STATIC_FILE, 'utf8')) as { users: StaticUser[] })
  : { users: [] as StaticUser[] };
const staticRecord = { username, name: record.name, ...hashPasswordStatic(password) };
const staticUsers = staticData.users.some((u) => u.username === username)
  ? staticData.users.map((u) => (u.username === username ? staticRecord : u))
  : [...staticData.users, staticRecord];
writeFileSync(
  STATIC_FILE,
  `${JSON.stringify({ algorithm: 'PBKDF2-SHA256', iterations: STATIC_ITERATIONS, users: staticUsers }, null, 2)}\n`,
);

console.log(`${existing ? 'Senha atualizada' : 'Usuário criado'}: ${record.name} (${username})`);
if (!chosen) console.log(`Senha: ${password}`);
