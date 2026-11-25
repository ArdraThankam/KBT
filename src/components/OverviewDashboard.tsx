import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Info,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { ChartCanvas } from './ChartCanvas';
import type {
  AnalyticsFilterParams,
  AnalyticsResponse,
  DwellingSegment,
  ForecastSplit,
  PartialYearMode,
  SolarSegment,
} from '../lib/kbt-types';

interface OverviewDashboardProps {
  data: AnalyticsResponse;
  filters: AnalyticsFilterParams;
  loading: boolean;
  onFilterChange: (next: Partial<AnalyticsFilterParams>) => void;
  onRefresh: () => void;
  onNavigateSettings: () => void;
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-IN');
}

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `₹ ${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

export function OverviewDashboard({
  data,
  filters,
  loading,
  onFilterChange,
  onRefresh,
  onNavigateSettings,
}: OverviewDashboardProps) {
  const [forecastMetric, setForecastMetric] = useState<'tax' | 'count'>('tax');
  const [stackedMetric, setStackedMetric] = useState<'count' | 'tax'>('count');

  const { summary, yearWise, taxBands, solarBreakdown, dwellingBreakdown, crossTab, forecast } =
    data;
  const ovForecast = forecast.overall;

  // 1. Year-wise Bar + Line Combo Chart (Chart.js v2 API)
  const yearWiseChartConfig = useMemo(() => {
    const labels = yearWise.map((r) => (r.isPartialYear ? `${r.year} (Partial)` : String(r.year)));
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Applications',
            yAxisID: 'y-count',
            backgroundColor: yearWise.map((r) =>
              r.isPartialYear ? 'rgba(14, 124, 134, 0.45)' : 'rgba(31, 78, 140, 0.85)',
            ),
            borderColor: yearWise.map((r) => (r.isPartialYear ? '#0e7c86' : '#1f4e8c')),
            borderWidth: 1,
            data: yearWise.map((r) => r.count),
            order: 2,
          },
          {
            label: `Total Tax (${filters.taxColumn})`,
            yAxisID: 'y-tax',
            type: 'line',
            borderColor: '#b45309',
            backgroundColor: 'rgba(180, 83, 9, 0.08)',
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
            lineTension: 0.2,
            data: yearWise.map((r) => Math.round(r.totalTax)),
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 12, fontColor: '#475467' },
        },
        tooltips: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (item: any, chartData: any) => {
              const dsLabel = chartData.datasets[item.datasetIndex].label || '';
              const val = Number(item.yLabel || 0);
              if (item.datasetIndex === 1) {
                return `${dsLabel}: ₹ ${val.toLocaleString('en-IN')}`;
              }
              return `${dsLabel}: ${val.toLocaleString('en-IN')}`;
            },
          },
        },
        scales: {
          xAxes: [{ gridLines: { display: false }, ticks: { fontColor: '#475467' } }],
          yAxes: [
            {
              id: 'y-count',
              position: 'left',
              ticks: {
                beginAtZero: true,
                fontColor: '#1f4e8c',
                callback: (v: number) => Number(v).toLocaleString('en-IN'),
              },
              gridLines: { color: '#eef2f6' },
            },
            {
              id: 'y-tax',
              position: 'right',
              ticks: {
                beginAtZero: true,
                fontColor: '#b45309',
                callback: (v: number) => `₹${Math.round(v / 1000).toLocaleString('en-IN')}k`,
              },
              gridLines: { drawOnChartArea: false },
            },
          ],
        },
      },
    };
  }, [yearWise, filters.taxColumn]);

  // 2. Tax-Amount Band (Proxy) Chart
  const taxBandsChartConfig = useMemo(() => {
    return {
      type: 'bar',
      data: {
        labels: taxBands.rows.map((b) => b.label),
        datasets: [
          {
            label: 'Applications',
            yAxisID: 'y-count',
            backgroundColor: 'rgba(14, 124, 134, 0.8)',
            borderColor: '#0e7c86',
            borderWidth: 1,
            data: taxBands.rows.map((b) => b.count),
          },
          {
            label: 'Total Tax (₹)',
            yAxisID: 'y-tax',
            backgroundColor: 'rgba(31, 78, 140, 0.35)',
            borderColor: '#1f4e8c',
            borderWidth: 1,
            data: taxBands.rows.map((b) => Math.round(b.totalTax)),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 12, fontColor: '#475467' },
        },
        tooltips: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (item: any, chartData: any) => {
              const dsLabel = chartData.datasets[item.datasetIndex].label || '';
              const val = Number(item.yLabel || 0);
              return item.datasetIndex === 1
                ? `${dsLabel}: ₹ ${val.toLocaleString('en-IN')}`
                : `${dsLabel}: ${val.toLocaleString('en-IN')}`;
            },
          },
        },
        scales: {
          xAxes: [{ gridLines: { display: false }, ticks: { fontColor: '#475467' } }],
          yAxes: [
            {
              id: 'y-count',
              position: 'left',
              ticks: {
                beginAtZero: true,
                fontColor: '#0e7c86',
                callback: (v: number) => Number(v).toLocaleString('en-IN'),
              },
              gridLines: { color: '#eef2f6' },
            },
            {
              id: 'y-tax',
              position: 'right',
              ticks: {
                beginAtZero: true,
                fontColor: '#1f4e8c',
                callback: (v: number) => `₹${Math.round(v / 1000).toLocaleString('en-IN')}k`,
              },
              gridLines: { drawOnChartArea: false },
            },
          ],
        },
      },
    };
  }, [taxBands]);

  // 3. Forecast Line Chart with 80% and 95% Prediction Interval Fan
  const forecastChartConfig = useMemo(() => {
    const activePts = ovForecast.history.filter((h) => !h.isExcludedPartial);
    const metricObj = forecastMetric === 'tax' ? ovForecast.tax : ovForecast.count;
    const labels = [...activePts.map((h) => (h.isAnnualised ? `${h.year} (Ann.)` : String(h.year)))];

    const histSeries: Array<number | null> = activePts.map((h) =>
      forecastMetric === 'tax' ? Math.round(h.tax) : h.count,
    );
    const expectedSeries: Array<number | null> = activePts.map(() => null);
    const low80Series: Array<number | null> = activePts.map(() => null);
    const high80Series: Array<number | null> = activePts.map(() => null);
    const low95Series: Array<number | null> = activePts.map(() => null);
    const high95Series: Array<number | null> = activePts.map(() => null);

    if (ovForecast.canForecast && metricObj && activePts.length > 0) {
      labels.push(`${ovForecast.forecastYear} (Est.)`);
      const lastVal = histSeries[histSeries.length - 1] ?? 0;
      histSeries.push(null);

      // Anchor interval fan at last observed fit point
      expectedSeries[expectedSeries.length - 1] = lastVal;
      low80Series[low80Series.length - 1] = lastVal;
      high80Series[high80Series.length - 1] = lastVal;
      low95Series[low95Series.length - 1] = lastVal;
      high95Series[high95Series.length - 1] = lastVal;

      expectedSeries.push(Math.round(metricObj.expected));
      low80Series.push(Math.round(metricObj.lower80));
      high80Series.push(Math.round(metricObj.upper80));
      low95Series.push(Math.round(metricObj.lower95));
      high95Series.push(Math.round(metricObj.upper95));
    }

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '95% Lower Bound',
            borderColor: 'rgba(31, 78, 140, 0.2)',
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false,
            lineTension: 0,
            data: low95Series,
          },
          {
            label: '95% Prediction Band',
            borderColor: 'rgba(31, 78, 140, 0.2)',
            backgroundColor: 'rgba(31, 78, 140, 0.10)',
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 2,
            fill: '-1',
            lineTension: 0,
            data: high95Series,
          },
          {
            label: '80% Lower Bound',
            borderColor: 'rgba(14, 124, 134, 0.35)',
            borderWidth: 1,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false,
            lineTension: 0,
            data: low80Series,
          },
          {
            label: '80% Prediction Band',
            borderColor: 'rgba(14, 124, 134, 0.35)',
            backgroundColor: 'rgba(14, 124, 134, 0.18)',
            borderWidth: 1,
            borderDash: [4, 3],
            pointRadius: 2,
            fill: '-1',
            lineTension: 0,
            data: high80Series,
          },
          {
            label: forecastMetric === 'tax' ? 'Historical Tax (₹)' : 'Historical Applications',
            borderColor: '#1f4e8c',
            backgroundColor: '#1f4e8c',
            borderWidth: 2.5,
            pointRadius: 4,
            fill: false,
            lineTension: 0.15,
            data: histSeries,
          },
          {
            label:
              forecastMetric === 'tax'
                ? 'Expected Forecast Tax (Estimate)'
                : 'Expected Forecast Count (Estimate)',
            borderColor: '#0e7c86',
            backgroundColor: '#0e7c86',
            borderWidth: 2.5,
            borderDash: [6, 4],
            pointRadius: 5,
            fill: false,
            lineTension: 0,
            data: expectedSeries,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 12, fontColor: '#475467' },
        },
        tooltips: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (item: any, chartData: any) => {
              if (item.value === 'NaN' || item.yLabel === null || item.yLabel === undefined) {
                return null;
              }
              const dsLabel = chartData.datasets[item.datasetIndex].label || '';
              const val = Number(item.yLabel);
              return forecastMetric === 'tax'
                ? `${dsLabel}: ₹ ${val.toLocaleString('en-IN')}`
                : `${dsLabel}: ${val.toLocaleString('en-IN')}`;
            },
          },
        },
        scales: {
          xAxes: [{ gridLines: { display: false }, ticks: { fontColor: '#475467' } }],
          yAxes: [
            {
              ticks: {
                beginAtZero: true,
                fontColor: '#475467',
                callback: (v: number) =>
                  forecastMetric === 'tax'
                    ? `₹${Math.round(v / 1000).toLocaleString('en-IN')}k`
                    : Number(v).toLocaleString('en-IN'),
              },
              gridLines: { color: '#eef2f6' },
            },
          ],
        },
      },
    };
  }, [ovForecast, forecastMetric]);

  // 4. Solar Panel Donut Chart
  const solarDonutConfig = useMemo(() => {
    return {
      type: 'doughnut',
      data: {
        labels: solarBreakdown.map((s) => s.label),
        datasets: [
          {
            data: solarBreakdown.map((s) => s.count),
            backgroundColor: ['#0e7c86', '#1f4e8c', '#98a2b3'],
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutoutPercentage: 62,
        legend: {
          display: true,
          position: 'bottom',
          labels: { boxWidth: 12, fontColor: '#475467' },
        },
        tooltips: {
          callbacks: {
            label: (item: any, chartData: any) => {
              const lbl = chartData.labels[item.index];
              const val = Number(chartData.datasets[0].data[item.index] || 0);
              return `${lbl}: ${val.toLocaleString('en-IN')} applications`;
            },
          },
        },
      },
    };
  }, [solarBreakdown]);

  // 5. Year-wise Stacked Bar Chart by Dwelling Type
  const dwellingStackedConfig = useMemo(() => {
    return {
      type: 'bar',
      data: {
        labels: yearWise.map((r) => (r.isPartialYear ? `${r.year}*` : String(r.year))),
        datasets: [
          {
            label: 'Flat',
            backgroundColor: '#1f4e8c',
            data: yearWise.map((r) =>
              stackedMetric === 'count' ? r.flatCount : Math.round(r.flatTax),
            ),
          },
          {
            label: 'House',
            backgroundColor: '#0e7c86',
            data: yearWise.map((r) =>
              stackedMetric === 'count' ? r.houseCount : Math.round(r.houseTax),
            ),
          },
          {
            label: 'Unknown',
            backgroundColor: '#98a2b3',
            data: yearWise.map((r) =>
              stackedMetric === 'count' ? r.dwellingUnknownCount : Math.round(r.dwellingUnknownTax),
            ),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 12, fontColor: '#475467' },
        },
        tooltips: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (item: any, chartData: any) => {
              const dsLabel = chartData.datasets[item.datasetIndex].label || '';
              const val = Number(item.yLabel || 0);
              return stackedMetric === 'tax'
                ? `${dsLabel}: ₹ ${val.toLocaleString('en-IN')}`
                : `${dsLabel}: ${val.toLocaleString('en-IN')}`;
            },
          },
        },
        scales: {
          xAxes: [{ stacked: true, gridLines: { display: false }, ticks: { fontColor: '#475467' } }],
          yAxes: [
            {
              stacked: true,
              ticks: {
                beginAtZero: true,
                fontColor: '#475467',
                callback: (v: number) =>
                  stackedMetric === 'tax'
                    ? `₹${Math.round(v / 1000).toLocaleString('en-IN')}k`
                    : Number(v).toLocaleString('en-IN'),
              },
              gridLines: { color: '#eef2f6' },
            },
          ],
        },
      },
    };
  }, [yearWise, stackedMetric]);

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0b1f3a]">
            Building Tax Intelligence Overview
          </h2>
          <p className="text-xs text-[#667085] mt-0.5">
            Active settings: Year source <code className="font-mono text-[#1f4e8c]">{filters.yearColumn}</code>
            {' · '}Tax column <code className="font-mono text-[#1f4e8c]">{filters.taxColumn}</code>
            {' · '}Dedupe <strong className="text-[#1d2939]">{filters.dedupe ? 'ON' : 'OFF'}</strong>
            {' · '}Deleted rows <strong className="text-[#1d2939]">{filters.includeDeleted ? 'Included' : 'Excluded'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-[#cfd6e0] text-[#475467] hover:bg-[#f9fafb]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Configure Bands &amp; Mappings</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#1f4e8c] text-white hover:bg-[#173c6d] disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e3e8ef] rounded-md p-4 shadow-xs">
          <div className="text-xs font-medium text-[#667085] uppercase tracking-wider">
            Counted Applications
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-[#0b1f3a] tabular-nums">
            {fmtInt(summary.countedRecords)}
          </div>
          <div className="mt-2 pt-2 border-t border-[#eef2f6] text-xs text-[#475467] space-y-0.5 tabular-nums">
            <div className="flex justify-between">
              <span>Raw matching rows:</span>
              <span className="font-medium text-[#0b1f3a]">{fmtInt(summary.rawMatchingRows)}</span>
            </div>
            <div className="flex justify-between">
              <span>Distinct applications:</span>
              <span className="font-medium text-[#0b1f3a]">
                {fmtInt(summary.distinctApplications)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Active / Deleted:</span>
              <span>
                {fmtInt(summary.activeRecords)} / {fmtInt(summary.deletedRecords)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e3e8ef] rounded-md p-4 shadow-xs">
          <div className="text-xs font-medium text-[#667085] uppercase tracking-wider">
            Total Assessed Tax
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-[#0b1f3a] tabular-nums">
            {fmtMoney(summary.totalTax)}
          </div>
          <div className="mt-2 pt-2 border-t border-[#eef2f6] text-xs text-[#475467] space-y-0.5 tabular-nums">
            <div className="flex justify-between">
              <span>Column:</span>
              <span className="font-mono text-[#1f4e8c]">{filters.taxColumn}</span>
            </div>
            <div className="flex justify-between">
              <span>Luxury (&gt; {data.settings.luxuryThresholdSqm} sq m):</span>
              <span className="font-medium text-[#0b1f3a]">
                {fmtInt(summary.luxuryCount)} (
                {summary.countedRecords > 0
                  ? fmtPct((100 * summary.luxuryCount) / summary.countedRecords)
                  : '—'}
                )
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e3e8ef] rounded-md p-4 shadow-xs">
          <div className="text-xs font-medium text-[#667085] uppercase tracking-wider">
            Date Quality &amp; Solar Adoption
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-[#0b1f3a] tabular-nums">
            {fmtInt(summary.hasSolarCount)}{' '}
            <span className="text-sm font-normal text-[#667085]">with solar</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#eef2f6] text-xs text-[#475467] space-y-0.5 tabular-nums">
            <div className="flex justify-between">
              <span>Missing / zero dates:</span>
              <button
                type="button"
                onClick={() => onFilterChange({ year: filters.year === -1 ? null : -1 })}
                className="font-medium text-[#b45309] hover:underline"
              >
                {fmtInt(summary.missingDateCount)} rows
              </button>
            </div>
            <div className="flex justify-between">
              <span>Solar unknown:</span>
              <span>{fmtInt(summary.solarUnknownCount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Flat / House / Unk:</span>
              <span>
                {fmtInt(summary.flatCount)} / {fmtInt(summary.houseCount)} /{' '}
                {fmtInt(summary.dwellingUnknownCount)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e3e8ef] rounded-md p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#667085] uppercase tracking-wider">
              {ovForecast.forecastYear} Forecast (Est.)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#eef3fa] text-[#1f4e8c] text-[10px] font-semibold uppercase">
              Estimate
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-[#0e7c86] tabular-nums">
            {ovForecast.canForecast && ovForecast.tax
              ? fmtMoney(ovForecast.tax.expected)
              : 'Insufficient data'}
          </div>
          <div className="mt-2 pt-2 border-t border-[#eef2f6] text-xs text-[#475467] space-y-0.5 tabular-nums">
            <div className="flex justify-between">
              <span>P(Tax &gt; {ovForecast.latestCompleteYear ?? 'latest'}):</span>
              <span className="font-semibold text-[#0b1f3a]">
                {ovForecast.probTaxHigherThanLatest !== null
                  ? fmtPct(ovForecast.probTaxHigherThanLatest * 100)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Expected count:</span>
              <span className="font-medium text-[#0b1f3a]">
                {ovForecast.canForecast && ovForecast.count
                  ? fmtInt(ovForecast.count.expected)
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Year-Wise View */}
      <section aria-label="Year-wise Applications and Tax" className="bg-white border border-[#e3e8ef] rounded-md shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#e3e8ef] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#0b1f3a] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#1f4e8c]" />
              <span>1. Year-Wise View — Applications &amp; Total Tax</span>
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Year derived from setting <strong className="text-[#1d2939]">{filters.yearColumn}</strong>.{' '}
              {filters.includeDeleted
                ? 'Deleted rows are included.'
                : 'Deleted rows (appln_delete ≠ 0) are excluded.'}{' '}
              Missing / zero-date records (<code>0000-00-00</code>) reported separately:{' '}
              <strong className="text-[#b45309] tabular-nums">{fmtInt(summary.missingDateCount)}</strong>.
            </p>
          </div>
          <div className="text-xs text-[#475467] bg-[#f9fafb] border border-[#e3e8ef] rounded px-2.5 py-1">
            Year-wise sum:{' '}
            <strong className="tabular-nums text-[#0b1f3a]">
              {fmtInt(yearWise.reduce((s, r) => s + r.count, 0))}
            </strong>{' '}
            + Missing dates:{' '}
            <strong className="tabular-nums text-[#b45309]">{fmtInt(summary.missingDateCount)}</strong>{' '}
            = <strong className="tabular-nums text-[#0b1f3a]">{fmtInt(summary.countedRecords)}</strong>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7">
            {yearWise.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-[#667085] border border-dashed border-[#cfd6e0] rounded">
                No dated records match the selected filters.
              </div>
            ) : (
              <ChartCanvas
                id="year-wise-chart"
                config={yearWiseChartConfig}
                height={290}
                ariaLabel="Bar and line chart of applications and total tax by year"
              />
            )}
          </div>

          <div className="lg:col-span-5 overflow-x-auto border border-[#e3e8ef] rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                <tr>
                  <th className="py-2 px-3 font-semibold">Year</th>
                  <th className="py-2 px-3 font-semibold text-right">Applications</th>
                  <th className="py-2 px-3 font-semibold text-right">Total Tax</th>
                  <th className="py-2 px-3 font-semibold text-right">Avg Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f6] tabular-nums">
                {yearWise.map((row) => (
                  <tr
                    key={row.year}
                    className={`hover:bg-[#f9fafb] ${
                      filters.year === row.year ? 'bg-[#eef3fa]' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-medium text-[#0b1f3a]">
                      <button
                        type="button"
                        onClick={() =>
                          onFilterChange({ year: filters.year === row.year ? null : row.year })
                        }
                        className="hover:underline text-left"
                      >
                        {row.year}
                      </button>
                      {row.isPartialYear && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] font-semibold">
                          Partial
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">{fmtInt(row.count)}</td>
                    <td className="py-2 px-3 text-right font-medium">{fmtMoney(row.totalTax)}</td>
                    <td className="py-2 px-3 text-right text-[#667085]">
                      {row.count > 0 ? fmtMoney(row.totalTax / row.count) : '—'}
                    </td>
                  </tr>
                ))}
                {summary.missingDateCount > 0 && (
                  <tr className="bg-[#fffbeb]">
                    <td className="py-2 px-3 font-medium text-[#92400e]">Missing / Zero Date</td>
                    <td className="py-2 px-3 text-right font-medium text-[#92400e]">
                      {fmtInt(summary.missingDateCount)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#92400e]" colSpan={2}>
                      Excluded from trend year
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 2: Income-Wise View (Proxy) */}
      <section aria-label="Income-wise Tax Band Proxy" className="bg-white border border-[#e3e8ef] rounded-md shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#e3e8ef] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#0b1f3a]">
              2. {taxBands.proxyLabel}
            </h3>
            <p className="text-xs text-[#667085] mt-0.5 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#1f4e8c] shrink-0" />
              <span>
                No applicant income column exists in <code>kbt_form2_appln_verified</code>; using
                configurable tax bands on <strong className="text-[#1d2939]">{taxBands.taxColumn}</strong>{' '}
                as an explicit proxy.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateSettings}
            className="text-xs font-medium text-[#1f4e8c] hover:underline"
          >
            Edit band thresholds →
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-6">
            <ChartCanvas
              id="tax-bands-chart"
              config={taxBandsChartConfig}
              height={260}
              ariaLabel="Bar chart of applications and total tax by configurable tax-amount band"
            />
          </div>

          <div className="lg:col-span-6 overflow-x-auto border border-[#e3e8ef] rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                <tr>
                  <th className="py-2 px-3 font-semibold">Band (Proxy, Not Income)</th>
                  <th className="py-2 px-3 font-semibold text-right">Range (₹)</th>
                  <th className="py-2 px-3 font-semibold text-right">Applications</th>
                  <th className="py-2 px-3 font-semibold text-right">Share</th>
                  <th className="py-2 px-3 font-semibold text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f6] tabular-nums">
                {taxBands.rows.map((b) => (
                  <tr key={b.id} className="hover:bg-[#f9fafb]">
                    <td className="py-2 px-3 font-medium text-[#0b1f3a]">{b.label}</td>
                    <td className="py-2 px-3 text-right text-[#667085]">
                      {b.min.toLocaleString('en-IN')} –{' '}
                      {b.max === null ? '∞' : b.max.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 text-right">{fmtInt(b.count)}</td>
                    <td className="py-2 px-3 text-right">{fmtPct(b.sharePct)}</td>
                    <td className="py-2 px-3 text-right font-medium">{fmtMoney(b.totalTax)}</td>
                  </tr>
                ))}
                {taxBands.unclassifiedCount > 0 && (
                  <tr className="bg-[#fffbeb]">
                    <td className="py-2 px-3 font-medium text-[#92400e]" colSpan={2}>
                      Outside configured band ranges
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-[#92400e]">
                      {fmtInt(taxBands.unclassifiedCount)}
                    </td>
                    <td className="py-2 px-3 text-right" colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 3: Next-Year Tax Forecast with Probability */}
      <section aria-label="Next-Year Tax Forecast" className="bg-white border border-[#e3e8ef] rounded-md shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#e3e8ef] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#0b1f3a] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0e7c86]" />
              <span>3. Next-Year Tax &amp; Application Forecast (Probabilistic Estimate)</span>
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Method: <strong className="text-[#1d2939]">{forecast.methodName}</strong>.{' '}
              {forecast.methodRationale}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Forecast metric"
              value={forecastMetric}
              onChange={(e) => setForecastMetric(e.target.value as 'tax' | 'count')}
              className="h-8 px-2.5 rounded border border-[#cfd6e0] bg-white text-xs text-[#1d2939]"
            >
              <option value="tax">Metric: Total Tax (₹)</option>
              <option value="count">Metric: Application Count</option>
            </select>

            <select
              aria-label="Partial year handling"
              value={filters.partialYearMode}
              onChange={(e) => onFilterChange({ partialYearMode: e.target.value as PartialYearMode })}
              className="h-8 px-2.5 rounded border border-[#cfd6e0] bg-white text-xs text-[#1d2939]"
            >
              <option value="exclude">Partial year: Exclude</option>
              <option value="annualise">Partial year: Annualise</option>
            </select>

            <select
              aria-label="Split forecast by segment"
              value={filters.forecastSplit}
              onChange={(e) => onFilterChange({ forecastSplit: e.target.value as ForecastSplit })}
              className="h-8 px-2.5 rounded border border-[#cfd6e0] bg-white text-xs text-[#1d2939]"
            >
              <option value="overall">Split: Overall</option>
              <option value="solar">Split: By Solar Panel</option>
              <option value="dwelling">Split: By Dwelling Type</option>
            </select>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded bg-[#f9fafb] border border-[#e3e8ef] text-xs text-[#475467]">
            <span>
              <strong>Notice:</strong> {forecast.estimateNotice}{' '}
              {ovForecast.partialYearNote && <span>· {ovForecast.partialYearNote}</span>}
            </span>
            <span>
              Fit observations: <strong className="text-[#0b1f3a]">{ovForecast.fitPointCount}</strong>
            </span>
          </div>

          {ovForecast.lowSampleWarning && (
            <div
              role="status"
              className="flex items-start gap-2.5 p-3 rounded border border-[#f7d08a] bg-[#fffbeb] text-xs text-[#92400e]"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Weak Forecast Warning:</strong>{' '}
                {ovForecast.lowSampleMessage ||
                  'Fewer than 5 yearly data points are available under the current filters.'}
              </span>
            </div>
          )}

          {ovForecast.canForecast && ovForecast.tax && ovForecast.count ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
                <div className="p-3 rounded border border-[#e3e8ef] bg-[#f9fafb]">
                  <div className="text-[11px] font-medium text-[#667085] uppercase">
                    Expected {ovForecast.forecastYear} Tax (Est.)
                  </div>
                  <div className="text-lg font-semibold text-[#0b1f3a] mt-0.5">
                    {fmtMoney(ovForecast.tax.expected)}
                  </div>
                  <div className="text-[11px] text-[#475467] mt-1">
                    80% PI: {fmtMoney(ovForecast.tax.lower80)} – {fmtMoney(ovForecast.tax.upper80)}
                    <br />
                    95% PI: {fmtMoney(ovForecast.tax.lower95)} – {fmtMoney(ovForecast.tax.upper95)}
                  </div>
                </div>

                <div className="p-3 rounded border border-[#e3e8ef] bg-[#f9fafb]">
                  <div className="text-[11px] font-medium text-[#667085] uppercase">
                    P(Tax &gt; {ovForecast.latestCompleteYear ?? 'Latest'})
                  </div>
                  <div className="text-lg font-semibold text-[#0e7c86] mt-0.5">
                    {ovForecast.probTaxHigherThanLatest !== null
                      ? fmtPct(ovForecast.probTaxHigherThanLatest * 100)
                      : '—'}
                  </div>
                  <div className="text-[11px] text-[#475467] mt-1">
                    Latest complete ({ovForecast.latestCompleteYear ?? '—'}):{' '}
                    {fmtMoney(ovForecast.latestCompleteTax)}
                  </div>
                </div>

                <div className="p-3 rounded border border-[#e3e8ef] bg-[#f9fafb]">
                  <div className="text-[11px] font-medium text-[#667085] uppercase">
                    Expected {ovForecast.forecastYear} Apps (Est.)
                  </div>
                  <div className="text-lg font-semibold text-[#0b1f3a] mt-0.5">
                    {fmtInt(ovForecast.count.expected)}
                  </div>
                  <div className="text-[11px] text-[#475467] mt-1">
                    80% PI: {fmtInt(ovForecast.count.lower80)} – {fmtInt(ovForecast.count.upper80)}
                    <br />
                    95% PI: {fmtInt(ovForecast.count.lower95)} – {fmtInt(ovForecast.count.upper95)}
                  </div>
                </div>

                <div className="p-3 rounded border border-[#e3e8ef] bg-[#f9fafb]">
                  <div className="text-[11px] font-medium text-[#667085] uppercase">
                    Estimated Annual Trend
                  </div>
                  <div className="text-lg font-semibold text-[#0b1f3a] mt-0.5">
                    {ovForecast.tax.slopePerYear >= 0 ? '+' : ''}
                    {fmtMoney(ovForecast.tax.slopePerYear)} / yr
                  </div>
                  <div className="text-[11px] text-[#475467] mt-1">
                    Count slope: {ovForecast.count.slopePerYear >= 0 ? '+' : ''}
                    {ovForecast.count.slopePerYear.toFixed(1)} apps/yr
                  </div>
                </div>
              </div>

              <ChartCanvas
                id="forecast-line-chart"
                config={forecastChartConfig}
                height={300}
                ariaLabel="Forecast line chart with historical totals, expected forecast, and 80% and 95% prediction intervals"
              />
            </>
          ) : (
            <div className="p-6 text-center text-sm text-[#667085] border border-dashed border-[#cfd6e0] rounded">
              {ovForecast.reason || 'Insufficient yearly history to compute a forecast.'}
            </div>
          )}

          {/* Segmented Forecast Split Table */}
          {forecast.segments.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#475467] mb-2">
                Segmented Forecast Breakdown ({filters.forecastSplit === 'solar' ? 'Solar Panel' : 'Dwelling Type'}) — Estimates Only
              </h4>
              <div className="overflow-x-auto border border-[#e3e8ef] rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Segment</th>
                      <th className="py-2 px-3 font-semibold text-right">Fit Years</th>
                      <th className="py-2 px-3 font-semibold text-right">Latest Complete Tax</th>
                      <th className="py-2 px-3 font-semibold text-right">Expected Tax (Est.)</th>
                      <th className="py-2 px-3 font-semibold text-right">80% Interval</th>
                      <th className="py-2 px-3 font-semibold text-right">95% Interval</th>
                      <th className="py-2 px-3 font-semibold text-right">P(&gt; Latest)</th>
                      <th className="py-2 px-3 font-semibold text-right">Expected Apps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f6] tabular-nums">
                    {forecast.segments.map((seg) => (
                      <tr key={seg.segmentKey} className="hover:bg-[#f9fafb]">
                        <td className="py-2 px-3 font-medium text-[#0b1f3a]">
                          {seg.segmentLabel}
                          {seg.lowSampleWarning && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] font-semibold">
                              &lt;5 yrs
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">{seg.fitPointCount}</td>
                        <td className="py-2 px-3 text-right">{fmtMoney(seg.latestCompleteTax)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-[#0e7c86]">
                          {seg.canForecast && seg.tax ? fmtMoney(seg.tax.expected) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-[#475467]">
                          {seg.canForecast && seg.tax
                            ? `${fmtMoney(seg.tax.lower80)} – ${fmtMoney(seg.tax.upper80)}`
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-[#667085]">
                          {seg.canForecast && seg.tax
                            ? `${fmtMoney(seg.tax.lower95)} – ${fmtMoney(seg.tax.upper95)}`
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {seg.probTaxHigherThanLatest !== null
                            ? fmtPct(seg.probTaxHigherThanLatest * 100)
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {seg.canForecast && seg.count ? fmtInt(seg.count.expected) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 4 & 5: Solar Panel & Flat vs House Segmentation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Solar Panel Donut + Quick Filter */}
        <section
          aria-label="Solar Panel Segmentation"
          className="lg:col-span-5 bg-white border border-[#e3e8ef] rounded-md shadow-xs"
        >
          <div className="px-5 py-3.5 border-b border-[#e3e8ef] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0b1f3a] flex items-center gap-2">
              <Sun className="w-4 h-4 text-[#0e7c86]" />
              <span>4. Solar Panel (`appln_solar`)</span>
            </h3>
            {filters.solar !== 'all' && (
              <button
                type="button"
                onClick={() => onFilterChange({ solar: 'all' })}
                className="text-xs text-[#1f4e8c] hover:underline"
              >
                Clear solar filter
              </button>
            )}
          </div>
          <div className="p-5 space-y-4">
            <ChartCanvas
              id="solar-donut-chart"
              config={solarDonutConfig}
              height={220}
              ariaLabel="Donut chart of applications by solar panel installation status"
            />
            <div className="overflow-x-auto border border-[#e3e8ef] rounded">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Segment</th>
                    <th className="py-2 px-3 font-semibold text-right">Apps</th>
                    <th className="py-2 px-3 font-semibold text-right">Share</th>
                    <th className="py-2 px-3 font-semibold text-right">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6] tabular-nums">
                  {solarBreakdown.map((s) => {
                    const segKey = s.key as SolarSegment;
                    const active = filters.solar === segKey;
                    return (
                      <tr key={s.key} className={active ? 'bg-[#eef3fa]' : 'hover:bg-[#f9fafb]'}>
                        <td className="py-2 px-3 font-medium text-[#0b1f3a]">
                          <button
                            type="button"
                            onClick={() =>
                              onFilterChange({ solar: active ? 'all' : segKey })
                            }
                            className="hover:underline text-left"
                          >
                            {s.label}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-right">{fmtInt(s.count)}</td>
                        <td className="py-2 px-3 text-right">{fmtPct(s.sharePct)}</td>
                        <td className="py-2 px-3 text-right font-medium">{fmtMoney(s.totalTax)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Cross-Tab & Stacked Dwelling Type Chart */}
        <section
          aria-label="Dwelling Type and Cross-Tab"
          className="lg:col-span-7 bg-white border border-[#e3e8ef] rounded-md shadow-xs"
        >
          <div className="px-5 py-3.5 border-b border-[#e3e8ef] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#0b1f3a]">
              5. Flat vs House (`appln_flat_yesno`) &amp; Solar Cross-Tab
            </h3>
            <div className="flex items-center gap-2">
              <select
                aria-label="Stacked chart metric"
                value={stackedMetric}
                onChange={(e) => setStackedMetric(e.target.value as 'count' | 'tax')}
                className="h-8 px-2 rounded border border-[#cfd6e0] bg-white text-xs text-[#1d2939]"
              >
                <option value="count">Stacked: Applications</option>
                <option value="tax">Stacked: Total Tax (₹)</option>
              </select>
              {filters.dwelling !== 'all' && (
                <button
                  type="button"
                  onClick={() => onFilterChange({ dwelling: 'all' })}
                  className="text-xs text-[#1f4e8c] hover:underline"
                >
                  Clear dwelling filter
                </button>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            <ChartCanvas
              id="dwelling-stacked-chart"
              config={dwellingStackedConfig}
              height={220}
              ariaLabel="Year-wise stacked bar chart by dwelling type (Flat, House, Unknown)"
            />

            <div className="grid grid-cols-1 gap-3">
              <div className="overflow-x-auto border border-[#e3e8ef] rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Solar × Dwelling Cross-Tab</th>
                      <th className="py-2 px-3 font-semibold text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onFilterChange({
                              dwelling:
                                filters.dwelling === 'flat' ? 'all' : ('flat' as DwellingSegment),
                            })
                          }
                          className="hover:underline"
                        >
                          Flat
                        </button>
                      </th>
                      <th className="py-2 px-3 font-semibold text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onFilterChange({
                              dwelling:
                                filters.dwelling === 'house' ? 'all' : ('house' as DwellingSegment),
                            })
                          }
                          className="hover:underline"
                        >
                          House
                        </button>
                      </th>
                      <th className="py-2 px-3 font-semibold text-right">Unknown</th>
                      <th className="py-2 px-3 font-semibold text-right">Row Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f6] tabular-nums">
                    {crossTab.rows.map((r) => (
                      <tr key={r.solarKey} className="hover:bg-[#f9fafb]">
                        <td className="py-2 px-3 font-medium text-[#0b1f3a]">{r.solarLabel}</td>
                        <td className="py-2 px-3 text-right">{fmtInt(r.flat)}</td>
                        <td className="py-2 px-3 text-right">{fmtInt(r.house)}</td>
                        <td className="py-2 px-3 text-right">{fmtInt(r.unknown)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-[#0b1f3a]">
                          {fmtInt(r.total)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#f9fafb] font-semibold text-[#0b1f3a] border-t border-[#cfd6e0]">
                      <td className="py-2 px-3">Column Total</td>
                      <td className="py-2 px-3 text-right">{fmtInt(crossTab.colTotals.flat)}</td>
                      <td className="py-2 px-3 text-right">{fmtInt(crossTab.colTotals.house)}</td>
                      <td className="py-2 px-3 text-right">{fmtInt(crossTab.colTotals.unknown)}</td>
                      <td className="py-2 px-3 text-right">{fmtInt(crossTab.colTotals.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-[#475467] tabular-nums">
                {dwellingBreakdown.map((d) => (
                  <span key={d.key} className="px-2.5 py-1 rounded bg-[#f9fafb] border border-[#e3e8ef]">
                    <strong>{d.label}:</strong> {fmtInt(d.count)} ({fmtPct(d.sharePct)}) ·{' '}
                    {fmtMoney(d.totalTax)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Existing DashLite Breakdowns: District, Status, Pointer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section aria-label="District Breakdown" className="lg:col-span-6 bg-white border border-[#e3e8ef] rounded-md shadow-xs">
          <div className="px-5 py-3.5 border-b border-[#e3e8ef]">
            <h3 className="text-sm font-semibold text-[#0b1f3a]">By District (Filtered)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                <tr>
                  <th className="py-2 px-4 font-semibold">District</th>
                  <th className="py-2 px-4 font-semibold text-right">Apps</th>
                  <th className="py-2 px-4 font-semibold text-right">Luxury</th>
                  <th className="py-2 px-4 font-semibold text-right">Total Tax</th>
                  <th className="py-2 px-4 font-semibold text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f6] tabular-nums">
                {data.districts.map((d) => (
                  <tr
                    key={d.id}
                    className={filters.district === d.id ? 'bg-[#eef3fa]' : 'hover:bg-[#f9fafb]'}
                  >
                    <td className="py-2 px-4 font-medium text-[#0b1f3a]">
                      <button
                        type="button"
                        onClick={() =>
                          onFilterChange({
                            district: filters.district === d.id ? null : d.id,
                            taluk: null,
                            village: null,
                          })
                        }
                        className="hover:underline text-left"
                      >
                        {d.name}
                      </button>
                    </td>
                    <td className="py-2 px-4 text-right">{fmtInt(d.count)}</td>
                    <td className="py-2 px-4 text-right">{fmtInt(d.luxuryCount)}</td>
                    <td className="py-2 px-4 text-right font-medium">{fmtMoney(d.totalTax)}</td>
                    <td className="py-2 px-4 text-right">{fmtPct(d.sharePct)}</td>
                  </tr>
                ))}
                {data.districts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 px-4 text-center text-[#667085]">
                      No matching districts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Status and Stage Breakdown" className="lg:col-span-6 space-y-5">
          <div className="bg-white border border-[#e3e8ef] rounded-md shadow-xs">
            <div className="px-5 py-3.5 border-b border-[#e3e8ef]">
              <h3 className="text-sm font-semibold text-[#0b1f3a]">By Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                  <tr>
                    <th className="py-2 px-4 font-semibold">Status</th>
                    <th className="py-2 px-4 font-semibold text-right">Apps</th>
                    <th className="py-2 px-4 font-semibold text-right">Total Tax</th>
                    <th className="py-2 px-4 font-semibold text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6] tabular-nums">
                  {data.statuses.map((s) => (
                    <tr key={s.code} className="hover:bg-[#f9fafb]">
                      <td className="py-2 px-4 font-medium text-[#0b1f3a]">{s.label}</td>
                      <td className="py-2 px-4 text-right">{fmtInt(s.count)}</td>
                      <td className="py-2 px-4 text-right font-medium">{fmtMoney(s.totalTax)}</td>
                      <td className="py-2 px-4 text-right">{fmtPct(s.sharePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-[#e3e8ef] rounded-md shadow-xs">
            <div className="px-5 py-3.5 border-b border-[#e3e8ef]">
              <h3 className="text-sm font-semibold text-[#0b1f3a]">By Stage (Pointer)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                  <tr>
                    <th className="py-2 px-4 font-semibold">Stage</th>
                    <th className="py-2 px-4 font-semibold text-right">Apps</th>
                    <th className="py-2 px-4 font-semibold text-right">Total Tax</th>
                    <th className="py-2 px-4 font-semibold text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6] tabular-nums">
                  {data.pointers.map((p) => (
                    <tr key={p.code} className="hover:bg-[#f9fafb]">
                      <td className="py-2 px-4 font-medium text-[#0b1f3a]">{p.label}</td>
                      <td className="py-2 px-4 text-right">{fmtInt(p.count)}</td>
                      <td className="py-2 px-4 text-right font-medium">{fmtMoney(p.totalTax)}</td>
                      <td className="py-2 px-4 text-right">{fmtPct(p.sharePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
