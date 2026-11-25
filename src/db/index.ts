import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_DWELLING_MAPPING,
  DEFAULT_SETTINGS,
  DEFAULT_SOLAR_MAPPING,
  DEFAULT_TAX_BANDS,
} from '../lib/kbt-analytics.ts';
import { loadGeographyFromDumps } from './sql-dump-parser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

declare global {
  var _kbtSqliteDb: DatabaseSync | undefined;
  var _kbtSqlitePath: string | undefined;
}

// Deterministic PRNG (Mulberry32) so seeded demo analytics are reproducible across restarts
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer',
      password_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY,
      district_name TEXT NOT NULL,
      district_state_sl INTEGER NOT NULL DEFAULT 16
    );

    CREATE TABLE IF NOT EXISTS taluks (
      id INTEGER PRIMARY KEY,
      taluk_district_id INTEGER NOT NULL,
      taluk_name TEXT NOT NULL,
      del INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS villages (
      id INTEGER PRIMARY KEY,
      vill_taluksl INTEGER NOT NULL,
      vill_name TEXT NOT NULL,
      del INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS kbt_form2_appln_verified (
      appln_id INTEGER PRIMARY KEY AUTOINCREMENT,
      appln_appln_id INTEGER NOT NULL DEFAULT 0,
      appln_no TEXT NOT NULL DEFAULT '',
      appln_year INTEGER NOT NULL DEFAULT 0,
      appln_form2_no TEXT NOT NULL DEFAULT '',
      appln_form2_date TEXT NOT NULL DEFAULT '0000-00-00',
      appln_form2_year INTEGER NOT NULL DEFAULT 0,
      appln_form2_submited_yesno INTEGER NOT NULL DEFAULT 1,
      appln_createdon TEXT NOT NULL DEFAULT '0000-00-00 00:00:00',
      appln_delete INTEGER NOT NULL DEFAULT 0,
      appln_status INTEGER NOT NULL DEFAULT 1,
      appln_pointer INTEGER NOT NULL DEFAULT 1,
      appln_solar INTEGER,
      appln_flat_yesno INTEGER,
      appln_landtype INTEGER NOT NULL DEFAULT 1,
      appln_nature INTEGER NOT NULL DEFAULT 1,
      appln_constr_nature INTEGER NOT NULL DEFAULT 1,
      appln_noof_floors INTEGER NOT NULL DEFAULT 1,
      appln_tax_lump INTEGER NOT NULL DEFAULT 0,
      prev_paid_amount REAL NOT NULL DEFAULT 0,
      prev_paid_date TEXT NOT NULL DEFAULT '0000-00-00',
      appln_tax_paid_old TEXT NOT NULL DEFAULT '',
      appln_tax_exempt_yesno INTEGER NOT NULL DEFAULT 0,
      appln_reduced_rate_yesno INTEGER NOT NULL DEFAULT 0,
      appln_pa_approved_res REAL NOT NULL DEFAULT 0,
      appln_pa_cnstrcted_res REAL NOT NULL DEFAULT 0,
      appln_pa_recommended_res REAL NOT NULL DEFAULT 0,
      appln_pa_approved_other REAL NOT NULL DEFAULT 0,
      appln_pa_cnstrcted_other REAL NOT NULL DEFAULT 0,
      appln_pa_recommended_other REAL NOT NULL DEFAULT 0,
      appln_pa_aprvd REAL NOT NULL DEFAULT 0,
      appln_pa_cnstrcted REAL NOT NULL DEFAULT 0,
      appln_dist INTEGER NOT NULL,
      appln_taluk INTEGER NOT NULL,
      appln_village INTEGER NOT NULL,
      appln_name TEXT NOT NULL DEFAULT '',
      appln_survey_no TEXT NOT NULL DEFAULT '',
      appln_block_no TEXT NOT NULL DEFAULT '',
      appln_sub_dvsn TEXT NOT NULL DEFAULT '',
      appln_thandapperu_no TEXT NOT NULL DEFAULT '',
      appln_lsgtype INTEGER NOT NULL DEFAULT 1,
      appln_building_permit_no TEXT NOT NULL DEFAULT '',
      appln_assess_order_status TEXT NOT NULL DEFAULT '',
      appln_demand_notice_status TEXT NOT NULL DEFAULT '',
      appln_appeal_status TEXT NOT NULL DEFAULT '',
      appln_compltn_dt TEXT NOT NULL DEFAULT '0000-00-00',
      appln_occupation_dt TEXT NOT NULL DEFAULT '0000-00-00',
      appln_remarks TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS kbt_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      year_column TEXT NOT NULL DEFAULT 'appln_form2_date',
      tax_column TEXT NOT NULL DEFAULT 'appln_tax_lump',
      dedupe_default INTEGER NOT NULL DEFAULT 1,
      partial_year_mode TEXT NOT NULL DEFAULT 'exclude',
      luxury_threshold_sqm REAL NOT NULL DEFAULT 300,
      bands_json TEXT NOT NULL,
      solar_mapping_json TEXT NOT NULL,
      dwelling_mapping_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_kbt_del_dist_status
      ON kbt_form2_appln_verified (appln_delete, appln_dist, appln_status);
    CREATE INDEX IF NOT EXISTS idx_kbt_solar_flat
      ON kbt_form2_appln_verified (appln_solar, appln_flat_yesno);
    CREATE INDEX IF NOT EXISTS idx_kbt_appln_id_pk
      ON kbt_form2_appln_verified (appln_appln_id, appln_id);
    CREATE INDEX IF NOT EXISTS idx_kbt_form2_date
      ON kbt_form2_appln_verified (appln_form2_date);
    CREATE INDEX IF NOT EXISTS idx_taluks_dist
      ON taluks (taluk_district_id, del);
    CREATE INDEX IF NOT EXISTS idx_villages_taluk
      ON villages (vill_taluksl, del);
  `);
}

function seedSettingsIfEmpty(db: DatabaseSync) {
  const row = db.prepare('SELECT id FROM kbt_settings WHERE id = 1').get();
  if (row) return;
  db.prepare(
    `INSERT INTO kbt_settings (
      id, year_column, tax_column, dedupe_default, partial_year_mode,
      luxury_threshold_sqm, bands_json, solar_mapping_json, dwelling_mapping_json
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    DEFAULT_SETTINGS.yearColumn,
    DEFAULT_SETTINGS.taxColumn,
    DEFAULT_SETTINGS.dedupeDefault ? 1 : 0,
    DEFAULT_SETTINGS.partialYearMode,
    DEFAULT_SETTINGS.luxuryThresholdSqm,
    JSON.stringify(DEFAULT_TAX_BANDS),
    JSON.stringify(DEFAULT_SOLAR_MAPPING),
    JSON.stringify(DEFAULT_DWELLING_MAPPING),
  );
}

const FALLBACK_DISTRICTS = [
  { id: 1601, districtName: 'KASARAGOD', districtStateSl: 16 },
  { id: 1602, districtName: 'KANNUR', districtStateSl: 16 },
  { id: 1603, districtName: 'WAYANAD', districtStateSl: 16 },
  { id: 1604, districtName: 'KOZHIKODE', districtStateSl: 16 },
  { id: 1605, districtName: 'MALAPPURAM', districtStateSl: 16 },
  { id: 1606, districtName: 'PALAKKAD', districtStateSl: 16 },
  { id: 1607, districtName: 'THRISSUR', districtStateSl: 16 },
  { id: 1608, districtName: 'ERNAKULAM', districtStateSl: 16 },
  { id: 1609, districtName: 'IDUKKI', districtStateSl: 16 },
  { id: 1610, districtName: 'KOTTAYAM', districtStateSl: 16 },
  { id: 1611, districtName: 'ALAPPUZHA', districtStateSl: 16 },
  { id: 1612, districtName: 'PATHANAMTHITTA', districtStateSl: 16 },
  { id: 1613, districtName: 'KOLLAM', districtStateSl: 16 },
  { id: 1614, districtName: 'THIRUVANANTHAPURAM', districtStateSl: 16 },
];

function seedGeographyIfEmpty(db: DatabaseSync) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM districts').get() as { n: number };
  if (existing.n > 0) return;

  const assetsDir = path.join(PROJECT_ROOT, 'public', 'assets', 'aistudio');
  const parsed = loadGeographyFromDumps({
    districtsPath: path.join(assetsDir, 'districts_5__ee20757f.txt'),
    taluksPath: path.join(assetsDir, 'taluks_2__d82ec7a7.txt'),
    villagesPath: path.join(assetsDir, 'villages_2__d4565e93.txt'),
  });

  const districtsToInsert = parsed.districts.length > 0 ? parsed.districts : FALLBACK_DISTRICTS;
  const taluksToInsert =
    parsed.taluks.length > 0
      ? parsed.taluks
      : districtsToInsert.map((d, i) => ({
          id: i + 1,
          talukDistrictId: d.id,
          talukName: `${d.districtName} Taluk`,
          del: 0,
        }));
  const villagesToInsert =
    parsed.villages.length > 0
      ? parsed.villages
      : taluksToInsert.map((t, i) => ({
          id: i + 1,
          villTaluksl: t.id,
          villName: `${t.talukName} Central`,
          del: 0,
        }));

  db.exec('BEGIN');
  try {
    const insDist = db.prepare(
      'INSERT OR IGNORE INTO districts (id, district_name, district_state_sl) VALUES (?, ?, ?)',
    );
    for (const d of districtsToInsert) {
      insDist.run(d.id, d.districtName, d.districtStateSl);
    }

    const insTaluk = db.prepare(
      'INSERT OR IGNORE INTO taluks (id, taluk_district_id, taluk_name, del) VALUES (?, ?, ?, ?)',
    );
    for (const t of taluksToInsert) {
      insTaluk.run(t.id, t.talukDistrictId, t.talukName, t.del);
    }

    const insVillage = db.prepare(
      'INSERT OR IGNORE INTO villages (id, vill_taluksl, vill_name, del) VALUES (?, ?, ?, ?)',
    );
    for (const v of villagesToInsert) {
      insVillage.run(v.id, v.villTaluksl, v.villName, v.del);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function seedDemoApplicationsIfEmpty(db: DatabaseSync, totalRows = 4500) {
  const existing = db
    .prepare('SELECT COUNT(*) AS n FROM kbt_form2_appln_verified')
    .get() as { n: number };
  if (existing.n > 0) return;

  const places = db
    .prepare(
      `SELECT v.id AS village_id, t.id AS taluk_id, d.id AS dist_id
       FROM villages v
       JOIN taluks t ON t.id = v.vill_taluksl
       JOIN districts d ON d.id = t.taluk_district_id
       WHERE d.district_state_sl = 16 AND t.del = 0 AND v.del = 0
       ORDER BY d.id, t.id, v.id`,
    )
    .all() as Array<{ village_id: number; taluk_id: number; dist_id: number }>;

  if (places.length === 0) return;

  // Group places by district so major districts get realistic weighted traffic
  const byDist = new Map<number, Array<{ village_id: number; taluk_id: number; dist_id: number }>>();
  for (const p of places) {
    const arr = byDist.get(p.dist_id) ?? [];
    arr.push(p);
    byDist.set(p.dist_id, arr);
  }
  const distIds = [...byDist.keys()].sort((a, b) => a - b);
  const distWeights: Record<number, number> = {
    1608: 1.9, // Ernakulam
    1614: 1.7, // Thiruvananthapuram
    1607: 1.5, // Thrissur
    1604: 1.4, // Kozhikode
    1605: 1.35, // Malappuram
    1613: 1.2, // Kollam
    1610: 1.1, // Kottayam
    1606: 1.05, // Palakkad
    1602: 1.0, // Kannur
    1611: 0.95, // Alappuzha
    1612: 0.75, // Pathanamthitta
    1601: 0.7, // Kasaragod
    1609: 0.65, // Idukki
    1603: 0.55, // Wayanad
  };
  const weightedDists: Array<{ id: number; cumWeight: number }> = [];
  let accW = 0;
  for (const id of distIds) {
    accW += distWeights[id] ?? 1.0;
    weightedDists.push({ id, cumWeight: accW });
  }

  const rng = createRng(20261125);
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 8; // 9-year window: e.g. 2018..2026
  const years: number[] = [];
  for (let y = startYear; y <= currentYear; y++) years.push(y);

  // Build weighted year buckets with healthy upward volume & tax trend, plus partial current year
  const yearWeights = years.map((y, idx) => {
    const growth = 1 + idx * 0.14;
    if (y === currentYear) return growth * 0.72; // partial year
    return growth;
  });
  const totalYearWeight = yearWeights.reduce((s, w) => s + w, 0);

  const pickYear = (): number => {
    let r = rng() * totalYearWeight;
    for (let i = 0; i < years.length; i++) {
      r -= yearWeights[i];
      if (r <= 0) return years[i];
    }
    return years[years.length - 1];
  };

  const pickPlace = () => {
    const r = rng() * accW;
    let chosenDist = distIds[0];
    for (const d of weightedDists) {
      if (r <= d.cumWeight) {
        chosenDist = d.id;
        break;
      }
    }
    const pool = byDist.get(chosenDist)!;
    return pool[Math.floor(rng() * pool.length)];
  };

  const insStmt = db.prepare(`
    INSERT INTO kbt_form2_appln_verified (
      appln_appln_id, appln_no, appln_year, appln_form2_no, appln_form2_date,
      appln_form2_year, appln_form2_submited_yesno, appln_createdon, appln_delete,
      appln_status, appln_pointer, appln_solar, appln_flat_yesno, appln_landtype,
      appln_nature, appln_constr_nature, appln_noof_floors, appln_tax_lump,
      prev_paid_amount, prev_paid_date, appln_tax_paid_old, appln_tax_exempt_yesno,
      appln_reduced_rate_yesno, appln_pa_approved_res, appln_pa_cnstrcted_res,
      appln_pa_recommended_res, appln_pa_approved_other, appln_pa_cnstrcted_other,
      appln_pa_recommended_other, appln_pa_aprvd, appln_pa_cnstrcted,
      appln_dist, appln_taluk, appln_village, appln_name, appln_survey_no,
      appln_block_no, appln_sub_dvsn, appln_thandapperu_no, appln_lsgtype,
      appln_building_permit_no, appln_assess_order_status, appln_demand_notice_status,
      appln_appeal_status, appln_compltn_dt, appln_occupation_dt, appln_remarks
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  db.exec('BEGIN');
  try {
    let nextRefId = 100001;
    const recentRefIds: number[] = [];

    for (let i = 1; i <= totalRows; i++) {
      const place = pickPlace();
      const year = pickYear();
      const yearIndex = year - startYear;

      // ~7% duplicate revision rows sharing an existing appln_appln_id to test DEDUPE
      let applnApplnId: number;
      if (recentRefIds.length > 20 && rng() < 0.07) {
        applnApplnId = recentRefIds[Math.floor(rng() * recentRefIds.length)];
      } else if (rng() < 0.015) {
        // ~1.5% unlinked rows (appln_appln_id = 0) preserved under dedupe
        applnApplnId = 0;
      } else {
        applnApplnId = nextRefId++;
        if (recentRefIds.length < 400) {
          recentRefIds.push(applnApplnId);
        } else {
          recentRefIds[Math.floor(rng() * recentRefIds.length)] = applnApplnId;
        }
      }

      // ~2.5% missing/zero Form 2 dates
      const isMissingDate = rng() < 0.025;
      const maxMonth = year === currentYear ? Math.max(1, new Date().getMonth() + 1) : 12;
      const month = 1 + Math.floor(rng() * maxMonth);
      const day = 1 + Math.floor(rng() * 28);
      const form2Date = isMissingDate ? '0000-00-00' : `${year}-${pad2(month)}-${pad2(day)}`;
      const compltnYear = Math.max(2012, year - 1);
      const compltnDt = `${compltnYear}-${pad2(1 + Math.floor(rng() * 12))}-${pad2(1 + Math.floor(rng() * 28))}`;
      const occDt = isMissingDate ? '0000-00-00' : form2Date;

      // Dwelling: ~28% flat (1), ~66% house (0), ~6% unknown (null)
      const dwellRoll = rng();
      const flatYesno = dwellRoll < 0.28 ? 1 : dwellRoll < 0.94 ? 0 : null;

      // Solar adoption grows smoothly over years (12% early -> 36% recent), plus ~8% unknown (null)
      const solarRoll = rng();
      const solarRate = 0.12 + yearIndex * 0.03;
      const solar =
        solarRoll < 0.08 ? null : solarRoll < 0.08 + solarRate * 0.92 ? 1 : 0;

      // Plinth area: realistic distribution with ~16% luxury (>300 sq m)
      const isLuxury = rng() < 0.16;
      const baseRes = isLuxury
        ? 290 + rng() * 260
        : flatYesno === 1
          ? 75 + rng() * 145
          : 95 + rng() * 185;
      const resApproved = Math.round(baseRes * 100) / 100;
      const resConstructed = Math.round(baseRes * (0.96 + rng() * 0.12) * 100) / 100;
      const hasOther = rng() < 0.26;
      const otherArea = hasOther ? Math.round((15 + rng() * 95) * 100) / 100 : 0;
      const totalArea = resConstructed + otherArea;

      // Tax amount: ~12% nil/exempt, rest scaled by area + modest annual inflation
      const isExempt = rng() < 0.12;
      const inflation = 1 + yearIndex * 0.055;
      let taxLump = 0;
      if (!isExempt) {
        const ratePerSqm =
          totalArea > 300
            ? 145 + rng() * 85
            : totalArea > 200
              ? 85 + rng() * 55
              : 40 + rng() * 45;
        taxLump = Math.round((totalArea * ratePerSqm * inflation) / 500) * 500;
        if (taxLump < 1500) taxLump = 1500;
      }

      const hasPrevPaid = !isExempt && rng() < 0.42;
      const prevPaidAmount = hasPrevPaid
        ? Math.round((taxLump * (0.25 + rng() * 0.55)) / 100) * 100
        : 0;
      const prevPaidDate = hasPrevPaid ? compltnDt : '0000-00-00';

      // Status (1: Submitted, 2: Verified, 3: Assessed, 4: Closed)
      const stRoll = rng();
      const status = stRoll < 0.1 ? 1 : stRoll < 0.34 ? 2 : stRoll < 0.78 ? 3 : 4;

      // Pointer (1..5)
      const ptrRoll = rng();
      const pointer =
        ptrRoll < 0.22 ? 1 : ptrRoll < 0.45 ? 2 : ptrRoll < 0.68 ? 3 : ptrRoll < 0.86 ? 4 : 5;

      const isDeleted = rng() < 0.03 ? 1 : 0;
      const floors = flatYesno === 1 ? 1 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 2);

      insStmt.run(
        applnApplnId,
        String(1000 + (i % 9000)),
        year,
        `F2/${year}/${String(i).padStart(5, '0')}`,
        form2Date,
        isMissingDate ? 0 : year,
        1,
        `${isMissingDate ? `${year}-01-15` : form2Date} 10:30:00`,
        isDeleted,
        status,
        pointer,
        solar,
        flatYesno,
        1 + Math.floor(rng() * 3),
        flatYesno === 1 ? 2 : 1,
        1,
        floors,
        taxLump,
        prevPaidAmount,
        prevPaidDate,
        '',
        isExempt ? 1 : 0,
        rng() < 0.08 ? 1 : 0,
        resApproved,
        resConstructed,
        resApproved,
        otherArea,
        otherArea,
        otherArea,
        Math.round((resApproved + otherArea) * 100) / 100,
        Math.round(totalArea * 100) / 100,
        place.dist_id,
        place.taluk_id,
        place.village_id,
        `Demo Applicant ${String(i).padStart(5, '0')}`,
        `${10 + Math.floor(rng() * 880)}/${1 + Math.floor(rng() * 18)}`,
        String(1 + Math.floor(rng() * 48)),
        `${1 + Math.floor(rng() * 9)}`,
        `TH-${String(10000 + (i % 89999))}`,
        1 + Math.floor(rng() * 3),
        `BP/${year}/${String(i).padStart(4, '0')}`,
        status >= 3 ? 'Issued' : 'Pending',
        pointer >= 4 ? 'Issued' : 'Pending',
        'None',
        compltnDt,
        occDt,
        'Synthetic demo dataset (no real citizen PII)',
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getDb(overridePath?: string): DatabaseSync {
  const targetPath =
    overridePath ||
    process.env.KBT_SQLITE_PATH ||
    path.join(PROJECT_ROOT, 'data', 'kbt.sqlite');

  if (global._kbtSqliteDb && global._kbtSqlitePath === targetPath) {
    return global._kbtSqliteDb;
  }

  if (global._kbtSqliteDb) {
    try {
      global._kbtSqliteDb.close();
    } catch {
      // ignore close errors
    }
  }

  if (targetPath !== ':memory:') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  const db = new DatabaseSync(targetPath);
  createSchema(db);
  seedSettingsIfEmpty(db);
  seedGeographyIfEmpty(db);
  seedDemoApplicationsIfEmpty(db);

  global._kbtSqliteDb = db;
  global._kbtSqlitePath = targetPath;
  return db;
}

export function resetDbHandleForTests() {
  if (global._kbtSqliteDb) {
    try {
      global._kbtSqliteDb.close();
    } catch {
      // ignore
    }
  }
  global._kbtSqliteDb = undefined;
  global._kbtSqlitePath = undefined;
}
