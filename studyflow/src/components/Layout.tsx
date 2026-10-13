import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateSettings } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { useExamRunning } from '../hooks/examMode';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Inici', icon: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/assignatures', label: 'Assignatures', icon: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h6' },
  { to: '/repas', label: 'Repàs pendent', icon: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2' },
  { to: '/progres', label: 'Progrés', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/configuracio', label: 'Configuració i dades', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const settings = useSettings();
  const loc = useLocation();
  const dueCount = useLiveQuery(() => db.reviews.where('due').belowOrEqual(Date.now()).count(), [loc.pathname], 0);
  const examMode = useExamRunning();

  const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Navegació principal">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx(
              'focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )
          }
        >
          <Icon d={n.icon} />
          <span className="flex-1">{n.label}</span>
          {n.to === '/repas' && dueCount > 0 && <span className="rounded-full bg-amber-500 px-2 text-xs font-semibold text-white tabular-nums">{dueCount}</span>}
        </NavLink>
      ))}
    </nav>
  );
  const brand = (
    <div className="flex items-center gap-2 px-5 py-4">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#4f46e5" />
        <path d="M9 10h14M9 16h10M9 22h6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <div>
        <div className="font-semibold text-slate-900 dark:text-white">StudyFlow</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Estudia a partir dels teus PDF</div>
      </div>
    </div>
  );
  const footer = (
    <div className="border-t border-slate-200 p-3 dark:border-slate-800">
      <button
        className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        onClick={() => updateSettings({ theme: nextTheme })}
        aria-label={`Canvia a mode ${nextTheme === 'dark' ? 'fosc' : 'clar'}`}
      >
        <Icon d={nextTheme === 'dark' ? 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' : 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'} />
        Mode {nextTheme === 'dark' ? 'fosc' : 'clar'}
      </button>
      <p className="px-3 pt-2 text-xs text-slate-500 dark:text-slate-500">Les dades es desen només en aquest navegador.</p>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {!examMode && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
          {brand}
          {nav}
          {footer}
        </aside>
      )}
      {/* Mòbil */}
      {!examMode && (
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
          <span className="font-semibold text-slate-900 dark:text-white">StudyFlow</span>
          <button className="focus-ring rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpen(true)} aria-label="Obre el menú">
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}
      <main className={cx('min-w-0 flex-1 px-4 pb-16 sm:px-6 lg:px-10', examMode ? 'pt-6' : 'pt-16 lg:pt-8')}>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
