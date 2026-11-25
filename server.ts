import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth, requireRole, type AuthRequest } from './src/middleware/auth.ts';
import {
  getAnalytics,
  getApplicationDetail,
  getLookups,
  getSettings,
  listApplications,
  saveSettings,
} from './src/db/kbt-queries.ts';
import {
  authenticateLocalUser,
  claimFirstLocalAdmin,
  hasLocalAdminAccount,
  listUsers,
  registerLocalUser,
  updateUserRole,
  type UserRole,
} from './src/db/users.ts';
import { getDb } from './src/db/index.ts';
import { signSessionToken } from './src/lib/local-auth.ts';
import type {
  AnalyticsFilterParams,
  DwellingSegment,
  ForecastSplit,
  PartialYearMode,
  SolarSegment,
  TaxColumnOption,
  YearColumnOption,
} from './src/lib/kbt-types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseOptInt(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isInteger(n) ? n : null;
}

function isValidEmail(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length >= 5 && trimmed.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

async function parseFilterParams(query: Record<string, unknown>): Promise<AnalyticsFilterParams> {
  const settings = await getSettings();
  const yearColumn = (
    typeof query.yearColumn === 'string' &&
    ['appln_form2_date', 'appln_year', 'appln_form2_year'].includes(query.yearColumn)
      ? query.yearColumn
      : settings.yearColumn
  ) as YearColumnOption;

  const taxColumn = (
    typeof query.taxColumn === 'string' &&
    ['appln_tax_lump', 'prev_paid_amount'].includes(query.taxColumn)
      ? query.taxColumn
      : settings.taxColumn
  ) as TaxColumnOption;

  const solar = (
    typeof query.solar === 'string' &&
    ['all', 'has_solar', 'no_solar', 'unknown'].includes(query.solar)
      ? query.solar
      : 'all'
  ) as SolarSegment;

  const dwelling = (
    typeof query.dwelling === 'string' &&
    ['all', 'flat', 'house', 'unknown'].includes(query.dwelling)
      ? query.dwelling
      : 'all'
  ) as DwellingSegment;

  const partialYearMode = (
    typeof query.partialYearMode === 'string' &&
    ['exclude', 'annualise'].includes(query.partialYearMode)
      ? query.partialYearMode
      : settings.partialYearMode
  ) as PartialYearMode;

  const forecastSplit = (
    typeof query.forecastSplit === 'string' &&
    ['overall', 'solar', 'dwelling'].includes(query.forecastSplit)
      ? query.forecastSplit
      : 'overall'
  ) as ForecastSplit;

  const dedupe =
    query.dedupe === '1' || query.dedupe === 'true'
      ? true
      : query.dedupe === '0' || query.dedupe === 'false'
        ? false
        : settings.dedupeDefault;

  return {
    year: parseOptInt(query.year),
    district: parseOptInt(query.district),
    taluk: parseOptInt(query.taluk),
    village: parseOptInt(query.village),
    status: parseOptInt(query.status),
    pointer: parseOptInt(query.pointer),
    luxury: query.luxury === '1' || query.luxury === 'true',
    solar,
    dwelling,
    dedupe,
    includeDeleted: query.deleted === '1' || query.deleted === 'true',
    yearColumn,
    taxColumn,
    partialYearMode,
    forecastSplit,
  };
}

async function startServer() {
  // Warm up local embedded SQLite storage & deterministic seed once on boot
  getDb();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, storage: 'local-sqlite' });
  });

  app.get('/api/auth/status', async (_req, res) => {
    try {
      const hasAdmin = await hasLocalAdminAccount();
      const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE?.trim());
      res.json({
        needsSetup: !hasAdmin && !envPasscodeSet,
        localAuthEnabled: true,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to inspect auth status.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/auth/setup', async (req, res) => {
    try {
      if (process.env.ADMIN_PASSCODE?.trim()) {
        res.status(403).json({
          error: 'First-run setup is disabled when ADMIN_PASSCODE is configured.',
        });
        return;
      }
      const { email, displayName, password } = req.body ?? {};
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Please enter a valid administrator email address.' });
        return;
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
        return;
      }
      const user = await claimFirstLocalAdmin({
        email,
        displayName: typeof displayName === 'string' ? displayName.slice(0, 120) : '',
        password,
      });
      const token = signSessionToken({ uid: user.uid, email: user.email, role: user.role });
      res.status(201).json({ token, user });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to complete admin setup.';
      const status = msg.includes('already been configured') ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }
      const user = await authenticateLocalUser(email, password);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      const token = signSessionToken({ uid: user.uid, email: user.email, role: user.role });
      res.json({ token, user });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sign-in failed.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, displayName, password } = req.body ?? {};
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
        return;
      }
      const user = await registerLocalUser({
        email,
        displayName: typeof displayName === 'string' ? displayName.slice(0, 120) : '',
        password,
      });
      const token = signSessionToken({ uid: user.uid, email: user.email, role: user.role });
      res.status(201).json({ token, user });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Registration failed.';
      const status = msg.includes('already exists') ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  });

  app.get('/api/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.dbUser });
  });

  app.get(
    '/api/lookups',
    requireAuth,
    requireRole(['viewer', 'analyst', 'admin']),
    async (req: AuthRequest, res) => {
      try {
        const districtId = parseOptInt(req.query.district);
        const talukId = parseOptInt(req.query.taluk);
        const data = await getLookups(districtId, talukId);
        res.json(data);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load lookups.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.get(
    '/api/analytics',
    requireAuth,
    requireRole(['viewer', 'analyst', 'admin']),
    async (req: AuthRequest, res) => {
      try {
        const filters = await parseFilterParams(req.query as Record<string, unknown>);
        const data = await getAnalytics(filters);
        res.json(data);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load analytics.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.get(
    '/api/settings',
    requireAuth,
    requireRole(['viewer', 'analyst', 'admin']),
    async (_req: AuthRequest, res) => {
      try {
        const data = await getSettings();
        res.json(data);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load settings.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.put(
    '/api/settings',
    requireAuth,
    requireRole(['analyst', 'admin']),
    async (req: AuthRequest, res) => {
      try {
        const saved = await saveSettings(req.body ?? {});
        res.json(saved);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to save settings.';
        res.status(400).json({ error: msg });
      }
    },
  );

  app.get(
    '/api/applications',
    requireAuth,
    requireRole(['analyst', 'admin']),
    async (req: AuthRequest, res) => {
      try {
        const filters = await parseFilterParams(req.query as Record<string, unknown>);
        const page = Math.max(1, parseOptInt(req.query.page) ?? 1);
        const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : '';
        const data = await listApplications(filters, search, page, 25);
        res.json(data);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load applications.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.get(
    '/api/applications/:id',
    requireAuth,
    requireRole(['analyst', 'admin']),
    async (req: AuthRequest, res) => {
      try {
        const id = parseOptInt(req.params.id);
        if (!id || id <= 0) {
          res.status(400).json({ error: 'Invalid application ID.' });
          return;
        }
        const detail = await getApplicationDetail(id);
        if (!detail) {
          res.status(404).json({ error: 'Application not found.' });
          return;
        }
        res.json(detail);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load application detail.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.get(
    '/api/admin/users',
    requireAuth,
    requireRole(['admin']),
    async (_req: AuthRequest, res) => {
      try {
        const usersList = await listUsers();
        res.json({ users: usersList });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load users.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.patch(
    '/api/admin/users/:uid/role',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthRequest, res) => {
      try {
        const role = req.body?.role;
        if (!['viewer', 'analyst', 'admin'].includes(role)) {
          res.status(400).json({ error: 'Role must be viewer, analyst, or admin.' });
          return;
        }
        const updated = await updateUserRole(req.params.uid, role as UserRole);
        if (!updated) {
          res.status(404).json({ error: 'User not found.' });
          return;
        }
        res.json({ user: updated });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to update role.';
        res.status(500).json({ error: msg });
      }
    },
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`KBT server listening on http://0.0.0.0:${port} (local SQLite)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
