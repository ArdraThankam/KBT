import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { DEFAULT_SETTINGS } from './lib/kbt-analytics';
import type {
  AnalyticsFilterParams,
  AnalyticsResponse,
  KbtSettingsDTO,
  UserRole,
} from './lib/kbt-types';
import { AuthScreen, type LocalAuthSession } from './components/AuthScreen';
import { ShellLayout, type ActiveTab } from './components/ShellLayout';
import { FilterBar, type LookupBundle } from './components/FilterBar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ApplicationsView } from './components/ApplicationsView';
import { SettingsView } from './components/SettingsView';

interface SessionUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
}

interface ExtendedLookupBundle extends LookupBundle {
  distinctValues: {
    appln_solar: Array<{ value: number | null; count: number }>;
    appln_flat_yesno: Array<{ value: number | null; count: number }>;
  };
}

function makeDefaultFilters(settings: KbtSettingsDTO): AnalyticsFilterParams {
  return {
    year: null,
    district: null,
    taluk: null,
    village: null,
    status: null,
    pointer: null,
    luxury: false,
    solar: 'all',
    dwelling: 'all',
    dedupe: settings.dedupeDefault,
    includeDeleted: false,
    yearColumn: settings.yearColumn,
    taxColumn: settings.taxColumn,
    partialYearMode: settings.partialYearMode,
    forecastSplit: 'overall',
  };
}

