import { RotateCcw } from 'lucide-react';
import type {
  AnalyticsFilterParams,
  DwellingSegment,
  SolarSegment,
  TaxColumnOption,
  YearColumnOption,
} from '../lib/kbt-types';

export interface LookupBundle {
  districts: Array<{ id: number; name: string }>;
  taluks: Array<{ id: number; name: string }>;
  villages: Array<{ id: number; name: string }>;
  statuses: Array<{ code: number; label: string }>;
  pointers: Array<{ code: number; label: string }>;
}

interface FilterBarProps {
  filters: AnalyticsFilterParams;
  lookups: LookupBundle;
  availableYears: number[];
  rawMatchingRows?: number;
  distinctApplications?: number;
  onChange: (next: Partial<AnalyticsFilterParams>) => void;
  onReset: () => void;
}

export function FilterBar({
  filters,
  lookups,
  availableYears,
  rawMatchingRows,
  distinctApplications,
  onChange,
  onReset,
}: FilterBarProps) {
  return (
    <section
      aria-label="Global Filters and Calculation Settings"
      className="bg-white border border-[#e3e8ef] rounded-md shadow-xs p-4 mb-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#e3e8ef]">
        <div>
          <h2 className="text-sm font-semibold text-[#0b1f3a]">
            Combined Filters &amp; Calculation Settings
          </h2>
          <p className="text-xs text-[#667085]">
            All filters combine cleanly and update every KPI, chart, cross-tab, and table consistently.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {typeof rawMatchingRows === 'number' && typeof distinctApplications === 'number' && (
            <div className="text-xs bg-[#f9fafb] border border-[#e3e8ef] rounded px-2.5 py-1 tabular-nums text-[#475467]">
              Raw rows: <strong className="text-[#0b1f3a]">{rawMatchingRows.toLocaleString()}</strong>
              {' · '}
              Distinct applications:{' '}
              <strong className="text-[#0b1f3a]">{distinctApplications.toLocaleString()}</strong>
            </div>
          )}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#cfd6e0] text-[#475467] hover:bg-[#f4f6f9]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset filters</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <div>
          <label htmlFor="filter-year" className="block text-xs font-medium text-[#475467] mb-1">
            Year
          </label>
          <select
            id="filter-year"
            value={filters.year === null ? '' : String(filters.year)}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ year: v === '' ? null : Number(v) });
            }}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-white text-sm text-[#1d2939]"
          >
            <option value="">All years (incl. missing)</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                {yr}
              </option>
            ))}
            <option value="-1">Missing / zero date</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-district" className="block text-xs font-medium text-[#475467] mb-1">
            District
          </label>
          <select
            id="filter-district"
            value={filters.district === null ? '' : String(filters.district)}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                district: v === '' ? null : Number(v),
                taluk: null,
                village: null,
              });
            }}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-white text-sm text-[#1d2939]"
          >
            <option value="">All districts</option>
            {lookups.districts.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-taluk" className="block text-xs font-medium text-[#475467] mb-1">
            Taluk
          </label>
          <select
            id="filter-taluk"
            value={filters.taluk === null ? '' : String(filters.taluk)}
            disabled={filters.district === null}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ taluk: v === '' ? null : Number(v), village: null });
            }}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-white text-sm text-[#1d2939] disabled:bg-[#f4f6f9] disabled:text-[#667085]"
          >
            <option value="">All taluks</option>
            {lookups.taluks.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-village" className="block text-xs font-medium text-[#475467] mb-1">
            Village
          </label>
          <select
            id="filter-village"
            value={filters.village === null ? '' : String(filters.village)}
            disabled={filters.taluk === null}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ village: v === '' ? null : Number(v) });
            }}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-white text-sm text-[#1d2939] disabled:bg-[#f4f6f9] disabled:text-[#667085]"
          >
            <option value="">All villages</option>
            {lookups.villages.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-solar" className="block text-xs font-medium text-[#475467] mb-1">
            Solar Panel (`appln_solar`)
          </label>
          <select
            id="filter-solar"
            value={filters.solar}
            onChange={(e) => onChange({ solar: e.target.value as SolarSegment })}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-white text-sm text-[#1d2939]"
          >
            <option value="all">All solar states</option>
            <option value="has_solar">Has solar</option>
            <option value="no_solar">No solar</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-dwelling" className="block text-xs font-medium text-[#475467] mb-1">
            Dwelling (`appln_flat_yesno`)
          </label>
          <select
            id="filter-dwelling"
            value={filters.dwelling}
            onChange={(e) => onChange({ dwelling: e.target.value as DwellingSegment })}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-white text-sm text-[#1d2939]"
          >
            <option value="all">All dwelling types</option>
            <option value="flat">Flat</option>
            <option value="house">House</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-status" className="block text-xs font-medium text-[#475467] mb-1">
            Status
          </label>
          <select
            id="filter-status"
            value={filters.status === null ? '' : String(filters.status)}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ status: v === '' ? null : Number(v) });
            }}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-white text-sm text-[#1d2939]"
          >
            <option value="">Any status</option>
            {lookups.statuses.map((s) => (
              <option key={s.code} value={String(s.code)}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-pointer" className="block text-xs font-medium text-[#475467] mb-1">
            Stage (Pointer)
          </label>
          <select
            id="filter-pointer"
            value={filters.pointer === null ? '' : String(filters.pointer)}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ pointer: v === '' ? null : Number(v) });
            }}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-white text-sm text-[#1d2939]"
          >
            <option value="">Any stage</option>
            {lookups.pointers.map((p) => (
              <option key={p.code} value={String(p.code)}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="setting-year-col" className="block text-xs font-medium text-[#475467] mb-1">
            Year Source Setting
          </label>
          <select
            id="setting-year-col"
            value={filters.yearColumn}
            onChange={(e) => onChange({ yearColumn: e.target.value as YearColumnOption })}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-[#f9fafb] text-sm text-[#1d2939]"
          >
            <option value="appln_form2_date">appln_form2_date (default)</option>
            <option value="appln_year">appln_year</option>
            <option value="appln_form2_year">appln_form2_year</option>
          </select>
        </div>

        <div>
          <label htmlFor="setting-tax-col" className="block text-xs font-medium text-[#475467] mb-1">
            Tax Amount Column
          </label>
          <select
            id="setting-tax-col"
            value={filters.taxColumn}
            onChange={(e) => onChange({ taxColumn: e.target.value as TaxColumnOption })}
            className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] bg-[#f9fafb] text-sm text-[#1d2939]"
          >
            <option value="appln_tax_lump">appln_tax_lump (default)</option>
            <option value="prev_paid_amount">prev_paid_amount</option>
          </select>
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-end gap-4 pb-1">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#1d2939] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.dedupe}
              onChange={(e) => onChange({ dedupe: e.target.checked })}
              className="rounded border-[#cfd6e0]"
            />
            <span>DEDUPE (`appln_appln_id` latest row)</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#1d2939] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.luxury}
              onChange={(e) => onChange({ luxury: e.target.checked })}
              className="rounded border-[#cfd6e0]"
            />
            <span>Luxury only (&gt; 300 sq m)</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#1d2939] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.includeDeleted}
              onChange={(e) => onChange({ includeDeleted: e.target.checked })}
              className="rounded border-[#cfd6e0]"
            />
            <span>Include deleted</span>
          </label>
        </div>
      </div>
    </section>
  );
}
