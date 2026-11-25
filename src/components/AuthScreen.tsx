import { useEffect, useState, type FormEvent } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Building2, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { UserRole } from '../lib/kbt-types';

export interface LocalAuthSession {
  token: string;
  user: {
    id: number;
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
  };
}

interface AuthScreenProps {
  externalError?: string | null;
  onLocalAuthenticated: (session: LocalAuthSession) => void;
}

type AuthMode = 'setup' | 'login' | 'register';

export function AuthScreen({ externalError, onLocalAuthenticated }: AuthScreenProps) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (!res.ok) {
          if (!cancelled) {
            setNeedsSetup(false);
            setMode('login');
          }
          return;
        }
        const data = (await res.json()) as { needsSetup?: boolean };
        if (!cancelled) {
          const setupRequired = Boolean(data.needsSetup);
          setNeedsSetup(setupRequired);
          setMode(setupRequired ? 'setup' : 'login');
        }
      } catch {
        if (!cancelled) {
          setNeedsSetup(false);
          setMode('login');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLocalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if ((mode === 'setup' || mode === 'register') && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (mode === 'login' && password.length === 0) {
      setError('Please enter your password.');
      return;
    }

    setBusy(true);
    try {
      const endpoint =
        mode === 'setup'
          ? '/api/auth/setup'
          : mode === 'register'
            ? '/api/auth/register'
            : '/api/auth/login';

      const body =
        mode === 'login'
          ? { email: trimmedEmail, password }
          : { email: trimmedEmail, displayName: displayName.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Authentication failed.');
      }
      onLocalAuthenticated(payload as LocalAuthSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(msg);
    } finally {
      setGoogleBusy(false);
    }
  };

  const displayError = error || externalError;

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-[#e3e8ef] rounded-md shadow-sm overflow-hidden">
        <div className="bg-[#0b1f3a] px-6 py-5 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#1f4e8c] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Enterprise Revenue Portal
            </div>
            <h1 className="text-lg font-semibold leading-tight">
              Building Tax (KBT) Analytics
            </h1>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {needsSetup ? (
            <div className="p-3 rounded border border-[#cfd6e0] bg-[#eef3fa] text-xs text-[#1d2939] leading-relaxed">
              <strong className="text-[#0b1f3a]">Initial Administrator Setup:</strong> Create the
              first administrator account for this local KBT workspace. This one-time setup locks
              automatically once claimed.
            </div>
          ) : (
            <div className="flex border-b border-[#e3e8ef] -mt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  mode === 'login'
                    ? 'border-[#1f4e8c] text-[#1f4e8c]'
                    : 'border-transparent text-[#667085] hover:text-[#0b1f3a]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  mode === 'register'
                    ? 'border-[#1f4e8c] text-[#1f4e8c]'
                    : 'border-transparent text-[#667085] hover:text-[#0b1f3a]'
                }`}
              >
                Register Account
              </button>
            </div>
          )}

          {displayError && (
            <div
              role="alert"
              className="p-3 rounded border border-[#f5c2c0] bg-[#fef3f2] text-xs text-[#b42318]"
            >
              {displayError}
            </div>
          )}

          <form onSubmit={handleLocalSubmit} className="space-y-3" noValidate>
            {(mode === 'setup' || mode === 'register') && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-medium text-[#475467] mb-1"
                >
                  Full Name
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={mode === 'setup' ? 'Revenue Admin' : 'Your Name'}
                  className="w-full h-9 px-3 rounded border border-[#cfd6e0] text-sm text-[#1d2939]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-[#475467] mb-1"
              >
                Work Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@kerala.gov.in"
                className="w-full h-9 px-3 rounded border border-[#cfd6e0] text-sm text-[#1d2939]"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-[#475467] mb-1"
              >
                Password {mode !== 'login' && <span className="text-[#667085]">(min 8 chars)</span>}
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-9 px-3 rounded border border-[#cfd6e0] text-sm text-[#1d2939]"
              />
            </div>

            <button
              type="submit"
              disabled={busy || googleBusy || needsSetup === null}
              className="w-full h-10 px-4 rounded-md bg-[#1f4e8c] hover:bg-[#173c6d] disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {mode === 'setup' ? (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>{busy ? 'Creating Admin...' : 'Claim Admin Account'}</span>
                </>
              ) : mode === 'register' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{busy ? 'Creating Account...' : 'Create Account'}</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>{busy ? 'Signing In...' : 'Sign In'}</span>
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-[#e3e8ef]" />
            <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-[#667085]">
              or
            </span>
            <div className="flex-grow border-t border-[#e3e8ef]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy || googleBusy}
            className="w-full h-9 px-4 rounded-md bg-white hover:bg-[#f9fafb] border border-[#cfd6e0] disabled:opacity-60 text-[#1d2939] text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <span>{googleBusy ? 'Authenticating...' : 'Continue with Google'}</span>
          </button>

          <div className="pt-3 border-t border-[#eef2f6] flex items-center justify-between text-xs text-[#667085]">
            <span>Local SQLite · Role-based access</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0e7c86]" />
              <span>PII-protected</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
