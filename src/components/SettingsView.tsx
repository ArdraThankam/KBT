import { useEffect, useState } from 'react';
import { Database, Plus, Save, Shield, Trash2 } from 'lucide-react';
import type {
  KbtSettingsDTO,
  PartialYearMode,
  TaxBandConfig,
  TaxColumnOption,
  UserRole,
  YearColumnOption,
} from '../lib/kbt-types';

interface DistinctValueEntry {
  value: number | null;
  count: number;
}

interface AdminUserRow {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
}

interface SettingsViewProps {
  role: UserRole;
  settings: KbtSettingsDTO;
  distinctValues: {
    appln_solar: DistinctValueEntry[];
    appln_flat_yesno: DistinctValueEntry[];
  };
  getToken: () => Promise<string>;
  onSaved: (next: KbtSettingsDTO) => void;
}

function parseCodeList(input: string): number[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));
}

export function SettingsView({
  role,
  settings,
  distinctValues,
  getToken,
  onSaved,
}: SettingsViewProps) {
  const canEditSettings = role === 'analyst' || role === 'admin';
  const isAdmin = role === 'admin';

  const [yearColumn, setYearColumn] = useState<YearColumnOption>(settings.yearColumn);
  const [taxColumn, setTaxColumn] = useState<TaxColumnOption>(settings.taxColumn);
  const [dedupeDefault, setDedupeDefault] = useState(settings.dedupeDefault);
  const [partialYearMode, setPartialYearMode] = useState<PartialYearMode>(settings.partialYearMode);
  const [luxuryThresholdSqm, setLuxuryThresholdSqm] = useState(settings.luxuryThresholdSqm);
  const [bands, setBands] = useState<TaxBandConfig[]>(settings.bands);
  const [hasSolarCodes, setHasSolarCodes] = useState(settings.solarMapping.hasSolar.join(', '));
  const [noSolarCodes, setNoSolarCodes] = useState(settings.solarMapping.noSolar.join(', '));
  const [flatCodes, setFlatCodes] = useState(settings.dwellingMapping.flat.join(', '));
  const [houseCodes, setHouseCodes] = useState(settings.dwellingMapping.house.join(', '));

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    setYearColumn(settings.yearColumn);
    setTaxColumn(settings.taxColumn);
    setDedupeDefault(settings.dedupeDefault);
    setPartialYearMode(settings.partialYearMode);
    setLuxuryThresholdSqm(settings.luxuryThresholdSqm);
    setBands(settings.bands);
    setHasSolarCodes(settings.solarMapping.hasSolar.join(', '));
    setNoSolarCodes(settings.solarMapping.noSolar.join(', '));
    setFlatCodes(settings.dwellingMapping.flat.join(', '));
    setHouseCodes(settings.dwellingMapping.house.join(', '));
  }, [settings]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const token = await getToken();
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const payload = await res.json();
          if (!cancelled) setUsersList(payload.users || []);
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, getToken]);

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const token = await getToken();
      const body: KbtSettingsDTO = {
        yearColumn,
        taxColumn,
        dedupeDefault,
        partialYearMode,
        luxuryThresholdSqm: Number(luxuryThresholdSqm) || 300,
        bands,
        solarMapping: {
          hasSolar: parseCodeList(hasSolarCodes),
          noSolar: parseCodeList(noSolarCodes),
        },
        dwellingMapping: {
          flat: parseCodeList(flatCodes),
          house: parseCodeList(houseCodes),
        },
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save settings.');
      }
      onSaved(payload as KbtSettingsDTO);
      setMessage('Settings saved to database and applied to analytics.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleUpdate = async (uid: string, nextRole: UserRole) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });
      if (res.ok) {
        const payload = await res.json();
        setUsersList((prev) => prev.map((u) => (u.uid === uid ? payload.user : u)));
      }
    } catch {
      // handled silently
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#e3e8ef] rounded-md p-5 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e3e8ef] pb-3">
          <div>
            <h2 className="text-lg font-semibold text-[#0b1f3a]">
              Analytics Settings &amp; Configurable Tax Bands
            </h2>
            <p className="text-xs text-[#667085]">
              {canEditSettings
                ? 'Configure default columns, deduplication, tax-amount bands (income proxy), and SQL code mappings.'
                : 'Read-only view. Analyst or Admin role is required to modify persisted settings.'}
            </p>
          </div>
          {canEditSettings && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#1f4e8c] hover:bg-[#173c6d] text-white text-xs font-medium disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          )}
        </div>

        {message && (
          <div className="p-3 rounded border border-[#abefc6] bg-[#ecfdf3] text-xs text-[#067647]">
            {message}
          </div>
        )}
        {error && (
          <div role="alert" className="p-3 rounded border border-[#f5c2c0] bg-[#fef3f2] text-xs text-[#b42318]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="cfg-year-col" className="block text-xs font-medium text-[#475467] mb-1">
              Default Year Column
            </label>
            <select
              id="cfg-year-col"
              disabled={!canEditSettings}
              value={yearColumn}
              onChange={(e) => setYearColumn(e.target.value as YearColumnOption)}
              className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] text-sm bg-white disabled:bg-[#f4f6f9]"
            >
              <option value="appln_form2_date">appln_form2_date (default)</option>
              <option value="appln_year">appln_year</option>
              <option value="appln_form2_year">appln_form2_year</option>
            </select>
          </div>

          <div>
            <label htmlFor="cfg-tax-col" className="block text-xs font-medium text-[#475467] mb-1">
              Default Tax Column
            </label>
            <select
              id="cfg-tax-col"
              disabled={!canEditSettings}
              value={taxColumn}
              onChange={(e) => setTaxColumn(e.target.value as TaxColumnOption)}
              className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] text-sm bg-white disabled:bg-[#f4f6f9]"
            >
              <option value="appln_tax_lump">appln_tax_lump (default)</option>
              <option value="prev_paid_amount">prev_paid_amount</option>
            </select>
          </div>

          <div>
            <label htmlFor="cfg-partial-mode" className="block text-xs font-medium text-[#475467] mb-1">
              Default Partial-Year Mode
            </label>
            <select
              id="cfg-partial-mode"
              disabled={!canEditSettings}
              value={partialYearMode}
              onChange={(e) => setPartialYearMode(e.target.value as PartialYearMode)}
              className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] text-sm bg-white disabled:bg-[#f4f6f9]"
            >
              <option value="exclude">Exclude partial year</option>
              <option value="annualise">Annualise partial year</option>
            </select>
          </div>

          <div>
            <label htmlFor="cfg-lux-sqm" className="block text-xs font-medium text-[#475467] mb-1">
              Luxury Plinth Threshold (sq m)
            </label>
            <input
              id="cfg-lux-sqm"
              type="number"
              min={1}
              disabled={!canEditSettings}
              value={luxuryThresholdSqm}
              onChange={(e) => setLuxuryThresholdSqm(Number(e.target.value))}
              className="w-full h-9 px-2.5 rounded border border-[#cfd6e0] text-sm bg-white disabled:bg-[#f4f6f9]"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-[#1d2939]">
          <input
            type="checkbox"
            disabled={!canEditSettings}
            checked={dedupeDefault}
            onChange={(e) => setDedupeDefault(e.target.checked)}
          />
          <span>Enable DEDUPE by default (count each positive `appln_appln_id` once via latest row)</span>
        </label>

        {/* Configurable Tax-Amount Bands */}
        <div className="pt-3 border-t border-[#e3e8ef]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0b1f3a]">
                Configurable Tax-Amount Bands (Proxy, Not Income)
              </h3>
              <p className="text-xs text-[#667085]">
                Leave Max blank for an open-ended upper band (e.g. 50,001+).
              </p>
            </div>
            {canEditSettings && (
              <button
                type="button"
                onClick={() =>
                  setBands((prev) => [
                    ...prev,
                    { id: `band_${Date.now()}`, label: 'New Band', min: 0, max: null },
                  ])
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#cfd6e0] text-xs font-medium hover:bg-[#f9fafb]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Band</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-[#e3e8ef] rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                <tr>
                  <th className="py-2 px-3 font-semibold">Band Label</th>
                  <th className="py-2 px-3 font-semibold">Min (₹)</th>
                  <th className="py-2 px-3 font-semibold">Max (₹, empty = ∞)</th>
                  {canEditSettings && <th className="py-2 px-3 text-right">Remove</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f6]">
                {bands.map((b, idx) => (
                  <tr key={b.id}>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        aria-label={`Band ${idx + 1} label`}
                        disabled={!canEditSettings}
                        value={b.label}
                        onChange={(e) =>
                          setBands((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row)),
                          )
                        }
                        className="w-full h-8 px-2 rounded border border-[#cfd6e0] disabled:bg-[#f4f6f9]"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        aria-label={`Band ${idx + 1} min`}
                        disabled={!canEditSettings}
                        value={b.min}
                        onChange={(e) =>
                          setBands((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, min: Number(e.target.value) } : row,
                            ),
                          )
                        }
                        className="w-32 h-8 px-2 rounded border border-[#cfd6e0] tabular-nums disabled:bg-[#f4f6f9]"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        aria-label={`Band ${idx + 1} max`}
                        disabled={!canEditSettings}
                        value={b.max === null ? '' : b.max}
                        placeholder="∞"
                        onChange={(e) => {
                          const raw = e.target.value;
                          setBands((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, max: raw === '' ? null : Number(raw) } : row,
                            ),
                          );
                        }}
                        className="w-32 h-8 px-2 rounded border border-[#cfd6e0] tabular-nums disabled:bg-[#f4f6f9]"
                      />
                    </td>
                    {canEditSettings && (
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          aria-label={`Remove band ${b.label}`}
                          disabled={bands.length <= 1}
                          onClick={() => setBands((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 rounded text-[#b42318] hover:bg-[#fef3f2] disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distinct Values Inspection & Mapping Confirmation */}
        <div className="pt-3 border-t border-[#e3e8ef] grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="border border-[#e3e8ef] rounded p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#0b1f3a]">
              Solar Column (`appln_solar`) Distinct SQL Counts &amp; Mapping
            </h3>
            <div className="flex flex-wrap gap-2 text-xs tabular-nums">
              {distinctValues.appln_solar.map((d, i) => (
                <span key={i} className="px-2.5 py-1 rounded bg-[#f9fafb] border border-[#e3e8ef]">
                  Value <strong>{d.value === null ? 'NULL' : d.value}</strong>: {d.count.toLocaleString()} rows
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-[#475467] mb-1">
                  Codes for Has Solar
                </label>
                <input
                  type="text"
                  disabled={!canEditSettings}
                  value={hasSolarCodes}
                  onChange={(e) => setHasSolarCodes(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-[#cfd6e0] disabled:bg-[#f4f6f9]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#475467] mb-1">
                  Codes for No Solar
                </label>
                <input
                  type="text"
                  disabled={!canEditSettings}
                  value={noSolarCodes}
                  onChange={(e) => setNoSolarCodes(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-[#cfd6e0] disabled:bg-[#f4f6f9]"
                />
              </div>
            </div>
          </div>

          <div className="border border-[#e3e8ef] rounded p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#0b1f3a]">
              Dwelling Column (`appln_flat_yesno`) Distinct SQL Counts &amp; Mapping
            </h3>
            <div className="flex flex-wrap gap-2 text-xs tabular-nums">
              {distinctValues.appln_flat_yesno.map((d, i) => (
                <span key={i} className="px-2.5 py-1 rounded bg-[#f9fafb] border border-[#e3e8ef]">
                  Value <strong>{d.value === null ? 'NULL' : d.value}</strong>: {d.count.toLocaleString()} rows
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-[#475467] mb-1">Codes for Flat</label>
                <input
                  type="text"
                  disabled={!canEditSettings}
                  value={flatCodes}
                  onChange={(e) => setFlatCodes(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-[#cfd6e0] disabled:bg-[#f4f6f9]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#475467] mb-1">Codes for House</label>
                <input
                  type="text"
                  disabled={!canEditSettings}
                  value={houseCodes}
                  onChange={(e) => setHouseCodes(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-[#cfd6e0] disabled:bg-[#f4f6f9]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Indexes Reference (Read-Only Advisory) */}
      <div className="bg-white border border-[#e3e8ef] rounded-md p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#1f4e8c]" />
          <h3 className="text-sm font-semibold text-[#0b1f3a]">
            Recommended Database Indexes (for ~675,000-row Production Table)
          </h3>
        </div>
        <p className="text-xs text-[#667085]">
          Advisory DDL only — never executed automatically against production without DBA review.
        </p>
        <pre className="p-3 rounded bg-[#0b1f3a] text-[#e2e8f0] text-xs overflow-x-auto leading-relaxed">
{`-- 1. Core active/location/status filter & dashboard grouping pass
CREATE INDEX idx_kbt_del_dist_status
  ON kbt_form2_appln_verified (appln_delete, appln_dist, appln_taluk, appln_village, appln_status, appln_pointer);

-- 2. Solar & dwelling segmentation and cross-tab aggregations
CREATE INDEX idx_kbt_solar_flat
  ON kbt_form2_appln_verified (appln_delete, appln_solar, appln_flat_yesno);

-- 3. Fast deduplication (latest row per appln_appln_id via MAX(appln_id))
CREATE INDEX idx_kbt_appln_id_pk
  ON kbt_form2_appln_verified (appln_appln_id, appln_id);

-- 4. Year-wise aggregation & date range filtering
CREATE INDEX idx_kbt_form2_date
  ON kbt_form2_appln_verified (appln_delete, appln_form2_date);`}
        </pre>
      </div>

      {/* Admin Role Management */}
      {isAdmin && (
        <div className="bg-white border border-[#e3e8ef] rounded-md p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0e7c86]" />
            <h3 className="text-sm font-semibold text-[#0b1f3a]">User Role Administration</h3>
          </div>
          <div className="overflow-x-auto border border-[#e3e8ef] rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
                <tr>
                  <th className="py-2 px-3 font-semibold">User</th>
                  <th className="py-2 px-3 font-semibold">Email</th>
                  <th className="py-2 px-3 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f6]">
                {usersLoading ? (
                  <tr>
                    <td colSpan={3} className="py-4 px-3 text-center text-[#667085]">
                      Loading users...
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-2 px-3 font-medium text-[#0b1f3a]">
                        {u.displayName || '—'}
                      </td>
                      <td className="py-2 px-3 text-[#475467]">{u.email}</td>
                      <td className="py-2 px-3">
                        <select
                          aria-label={`Role for ${u.email}`}
                          value={u.role}
                          onChange={(e) => handleRoleUpdate(u.uid, e.target.value as UserRole)}
                          className="h-8 px-2 rounded border border-[#cfd6e0] bg-white text-xs"
                        >
                          <option value="viewer">viewer (analytics only)</option>
                          <option value="analyst">analyst (analytics + applicant records)</option>
                          <option value="admin">admin (full access + roles)</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
