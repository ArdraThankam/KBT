import type {
  ForecastHistoryPoint,
  MetricForecast,
  PartialYearMode,
  SegmentForecastResult,
} from './kbt-types.ts';

// Log-gamma via Lanczos approximation for exact Student-t CDF / quantiles
function logGamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const zz = z - 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (zz + i);
  }
  const t = zz + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIter = 200;
  const eps = 3e-12;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

export function studentTCdf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  if (df <= 0) return 0.5;
  if (t === 0) return 0.5;
  const x = df / (df + t * t);
  const ib = regularizedIncompleteBeta(df / 2, 0.5, x);
  return t > 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

export function studentTCritical(df: number, twoSidedConfidence: number): number {
  const targetCdf = 0.5 + twoSidedConfidence / 2;
  let lo = 0;
  let hi = 40;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < targetCdf) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export interface AnnualInputPoint {
  year: number;
  count: number;
  totalTax: number;
}

export interface ComputeSegmentForecastOptions {
  segmentKey: string;
  segmentLabel: string;
  points: AnnualInputPoint[];
  currentCalendarYear: number;
  partialYearFraction: number;
  partialYearMode: PartialYearMode;
}

function fitOlsMetric(
  xs: number[],
  ys: number[],
  forecastX: number,
): MetricForecast {
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    sxx += dx * dx;
    sxy += dx * (ys[i] - meanY);
  }

  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = meanY - slope * meanX;

  let sse = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    const err = ys[i] - pred;
    sse += err * err;
  }

  const df = n > 2 ? n - 2 : 1;
  // For n=2, residual SSE is 0; apply conservative 15% CV fallback so intervals are never zero-width.
  const se = n > 2 ? Math.sqrt(sse / df) : Math.max(1, Math.abs(meanY) * 0.15);
  const leverage = sxx > 0 ? ((forecastX - meanX) * (forecastX - meanX)) / sxx : 0;
  const stdErrorPred = se * Math.sqrt(1 + 1 / n + leverage);

  const expected = Math.max(0, intercept + slope * forecastX);
  const t80 = studentTCritical(df, 0.8);
  const t95 = studentTCritical(df, 0.95);

  return {
    expected,
    lower80: Math.max(0, expected - t80 * stdErrorPred),
    upper80: expected + t80 * stdErrorPred,
    lower95: Math.max(0, expected - t95 * stdErrorPred),
    upper95: expected + t95 * stdErrorPred,
    stdErrorPred,
    slopePerYear: slope,
  };
}

export function computeSegmentForecast(
  opts: ComputeSegmentForecastOptions,
): SegmentForecastResult {
  const sorted = [...opts.points].sort((a, b) => a.year - b.year);
  const safeFraction = Math.min(1, Math.max(0.05, opts.partialYearFraction || 1));

  const history: ForecastHistoryPoint[] = [];
  const fitPoints: Array<{ year: number; tax: number; count: number }> = [];
  let partialYearNote: string | null = null;

  for (const pt of sorted) {
    const isCurrentPartial = pt.year === opts.currentCalendarYear && safeFraction < 0.999;
    if (isCurrentPartial) {
      if (opts.partialYearMode === 'exclude') {
        history.push({
          year: pt.year,
          tax: pt.totalTax,
          count: pt.count,
          isAnnualised: false,
          isExcludedPartial: true,
        });
        partialYearNote = `Partial year ${pt.year} (${Math.round(safeFraction * 100)}% elapsed) excluded from trend fitting.`;
      } else {
        const annTax = pt.totalTax / safeFraction;
        const annCount = Math.round(pt.count / safeFraction);
        history.push({
          year: pt.year,
          tax: annTax,
          count: annCount,
          isAnnualised: true,
          isExcludedPartial: false,
        });
        fitPoints.push({ year: pt.year, tax: annTax, count: annCount });
        partialYearNote = `Partial year ${pt.year} (${Math.round(safeFraction * 100)}% elapsed) annualised (×${(1 / safeFraction).toFixed(2)}) for trend fitting — estimate only.`;
      }
    } else {
      history.push({
        year: pt.year,
        tax: pt.totalTax,
        count: pt.count,
        isAnnualised: false,
        isExcludedPartial: false,
      });
      fitPoints.push({ year: pt.year, tax: pt.totalTax, count: pt.count });
    }
  }

  const completePoints = sorted.filter(
    (p) => !(p.year === opts.currentCalendarYear && safeFraction < 0.999),
  );
  const latestComplete = completePoints.length > 0 ? completePoints[completePoints.length - 1] : null;
  const lastFitYear =
    fitPoints.length > 0
      ? fitPoints[fitPoints.length - 1].year
      : opts.currentCalendarYear;
  const forecastYear = lastFitYear + 1;
  const lowSampleWarning = fitPoints.length < 5;

  if (fitPoints.length < 2) {
    return {
      segmentKey: opts.segmentKey,
      segmentLabel: opts.segmentLabel,
      canForecast: false,
      reason: 'At least 2 yearly points are needed to fit a forecast trend under current filters.',
      forecastYear,
      latestCompleteYear: latestComplete?.year ?? null,
      latestCompleteTax: latestComplete?.totalTax ?? null,
      latestCompleteCount: latestComplete?.count ?? null,
      fitPointCount: fitPoints.length,
      lowSampleWarning: true,
      lowSampleMessage:
        'Fewer than 5 yearly data points — insufficient history for a reliable projection.',
      probTaxHigherThanLatest: null,
      tax: null,
      count: null,
      history,
      partialYearNote,
    };
  }

  const xs = fitPoints.map((p) => p.year);
  const taxYs = fitPoints.map((p) => p.tax);
  const countYs = fitPoints.map((p) => p.count);

  const taxForecast = fitOlsMetric(xs, taxYs, forecastYear);
  const countForecast = fitOlsMetric(xs, countYs, forecastYear);

  const df = fitPoints.length > 2 ? fitPoints.length - 2 : 1;
  let probTaxHigherThanLatest: number | null = null;
  if (latestComplete !== null) {
    if (taxForecast.stdErrorPred <= 0) {
      probTaxHigherThanLatest = taxForecast.expected > latestComplete.totalTax ? 1 : 0;
    } else {
      const tStat = (latestComplete.totalTax - taxForecast.expected) / taxForecast.stdErrorPred;
      probTaxHigherThanLatest = Math.min(1, Math.max(0, 1 - studentTCdf(tStat, df)));
    }
  }

  return {
    segmentKey: opts.segmentKey,
    segmentLabel: opts.segmentLabel,
    canForecast: true,
    forecastYear,
    latestCompleteYear: latestComplete?.year ?? null,
    latestCompleteTax: latestComplete?.totalTax ?? null,
    latestCompleteCount: latestComplete?.count ?? null,
    fitPointCount: fitPoints.length,
    lowSampleWarning,
    lowSampleMessage: lowSampleWarning
      ? `Only ${fitPoints.length} yearly data points available (minimum 5 recommended) — forecast is weak and should be treated cautiously.`
      : undefined,
    probTaxHigherThanLatest,
    tax: taxForecast,
    count: countForecast,
    history,
    partialYearNote,
  };
}
