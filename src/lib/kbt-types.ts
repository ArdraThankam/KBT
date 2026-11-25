export type YearColumnOption = 'appln_form2_date' | 'appln_year' | 'appln_form2_year';
export type TaxColumnOption = 'appln_tax_lump' | 'prev_paid_amount';
export type PartialYearMode = 'exclude' | 'annualise';
export type SolarSegment = 'all' | 'has_solar' | 'no_solar' | 'unknown';
export type DwellingSegment = 'all' | 'flat' | 'house' | 'unknown';
export type ForecastSplit = 'overall' | 'solar' | 'dwelling';
export type UserRole = 'viewer' | 'analyst' | 'admin';

export interface TaxBandConfig {
  id: string;
  label: string;
  min: number;
  max: number | null;
}

export interface SolarMappingConfig {
  hasSolar: number[];
  noSolar: number[];
}

export interface DwellingMappingConfig {
  flat: number[];
  house: number[];
}

export interface KbtSettingsDTO {
  yearColumn: YearColumnOption;
  taxColumn: TaxColumnOption;
  dedupeDefault: boolean;
  partialYearMode: PartialYearMode;
  luxuryThresholdSqm: number;
  bands: TaxBandConfig[];
  solarMapping: SolarMappingConfig;
  dwellingMapping: DwellingMappingConfig;
}

export interface AnalyticsFilterParams {
  year: number | null;
  district: number | null;
  taluk: number | null;
  village: number | null;
  status: number | null;
  pointer: number | null;
  luxury: boolean;
  solar: SolarSegment;
  dwelling: DwellingSegment;
  dedupe: boolean;
  includeDeleted: boolean;
  yearColumn: YearColumnOption;
  taxColumn: TaxColumnOption;
  partialYearMode: PartialYearMode;
  forecastSplit: ForecastSplit;
}

export interface YearWiseRow {
  year: number;
  count: number;
  totalTax: number;
  isPartialYear: boolean;
  flatCount: number;
  houseCount: number;
  dwellingUnknownCount: number;
  flatTax: number;
  houseTax: number;
  dwellingUnknownTax: number;
}

export interface TaxBandRow {
  id: string;
  label: string;
  min: number;
  max: number | null;
  count: number;
  totalTax: number;
  sharePct: number;
}

export interface SegmentRow {
  key: string;
  label: string;
  count: number;
  totalTax: number;
  sharePct: number;
}

export interface CrossTabRow {
  solarKey: 'has_solar' | 'no_solar' | 'unknown';
  solarLabel: string;
  flat: number;
  house: number;
  unknown: number;
  total: number;
}

export interface ForecastHistoryPoint {
  year: number;
  tax: number;
  count: number;
  isAnnualised: boolean;
  isExcludedPartial: boolean;
}

export interface MetricForecast {
  expected: number;
  lower80: number;
  upper80: number;
  lower95: number;
  upper95: number;
  stdErrorPred: number;
  slopePerYear: number;
}

export interface SegmentForecastResult {
  segmentKey: string;
  segmentLabel: string;
  canForecast: boolean;
  reason?: string;
  forecastYear: number;
  latestCompleteYear: number | null;
  latestCompleteTax: number | null;
  latestCompleteCount: number | null;
  fitPointCount: number;
  lowSampleWarning: boolean;
  lowSampleMessage?: string;
  probTaxHigherThanLatest: number | null;
  tax: MetricForecast | null;
  count: MetricForecast | null;
  history: ForecastHistoryPoint[];
  partialYearNote: string | null;
}

export interface ForecastBundle {
  methodName: string;
  methodRationale: string;
  estimateNotice: string;
  partialYearMode: PartialYearMode;
  splitBy: ForecastSplit;
  overall: SegmentForecastResult;
  segments: SegmentForecastResult[];
}

export interface AnalyticsResponse {
  appliedFilters: AnalyticsFilterParams;
  settings: KbtSettingsDTO;
  summary: {
    rawMatchingRows: number;
    distinctApplications: number;
    countedRecords: number;
    activeRecords: number;
    deletedRecords: number;
    luxuryCount: number;
    totalTax: number;
    missingDateCount: number;
    hasSolarCount: number;
    noSolarCount: number;
    solarUnknownCount: number;
    flatCount: number;
    houseCount: number;
    dwellingUnknownCount: number;
  };
  yearWise: YearWiseRow[];
  taxBands: {
    isProxy: true;
    proxyLabel: string;
    taxColumn: TaxColumnOption;
    rows: TaxBandRow[];
    unclassifiedCount: number;
  };
  solarBreakdown: SegmentRow[];
  dwellingBreakdown: SegmentRow[];
  crossTab: {
    rows: CrossTabRow[];
    colTotals: {
      flat: number;
      house: number;
      unknown: number;
      total: number;
    };
  };
  districts: Array<{
    id: number;
    name: string;
    count: number;
    luxuryCount: number;
    totalTax: number;
    sharePct: number;
  }>;
  statuses: Array<{
    code: number;
    label: string;
    count: number;
    totalTax: number;
    sharePct: number;
  }>;
  pointers: Array<{
    code: number;
    label: string;
    count: number;
    totalTax: number;
    sharePct: number;
  }>;
  forecast: ForecastBundle;
  availableYears: number[];
}

export interface ApplicationListItem {
  applnId: number;
  applnApplnId: number;
  applnNo: string;
  applnYear: number;
  applnForm2Date: string;
  applnName: string;
  districtName: string;
  talukName: string;
  villName: string;
  area: number;
  taxAmount: number;
  applnSolar: number | null;
  applnFlatYesno: number | null;
  applnStatus: number;
  applnPointer: number;
  applnDelete: number;
}
