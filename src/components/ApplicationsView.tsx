import { useEffect, useState } from 'react';
import { Eye, Lock, Search, X } from 'lucide-react';
import {
  classifyDwelling,
  classifySolar,
  formatDisplayDate,
  getPointerLabel,
  getStatusLabel,
} from '../lib/kbt-analytics';
import type {
  AnalyticsFilterParams,
  ApplicationListItem,
  KbtSettingsDTO,
  UserRole,
} from '../lib/kbt-types';

interface ApplicationsViewProps {
  role: UserRole;
  filters: AnalyticsFilterParams;
  settings: KbtSettingsDTO;
  getToken: () => Promise<string>;
}

interface ApplicationDetailRecord {
  applnId: number;
  applnApplnId: number;
  applnNo: string;
  applnYear: number;
  applnForm2No: string;
  applnForm2Date: string;
  applnForm2Year: number;
  applnForm2SubmitedYesno: number;
  applnDelete: number;
  applnStatus: number;
  applnPointer: number;
  applnSolar: number | null;
  applnFlatYesno: number | null;
  applnLandtype: number;
  applnNature: number;
  applnConstrNature: number;
  applnNoofFloors: number;
  applnTaxLump: number;
  prevPaidAmount: number;
  prevPaidDate: string;
  applnTaxExemptYesno: number;
  applnReducedRateYesno: number;
  applnPaApprovedRes: number;
  applnPaCnstrctedRes: number;
  applnPaRecommendedRes: number;
  applnPaApprovedOther: number;
  applnPaCnstrctedOther: number;
  applnPaRecommendedOther: number;
  applnPaAprvd: number;
  applnPaCnstrcted: number;
  applnName: string;
  applnSurveyNo: string;
  applnBlockNo: string;
  applnSubDvsn: string;
  applnThandapperuNo: string;
  applnLsgtype: number;
  applnBuildingPermitNo: string;
  applnAssessOrderStatus: string;
  applnDemandNoticeStatus: string;
  applnAppealStatus: string;
  applnCompltnDt: string;
  applnOccupationDt: string;
  applnRemarks: string;
  districtName: string | null;
  talukName: string | null;
  villName: string | null;
  luxuryArea: number;
}

function buildFilterSearchParams(filters: AnalyticsFilterParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.year !== null) sp.set('year', String(filters.year));
  if (filters.district !== null) sp.set('district', String(filters.district));
  if (filters.taluk !== null) sp.set('taluk', String(filters.taluk));
  if (filters.village !== null) sp.set('village', String(filters.village));
  if (filters.status !== null) sp.set('status', String(filters.status));
  if (filters.pointer !== null) sp.set('pointer', String(filters.pointer));
  if (filters.luxury) sp.set('luxury', '1');
  if (filters.solar !== 'all') sp.set('solar', filters.solar);
  if (filters.dwelling !== 'all') sp.set('dwelling', filters.dwelling);
  sp.set('dedupe', filters.dedupe ? '1' : '0');
  if (filters.includeDeleted) sp.set('deleted', '1');
  sp.set('yearColumn', filters.yearColumn);
  sp.set('taxColumn', filters.taxColumn);
  return sp;
}

