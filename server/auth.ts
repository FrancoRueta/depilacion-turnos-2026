import { randomBytes, scrypt, timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { SESSION_DURATION_HOURS } from "../shared/constants";
import type { Database } from "./db";

async function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

interface AdminRow {
  id: string;
  username: string;
  password_hash: string;
}

interface SessionAdminRow {
  id: string;
  username: string;
  expires_at: string | Date;
}

export interface AdminIdentity {
  id: string;
  username: string;
}

function scryptOptions() {
  return { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY };
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(password, salt, KEY_LENGTH, scryptOptions())) as Buffer;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [algorithm, n, r, p, saltText, keyText] = storedHash.split("$");
    if (algorithm !== "scrypt" || !n || !r || !p || !saltText || !keyText) return false;

    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    const options = {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEMORY,
    };
    if (
      !Number.isInteger(options.N) ||
      !Number.isInteger(options.r) ||
      !Number.isInteger(options.p) ||
      expected.length === 0
    ) {
      return false;
    }

    const actual = (await scryptAsync(password, salt, expected.length, options)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function burnPasswordCheck(password: string): Promise<void> {
  const salt = randomBytes(16);
  await deriveKey(password, salt);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidAdminUsername(value: string): boolean {
  return /^[a-zA-Z0-9._-]{3,64}$/.test(value);
}

export function isValidAdminPassword(value: string): boolean {
  return value.length >= 12 && value.length <= 200;
}

export async function countAdmins(db: Database): Promise<number> {
  const rows = await db.query<{ count: string }>("SELECT count(*)::text AS count FROM admins");
  return Number(rows[0]?.count ?? "0");
}

export async function authenticateAdmin(
  db: Database,
  username: string,
  password: string,
): Promise<AdminIdentity | null> {
  const rows = await db.query<AdminRow>(
    "SELECT id, username, password_hash FROM admins WHERE username = $1 LIMIT 1",
    [username],
  );

  const admin = rows[0];
  if (!admin) {
    await burnPasswordCheck(password);
    return null;
  }

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) return null;

  return { id: admin.id, username: admin.username };
}

export async function createAdminSession(
  db: Database,
  adminId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await db.query("DELETE FROM admin_sessions WHERE expires_at <= now()");
  await db.query(
    `INSERT INTO admin_sessions (token_hash, admin_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash, adminId, expiresAt],
  );

  return { token, expiresAt };
}

export async function findSessionAdmin(
  db: Database,
  token: string,
): Promise<AdminIdentity | null> {
  const tokenHash = hashSessionToken(token);
  const rows = await db.query<SessionAdminRow>(
    `SELECT a.id, a.username, s.expires_at
       FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
      LIMIT 1`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username };
}

export async function revokeSession(db: Database, token: string): Promise<void> {
  await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
}

export async function createOrUpdateSingleAdmin(
  db: Database,
  username: string,
  password: string,
): Promise<{ created: boolean }> {
  const existing = await db.query<{ id: string; username: string }>(
    "SELECT id, username FROM admins ORDER BY created_at ASC",
  );

  const passwordHash = await hashPassword(password);
  const adminId = randomUUID();

  if (existing.length === 0) {
    await db.query(
      "INSERT INTO admins (id, username, password_hash) VALUES ($1, $2, $3)",
      [adminId, username, passwordHash],
    );
    return { created: true };
  }

  const current = existing[0];
  if (current.username !== username) {
    throw new Error(
      `Ya existe el administrador "${current.username}". Para cambiar el usuario, actualizá ese nombre.`,
    );
  }

  await db.query("UPDATE admins SET password_hash = $1 WHERE id = $2", [
    passwordHash,
    current.id,
  ]);
  await db.query("DELETE FROM admin_sessions WHERE admin_id = $1", [current.id]);
  return { created: false };
}
