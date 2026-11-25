import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMysqlInsertTuples } from './sql-dump-parser.ts';
import { getDb, resetDbHandleForTests } from './index.ts';
import {
  getAnalytics,
  getApplicationDetail,
  getLookups,
  getSettings,
  listApplications,
  saveSettings,
} from './kbt-queries.ts';
import {
  authenticateLocalUser,
  claimFirstLocalAdmin,
  hasLocalAdminAccount,
  listUsers,
  registerLocalUser,
  updateUserRole,
} from './users.ts';
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../lib/local-auth.ts';
import { DEFAULT_SETTINGS } from '../lib/kbt-analytics.ts';
import type { AnalyticsFilterParams } from '../lib/kbt-types.ts';

function defaultFilters(): AnalyticsFilterParams {
  return {
    year: null,
    district: null,
    taluk: null,
    village: null,
    status: null,
    pointer: null,
    luxury: false,
    solar: 'all',
    dwelling: 'all',
    dedupe: true,
    includeDeleted: false,
    yearColumn: 'appln_form2_date',
    taxColumn: 'appln_tax_lump',
    partialYearMode: 'exclude',
    forecastSplit: 'overall',
  };
}

test('parseMysqlInsertTuples parses quoted strings, escaped quotes, NULLs, and numbers', () => {
  const sample = `
    INSERT INTO \`districts\` (\`id\`, \`page_id\`, \`district_state_sl\`, \`district_name\`) VALUES
    (1608, NULL, 16, 'ERNAKULAM'),
    (1614, 2, 16, 'THIRU\\'VANANTHAPURAM, KERALA');
  `;
  const rows = parseMysqlInsertTuples(sample, 'districts');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], [1608, null, 16, 'ERNAKULAM']);
  assert.deepEqual(rows[1], [1614, 2, 16, "THIRU'VANANTHAPURAM, KERALA"]);
});

test('scrypt password hashing and HMAC session tokens verify validly and reject tampering', () => {
  const hash = hashPassword('StrongPass!2026');
  assert.equal(verifyPassword('StrongPass!2026', hash), true);
  assert.equal(verifyPassword('WrongPass!2026', hash), false);

  const token = signSessionToken({ uid: 'local_1', email: 'admin@example.com', role: 'admin' });
  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.uid, 'local_1');
  assert.equal(verified.role, 'admin');

  const tampered = `${token.slice(0, -4)}AAAA`;
  assert.equal(verifySessionToken(tampered), null);
});

test('local SQLite seeds Kerala geography, computes analytics, filters, dedupe, and forecasts', async () => {
  process.env.KBT_SQLITE_PATH = ':memory:';
  resetDbHandleForTests();
  getDb(':memory:');

  const lookups = await getLookups();
  assert.equal(lookups.districts.length, 14, 'All 14 Kerala districts should be loaded');

  const ernakulam = lookups.districts.find((d) => d.id === 1608);
  assert.ok(ernakulam, 'Ernakulam district (1608) should exist');

  const ekmLookups = await getLookups(1608);
  assert.ok(ekmLookups.taluks.length > 0, 'Ernakulam should have cascading taluks');

  const analytics = await getAnalytics(defaultFilters());
  assert.ok(analytics.summary.rawMatchingRows > analytics.summary.distinctApplications);
  assert.equal(analytics.summary.countedRecords, analytics.summary.distinctApplications);
  assert.ok(analytics.summary.missingDateCount > 0);
  assert.ok(analytics.summary.totalTax > 0);
  assert.equal(analytics.forecast.overall.canForecast, true);
  assert.ok(analytics.forecast.overall.tax !== null);

  // Sum of yearWise counts + missingDateCount must equal countedRecords
  const datedSum = analytics.yearWise.reduce((s, r) => s + r.count, 0);
  assert.equal(datedSum + analytics.summary.missingDateCount, analytics.summary.countedRecords);

  // Combined district + solar + forecastSplit filter
  const filtered = await getAnalytics({
    ...defaultFilters(),
    district: 1608,
    solar: 'has_solar',
    forecastSplit: 'solar',
    partialYearMode: 'annualise',
  });
  assert.ok(filtered.summary.countedRecords > 0);
  assert.ok(filtered.summary.countedRecords < analytics.summary.countedRecords);
  assert.equal(filtered.summary.noSolarCount, 0);
  assert.equal(filtered.forecast.segments.length, 3);

  // Applications list & detail
  const apps = await listApplications(defaultFilters(), '', 1, 10);
  assert.equal(apps.rows.length, 10);
  assert.equal(apps.hasNext, true);
  const detail = await getApplicationDetail(apps.rows[0].applnId);
  assert.ok(detail);
  assert.equal(detail.applnId, apps.rows[0].applnId);

  // Settings persistence
  const saved = await saveSettings({
    ...DEFAULT_SETTINGS,
    luxuryThresholdSqm: 325,
    taxColumn: 'prev_paid_amount',
  });
  assert.equal(saved.luxuryThresholdSqm, 325);
  const reloaded = await getSettings();
  assert.equal(reloaded.luxuryThresholdSqm, 325);
  assert.equal(reloaded.taxColumn, 'prev_paid_amount');

  // Local admin first-run claim & locking
  assert.equal(await hasLocalAdminAccount(), false);
  const admin = await claimFirstLocalAdmin({
    email: 'admin@kbt.local',
    displayName: 'Revenue Admin',
    password: 'AdminPassword123!',
  });
  assert.equal(admin.role, 'admin');
  assert.equal(await hasLocalAdminAccount(), true);

  await assert.rejects(
    () =>
      claimFirstLocalAdmin({
        email: 'second@kbt.local',
        displayName: 'Second',
        password: 'AnotherPassword123!',
      }),
    /already been configured/,
  );

  const authed = await authenticateLocalUser('admin@kbt.local', 'AdminPassword123!');
  assert.ok(authed);
  assert.equal(authed.uid, admin.uid);
  assert.equal(await authenticateLocalUser('admin@kbt.local', 'WrongPassword'), null);

  const viewer = await registerLocalUser({
    email: 'viewer@kbt.local',
    displayName: 'Viewer Officer',
    password: 'ViewerPassword123!',
  });
  assert.equal(viewer.role, 'viewer');

  const promoted = await updateUserRole(viewer.uid, 'analyst');
  assert.equal(promoted?.role, 'analyst');
  const allUsers = await listUsers();
  assert.equal(allUsers.length, 2);

  resetDbHandleForTests();
  delete process.env.KBT_SQLITE_PATH;
});
