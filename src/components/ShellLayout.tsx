import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Building2,
  FileText,
  Lock,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { UserRole } from '../lib/kbt-types';

export type ActiveTab = 'overview' | 'applications' | 'settings';

interface ShellLayoutProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user: {
    email: string;
    displayName: string;
    role: UserRole;
  };
  onSignOut: () => void;
  children: ReactNode;
}

export function ShellLayout({
  activeTab,
  onSelectTab,
  user,
  onSignOut,
  children,
}: ShellLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initials = (user.displayName || user.email || 'U')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const canViewApplications = user.role === 'analyst' || user.role === 'admin';

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof BarChart3;
    restricted?: boolean;
  }> = [
    { id: 'overview', label: 'Overview & Analytics', icon: BarChart3 },
    {
      id: 'applications',
      label: 'Applications',
      icon: FileText,
      restricted: !canViewApplications,
    },
    { id: 'settings', label: 'Settings & Roles', icon: Settings },
  ];

  const handleNav = (id: ActiveTab) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[#f4f6f9] text-[#1d2939]">
      {/* Left Enterprise Navy App Rail */}
      <aside
        aria-label="Platform modules"
        className="hidden lg:flex flex-col w-16 shrink-0 bg-[#0b1f3a] border-r border-white/10 items-center py-3 justify-between"
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-md bg-[#1f4e8c] text-white flex items-center justify-center shadow-sm"
            title="KBT Building Tax"
          >
            <Building2 className="w-5 h-5" />
          </div>
          <div className="w-8 h-px bg-white/15" />
          <button
            type="button"
            onClick={() => handleNav('overview')}
            aria-label="Building Tax Analytics"
            title="Building Tax Analytics"
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
              activeTab === 'overview'
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleNav('applications')}
            aria-label="Applications Registry"
            title={canViewApplications ? 'Applications Registry' : 'Applications (Analyst/Admin only)'}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
              activeTab === 'applications'
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleNav('settings')}
            aria-label="Configuration & Roles"
            title="Configuration & Roles"
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
              activeTab === 'settings'
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="w-10 h-10 rounded-md flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </aside>

      {/* Secondary Sidebar (Desktop) */}
      <nav
        aria-label="KBT Navigation"
        className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-[#e3e8ef]"
      >
        <div className="h-[60px] px-5 flex items-center border-b border-[#e3e8ef]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
              Enterprise Revenue
            </div>
            <div className="text-[15px] font-semibold text-[#0b1f3a]">
              Building Tax (KBT)
            </div>
          </div>
        </div>
        <div className="p-3 flex-1 space-y-1">
          <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
            Analytics & Registry
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-[#eef3fa] text-[#1f4e8c] font-semibold'
                    : 'text-[#475467] hover:bg-[#f9fafb] hover:text-[#0b1f3a]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.restricted && (
                  <Lock className="w-3.5 h-3.5 text-[#667085]" aria-label="Analyst or Admin only" />
                )}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-[#e3e8ef] bg-[#f9fafb]">
          <div className="flex items-center gap-2 text-xs text-[#475467]">
            <ShieldCheck className="w-4 h-4 text-[#0e7c86] shrink-0" />
            <span>PII-masked analytics mode</span>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav
            aria-label="Mobile Navigation"
            className="relative z-10 w-64 bg-white h-full border-r border-[#e3e8ef] flex flex-col"
          >
            <div className="h-[60px] px-4 flex items-center justify-between border-b border-[#e3e8ef]">
              <span className="font-semibold text-[#0b1f3a]">Building Tax (KBT)</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded hover:bg-[#f4f6f9]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 space-y-1 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium text-left ${
                      active
                        ? 'bg-[#eef3fa] text-[#1f4e8c] font-semibold'
                        : 'text-[#475467] hover:bg-[#f9fafb]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {item.restricted && <Lock className="w-3.5 h-3.5 text-[#667085]" />}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[60px] bg-white border-b border-[#e3e8ef] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-md text-[#475467] hover:bg-[#f4f6f9]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-[#0b1f3a] leading-tight">
                KBT Tax Analytics &amp; Registry
              </h1>
              <p className="text-xs text-[#667085] hidden sm:block">
                Form 2 Verified Building &amp; Luxury Tax Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide border ${
                user.role === 'admin'
                  ? 'bg-[#eef3fa] text-[#1f4e8c] border-[#cfd6e0]'
                  : user.role === 'analyst'
                    ? 'bg-[#e6f4f5] text-[#0e7c86] border-[#b7e1e4]'
                    : 'bg-[#f4f6f9] text-[#475467] border-[#e3e8ef]'
              }`}
            >
              Role: {user.role}
            </span>
            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-[#e3e8ef]">
              <div className="w-8 h-8 rounded-full bg-[#1f4e8c] text-white text-xs font-semibold flex items-center justify-center">
                {initials}
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-[#1d2939] leading-tight">
                  {user.displayName || user.email}
                </div>
                <div className="text-[11px] text-[#667085] leading-tight">{user.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#cfd6e0] text-[#475467] hover:bg-[#f9fafb] hover:text-[#0b1f3a] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
