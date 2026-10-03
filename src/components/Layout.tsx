import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  BarChart3,
  Bell,
  Briefcase,
  CalendarCheck,
  ClipboardCheck,
  Code2,
  Compass,
  FolderGit2,
  Home,
  Library,
  LogOut,
  Map as MapIcon,
  Menu,
  MessagesSquare,
  Moon,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  StickyNote,
  Sun,
  Timer,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { useUi } from '@/uiStore';
import { Button, Drawer, Tooltip, useToast } from '@/components/ui';
import { notifications } from '@/lib/progress';
import { CommandPalette } from '@/components/CommandPalette';
import { QuickAdd } from '@/components/QuickAdd';
import { TimerWidget } from '@/components/TimerWidget';
import { useAuth } from '@/services/AuthProvider';
import { signOut } from '@/services/auth';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** shown in the mobile bottom bar */
  primary?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/', label: 'Home', icon: <Home size={17} />, primary: true },
      { to: '/planner', label: 'Today', icon: <CalendarCheck size={17} />, primary: true },
      { to: '/subjects', label: 'Study', icon: <Library size={17} />, primary: true },
      { to: '/dsa', label: 'DSA Lab', icon: <Code2 size={17} />, primary: true },
      { to: '/roadmap', label: 'Roadmap', icon: <MapIcon size={17} /> },
      { to: '/revision', label: 'Revision', icon: <RotateCcw size={17} /> },
    ],
  },
  {
    label: 'Career',
    items: [
      { to: '/projects', label: 'Projects', icon: <FolderGit2 size={17} /> },
      { to: '/interviews', label: 'Interviews', icon: <MessagesSquare size={17} /> },
      { to: '/applications', label: 'Applications', icon: <Briefcase size={17} /> },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { to: '/analytics', label: 'Analytics', icon: <BarChart3 size={17} /> },
      { to: '/notes', label: 'Notes', icon: <StickyNote size={17} /> },
      { to: '/journal', label: 'Journal', icon: <NotebookPen size={17} /> },
      { to: '/review', label: 'Reviews', icon: <ClipboardCheck size={17} /> },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/archived', label: 'Archived', icon: <Archive size={17} /> },
      { to: '/settings', label: 'Settings', icon: <SettingsIcon size={17} /> },
    ],
  },
];

