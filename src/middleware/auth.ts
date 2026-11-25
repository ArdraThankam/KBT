import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/local-auth.ts';
import { getOrCreateUser, getUserByUid, type UserRole } from '../db/users.ts';

export interface AuthenticatedDbUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: AuthenticatedDbUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty authentication token.' });
    return;
  }

  // 1. Check server-signed local session token first
  if (token.startsWith('kbt1.')) {
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
      return;
    }

    try {
      const dbUser = await getUserByUid(payload.uid);
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized: User account no longer exists.' });
        return;
      }
      req.dbUser = {
        id: dbUser.id,
        uid: dbUser.uid,
        email: dbUser.email,
        displayName: dbUser.displayName,
        role: dbUser.role,
      };
      next();
      return;
    } catch (error) {
      console.error('Local user lookup failed:', error);
      res.status(500).json({ error: 'Failed to load user profile.' });
      return;
    }
  }

  // 2. Otherwise verify Firebase Auth ID token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;

    const email = decoded.email || `${decoded.uid}@authenticated.local`;
    const displayName = typeof decoded.name === 'string' ? decoded.name : '';
    const dbUser = await getOrCreateUser(decoded.uid, email, displayName);

    req.dbUser = {
      id: dbUser.id,
      uid: dbUser.uid,
      email: dbUser.email,
      displayName: dbUser.displayName,
      role: dbUser.role,
    };
    next();
  } catch (error) {
    console.error('Authentication token verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
};

export const requireRole = (allowed: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.dbUser?.role;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({
        error: `Forbidden: This resource requires one of [${allowed.join(', ')}] role(s).`,
      });
      return;
    }
    next();
  };
};
