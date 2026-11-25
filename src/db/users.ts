import crypto from 'node:crypto';
import { getDb } from './index.ts';
import { hashPassword, verifyPassword } from '../lib/local-auth.ts';
import type { UserRole } from '../lib/kbt-types.ts';

export type { UserRole };

export interface UserRecord {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

interface RawUserRow {
  id: number;
  uid: string;
  email: string;
  display_name: string;
  role: string;
  password_hash: string | null;
  created_at: string;
}

function mapUserRow(row: RawUserRow): UserRecord {
  return {
    id: Number(row.id),
    uid: String(row.uid),
    email: String(row.email),
    displayName: String(row.display_name || ''),
    role: (['viewer', 'analyst', 'admin'].includes(row.role) ? row.role : 'viewer') as UserRole,
    createdAt: String(row.created_at || ''),
  };
}

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.trim().toLowerCase());
}

export async function getUserByUid(uid: string): Promise<UserRecord | null> {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT id, uid, email, display_name, role, password_hash, created_at FROM users WHERE uid = ? LIMIT 1',
    )
    .get(uid) as RawUserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName = '',
): Promise<UserRecord> {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db
    .prepare(
      'SELECT id, uid, email, display_name, role, password_hash, created_at FROM users WHERE uid = ? LIMIT 1',
    )
    .get(uid) as RawUserRow | undefined;

  if (existing) {
    const nextName = displayName.trim() || existing.display_name;
    if (existing.email !== normalizedEmail || existing.display_name !== nextName) {
      db.prepare('UPDATE users SET email = ?, display_name = ? WHERE uid = ?').run(
        normalizedEmail,
        nextName,
        uid,
      );
      return { ...mapUserRow(existing), email: normalizedEmail, displayName: nextName };
    }
    return mapUserRow(existing);
  }

  const countRow = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  const isFirstUser = Number(countRow?.n ?? 0) === 0;
  const initialRole: UserRole = isFirstUser || isAdminEmail(normalizedEmail) ? 'admin' : 'viewer';
  const safeName = displayName.trim() || normalizedEmail.split('@')[0];

  db.prepare(
    `INSERT INTO users (uid, email, display_name, role)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(uid) DO UPDATE SET email = excluded.email, display_name = excluded.display_name`,
  ).run(uid, normalizedEmail, safeName, initialRole);

  const inserted = db
    .prepare(
      'SELECT id, uid, email, display_name, role, password_hash, created_at FROM users WHERE uid = ? LIMIT 1',
    )
    .get(uid) as unknown as RawUserRow;

  return mapUserRow(inserted);
}

export async function hasLocalAdminAccount(): Promise<boolean> {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE password_hash IS NOT NULL AND role = 'admin'")
    .get() as { n: number };
  return Number(row?.n ?? 0) > 0;
}

export async function claimFirstLocalAdmin(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<UserRecord> {
  const db = getDb();
  const normalizedEmail = input.email.trim().toLowerCase();
  const safeName = input.displayName.trim() || normalizedEmail.split('@')[0];
  const passwordHash = hashPassword(input.password);
  const uid = `local_${crypto.randomUUID()}`;

  db.exec('BEGIN IMMEDIATE');
  try {
    const existingAdmin = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE password_hash IS NOT NULL AND role = 'admin'")
      .get() as { n: number };
    if (Number(existingAdmin?.n ?? 0) > 0) {
      throw new Error('Initial administrator account has already been configured.');
    }

    const existingEmail = db
      .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
      .get(normalizedEmail);
    if (existingEmail) {
      db.prepare(
        "UPDATE users SET display_name = ?, role = 'admin', password_hash = ? WHERE email = ?",
      ).run(safeName, passwordHash, normalizedEmail);
    } else {
      db.prepare(
        `INSERT INTO users (uid, email, display_name, role, password_hash)
         VALUES (?, ?, ?, 'admin', ?)`,
      ).run(uid, normalizedEmail, safeName, passwordHash);
    }

    const created = db
      .prepare(
        'SELECT id, uid, email, display_name, role, password_hash, created_at FROM users WHERE email = ? LIMIT 1',
      )
      .get(normalizedEmail) as unknown as RawUserRow;

    db.exec('COMMIT');
    return mapUserRow(created);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export async function registerLocalUser(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<UserRecord> {
  const db = getDb();
  const normalizedEmail = input.email.trim().toLowerCase();
  const safeName = input.displayName.trim() || normalizedEmail.split('@')[0];

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
    .get(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const passwordHash = hashPassword(input.password);
  const uid = `local_${crypto.randomUUID()}`;
  const role: UserRole = isAdminEmail(normalizedEmail) ? 'admin' : 'viewer';

  db.prepare(
    `INSERT INTO users (uid, email, display_name, role, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(uid, normalizedEmail, safeName, role, passwordHash);

  const inserted = db
    .prepare(
      'SELECT id, uid, email, display_name, role, password_hash, created_at FROM users WHERE uid = ? LIMIT 1',
    )
    .get(uid) as unknown as RawUserRow;

  return mapUserRow(inserted);
}

export async function authenticateLocalUser(
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();

  // If ADMIN_PASSCODE env var is configured, allow server-verified passcode login for admin email
  const configuredPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (configuredPasscode && configuredPasscode.length > 0 && isAdminEmail(normalizedEmail)) {
    const a = Buffer.from(password, 'utf8');
    const b = Buffer.from(configuredPasscode, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      const uid = `env_admin_${crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 16)}`;
      const existing = await getOrCreateUser(uid, normalizedEmail, normalizedEmail.split('@')[0]);
      if (existing.role !== 'admin') {
        const promoted = await updateUserRole(existing.uid, 'admin');
        if (promoted) return promoted;
      }
      return existing;
    }
  }

  const row = db
    .prepare(
      'SELECT id, uid, email, display_name, role, password_hash, created_at FROM users WHERE email = ? LIMIT 1',
    )
    .get(normalizedEmail) as RawUserRow | undefined;

  if (!row || !row.password_hash) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return mapUserRow(row);
}

export async function listUsers(): Promise<UserRecord[]> {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, uid, email, display_name, role, password_hash, created_at FROM users ORDER BY id ASC',
    )
    .all() as unknown as RawUserRow[];
  return rows.map(mapUserRow);
}

export async function updateUserRole(
  targetUid: string,
  role: UserRole,
): Promise<UserRecord | null> {
  const db = getDb();
  const res = db.prepare('UPDATE users SET role = ? WHERE uid = ?').run(role, targetUid);
  if (!res.changes) return null;
  return getUserByUid(targetUid);
}