/** Flat list kept for compatibility with anything that expects a single array. */
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', dark);
    };
    apply();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);
}

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Compass size={size * 0.55} strokeWidth={2.2} />
    </span>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      to="/"
      className={cn('flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-raised', collapsed && 'justify-center px-0')}
      aria-label="PrepTrack home"
    >
      <LogoMark />
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-semibold tracking-tight">PrepTrack</span>
          <span className="block truncate text-[10px] font-medium uppercase tracking-wider text-content-faint">Placement OS</span>
        </span>
      )}
    </Link>
  );
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <Tooltip label={collapsed ? item.label : ''}>
      <NavLink
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
            collapsed ? 'justify-center px-0' : '',
            isActive ? 'bg-brand/[0.09] text-brand' : 'text-content-muted hover:bg-surface-raised hover:text-content',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && !collapsed && (
              <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" aria-hidden />
            )}
            <span className={cn('shrink-0 transition-colors', isActive && 'text-brand')}>{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        )}
      </NavLink>
    </Tooltip>
  );
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-2 no-scrollbar" aria-label="Primary">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="pt-3 first:pt-1">
          {!collapsed && (
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-content-faint/80">{group.label}</p>
          )}
          {collapsed && <div className="mx-2 mb-1 border-t" aria-hidden />}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavRow key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NotificationBell() {
  const data = useStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const notices = useMemo(() => notifications(data), [data]);
  return (
    <div className="relative">
      <Tooltip label="Notifications">
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label={notices.length ? `Notifications (${notices.length})` : 'Notifications'}>
          <span className="relative">
            <Bell size={17} />
            {notices.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-clay px-0.5 text-[9px] font-bold text-white">
                {notices.length > 9 ? '9+' : notices.length}
              </span>
            )}
          </span>
        </Button>
      </Tooltip>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-1 w-[19rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border bg-surface shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Notifications</span>
              <button onClick={() => setOpen(false)} className="text-content-faint hover:text-content" aria-label="Close notifications">
                <X size={14} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notices.length === 0 && <p className="px-3 py-6 text-center text-xs text-content-faint">No notifications.</p>}
              {notices.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(n.to);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-0 hover:bg-surface-muted"
                >
                  <span className="text-xs font-medium text-content">{n.title}</span>
                  <span className="text-[11px] text-content-faint">{n.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickAddMenu() {
  const { quickAddOpen, setQuickAddOpen } = useUi();
  const items = [
    { label: 'Study session', action: 'session' },
    { label: 'Task', action: 'task' },
    { label: 'Subject', action: 'subject' },
    { label: 'Topic', action: 'topic' },
    { label: 'DSA problem', action: 'problem' },
    { label: 'DSA session', action: 'dsaSession' },
    { label: 'Project', action: 'project' },
    { label: 'Note', action: 'note' },
    { label: 'Interview question', action: 'question' },
    { label: 'Mock interview', action: 'mock' },
    { label: 'Application', action: 'application' },
    { label: 'Goal', action: 'goal' },
    { label: 'STAR story', action: 'story' },
  ];
  return (
    <>
      <Tooltip label="Quick add">
        <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setQuickAddOpen(true)} aria-label="Quick add">
          <span className="hidden sm:inline">Add</span>
        </Button>
      </Tooltip>
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} presets={items} />
    </>
  );
}

const MOBILE_ITEMS = NAV.filter((n) => n.primary);
// Mobile "More" menu items (used by the bottom nav overflow).

export function AppShell({ children }: { children: ReactNode }) {
  const theme = useStore((s) => s.settings.theme);
  const updateSettings = useStore((s) => s.updateSettings);
  const collapsedPref = useStore((s) => s.settings.sidebarCollapsed);
  const { commandOpen, setCommandOpen, mobileNavOpen, setMobileNavOpen, setQuickAddOpen, timerOpen } = useUi();
  const location = useLocation();
  const toast = useToast();
  useTheme();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, setMobileNavOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (typing) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setQuickAddOpen(true);
      }
      if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        toast.push('Shortcuts: Ctrl+K search · N quick add', { tone: 'default' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandOpen, setQuickAddOpen, toast]);

  const collapsed = collapsedPref;
  const toggleTheme = () => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' });

  const { user, localMode } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const account = user;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    const error = await signOut();
    if (error) {
      setSigningOut(false);
      toast.push(error.message, { tone: 'error' });
    }
  }

  return (
    <div className="min-h-screen">
      {/* Desktop / tablet sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-surface transition-all duration-200 md:flex',
          collapsed ? 'w-[68px]' : 'w-[240px]',
        )}
      >
        <div className={cn('px-2 pb-1 pt-2.5', collapsed && 'px-2.5')}>
          <Brand collapsed={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className="border-t px-2 py-2">
          {account && !localMode && (
            <>
              {!collapsed && account.email && (
                <p className="truncate px-2.5 pb-1.5 text-[11px] text-content-faint" title={account.email}>
                  {account.email}
                </p>
              )}
              <Tooltip label={collapsed ? account.email ?? 'Account' : ''}>
              <button
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-content-faint transition-colors hover:bg-surface-raised hover:text-content disabled:opacity-60',
                  collapsed && 'justify-center px-0',
                )}
                aria-label="Sign out"
              >
                <LogOut size={17} />
                {!collapsed && <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>}
              </button>
              </Tooltip>
            </>
          )}
          <Tooltip label={collapsed ? 'Expand sidebar' : ''}>
            <button
              onClick={() => updateSettings({ sidebarCollapsed: !collapsedPref })}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-content-faint transition-colors hover:bg-surface-raised hover:text-content',
                collapsed && 'justify-center px-0',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Main area */}
      <div className={cn('flex min-h-screen flex-col transition-all duration-200 md:pl-[68px]', !collapsed && 'md:pl-[240px]')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-surface/90 px-3 backdrop-blur sm:px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </Button>
          <Link to="/" className="flex items-center gap-2 md:hidden">
            <LogoMark size={26} />
            <span className="text-sm font-semibold">PrepTrack</span>
          </Link>

          <button
            onClick={() => setCommandOpen(true)}
            className="ml-auto hidden h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-surface-muted px-3 text-sm text-content-faint transition-colors hover:border-brand/50 md:flex"
            aria-label="Search everything"
          >
            <Search size={15} />
            <span>Search everything…</span>
            <kbd className="ml-auto rounded border bg-surface px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setCommandOpen(true)} aria-label="Search">
              <Search size={18} />
            </Button>
            <Tooltip label="Study timer">
              <Button
                variant={timerOpen ? 'primary' : 'ghost'}
                size="icon"
                onClick={() => useUi.getState().setTimerOpen(!timerOpen)}
                aria-label="Study timer"
              >
                <Timer size={17} />
              </Button>
            </Tooltip>
            <NotificationBell />
            <Tooltip label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </Button>
            </Tooltip>
            <div className="pl-1">
              <QuickAddMenu />
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-4 pb-24 sm:px-4 sm:py-5 md:pb-8 lg:px-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
        {MOBILE_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors', isActive ? 'text-brand' : 'text-content-muted')
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMobileNavOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-content-muted"
        >
          <Menu size={17} />
          More
        </button>
      </nav>

      {/* Mobile FAB */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-fg shadow-xl transition-transform active:scale-95 md:hidden"
        aria-label="Quick add"
      >
        <Plus size={22} />
      </button>

      {/* Mobile navigation drawer */}
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Navigate" side="left">
        <div className="space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-content-faint/80">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium',
                        isActive ? 'bg-brand/[0.09] text-brand' : 'text-content-muted hover:bg-surface-raised hover:text-content',
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Drawer>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <TimerWidget />
    </div>
  );
}
