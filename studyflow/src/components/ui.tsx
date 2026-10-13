// Components d'interfície reutilitzables.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ContentOrigin, MasteryLevel } from '../types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
};

export function Button({ variant = 'primary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2 text-sm',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function LinkButton({ to, variant = 'primary', className, children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx('focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors', VARIANTS[variant], className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cx('rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { to: string; label: string }[] }) {
  return (
    <header className="mb-6">
      {crumbs && (
        <nav aria-label="Ruta" className="mb-2 flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          {crumbs.map((c, i) => (
            <span key={c.to} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>›</span>}
              <Link to={c.to} className="hover:text-brand-600 hover:underline">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-slate-600 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Badge({ children, tone = 'slate', title }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet'; title?: string }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  };
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  );
}

const ORIGIN_INFO: Record<ContentOrigin, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet'; title: string }> = {
  pdf: { label: 'Text del PDF', tone: 'green', title: 'Text literal extret del document original' },
  extractive: { label: 'Reorganització automàtica', tone: 'blue', title: 'Organització automàtica del text del PDF, sense IA i sense afegir informació' },
  'ai-textual': { label: 'IA · basat en el PDF', tone: 'blue', title: 'Generat per IA amb una cita verificada al document' },
  'ai-complement': { label: 'IA · explicació complementària', tone: 'amber', title: 'Explicació generada per IA que NO apareix al document' },
  'ai-unverified': { label: 'IA · no verificable', tone: 'red', title: 'Afirmació generada per IA que no s’ha pogut verificar amb el document' },
  manual: { label: 'Editat per tu', tone: 'violet', title: 'Contingut editat manualment' },
  demo: { label: 'Demostració (fictici)', tone: 'violet', title: 'Contingut fictici de demostració' },
};

export function OriginBadge({ origin }: { origin: ContentOrigin }) {
  const o = ORIGIN_INFO[origin];
  return (
    <Badge tone={o.tone} title={o.title}>
      {o.label}
    </Badge>
  );
}

export const MASTERY_TONE: Record<MasteryLevel, 'slate' | 'red' | 'amber' | 'blue' | 'green'> = {
  not_started: 'slate',
  not_achieved: 'red',
  learning: 'amber',
  achieved: 'blue',
  mastered: 'green',
};

export function ProgressBar({ value, label, tone = 'brand', className }: { value: number; label?: string; tone?: 'brand' | 'green' | 'amber'; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const colors = { brand: 'bg-brand-600', green: 'bg-emerald-600', amber: 'bg-amber-500' };
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>{label}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cx('h-full rounded-full transition-all', colors[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums dark:text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-prose text-sm text-slate-600 dark:text-slate-400">{children}</div>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode; title?: string }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
    warn: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-4 py-3 text-sm', tones[tone])}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl dark:bg-slate-900', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button className="focus-ring rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose} aria-label="Tanca">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Confirmacions ----------
interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Text que l'usuari ha d'escriure per confirmar accions irreversibles */
  typeToConfirm?: string;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => {
    setTyped('');
    setState({ ...o, resolve });
  }), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const blocked = !!state?.typeToConfirm && typed.trim() !== state.typeToConfirm;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel·la
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirma'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-700 dark:text-slate-300">{state?.message}</div>
        {state?.typeToConfirm && (
          <label className="mt-4 block text-sm">
            Escriu <strong>{state.typeToConfirm}</strong> per confirmar:
            <input className="input mt-1" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </label>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ---------- Avisos breus ----------
type Toast = { id: number; msg: string; tone: 'info' | 'error' | 'success' };
const ToastCtx = createContext<(msg: string, tone?: Toast['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto rounded-lg px-4 py-3 text-sm shadow-lg',
              t.tone === 'error' ? 'bg-red-600 text-white' : t.tone === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white dark:bg-slate-700',
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden />
      {label}
    </span>
  );
}

export function Loading() {
  return (
    <div className="py-16 text-center">
      <Spinner label="Carregant…" />
    </div>
  );
}
