import { useState } from 'react';

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  tooltip?: string;
}
export function Button({ variant = 'primary', size = 'md', loading, tooltip, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
  const v: Record<string, string> = {
    primary: 'bg-ink-900 text-white hover:bg-ink-800 shadow-sm',
    secondary: 'bg-gold-500 text-white hover:bg-gold-600 shadow-sm',
    ghost: 'text-ink-700 hover:bg-ink-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-ink-300 text-ink-700 hover:bg-ink-50 bg-white',
  };
  const s: Record<string, string> = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button title={tooltip} className={`${base} ${v[variant]} ${s[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
export function Badge({ variant = 'default', size = 'sm', children }: { variant?: BadgeVariant; size?: 'sm' | 'md' | 'lg'; children: React.ReactNode }) {
  const v: Record<BadgeVariant, string> = {
    default: 'bg-ink-100 text-ink-700',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-red-50 text-red-700 border border-red-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    gold: 'bg-gold-50 text-gold-800 border border-gold-200',
  };
  const sz = size === 'lg' ? 'px-3 py-1 text-sm' : size === 'md' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs';
  return <span className={`inline-flex items-center rounded-md font-medium ${sz} ${v[variant]}`}>{children}</span>;
}

export function statusVariant(s: string): BadgeVariant {
  const m: Record<string, BadgeVariant> = {
    active: 'success', published: 'success', approved: 'success', complete: 'success',
    fulfilled: 'success', completed: 'success', resolved: 'success',
    pending: 'warning', draft: 'default', review: 'warning', 'in_progress': 'warning',
    processing: 'info', shipped: 'info', open: 'info',
    cancelled: 'danger', rejected: 'danger', archived: 'danger', failed: 'danger',
  };
  return m[s?.toLowerCase()] ?? 'default';
}

// ─── InfoTooltip ──────────────────────────────────────────────────────────────
export function InfoTooltip({ text, content }: { text?: string; content?: string }) {
  const [show, setShow] = useState(false);
  const body = text ?? content ?? '';
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span className="w-4 h-4 rounded-full bg-ink-200 text-ink-500 text-xs flex items-center justify-center cursor-help select-none font-semibold leading-none">i</span>
      {show && body && (
        <span className="absolute z-50 bottom-6 left-1/2 -translate-x-1/2 w-64 bg-ink-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-2xl pointer-events-none leading-relaxed">
          {body}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink-900" />
        </span>
      )}
    </span>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; hint?: string; error?: string; tooltip?: string;
}
export function Input({ label, hint, error, tooltip, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
          {label} {tooltip && <InfoTooltip text={tooltip} />}
        </label>
      )}
      <input
        className={`w-full px-3 py-2 text-sm bg-white border rounded-lg text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent transition ${error ? 'border-red-400 ring-1 ring-red-400' : 'border-ink-200'} ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; hint?: string; error?: string; tooltip?: string;
}
export function Textarea({ label, hint, error, tooltip, className = '', ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
          {label} {tooltip && <InfoTooltip text={tooltip} />}
        </label>
      )}
      <textarea
        className={`w-full px-3 py-2 text-sm bg-white border rounded-lg text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent transition resize-none ${error ? 'border-red-400' : 'border-ink-200'} ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; hint?: string; error?: string; tooltip?: string;
  options?: Array<{ value: string; label: string }>;
}
export function Select({ label, hint, error, tooltip, options, children, className = '', ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
          {label} {tooltip && <InfoTooltip text={tooltip} />}
        </label>
      )}
      <select
        className={`w-full px-3 py-2 text-sm bg-white border rounded-lg text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent transition ${error ? 'border-red-400' : 'border-ink-200'} ${className}`}
        {...props}
      >
        {options ? options.map(o => <option key={o.value} value={o.value}>{o.label}</option>) : children}
      </select>
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-display font-semibold text-ink-900 tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-500 max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 ml-6 flex-shrink-0">{actions}</div>}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, title, className = '', padding = true }: { children: React.ReactNode; title?: string; className?: string; padding?: boolean }) {
  return (
    <div className={`bg-white border border-ink-200 rounded-xl shadow-sm ${padding ? 'p-6' : ''} ${className}`}>
      {title && <h3 className={`text-sm font-semibold text-ink-900 mb-4 ${!padding ? 'px-6 pt-5' : ''}`}>{title}</h3>}
      {children}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-ink-100 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-ink-500 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return <div className={`${sz} border-2 border-gold-400 border-t-transparent rounded-full animate-spin ${className}`} />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-ink-100 rounded-lg ${className}`} />;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-lg'} w-full max-h-[90vh] flex flex-col animate-fade-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 flex-shrink-0">
          <h2 className="text-base font-display font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-end gap-3 flex-shrink-0 bg-ink-50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-ink-100 rounded-xl mb-6 w-fit">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${active === tab.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T extends object>({
  columns, data, loading, emptyTitle = 'No records found', emptyDescription, onRowClick,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }
  if (!data.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ink-50 border-b border-ink-200">
            {columns.map(c => (
              <th key={c.key} className={`text-left py-3 px-4 text-xs font-semibold text-ink-500 uppercase tracking-wider whitespace-nowrap ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`hover:bg-ink-50/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map(c => (
                <td key={c.key} className={`py-3 px-4 text-ink-800 ${c.className ?? ''}`}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, trend }: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="bg-white border border-ink-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-display font-semibold text-ink-900">{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
      {trend && (
        <p className={`text-xs font-medium mt-2 ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </p>
      )}
    </div>
  );
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search…', className = '' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
      />
    </div>
  );
}
