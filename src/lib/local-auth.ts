import crypto from 'node:crypto';
import type { UserRole } from './kbt-types.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32);

function getSigningKey(): Buffer {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return crypto.createHash('sha256').update(configured).digest();
  }
  return EPHEMERAL_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const expected = Buffer.from(hexHash, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface LocalSessionPayload {
  uid: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

export function signSessionToken(input: {
  uid: string;
  email: string;
  role: UserRole;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: LocalSessionPayload = {
    uid: input.uid,
    email: input.email,
    role: input.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedPayload)
    .digest('base64url');
  return `kbt1.${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): LocalSessionPayload | null {
  if (!token.startsWith('kbt1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedPayload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as LocalSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.uid || !decoded.email || typeof decoded.exp !== 'number' || decoded.exp <= now) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
