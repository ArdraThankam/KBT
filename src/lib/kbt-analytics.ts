import type {
  DwellingMappingConfig,
  KbtSettingsDTO,
  SolarMappingConfig,
  TaxBandConfig,
  YearColumnOption,
} from './kbt-types.ts';

export const DEFAULT_TAX_BANDS: TaxBandConfig[] = [
  { id: 'nil', label: 'Nil / Exempt (0)', min: 0, max: 0 },
  { id: 'b1', label: '1 - 10,000', min: 1, max: 10000 },
  { id: 'b2', label: '10,001 - 25,000', min: 10001, max: 25000 },
  { id: 'b3', label: '25,001 - 50,000', min: 25001, max: 50000 },
  { id: 'b4', label: '50,001+', min: 50001, max: null },
];

export const DEFAULT_SOLAR_MAPPING: SolarMappingConfig = {
  hasSolar: [1],
  noSolar: [0],
};

export const DEFAULT_DWELLING_MAPPING: DwellingMappingConfig = {
  flat: [1],
  house: [0],
};

export const DEFAULT_SETTINGS: KbtSettingsDTO = {
  yearColumn: 'appln_form2_date',
  taxColumn: 'appln_tax_lump',
  dedupeDefault: true,
  partialYearMode: 'exclude',
  luxuryThresholdSqm: 300,
  bands: DEFAULT_TAX_BANDS,
  solarMapping: DEFAULT_SOLAR_MAPPING,
  dwellingMapping: DEFAULT_DWELLING_MAPPING,
};

export const STATUS_LABELS: Record<number, string> = {
  1: 'Submitted',
  2: 'Verified',
  3: 'Assessed',
  4: 'Closed',
};

export const POINTER_LABELS: Record<number, string> = {
  1: 'Village Officer',
  2: 'Revenue Inspector',
  3: 'Tahsildar Review',
  4: 'Demand Issued',
  5: 'Completed',
};

export function getStatusLabel(code: number): string {
  return STATUS_LABELS[code] ?? `Status ${code}`;
}

export function getPointerLabel(code: number): string {
  return POINTER_LABELS[code] ?? `Stage ${code}`;
}

export function isZeroOrEmptyDate(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = String(value).trim();
  return trimmed === '' || trimmed.startsWith('0000');
}

export function extractYear(
  record: {
    applnForm2Date?: string | null;
    applnYear?: number | null;
    applnForm2Year?: number | null;
  },
  column: YearColumnOption,
): number | null {
  if (column === 'appln_form2_date') {
    const raw = record.applnForm2Date;
    if (isZeroOrEmptyDate(raw)) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw).trim());
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return y;
  }

  const rawNum = column === 'appln_year' ? record.applnYear : record.applnForm2Year;
  if (typeof rawNum !== 'number' || !Number.isFinite(rawNum)) return null;
  const yr = Math.trunc(rawNum);
  return yr >= 1900 && yr <= 2100 ? yr : null;
}

export function classifySolar(
  value: number | null | undefined,
  mapping: SolarMappingConfig = DEFAULT_SOLAR_MAPPING,
): 'has_solar' | 'no_solar' | 'unknown' {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'unknown';
  }
  if (mapping.hasSolar.includes(value)) return 'has_solar';
  if (mapping.noSolar.includes(value)) return 'no_solar';
  return 'unknown';
}

export function classifyDwelling(
  value: number | null | undefined,
  mapping: DwellingMappingConfig = DEFAULT_DWELLING_MAPPING,
): 'flat' | 'house' | 'unknown' {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'unknown';
  }
  if (mapping.flat.includes(value)) return 'flat';
  if (mapping.house.includes(value)) return 'house';
  return 'unknown';
}

export function assignTaxBand(
  amount: number,
  bands: TaxBandConfig[] = DEFAULT_TAX_BANDS,
): TaxBandConfig | null {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  for (const band of bands) {
    if (safe >= band.min && (band.max === null || safe <= band.max)) {
      return band;
    }
  }
  return null;
}

export interface RawDedupeCandidate {
  applnId: number;
  applnApplnId: number;
}

export function dedupeByApplnId<T extends RawDedupeCandidate>(rows: T[]): {
  deduped: T[];
  rawCount: number;
  distinctCount: number;
} {
  const byAppId = new Map<number, T>();
  const unlinked: T[] = [];

  for (const row of rows) {
    if (!row.applnApplnId || row.applnApplnId <= 0) {
      unlinked.push(row);
      continue;
    }
    const prev = byAppId.get(row.applnApplnId);
    if (!prev || row.applnId > prev.applnId) {
      byAppId.set(row.applnApplnId, row);
    }
  }

  const deduped = [...byAppId.values(), ...unlinked];
  return {
    deduped,
    rawCount: rows.length,
    distinctCount: deduped.length,
  };
}

export function formatDisplayDate(value: string | null | undefined): string {
  if (isZeroOrEmptyDate(value)) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (!match) return String(value);
  const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function validateBands(bands: TaxBandConfig[]): TaxBandConfig[] {
  if (!Array.isArray(bands) || bands.length === 0) {
    throw new Error('At least one tax band is required.');
  }
  return bands.map((b, idx) => {
    const min = Number(b.min);
    const max = b.max === null || b.max === undefined || b.max === ('' as unknown as number) ? null : Number(b.max);
    if (!Number.isFinite(min) || min < 0) {
      throw new Error(`Band ${idx + 1} has an invalid minimum.`);
    }
    if (max !== null && (!Number.isFinite(max) || max < min)) {
      throw new Error(`Band ${idx + 1} maximum must be >= minimum.`);
    }
    const label = String(b.label || '').trim();
    if (!label) {
      throw new Error(`Band ${idx + 1} must have a label.`);
    }
    return {
      id: String(b.id || `band_${idx + 1}`),
      label,
      min,
      max,
    };
  });
}
