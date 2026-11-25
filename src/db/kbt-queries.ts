import { getDb } from './index.ts';
import {
  DEFAULT_DWELLING_MAPPING,
  DEFAULT_SETTINGS,
  DEFAULT_SOLAR_MAPPING,
  DEFAULT_TAX_BANDS,
  getPointerLabel,
  getStatusLabel,
  validateBands,
} from '../lib/kbt-analytics.ts';
import { computeSegmentForecast } from '../lib/forecast.ts';
import type {
  AnalyticsFilterParams,
  AnalyticsResponse,
  ApplicationListItem,
  CrossTabRow,
  DwellingMappingConfig,
  KbtSettingsDTO,
  PartialYearMode,
  SolarMappingConfig,
  TaxBandConfig,
  TaxBandRow,
  TaxColumnOption,
  YearColumnOption,
  YearWiseRow,
} from '../lib/kbt-types.ts';

type SqlParam = string | number | null;

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sanitizeIntList(values: number[] | undefined, fallback: number[]): number[] {
  if (!Array.isArray(values)) return fallback;
  const cleaned = values.filter((v) => typeof v === 'number' && Number.isInteger(v));
  return cleaned.length > 0 ? cleaned : fallback;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function getSettings(): Promise<KbtSettingsDTO> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT year_column, tax_column, dedupe_default, partial_year_mode,
              luxury_threshold_sqm, bands_json, solar_mapping_json, dwelling_mapping_json
       FROM kbt_settings WHERE id = 1 LIMIT 1`,
    )
    .get() as
    | {
        year_column: string;
        tax_column: string;
        dedupe_default: number;
        partial_year_mode: string;
        luxury_threshold_sqm: number;
        bands_json: string;
        solar_mapping_json: string;
        dwelling_mapping_json: string;
      }
    | undefined;

  if (!row) return DEFAULT_SETTINGS;

  return {
    yearColumn: (['appln_form2_date', 'appln_year', 'appln_form2_year'].includes(row.year_column)
      ? row.year_column
      : 'appln_form2_date') as YearColumnOption,
    taxColumn: (['appln_tax_lump', 'prev_paid_amount'].includes(row.tax_column)
      ? row.tax_column
      : 'appln_tax_lump') as TaxColumnOption,
    dedupeDefault: Number(row.dedupe_default) !== 0,
    partialYearMode: (row.partial_year_mode === 'annualise'
      ? 'annualise'
      : 'exclude') as PartialYearMode,
    luxuryThresholdSqm: Number(row.luxury_threshold_sqm) || 300,
    bands: safeJsonParse<TaxBandConfig[]>(row.bands_json, DEFAULT_TAX_BANDS),
    solarMapping: safeJsonParse<SolarMappingConfig>(row.solar_mapping_json, DEFAULT_SOLAR_MAPPING),
    dwellingMapping: safeJsonParse<DwellingMappingConfig>(
      row.dwelling_mapping_json,
      DEFAULT_DWELLING_MAPPING,
    ),
  };
}

export async function saveSettings(input: Partial<KbtSettingsDTO>): Promise<KbtSettingsDTO> {
  const db = getDb();
  const current = await getSettings();

  const yearColumn: YearColumnOption =
    input.yearColumn &&
    ['appln_form2_date', 'appln_year', 'appln_form2_year'].includes(input.yearColumn)
      ? input.yearColumn
      : current.yearColumn;
  const taxColumn: TaxColumnOption =
    input.taxColumn && ['appln_tax_lump', 'prev_paid_amount'].includes(input.taxColumn)
      ? input.taxColumn
      : current.taxColumn;
  const partialYearMode: PartialYearMode =
    input.partialYearMode === 'annualise' || input.partialYearMode === 'exclude'
      ? input.partialYearMode
      : current.partialYearMode;
  const dedupeDefault =
    typeof input.dedupeDefault === 'boolean' ? input.dedupeDefault : current.dedupeDefault;
  const luxuryThresholdSqm =
    typeof input.luxuryThresholdSqm === 'number' &&
    Number.isFinite(input.luxuryThresholdSqm) &&
    input.luxuryThresholdSqm > 0
      ? input.luxuryThresholdSqm
      : current.luxuryThresholdSqm;
  const bands = input.bands ? validateBands(input.bands) : current.bands;
  const solarMapping: SolarMappingConfig = input.solarMapping
    ? {
        hasSolar: sanitizeIntList(input.solarMapping.hasSolar, DEFAULT_SOLAR_MAPPING.hasSolar),
        noSolar: sanitizeIntList(input.solarMapping.noSolar, DEFAULT_SOLAR_MAPPING.noSolar),
      }
    : current.solarMapping;
  const dwellingMapping: DwellingMappingConfig = input.dwellingMapping
    ? {
        flat: sanitizeIntList(input.dwellingMapping.flat, DEFAULT_DWELLING_MAPPING.flat),
        house: sanitizeIntList(input.dwellingMapping.house, DEFAULT_DWELLING_MAPPING.house),
      }
    : current.dwellingMapping;

  db.prepare(
    `INSERT INTO kbt_settings (
       id, year_column, tax_column, dedupe_default, partial_year_mode,
       luxury_threshold_sqm, bands_json, solar_mapping_json, dwelling_mapping_json, updated_at
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       year_column = excluded.year_column,
       tax_column = excluded.tax_column,
       dedupe_default = excluded.dedupe_default,
       partial_year_mode = excluded.partial_year_mode,
       luxury_threshold_sqm = excluded.luxury_threshold_sqm,
       bands_json = excluded.bands_json,
       solar_mapping_json = excluded.solar_mapping_json,
       dwelling_mapping_json = excluded.dwelling_mapping_json,
       updated_at = datetime('now')`,
  ).run(
    yearColumn,
    taxColumn,
    dedupeDefault ? 1 : 0,
    partialYearMode,
    luxuryThresholdSqm,
    JSON.stringify(bands),
    JSON.stringify(solarMapping),
    JSON.stringify(dwellingMapping),
  );

  return {
    yearColumn,
    taxColumn,
    dedupeDefault,
    partialYearMode,
    luxuryThresholdSqm,
    bands,
    solarMapping,
    dwellingMapping,
  };
}

export async function getLookups(districtId?: number | null, talukId?: number | null) {
  const db = getDb();

  const districtRows = db
    .prepare(
      'SELECT id, district_name AS name FROM districts WHERE district_state_sl = 16 ORDER BY district_name ASC',
    )
    .all() as Array<{ id: number; name: string }>;

  const talukRows =
    districtId !== null && districtId !== undefined
      ? (db
          .prepare(
            'SELECT id, taluk_name AS name FROM taluks WHERE taluk_district_id = ? AND del = 0 ORDER BY taluk_name ASC',
          )
          .all(districtId) as Array<{ id: number; name: string }>)
      : [];

  const villageRows =
    talukId !== null && talukId !== undefined
      ? (db
          .prepare(
            'SELECT id, vill_name AS name FROM villages WHERE vill_taluksl = ? AND del = 0 ORDER BY vill_name ASC',
          )
          .all(talukId) as Array<{ id: number; name: string }>)
      : [];

  const statusRows = db
    .prepare(
      'SELECT appln_status AS code FROM kbt_form2_appln_verified GROUP BY appln_status ORDER BY appln_status ASC',
    )
    .all() as Array<{ code: number }>;

  const pointerRows = db
    .prepare(
      'SELECT appln_pointer AS code FROM kbt_form2_appln_verified GROUP BY appln_pointer ORDER BY appln_pointer ASC',
    )
    .all() as Array<{ code: number }>;

  const solarValues = db
    .prepare(
      'SELECT appln_solar AS value, COUNT(*) AS count FROM kbt_form2_appln_verified GROUP BY appln_solar ORDER BY count DESC',
    )
    .all() as Array<{ value: number | null; count: number }>;

  const flatValues = db
    .prepare(
      'SELECT appln_flat_yesno AS value, COUNT(*) AS count FROM kbt_form2_appln_verified GROUP BY appln_flat_yesno ORDER BY count DESC',
    )
    .all() as Array<{ value: number | null; count: number }>;

  return {
    districts: districtRows.map((d) => ({ id: Number(d.id), name: String(d.name) })),
    taluks: talukRows.map((t) => ({ id: Number(t.id), name: String(t.name) })),
    villages: villageRows.map((v) => ({ id: Number(v.id), name: String(v.name) })),
    statuses: statusRows.map((s) => ({
      code: Number(s.code),
      label: getStatusLabel(Number(s.code)),
    })),
    pointers: pointerRows.map((p) => ({
      code: Number(p.code),
      label: getPointerLabel(Number(p.code)),
    })),
    distinctValues: {
      appln_solar: solarValues.map((r) => ({
        value: r.value === null ? null : Number(r.value),
        count: Number(r.count),
      })),
      appln_flat_yesno: flatValues.map((r) => ({
        value: r.value === null ? null : Number(r.value),
        count: Number(r.count),
      })),
    },
  };
}

function yearExprSql(yearColumn: YearColumnOption): string {
  if (yearColumn === 'appln_year') {
    return 'CASE WHEN v.appln_year BETWEEN 1900 AND 2100 THEN v.appln_year ELSE NULL END';
  }
  if (yearColumn === 'appln_form2_year') {
    return 'CASE WHEN v.appln_form2_year BETWEEN 1900 AND 2100 THEN v.appln_form2_year ELSE NULL END';
  }
  return `CASE
    WHEN v.appln_form2_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'
     AND substr(v.appln_form2_date, 1, 4) <> '0000'
     AND CAST(substr(v.appln_form2_date, 1, 4) AS INTEGER) BETWEEN 1900 AND 2100
    THEN CAST(substr(v.appln_form2_date, 1, 4) AS INTEGER)
    ELSE NULL
  END`;
}

function taxExprSql(taxColumn: TaxColumnOption): string {
  if (taxColumn === 'prev_paid_amount') {
    return 'CAST(COALESCE(v.prev_paid_amount, 0) AS REAL)';
  }
  return 'CAST(COALESCE(v.appln_tax_lump, 0) AS REAL)';
}

function areaExprSql(): string {
  return '(CAST(COALESCE(v.appln_pa_cnstrcted_res, 0) AS REAL) + CAST(COALESCE(v.appln_pa_cnstrcted_other, 0) AS REAL))';
}

function solarBucketExpr(mapping: SolarMappingConfig): { sql: string; params: SqlParam[] } {
  const hasCodes = sanitizeIntList(mapping.hasSolar, [1]);
  const noCodes = sanitizeIntList(mapping.noSolar, [0]);
  return {
    sql: `CASE
      WHEN v.appln_solar IN (${placeholders(hasCodes.length)}) THEN 'has_solar'
      WHEN v.appln_solar IN (${placeholders(noCodes.length)}) THEN 'no_solar'
      ELSE 'unknown'
    END`,
    params: [...hasCodes, ...noCodes],
  };
}

function dwellingBucketExpr(mapping: DwellingMappingConfig): { sql: string; params: SqlParam[] } {
  const flatCodes = sanitizeIntList(mapping.flat, [1]);
  const houseCodes = sanitizeIntList(mapping.house, [0]);
  return {
    sql: `CASE
      WHEN v.appln_flat_yesno IN (${placeholders(flatCodes.length)}) THEN 'flat'
      WHEN v.appln_flat_yesno IN (${placeholders(houseCodes.length)}) THEN 'house'
      ELSE 'unknown'
    END`,
    params: [...flatCodes, ...houseCodes],
  };
}

function buildWhereClause(
  params: AnalyticsFilterParams,
  settings: KbtSettingsDTO,
  opts: { includeYear?: boolean; includeDedupe?: boolean; search?: string } = {},
): { whereSql: string; whereParams: SqlParam[] } {
  const clauses: string[] = [];
  const bind: SqlParam[] = [];
  const includeYear = opts.includeYear ?? true;
  const includeDedupe = opts.includeDedupe ?? params.dedupe;

  if (!params.includeDeleted) {
    clauses.push('v.appln_delete = 0');
  }
  if (params.district !== null) {
    clauses.push('v.appln_dist = ?');
    bind.push(params.district);
  }
  if (params.taluk !== null) {
    clauses.push('v.appln_taluk = ?');
    bind.push(params.taluk);
  }
  if (params.village !== null) {
    clauses.push('v.appln_village = ?');
    bind.push(params.village);
  }
  if (params.status !== null) {
    clauses.push('v.appln_status = ?');
    bind.push(params.status);
  }
  if (params.pointer !== null) {
    clauses.push('v.appln_pointer = ?');
    bind.push(params.pointer);
  }
  if (params.luxury) {
    clauses.push(`${areaExprSql()} > ?`);
    bind.push(settings.luxuryThresholdSqm);
  }

  const hasCodes = sanitizeIntList(settings.solarMapping.hasSolar, [1]);
  const noCodes = sanitizeIntList(settings.solarMapping.noSolar, [0]);
  if (params.solar === 'has_solar') {
    clauses.push(`v.appln_solar IN (${placeholders(hasCodes.length)})`);
    bind.push(...hasCodes);
  } else if (params.solar === 'no_solar') {
    clauses.push(`v.appln_solar IN (${placeholders(noCodes.length)})`);
    bind.push(...noCodes);
  } else if (params.solar === 'unknown') {
    const known = [...hasCodes, ...noCodes];
    clauses.push(`(v.appln_solar IS NULL OR v.appln_solar NOT IN (${placeholders(known.length)}))`);
    bind.push(...known);
  }

  const flatCodes = sanitizeIntList(settings.dwellingMapping.flat, [1]);
  const houseCodes = sanitizeIntList(settings.dwellingMapping.house, [0]);
  if (params.dwelling === 'flat') {
    clauses.push(`v.appln_flat_yesno IN (${placeholders(flatCodes.length)})`);
    bind.push(...flatCodes);
  } else if (params.dwelling === 'house') {
    clauses.push(`v.appln_flat_yesno IN (${placeholders(houseCodes.length)})`);
    bind.push(...houseCodes);
  } else if (params.dwelling === 'unknown') {
    const known = [...flatCodes, ...houseCodes];
    clauses.push(
      `(v.appln_flat_yesno IS NULL OR v.appln_flat_yesno NOT IN (${placeholders(known.length)}))`,
    );
    bind.push(...known);
  }

  if (includeYear && params.year !== null) {
    const yExpr = yearExprSql(params.yearColumn);
    if (params.year === -1) {
      clauses.push(`(${yExpr}) IS NULL`);
    } else {
      clauses.push(`(${yExpr}) = ?`);
      bind.push(params.year);
    }
  }

  if (includeDedupe) {
    const dedupeActiveFilter = params.includeDeleted ? '' : ' AND d2.appln_delete = 0';
    clauses.push(
      `(v.appln_appln_id <= 0 OR v.appln_id IN (
         SELECT MAX(d2.appln_id) FROM kbt_form2_appln_verified d2
         WHERE d2.appln_appln_id > 0${dedupeActiveFilter}
         GROUP BY d2.appln_appln_id
       ))`,
    );
  }

  if (opts.search && opts.search.trim().length >= 2) {
    const term = `%${opts.search.trim()}%`;
    clauses.push(
      `(LOWER(v.appln_no) LIKE LOWER(?) OR LOWER(v.appln_form2_no) LIKE LOWER(?) OR LOWER(v.appln_name) LIKE LOWER(?) OR LOWER(v.appln_survey_no) LIKE LOWER(?))`,
    );
    bind.push(term, term, term, term);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    whereParams: bind,
  };
}

export async function getAnalytics(params: AnalyticsFilterParams): Promise<AnalyticsResponse> {
  const db = getDb();
  const settings = await getSettings();

  const yearExpr = yearExprSql(params.yearColumn);
  const taxExpr = taxExprSql(params.taxColumn);
  const areaExpr = areaExprSql();
  const solarExpr = solarBucketExpr(settings.solarMapping);
  const dwellingExpr = dwellingBucketExpr(settings.dwellingMapping);

  const filtered = buildWhereClause(params, settings, {
    includeYear: true,
    includeDedupe: params.dedupe,
  });
  const nonDedupe = buildWhereClause(params, settings, {
    includeYear: true,
    includeDedupe: false,
  });
  const forecastFilter = buildWhereClause(params, settings, {
    includeYear: false,
    includeDedupe: params.dedupe,
  });

  const rowVsDistinct = db
    .prepare(
      `SELECT COUNT(*) AS rawRows,
              COUNT(DISTINCT CASE WHEN v.appln_appln_id > 0 THEN 'A:' || CAST(v.appln_appln_id AS TEXT) ELSE 'R:' || CAST(v.appln_id AS TEXT) END) AS distinctApps
       FROM kbt_form2_appln_verified v
       ${nonDedupe.whereSql}`,
    )
    .get(...nonDedupe.whereParams) as { rawRows: number; distinctApps: number } | undefined;

  const cubeGroups = db
    .prepare(
      `SELECT (${yearExpr}) AS yr,
              (${solarExpr.sql}) AS solar,
              (${dwellingExpr.sql}) AS dwelling,
              (CASE WHEN v.appln_delete <> 0 THEN 1 ELSE 0 END) AS isDeleted,
              (CASE WHEN ${areaExpr} > ? THEN 1 ELSE 0 END) AS isLuxury,
              COUNT(*) AS n,
              COALESCE(SUM(${taxExpr}), 0) AS totalTax
       FROM kbt_form2_appln_verified v
       ${filtered.whereSql}
       GROUP BY 1, 2, 3, 4, 5`,
    )
    .all(
      ...solarExpr.params,
      ...dwellingExpr.params,
      settings.luxuryThresholdSqm,
      ...filtered.whereParams,
    ) as Array<{
    yr: number | null;
    solar: string;
    dwelling: string;
    isDeleted: number;
    isLuxury: number;
    n: number;
    totalTax: number;
  }>;

  const districtRows = db
    .prepare(
      `SELECT v.appln_dist AS distId,
              COUNT(*) AS n,
              SUM(CASE WHEN ${areaExpr} > ? THEN 1 ELSE 0 END) AS luxuryN,
              COALESCE(SUM(${taxExpr}), 0) AS totalTax
       FROM kbt_form2_appln_verified v
       ${filtered.whereSql}
       GROUP BY v.appln_dist`,
    )
    .all(settings.luxuryThresholdSqm, ...filtered.whereParams) as Array<{
    distId: number;
    n: number;
    luxuryN: number;
    totalTax: number;
  }>;

  const statusRows = db
    .prepare(
      `SELECT v.appln_status AS code,
              COUNT(*) AS n,
              COALESCE(SUM(${taxExpr}), 0) AS totalTax
       FROM kbt_form2_appln_verified v
       ${filtered.whereSql}
       GROUP BY v.appln_status`,
    )
    .all(...filtered.whereParams) as Array<{ code: number; n: number; totalTax: number }>;

  const pointerRows = db
    .prepare(
      `SELECT v.appln_pointer AS code,
              COUNT(*) AS n,
              COALESCE(SUM(${taxExpr}), 0) AS totalTax
       FROM kbt_form2_appln_verified v
       ${filtered.whereSql}
       GROUP BY v.appln_pointer`,
    )
    .all(...filtered.whereParams) as Array<{ code: number; n: number; totalTax: number }>;

  const forecastCubeRows = db
    .prepare(
      `SELECT (${yearExpr}) AS yr,
              (${solarExpr.sql}) AS solar,
              (${dwellingExpr.sql}) AS dwelling,
              COUNT(*) AS n,
              COALESCE(SUM(${taxExpr}), 0) AS totalTax
       FROM kbt_form2_appln_verified v
       ${forecastFilter.whereSql}
       GROUP BY 1, 2, 3`,
    )
    .all(
      ...solarExpr.params,
      ...dwellingExpr.params,
      ...forecastFilter.whereParams,
    ) as Array<{
    yr: number | null;
    solar: string;
    dwelling: string;
    n: number;
    totalTax: number;
  }>;

  const bandAggRows = db
    .prepare(
      `SELECT (${taxExpr}) AS taxAmount,
              COUNT(*) AS n
       FROM kbt_form2_appln_verified v
       ${filtered.whereSql}
       GROUP BY 1`,
    )
    .all(...filtered.whereParams) as Array<{ taxAmount: number; n: number }>;

  const allYearsRows = db
    .prepare(`SELECT DISTINCT (${yearExpr}) AS yr FROM kbt_form2_appln_verified v`)
    .all() as Array<{ yr: number | null }>;

  const districtLookup = db
    .prepare('SELECT id, district_name AS name FROM districts')
    .all() as Array<{ id: number; name: string }>;

  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const startOfYear = new Date(currentCalendarYear, 0, 1);
  const dayOfYear = Math.max(
    1,
    Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const partialYearFraction = Math.min(1, dayOfYear / 365);

  let countedRecords = 0;
  let activeRecords = 0;
  let deletedRecords = 0;
  let luxuryCount = 0;
  let totalTax = 0;
  let missingDateCount = 0;

  const solarCounts: Record<'has_solar' | 'no_solar' | 'unknown', { count: number; tax: number }> = {
    has_solar: { count: 0, tax: 0 },
    no_solar: { count: 0, tax: 0 },
    unknown: { count: 0, tax: 0 },
  };
  const dwellingCounts: Record<'flat' | 'house' | 'unknown', { count: number; tax: number }> = {
    flat: { count: 0, tax: 0 },
    house: { count: 0, tax: 0 },
    unknown: { count: 0, tax: 0 },
  };
  const crossMap: Record<
    'has_solar' | 'no_solar' | 'unknown',
    { flat: number; house: number; unknown: number }
  > = {
    has_solar: { flat: 0, house: 0, unknown: 0 },
    no_solar: { flat: 0, house: 0, unknown: 0 },
    unknown: { flat: 0, house: 0, unknown: 0 },
  };
  const yearMap = new Map<number, YearWiseRow>();

  for (const g of cubeGroups) {
    const n = Number(g.n) || 0;
    const tax = Number(g.totalTax) || 0;
    countedRecords += n;
    if (Number(g.isDeleted) !== 0) deletedRecords += n;
    else activeRecords += n;
    if (Number(g.isLuxury) !== 0) luxuryCount += n;
    totalTax += tax;

    const sKey = (g.solar === 'has_solar' || g.solar === 'no_solar' ? g.solar : 'unknown') as
      | 'has_solar'
      | 'no_solar'
      | 'unknown';
    const dKey = (g.dwelling === 'flat' || g.dwelling === 'house' ? g.dwelling : 'unknown') as
      | 'flat'
      | 'house'
      | 'unknown';

    solarCounts[sKey].count += n;
    solarCounts[sKey].tax += tax;
    dwellingCounts[dKey].count += n;
    dwellingCounts[dKey].tax += tax;
    crossMap[sKey][dKey] += n;

    if (g.yr === null || g.yr === undefined) {
      missingDateCount += n;
    } else {
      const yr = Number(g.yr);
      let row = yearMap.get(yr);
      if (!row) {
        row = {
          year: yr,
          count: 0,
          totalTax: 0,
          isPartialYear: yr === currentCalendarYear && partialYearFraction < 0.999,
          flatCount: 0,
          houseCount: 0,
          dwellingUnknownCount: 0,
          flatTax: 0,
          houseTax: 0,
          dwellingUnknownTax: 0,
        };
        yearMap.set(yr, row);
      }
      row.count += n;
      row.totalTax += tax;
      if (dKey === 'flat') {
        row.flatCount += n;
        row.flatTax += tax;
      } else if (dKey === 'house') {
        row.houseCount += n;
        row.houseTax += tax;
      } else {
        row.dwellingUnknownCount += n;
        row.dwellingUnknownTax += tax;
      }
    }
  }

  const yearWise = [...yearMap.values()].sort((a, b) => a.year - b.year);

  // Configurable Tax-Amount Bands (income proxy)
  const bandBuckets: TaxBandRow[] = settings.bands.map((b) => ({
    id: b.id,
    label: b.label,
    min: b.min,
    max: b.max,
    count: 0,
    totalTax: 0,
    sharePct: 0,
  }));
  let unclassifiedCount = 0;
  for (const row of bandAggRows) {
    const amt = Math.max(0, Number(row.taxAmount) || 0);
    const n = Number(row.n) || 0;
    const target = bandBuckets.find((b) => amt >= b.min && (b.max === null || amt <= b.max));
    if (target) {
      target.count += n;
      target.totalTax += amt * n;
    } else {
      unclassifiedCount += n;
    }
  }
  for (const b of bandBuckets) {
    b.sharePct = countedRecords > 0 ? (100 * b.count) / countedRecords : 0;
  }

  const solarBreakdown = (
    [
      { key: 'has_solar', label: 'Has Solar' },
      { key: 'no_solar', label: 'No Solar' },
      { key: 'unknown', label: 'Unknown' },
    ] as const
  ).map((item) => ({
    key: item.key,
    label: item.label,
    count: solarCounts[item.key].count,
    totalTax: solarCounts[item.key].tax,
    sharePct: countedRecords > 0 ? (100 * solarCounts[item.key].count) / countedRecords : 0,
  }));

  const dwellingBreakdown = (
    [
      { key: 'flat', label: 'Flat' },
      { key: 'house', label: 'House' },
      { key: 'unknown', label: 'Unknown' },
    ] as const
  ).map((item) => ({
    key: item.key,
    label: item.label,
    count: dwellingCounts[item.key].count,
    totalTax: dwellingCounts[item.key].tax,
    sharePct: countedRecords > 0 ? (100 * dwellingCounts[item.key].count) / countedRecords : 0,
  }));

  const crossTabRows: CrossTabRow[] = (
    [
      { key: 'has_solar', label: 'Has Solar' },
      { key: 'no_solar', label: 'No Solar' },
      { key: 'unknown', label: 'Unknown' },
    ] as const
  ).map((item) => {
    const row = crossMap[item.key];
    return {
      solarKey: item.key,
      solarLabel: item.label,
      flat: row.flat,
      house: row.house,
      unknown: row.unknown,
      total: row.flat + row.house + row.unknown,
    };
  });

  const districtNameMap = new Map(districtLookup.map((d) => [Number(d.id), String(d.name)]));
  const districtsAgg = districtRows
    .map((d) => ({
      id: Number(d.distId),
      name: districtNameMap.get(Number(d.distId)) ?? `District ${d.distId}`,
      count: Number(d.n) || 0,
      luxuryCount: Number(d.luxuryN) || 0,
      totalTax: Number(d.totalTax) || 0,
      sharePct: countedRecords > 0 ? (100 * (Number(d.n) || 0)) / countedRecords : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const statusesAgg = statusRows
    .map((s) => ({
      code: Number(s.code),
      label: getStatusLabel(Number(s.code)),
      count: Number(s.n) || 0,
      totalTax: Number(s.totalTax) || 0,
      sharePct: countedRecords > 0 ? (100 * (Number(s.n) || 0)) / countedRecords : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const pointersAgg = pointerRows
    .map((p) => ({
      code: Number(p.code),
      label: getPointerLabel(Number(p.code)),
      count: Number(p.n) || 0,
      totalTax: Number(p.totalTax) || 0,
      sharePct: countedRecords > 0 ? (100 * (Number(p.n) || 0)) / countedRecords : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Forecast computation over multi-year series (ignoring single-year filter, keeping all other filters)
  const overallForecastYearMap = new Map<number, { count: number; totalTax: number }>();
  const splitMaps = new Map<string, Map<number, { count: number; totalTax: number }>>();
  for (const r of forecastCubeRows) {
    if (r.yr === null || r.yr === undefined) continue;
    const yr = Number(r.yr);
    const n = Number(r.n) || 0;
    const tax = Number(r.totalTax) || 0;

    const cur = overallForecastYearMap.get(yr) ?? { count: 0, totalTax: 0 };
    cur.count += n;
    cur.totalTax += tax;
    overallForecastYearMap.set(yr, cur);

    if (params.forecastSplit !== 'overall') {
      const segKey = params.forecastSplit === 'solar' ? String(r.solar) : String(r.dwelling);
      let segYearMap = splitMaps.get(segKey);
      if (!segYearMap) {
        segYearMap = new Map();
        splitMaps.set(segKey, segYearMap);
      }
      const segCur = segYearMap.get(yr) ?? { count: 0, totalTax: 0 };
      segCur.count += n;
      segCur.totalTax += tax;
      segYearMap.set(yr, segCur);
    }
  }

  const overallForecast = computeSegmentForecast({
    segmentKey: 'overall',
    segmentLabel: 'All Filtered Applications',
    points: [...overallForecastYearMap.entries()].map(([year, v]) => ({
      year,
      count: v.count,
      totalTax: v.totalTax,
    })),
    currentCalendarYear,
    partialYearFraction,
    partialYearMode: params.partialYearMode,
  });

  const splitDescriptors =
    params.forecastSplit === 'solar'
      ? [
          { key: 'has_solar', label: 'Has Solar' },
          { key: 'no_solar', label: 'No Solar' },
          { key: 'unknown', label: 'Solar Unknown' },
        ]
      : params.forecastSplit === 'dwelling'
        ? [
            { key: 'flat', label: 'Flat' },
            { key: 'house', label: 'House' },
            { key: 'unknown', label: 'Dwelling Unknown' },
          ]
        : [];

  const segmentForecasts = splitDescriptors.map((d) => {
    const m = splitMaps.get(d.key) ?? new Map();
    return computeSegmentForecast({
      segmentKey: d.key,
      segmentLabel: d.label,
      points: [...m.entries()].map(([year, v]) => ({
        year,
        count: v.count,
        totalTax: v.totalTax,
      })),
      currentCalendarYear,
      partialYearFraction,
      partialYearMode: params.partialYearMode,
    });
  });

  const availableYears = allYearsRows
    .map((r) => (r.yr === null || r.yr === undefined ? null : Number(r.yr)))
    .filter((y): y is number => y !== null)
    .sort((a, b) => b - a);

  return {
    appliedFilters: params,
    settings,
    summary: {
      rawMatchingRows: Number(rowVsDistinct?.rawRows ?? 0),
      distinctApplications: Number(rowVsDistinct?.distinctApps ?? 0),
      countedRecords,
      activeRecords,
      deletedRecords,
      luxuryCount,
      totalTax,
      missingDateCount,
      hasSolarCount: solarCounts.has_solar.count,
      noSolarCount: solarCounts.no_solar.count,
      solarUnknownCount: solarCounts.unknown.count,
      flatCount: dwellingCounts.flat.count,
      houseCount: dwellingCounts.house.count,
      dwellingUnknownCount: dwellingCounts.unknown.count,
    },
    yearWise,
    taxBands: {
      isProxy: true,
      proxyLabel: 'Tax-amount band - proxy, not income',
      taxColumn: params.taxColumn,
      rows: bandBuckets,
      unclassifiedCount,
    },
    solarBreakdown,
    dwellingBreakdown,
    crossTab: {
      rows: crossTabRows,
      colTotals: {
        flat: dwellingCounts.flat.count,
        house: dwellingCounts.house.count,
        unknown: dwellingCounts.unknown.count,
        total: countedRecords,
      },
    },
    districts: districtsAgg,
    statuses: statusesAgg,
    pointers: pointersAgg,
    forecast: {
      methodName: 'OLS Linear Trend with Student-t Prediction Intervals',
      methodRationale:
        'Selected for transparent linear slope interpretation and closed-form t-distributed prediction intervals that naturally widen when fewer annual observations exist.',
      estimateNotice: 'Statistical estimate only — never a guaranteed collection figure.',
      partialYearMode: params.partialYearMode,
      splitBy: params.forecastSplit,
      overall: overallForecast,
      segments: segmentForecasts,
    },
    availableYears,
  };
}

export async function listApplications(
  params: AnalyticsFilterParams,
  search: string,
  page: number,
  pageSize = 25,
): Promise<{
  rows: ApplicationListItem[];
  hasNext: boolean;
  page: number;
  pageSize: number;
}> {
  const db = getDb();
  const settings = await getSettings();
  const { whereSql, whereParams } = buildWhereClause(params, settings, {
    includeYear: true,
    includeDedupe: params.dedupe,
    search,
  });
  const taxExpr = taxExprSql(params.taxColumn);
  const areaExpr = areaExprSql();

  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT v.appln_id AS applnId,
              v.appln_appln_id AS applnApplnId,
              v.appln_no AS applnNo,
              v.appln_year AS applnYear,
              v.appln_form2_date AS applnForm2Date,
              v.appln_name AS applnName,
              d.district_name AS districtName,
              t.taluk_name AS talukName,
              vl.vill_name AS villName,
              ${areaExpr} AS area,
              ${taxExpr} AS taxAmount,
              v.appln_solar AS applnSolar,
              v.appln_flat_yesno AS applnFlatYesno,
              v.appln_status AS applnStatus,
              v.appln_pointer AS applnPointer,
              v.appln_delete AS applnDelete
       FROM kbt_form2_appln_verified v
       LEFT JOIN districts d ON d.id = v.appln_dist
       LEFT JOIN taluks t ON t.id = v.appln_taluk
       LEFT JOIN villages vl ON vl.id = v.appln_village
       ${whereSql}
       ORDER BY v.appln_id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...whereParams, pageSize + 1, offset) as Array<Record<string, unknown>>;

  const hasNext = rows.length > pageSize;
  return {
    rows: rows.slice(0, pageSize).map((r) => ({
      applnId: Number(r.applnId),
      applnApplnId: Number(r.applnApplnId),
      applnNo: String(r.applnNo ?? ''),
      applnYear: Number(r.applnYear),
      applnForm2Date: String(r.applnForm2Date ?? '0000-00-00'),
      applnName: String(r.applnName ?? ''),
      districtName: r.districtName ? String(r.districtName) : '—',
      talukName: r.talukName ? String(r.talukName) : '—',
      villName: r.villName ? String(r.villName) : '—',
      area: Number(r.area) || 0,
      taxAmount: Number(r.taxAmount) || 0,
      applnSolar: r.applnSolar === null || r.applnSolar === undefined ? null : Number(r.applnSolar),
      applnFlatYesno:
        r.applnFlatYesno === null || r.applnFlatYesno === undefined
          ? null
          : Number(r.applnFlatYesno),
      applnStatus: Number(r.applnStatus),
      applnPointer: Number(r.applnPointer),
      applnDelete: Number(r.applnDelete),
    })),
    hasNext,
    page,
    pageSize,
  };
}

export async function getApplicationDetail(applnId: number) {
  const db = getDb();
  const areaExpr = areaExprSql();
  const row = db
    .prepare(
      `SELECT v.appln_id AS applnId,
              v.appln_appln_id AS applnApplnId,
              v.appln_no AS applnNo,
              v.appln_year AS applnYear,
              v.appln_form2_no AS applnForm2No,
              v.appln_form2_date AS applnForm2Date,
              v.appln_form2_year AS applnForm2Year,
              v.appln_form2_submited_yesno AS applnForm2SubmitedYesno,
              v.appln_delete AS applnDelete,
              v.appln_status AS applnStatus,
              v.appln_pointer AS applnPointer,
              v.appln_solar AS applnSolar,
              v.appln_flat_yesno AS applnFlatYesno,
              v.appln_landtype AS applnLandtype,
              v.appln_nature AS applnNature,
              v.appln_constr_nature AS applnConstrNature,
              v.appln_noof_floors AS applnNoofFloors,
              v.appln_tax_lump AS applnTaxLump,
              v.prev_paid_amount AS prevPaidAmount,
              v.prev_paid_date AS prevPaidDate,
              v.appln_tax_exempt_yesno AS applnTaxExemptYesno,
              v.appln_reduced_rate_yesno AS applnReducedRateYesno,
              v.appln_pa_approved_res AS applnPaApprovedRes,
              v.appln_pa_cnstrcted_res AS applnPaCnstrctedRes,
              v.appln_pa_recommended_res AS applnPaRecommendedRes,
              v.appln_pa_approved_other AS applnPaApprovedOther,
              v.appln_pa_cnstrcted_other AS applnPaCnstrctedOther,
              v.appln_pa_recommended_other AS applnPaRecommendedOther,
              v.appln_pa_aprvd AS applnPaAprvd,
              v.appln_pa_cnstrcted AS applnPaCnstrcted,
              v.appln_name AS applnName,
              v.appln_survey_no AS applnSurveyNo,
              v.appln_block_no AS applnBlockNo,
              v.appln_sub_dvsn AS applnSubDvsn,
              v.appln_thandapperu_no AS applnThandapperuNo,
              v.appln_lsgtype AS applnLsgtype,
              v.appln_building_permit_no AS applnBuildingPermitNo,
              v.appln_assess_order_status AS applnAssessOrderStatus,
              v.appln_demand_notice_status AS applnDemandNoticeStatus,
              v.appln_appeal_status AS applnAppealStatus,
              v.appln_compltn_dt AS applnCompltnDt,
              v.appln_occupation_dt AS applnOccupationDt,
              v.appln_remarks AS applnRemarks,
              d.district_name AS districtName,
              t.taluk_name AS talukName,
              vl.vill_name AS villName,
              ${areaExpr} AS luxuryArea
       FROM kbt_form2_appln_verified v
       LEFT JOIN districts d ON d.id = v.appln_dist
       LEFT JOIN taluks t ON t.id = v.appln_taluk
       LEFT JOIN villages vl ON vl.id = v.appln_village
       WHERE v.appln_id = ?
       LIMIT 1`,
    )
    .get(applnId) as Record<string, unknown> | undefined;

  return row ?? null;
}