export function ApplicationsView({
  role,
  filters,
  settings,
  getToken,
}: ApplicationsViewProps) {
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ApplicationListItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ApplicationDetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const canAccess = role === 'analyst' || role === 'admin';

  useEffect(() => {
    setPage(1);
  }, [filters, activeSearch]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const sp = buildFilterSearchParams(filters);
        sp.set('page', String(page));
        if (activeSearch.trim().length >= 2) {
          sp.set('q', activeSearch.trim());
        }
        const res = await fetch(`/api/applications?${sp.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load applications.');
        }
        const payload = await res.json();
        if (!cancelled) {
          setRows(payload.rows || []);
          setHasNext(Boolean(payload.hasNext));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load applications.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccess, filters, page, activeSearch, getToken]);

  const openDetail = async (applnId: number) => {
    setDetailLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/applications/${applnId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load application detail.');
      }
      const detail = (await res.json()) as ApplicationDetailRecord;
      setSelectedDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="bg-white border border-[#e3e8ef] rounded-md p-8 text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-[#eef3fa] text-[#1f4e8c] flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-[#0b1f3a]">
          Applicant-Level Records Restricted
        </h2>
        <p className="text-xs text-[#475467] mt-2 leading-relaxed">
          Your account currently has the <strong>{role}</strong> role. Aggregate analytics and
          forecasts are available to all dashboard roles, while individual applicant records are
          restricted to <strong>analyst</strong> and <strong>admin</strong> roles. Ask an
          administrator in Settings &amp; Roles to upgrade your role if needed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#e3e8ef] rounded-md p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0b1f3a]">
            Applications Registry (Filtered)
          </h2>
          <p className="text-xs text-[#667085]">
            Matches all active combined filters above. Showing 25 records per page, newest first.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActiveSearch(searchInput.trim());
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="w-4 h-4 text-[#667085] absolute left-2.5 top-2.5" />
            <input
              type="text"
              aria-label="Search applications"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="App no., Form 2 no., name, survey..."
              className="h-9 w-64 pl-8 pr-3 rounded border border-[#cfd6e0] text-xs text-[#1d2939]"
            />
          </div>
          <button
            type="submit"
            className="h-9 px-3 rounded bg-[#1f4e8c] hover:bg-[#173c6d] text-white text-xs font-medium"
          >
            Search
          </button>
          {activeSearch && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setActiveSearch('');
              }}
              className="h-9 px-2.5 rounded border border-[#cfd6e0] text-xs text-[#475467] hover:bg-[#f9fafb]"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded border border-[#f5c2c0] bg-[#fef3f2] text-xs text-[#b42318]">
          {error}
        </div>
      )}

      <div className="bg-white border border-[#e3e8ef] rounded-md shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f9fafb] text-[#475467] border-b border-[#e3e8ef]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Application / Form 2 Date</th>
                <th className="py-2.5 px-3 font-semibold">Applicant</th>
                <th className="py-2 px-3 font-semibold">Location</th>
                <th className="py-2.5 px-3 font-semibold text-right">Area (sq m)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Tax ({filters.taxColumn})</th>
                <th className="py-2.5 px-3 font-semibold">Solar</th>
                <th className="py-2.5 px-3 font-semibold">Dwelling</th>
                <th className="py-2.5 px-3 font-semibold">Status / Stage</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f6] tabular-nums">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#667085]">
                    Loading applications...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#667085]">
                    No applications match the active filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const solarState = classifySolar(r.applnSolar, settings.solarMapping);
                  const dwellState = classifyDwelling(r.applnFlatYesno, settings.dwellingMapping);
                  return (
                    <tr key={r.applnId} className="hover:bg-[#f9fafb]">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#0b1f3a]">
                          {r.applnNo || r.applnId} / {r.applnYear}
                          {r.applnDelete !== 0 && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[#fee4e2] text-[#b42318]">
                              deleted
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#667085]">
                          Form 2: {formatDisplayDate(r.applnForm2Date)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#1d2939]">
                        {r.applnName || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-[#1d2939]">{r.villName}</div>
                        <div className="text-[11px] text-[#667085]">
                          {r.talukName}, {r.districtName}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-medium">{r.area.toFixed(2)}</span>
                        {r.area > settings.luxuryThresholdSqm && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] font-semibold">
                            Luxury
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-[#0b1f3a]">
                        ₹ {Math.round(r.taxAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3">
                        {solarState === 'has_solar'
                          ? 'Has Solar'
                          : solarState === 'no_solar'
                            ? 'No Solar'
                            : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-3">
                        {dwellState === 'flat'
                          ? 'Flat'
                          : dwellState === 'house'
                            ? 'House'
                            : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-[#1d2939]">{getStatusLabel(r.applnStatus)}</div>
                        <div className="text-[11px] text-[#667085]">
                          {getPointerLabel(r.applnPointer)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(r.applnId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#cfd6e0] text-[#1f4e8c] hover:bg-[#eef3fa] font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-[#e3e8ef] flex items-center justify-between text-xs text-[#475467]">
          <span>
            Page {page} {rows.length > 0 ? `(${rows.length} rows shown)` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded border border-[#cfd6e0] disabled:opacity-40 hover:bg-[#f9fafb]"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!hasNext || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded border border-[#cfd6e0] disabled:opacity-40 hover:bg-[#f9fafb]"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Application Detail Modal */}
      {(selectedDetail || detailLoading) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Application Detail"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#e3e8ef] rounded-md shadow-lg max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0b1f3a] text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/70">
                  Verified Record Detail
                </div>
                <h3 className="text-base font-semibold">
                  {selectedDetail
                    ? `Application ${selectedDetail.applnNo || selectedDetail.applnId} / ${selectedDetail.applnYear}`
                    : 'Loading record...'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close detail"
                onClick={() => setSelectedDetail(null)}
                className="p-1 rounded hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {detailLoading || !selectedDetail ? (
                <div className="py-10 text-center text-[#667085]">Loading details...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-[#e3e8ef] rounded p-3 space-y-1.5">
                      <h4 className="font-semibold text-[#0b1f3a] border-b border-[#eef2f6] pb-1 mb-2">
                        Application &amp; Status
                      </h4>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Internal PK / App Ref ID:</span>
                        <span className="font-medium tabular-nums">
                          {selectedDetail.applnId} / {selectedDetail.applnApplnId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Form 2 No. &amp; Date:</span>
                        <span className="font-medium">
                          {selectedDetail.applnForm2No || '—'} ·{' '}
                          {formatDisplayDate(selectedDetail.applnForm2Date)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Status / Stage:</span>
                        <span className="font-medium">
                          {getStatusLabel(selectedDetail.applnStatus)} /{' '}
                          {getPointerLabel(selectedDetail.applnPointer)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Completion / Occupation:</span>
                        <span>
                          {formatDisplayDate(selectedDetail.applnCompltnDt)} /{' '}
                          {formatDisplayDate(selectedDetail.applnOccupationDt)}
                        </span>
                      </div>
                    </div>

                    <div className="border border-[#e3e8ef] rounded p-3 space-y-1.5">
                      <h4 className="font-semibold text-[#0b1f3a] border-b border-[#eef2f6] pb-1 mb-2">
                        Location, Solar &amp; Dwelling
                      </h4>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Applicant Name:</span>
                        <span className="font-semibold text-[#0b1f3a]">
                          {selectedDetail.applnName || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">District / Taluk / Village:</span>
                        <span>
                          {selectedDetail.districtName || '—'} / {selectedDetail.talukName || '—'}{' '}
                          / {selectedDetail.villName || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Survey / Block / Floors:</span>
                        <span>
                          {selectedDetail.applnSurveyNo || '—'} /{' '}
                          {selectedDetail.applnBlockNo || '—'} / {selectedDetail.applnNoofFloors}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Solar / Dwelling:</span>
                        <span className="font-medium">
                          {classifySolar(selectedDetail.applnSolar, settings.solarMapping)} (code{' '}
                          {String(selectedDetail.applnSolar ?? 'null')}) ·{' '}
                          {classifyDwelling(
                            selectedDetail.applnFlatYesno,
                            settings.dwellingMapping,
                          )}{' '}
                          (code {String(selectedDetail.applnFlatYesno ?? 'null')})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-[#e3e8ef] rounded p-3 space-y-1.5">
                      <h4 className="font-semibold text-[#0b1f3a] border-b border-[#eef2f6] pb-1 mb-2">
                        Tax &amp; Payment
                      </h4>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Lump Sum Tax (`appln_tax_lump`):</span>
                        <span className="font-semibold text-[#0b1f3a] tabular-nums">
                          ₹ {Number(selectedDetail.applnTaxLump).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Previously Paid (`prev_paid_amount`):</span>
                        <span className="tabular-nums">
                          ₹ {Number(selectedDetail.prevPaidAmount).toLocaleString('en-IN')} (
                          {formatDisplayDate(selectedDetail.prevPaidDate)})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#667085]">Tax Exempt / Reduced Rate:</span>
                        <span>
                          {selectedDetail.applnTaxExemptYesno === 1 ? 'Yes' : 'No'} /{' '}
                          {selectedDetail.applnReducedRateYesno === 1 ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>

                    <div className="border border-[#e3e8ef] rounded p-3">
                      <h4 className="font-semibold text-[#0b1f3a] border-b border-[#eef2f6] pb-1 mb-2">
                        Plinth Area Matrix (sq m)
                      </h4>
                      <table className="w-full text-xs tabular-nums">
                        <thead>
                          <tr className="text-[#667085]">
                            <th className="text-left font-medium py-1">Stage</th>
                            <th className="text-right font-medium py-1">Residential</th>
                            <th className="text-right font-medium py-1">Other</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-1">Approved</td>
                            <td className="text-right">{selectedDetail.applnPaApprovedRes.toFixed(2)}</td>
                            <td className="text-right">{selectedDetail.applnPaApprovedOther.toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td className="py-1 font-medium">Constructed</td>
                            <td className="text-right font-medium">
                              {selectedDetail.applnPaCnstrctedRes.toFixed(2)}
                            </td>
                            <td className="text-right font-medium">
                              {selectedDetail.applnPaCnstrctedOther.toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1">Recommended</td>
                            <td className="text-right">
                              {selectedDetail.applnPaRecommendedRes.toFixed(2)}
                            </td>
                            <td className="text-right">
                              {selectedDetail.applnPaRecommendedOther.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-2 pt-2 border-t border-[#eef2f6] flex justify-between font-semibold text-[#0b1f3a]">
                        <span>Luxury Area Sum:</span>
                        <span>
                          {Number(selectedDetail.luxuryArea).toFixed(2)} sq m{' '}
                          {selectedDetail.luxuryArea > settings.luxuryThresholdSqm ? '(Luxury)' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