function buildAnalyticsQuery(filters: AnalyticsFilterParams): string {
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
  sp.set('partialYearMode', filters.partialYearMode);
  sp.set('forecastSplit', filters.forecastSplit);
  return sp.toString();
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [fbUser, setFbUser] = useState<User | null>(null);
  // Local Bearer token kept strictly in React memory (never persisted to localStorage/sessionStorage)
  const [localToken, setLocalToken] = useState<string | null>(null);
  const localTokenRef = useRef<string | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [settings, setSettings] = useState<KbtSettingsDTO>(DEFAULT_SETTINGS);
  const [filters, setFilters] = useState<AnalyticsFilterParams>(() =>
    makeDefaultFilters(DEFAULT_SETTINGS),
  );
  const [lookups, setLookups] = useState<ExtendedLookupBundle>({
    districts: [],
    taluks: [],
    villages: [],
    statuses: [],
    pointers: [],
    distinctValues: { appln_solar: [], appln_flat_yesno: [] },
  });
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const initializedDefaultsRef = useRef(false);

  const getToken = useCallback(async (): Promise<string> => {
    if (localTokenRef.current) {
      return localTokenRef.current;
    }
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Not authenticated.');
    }
    return current.getIdToken();
  }, []);

  const syncSettingsForSession = useCallback(async (token: string) => {
    const cfgRes = await fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (cfgRes.ok) {
      const cfgPayload = (await cfgRes.json()) as KbtSettingsDTO;
      setSettings(cfgPayload);
      if (!initializedDefaultsRef.current) {
        initializedDefaultsRef.current = true;
        setFilters(makeDefaultFilters(cfgPayload));
      }
    }
  }, []);

  const handleLocalAuthenticated = useCallback(
    async (session: LocalAuthSession) => {
      setAuthError(null);
      localTokenRef.current = session.token;
      setLocalToken(session.token);
      setSessionUser(session.user);
      setAuthReady(true);
      try {
        await syncSettingsForSession(session.token);
      } catch {
        // non-fatal initial settings fetch
      }
    },
    [syncSettingsForSession],
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (!user) {
        // Only clear session if there is no active local memory session
        if (!localTokenRef.current) {
          setSessionUser(null);
          setAnalytics(null);
          initializedDefaultsRef.current = false;
        }
        setAuthReady(true);
        return;
      }

      setAuthError(null);
      localTokenRef.current = null;
      setLocalToken(null);

      try {
        const token = await user.getIdToken();
        const meRes = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meRes.ok) {
          const payload = await meRes.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to verify user session.');
        }

        const mePayload = await meRes.json();
        setSessionUser(mePayload.user);
        await syncSettingsForSession(token);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Session synchronization failed.');
        setSessionUser(null);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [syncSettingsForSession]);

  const isAuthenticated = Boolean(sessionUser && (localToken || fbUser));

  // Load lookups whenever session, district, or taluk changes
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const sp = new URLSearchParams();
        if (filters.district !== null) sp.set('district', String(filters.district));
        if (filters.taluk !== null) sp.set('taluk', String(filters.taluk));
        const res = await fetch(`/api/lookups?${sp.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const payload = (await res.json()) as ExtendedLookupBundle;
        if (!cancelled) setLookups(payload);
      } catch {
        // non-fatal lookup refresh
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, filters.district, filters.taluk, getToken]);

  // Load analytics whenever session, filters, or refreshCounter changes
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      setLoadingAnalytics(true);
      setDataError(null);
      try {
        const token = await getToken();
        const qs = buildAnalyticsQuery(filters);
        const res = await fetch(`/api/analytics?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load analytics.');
        }
        const payload = (await res.json()) as AnalyticsResponse;
        if (!cancelled) {
          setAnalytics(payload);
          setSettings(payload.settings);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err instanceof Error ? err.message : 'Failed to load analytics.');
        }
      } finally {
        if (!cancelled) setLoadingAnalytics(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, filters, refreshCounter, getToken]);

  const handleFilterChange = useCallback((next: Partial<AnalyticsFilterParams>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(makeDefaultFilters(settings));
  }, [settings]);

  const handleSignOut = async () => {
    localTokenRef.current = null;
    setLocalToken(null);
    setSessionUser(null);
    setAnalytics(null);
    initializedDefaultsRef.current = false;
    setActiveTab('overview');
    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center text-sm text-[#475467]">
        Initializing KBT Analytics Portal...
      </div>
    );
  }

  if (!isAuthenticated || !sessionUser) {
    return (
      <AuthScreen
        externalError={authError}
        onLocalAuthenticated={handleLocalAuthenticated}
      />
    );
  }

  return (
    <ShellLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      user={sessionUser}
      onSignOut={handleSignOut}
    >
      {activeTab !== 'settings' && (
        <FilterBar
          filters={filters}
          lookups={lookups}
          availableYears={analytics?.availableYears ?? []}
          rawMatchingRows={analytics?.summary.rawMatchingRows}
          distinctApplications={analytics?.summary.distinctApplications}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      )}

      {dataError && (
        <div
          role="alert"
          className="mb-4 p-3 rounded border border-[#f5c2c0] bg-[#fef3f2] text-xs text-[#b42318]"
        >
          {dataError}
        </div>
      )}

      {activeTab === 'overview' &&
        (analytics ? (
          <OverviewDashboard
            data={analytics}
            filters={filters}
            loading={loadingAnalytics}
            onFilterChange={handleFilterChange}
            onRefresh={() => setRefreshCounter((c) => c + 1)}
            onNavigateSettings={() => setActiveTab('settings')}
          />
        ) : (
          <div className="bg-white border border-[#e3e8ef] rounded-md p-10 text-center text-sm text-[#667085]">
            Loading KBT Building Tax analytics...
          </div>
        ))}

      {activeTab === 'applications' && (
        <ApplicationsView
          role={sessionUser.role}
          filters={filters}
          settings={settings}
          getToken={getToken}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          role={sessionUser.role}
          settings={settings}
          distinctValues={lookups.distinctValues}
          getToken={getToken}
          onSaved={(nextCfg) => {
            setSettings(nextCfg);
            setFilters((prev) => ({
              ...prev,
              yearColumn: nextCfg.yearColumn,
              taxColumn: nextCfg.taxColumn,
              dedupe: nextCfg.dedupeDefault,
              partialYearMode: nextCfg.partialYearMode,
            }));
            setRefreshCounter((c) => c + 1);
          }}
        />
      )}
    </ShellLayout>
  );
}
