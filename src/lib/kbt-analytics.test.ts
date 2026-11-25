import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignTaxBand,
  classifyDwelling,
  classifySolar,
  dedupeByApplnId,
  DEFAULT_TAX_BANDS,
  extractYear,
  formatDisplayDate,
  isZeroOrEmptyDate,
  validateBands,
} from './kbt-analytics.ts';
import { computeSegmentForecast, studentTCdf } from './forecast.ts';

test('zero dates and missing dates are handled safely without crashing', () => {
  assert.equal(isZeroOrEmptyDate('0000-00-00'), true);
  assert.equal(isZeroOrEmptyDate(''), true);
  assert.equal(isZeroOrEmptyDate(null), true);
  assert.equal(isZeroOrEmptyDate('2024-05-10'), false);

  assert.equal(extractYear({ applnForm2Date: '0000-00-00' }, 'appln_form2_date'), null);
  assert.equal(extractYear({ applnForm2Date: '2023-11-04' }, 'appln_form2_date'), 2023);
  assert.equal(extractYear({ applnYear: 2021 }, 'appln_year'), 2021);
  assert.equal(extractYear({ applnYear: 0 }, 'appln_year'), null);
  assert.equal(formatDisplayDate('0000-00-00'), '—');
});

test('solar and dwelling classifications separate yes, no, and unknown cleanly', () => {
  assert.equal(classifySolar(1), 'has_solar');
  assert.equal(classifySolar(0), 'no_solar');
  assert.equal(classifySolar(null), 'unknown');
  assert.equal(classifySolar(99), 'unknown');

  assert.equal(classifyDwelling(1), 'flat');
  assert.equal(classifyDwelling(0), 'house');
  assert.equal(classifyDwelling(undefined), 'unknown');
});

test('deduplication keeps latest appln_id per positive appln_appln_id and preserves zero/unlinked ids', () => {
  const result = dedupeByApplnId([
    { applnId: 1, applnApplnId: 100 },
    { applnId: 5, applnApplnId: 100 },
    { applnId: 2, applnApplnId: 200 },
    { applnId: 3, applnApplnId: 0 },
    { applnId: 4, applnApplnId: 0 },
  ]);

  assert.equal(result.rawCount, 5);
  assert.equal(result.distinctCount, 4);
  assert.deepEqual(
    result.deduped.map((r) => r.applnId).sort((a, b) => a - b),
    [2, 3, 4, 5],
  );
});

test('tax band assignment and validation work with configurable bands', () => {
  assert.equal(assignTaxBand(0, DEFAULT_TAX_BANDS)?.id, 'nil');
  assert.equal(assignTaxBand(5000, DEFAULT_TAX_BANDS)?.id, 'b1');
  assert.equal(assignTaxBand(25000, DEFAULT_TAX_BANDS)?.id, 'b2');
  assert.equal(assignTaxBand(75000, DEFAULT_TAX_BANDS)?.id, 'b4');

  const custom = validateBands([
    { id: 'low', label: '0 - 5,000', min: 0, max: 5000 },
    { id: 'high', label: '5,001+', min: 5001, max: null },
  ]);
  assert.equal(custom.length, 2);
  assert.throws(() => validateBands([{ id: 'bad', label: 'Bad', min: 100, max: 50 }]));
});

test('studentTCdf symmetry and OLS forecast produce valid intervals and probability', () => {
  assert.ok(Math.abs(studentTCdf(0, 5) - 0.5) < 1e-9);
  assert.ok(studentTCdf(2, 5) > 0.9);
  assert.ok(studentTCdf(-2, 5) < 0.1);

  const series = [
    { year: 2019, count: 30, totalTax: 100000 },
    { year: 2020, count: 36, totalTax: 120000 },
    { year: 2021, count: 42, totalTax: 140000 },
    { year: 2022, count: 48, totalTax: 160000 },
    { year: 2023, count: 54, totalTax: 180000 },
    { year: 2024, count: 60, totalTax: 200000 },
    { year: 2025, count: 30, totalTax: 100000 }, // partial year (50% elapsed)
  ];

  const excluded = computeSegmentForecast({
    segmentKey: 'overall',
    segmentLabel: 'Overall',
    points: series,
    currentCalendarYear: 2025,
    partialYearFraction: 0.5,
    partialYearMode: 'exclude',
  });

  assert.equal(excluded.canForecast, true);
  assert.equal(excluded.lowSampleWarning, false);
  assert.equal(excluded.forecastYear, 2025);
  assert.ok(excluded.tax !== null);
  assert.ok(Math.abs(excluded.tax!.expected - 220000) < 1);
  assert.ok(excluded.tax!.lower95 <= excluded.tax!.lower80);
  assert.ok(excluded.tax!.lower80 <= excluded.tax!.expected);
  assert.ok(excluded.tax!.expected <= excluded.tax!.upper80);
  assert.ok(excluded.tax!.upper80 <= excluded.tax!.upper95);
  assert.ok(excluded.probTaxHigherThanLatest !== null && excluded.probTaxHigherThanLatest > 0.8);

  const annualised = computeSegmentForecast({
    segmentKey: 'overall',
    segmentLabel: 'Overall',
    points: series,
    currentCalendarYear: 2025,
    partialYearFraction: 0.5,
    partialYearMode: 'annualise',
  });

  assert.equal(annualised.forecastYear, 2026);
  assert.equal(annualised.fitPointCount, 7);
});

test('forecast warns when fewer than 5 yearly points exist and refuses below 2', () => {
  const shortRes = computeSegmentForecast({
    segmentKey: 'short',
    segmentLabel: 'Short',
    points: [
      { year: 2022, count: 10, totalTax: 50000 },
      { year: 2023, count: 15, totalTax: 75000 },
      { year: 2024, count: 18, totalTax: 90000 },
    ],
    currentCalendarYear: 2025,
    partialYearFraction: 0.5,
    partialYearMode: 'exclude',
  });
  assert.equal(shortRes.canForecast, true);
  assert.equal(shortRes.lowSampleWarning, true);

  const tinyRes = computeSegmentForecast({
    segmentKey: 'tiny',
    segmentLabel: 'Tiny',
    points: [{ year: 2024, count: 10, totalTax: 50000 }],
    currentCalendarYear: 2025,
    partialYearFraction: 0.5,
    partialYearMode: 'exclude',
  });
  assert.equal(tinyRes.canForecast, false);
  assert.equal(tinyRes.lowSampleWarning, true);
});
