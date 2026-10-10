import { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export const cx = (...a: any[]) => a.filter(Boolean).join(' ')
export const when = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-')
export const inputCls = 'w-full rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500'

export const Card = ({ className, children }: { className?: string; children: ReactNode }) =>
  <div className={cx('rounded-xl border border-line bg-ink-800/70', className)}>{children}</div>

export function Btn({ variant = 'default', className, ...p }: any) {
  const v = variant === 'primary' ? 'bg-indigo-500 text-white hover:bg-indigo-400'
    : variant === 'danger' ? 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
    : 'border border-line bg-ink-700/60 text-slate-200 hover:bg-ink-600/60'
  return <button {...p} className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', v, className)} />
}

const TONES: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', red: 'bg-red-500/10 text-red-300 border-red-500/30',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30', sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30', slate: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
}
const MAP: Record<string, string> = {
  Deployed: 'emerald', Approved: 'emerald', Passed: 'emerald', 'Element Found': 'emerald', resolved: 'emerald', simulated_deployed: 'emerald',
  Failed: 'red', Rejected: 'red', 'Element Missing': 'red', failed: 'red',
  'Pending Review': 'amber', 'Needs Review': 'amber', 'Possible Element Change': 'amber', 'Patch Needs Review': 'amber', open: 'amber',
  Testing: 'sky', 'Rolled Back': 'violet', rolled_back: 'violet', Draft: 'slate', dismissed: 'slate',
}
export const Badge = ({ label, text }: { label: string; text?: string }) =>
  <span className={cx('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs', TONES[MAP[label] ?? 'slate'])}>{text ?? label.replace('simulated_deployed', 'simulated deploy').replace('_', ' ')}</span>

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) =>
  <label className="block text-sm"><span className="mb-1 block text-slate-400">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>

export const Spinner = () => <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

export const Empty = ({ title, body, children }: { title: string; body: string; children?: ReactNode }) =>
  <div className="rounded-xl border border-dashed border-line p-8 text-center"><p className="font-medium text-slate-200">{title}</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{body}</p><div className="mt-4 flex justify-center gap-2">{children}</div></div>

export const PageHead = ({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) =>
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold text-white">{title}</h1>{sub && <p className="text-sm text-slate-400">{sub}</p>}</div><div className="flex flex-wrap gap-2">{children}</div></div>

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-line bg-ink-800 p-5" onClick={(e) => e.stopPropagation()}>
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>{children}</div></div>
}

export const Confirm = ({ open, title, body, label, onYes, onNo }: { open: boolean; title: string; body: string; label: string; onYes: () => void; onNo: () => void }) =>
  <Modal open={open} title={title} onClose={onNo}><p className="text-sm text-slate-300">{body}</p>
    <div className="mt-4 flex justify-end gap-2"><Btn onClick={onNo}>Cancel</Btn><Btn variant="danger" onClick={onYes}>{label}</Btn></div></Modal>

export function Diff({ a, b }: { a: string; b: string }) {
  const A = a.split('\n'), B = b.split('\n')
  const col = (lines: string[], other: string[], c: string) => <pre className="overflow-auto rounded-lg border border-line bg-ink-950/60 p-2 font-mono text-xs">
    {lines.map((l, i) => <div key={i} className={other.includes(l) ? 'text-slate-400' : c}>{l || ' '}</div>)}</pre>
  return <div className="grid gap-2 md:grid-cols-2">{col(A, B, 'bg-red-500/15 text-red-200')}{col(B, A, 'bg-emerald-500/15 text-emerald-200')}</div>
}

export const Toasts = ({ items }: { items: { id: number; msg: string; kind: string }[] }) =>
  <div className="fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2" aria-live="polite">
    {items.map((t) => <div key={t.id} className={cx('rounded-lg border px-3 py-2 text-sm shadow-lg', t.kind === 'err' ? 'border-red-500/40 bg-red-950 text-red-200' : 'border-emerald-500/40 bg-emerald-950 text-emerald-200')}>{t.msg}</div>)}</div>
