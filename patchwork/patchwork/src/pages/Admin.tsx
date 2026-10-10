import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Search, X } from 'lucide-react'
import { useApp } from '../lib/store'
import { ACTION } from './Core'
import { Badge, Btn, Card, Diff, Empty, Modal, PageHead, inputCls, when } from '../ui'

export function Review() {
  const A = useApp(), nav = useNavigate(), d = A.data
  const [cmp, setCmp] = useState<any>(null), [note, setNote] = useState('')
  const ids = new Set(A.patches.map((p) => p.id))
  const conflicts = d.patch_conflicts.filter((c) => c.project_id === A.pid)
  const find = (id: string) => d.patches.find((p) => p.id === id)
  const pending = A.patches.filter((p) => p.status === 'Pending Review')
  const reviews = d.patch_reviews.filter((r) => ids.has(r.patch_id))
  return <><PageHead title="Review and conflicts" sub="Shared project visibility, review decisions and overlap warnings"><Btn onClick={A.scanProject}><Search className="h-4 w-4" />Scan for conflicts</Btn></PageHead>
    <h2 className="mb-2 text-sm font-medium text-white">Conflicts</h2>
    {!conflicts.length ? <Empty title="No conflicts" body="Active patches do not overlap. Run a scan after changing selectors or code." /> : <div className="space-y-3">{conflicts.map((c) => { const a = find(c.patch_id), b = find(c.conflicting_patch_id); return <Card key={c.id} className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm"><b className="text-white">{a?.title}</b> and <b className="text-white">{b?.title}</b></div><Badge label={c.status} /></div>
      <p className="mt-1 text-sm text-slate-400">{c.conflict_type.replace('_', ' ')}: {c.description}</p>
      {c.status === 'open' && <div className="mt-3 flex flex-wrap gap-2"><Btn onClick={() => setCmp({ a, b })}>Compare changes</Btn>
        <Btn onClick={() => { A.setPatchId(a!.id); nav('/app/editor') }}>Resolve manually</Btn>
        {[a, b].map((x) => x && <Btn key={x.id} onClick={() => A.setConflict(c, 'resolved', x)}>Approve “{x.title}” for testing</Btn>)}
        <Btn onClick={() => A.setConflict(c, 'dismissed')}>Dismiss</Btn></div>}</Card> })}</div>}
    <h2 className="mb-2 mt-6 text-sm font-medium text-white">Pending review</h2>
    {!pending.length ? <p className="text-sm text-slate-500">Nothing waiting for review.</p> : <div className="space-y-3">{pending.map((p) => <Card key={p.id} className="p-4"><div className="flex items-center justify-between"><div><div className="font-medium text-white">{p.title}</div><div className="text-xs text-slate-400">v{p.current_version} · {p.patch_type} · <code>{p.target_selector}</code></div></div>
      {p.target_metadata?.lastTest ? <Badge label={p.target_metadata.lastTest.overall} /> : <Badge label="Needs Review" text="Not tested" />}</div>
      <div className="mt-3 flex flex-wrap gap-2"><input className={inputCls + ' !w-56'} placeholder="Comment" value={note} onChange={(e) => setNote(e.target.value)} />
        <Btn onClick={() => A.review(p, 'Approved', note)}><Check className="h-4 w-4" />Approve</Btn><Btn variant="danger" onClick={() => A.review(p, 'Rejected', note)}><X className="h-4 w-4" />Reject</Btn>
        <Btn onClick={() => { A.setPatchId(p.id); nav('/app/preview') }}>Open in preview</Btn></div></Card>)}</div>}
    <h2 className="mb-2 mt-6 text-sm font-medium text-white">Review history</h2>
    {reviews.map((r) => <div key={r.id} className="flex items-center justify-between border-t border-line py-2 text-sm"><span>{find(r.patch_id)?.title} <span className="text-slate-500">{r.comments}</span></span><span className="flex items-center gap-2"><Badge label={r.status} /><span className="text-xs text-slate-500">{when(r.created_at)}</span></span></div>)}
    <Modal open={!!cmp} title="Compare patches" onClose={() => setCmp(null)}>{cmp && <><div className="mb-2 grid grid-cols-2 gap-2 text-xs text-slate-400"><span>{cmp.a?.title}</span><span>{cmp.b?.title}</span></div><Diff a={cmp.a?.patch_code ?? ''} b={cmp.b?.patch_code ?? ''} /></>}</Modal></>
}

export function Audit() {
  const A = useApp(), [q, setQ] = useState('')
  const rows = A.data.audit_logs.filter((l) => l.project_id === A.pid && (ACTION(l.action) + JSON.stringify(l.details)).toLowerCase().includes(q.toLowerCase()))
  const target = (l: any) => A.data.patches.find((p) => p.id === l.entity_id)?.title ?? A.data.projects.find((p) => p.id === l.project_id)?.name ?? l.details?.title ?? '-'
  return <><PageHead title="Audit logs" sub={A.cur?.name}><input aria-label="Filter" className={inputCls + ' !w-56'} placeholder="Filter actions" value={q} onChange={(e) => setQ(e.target.value)} /></PageHead>
    {!rows.length ? <Empty title="No activity" body="Actions like creating patches, running tests and deploying are recorded here." /> :
      <Card className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="p-3">Action</th><th>User</th><th>Related to</th><th>Time</th></tr></thead>
        <tbody>{rows.map((l) => <tr key={l.id} className="border-t border-line"><td className="p-3">{ACTION(l.action)}{l.details?.simulated && <span className="ml-2 text-xs text-slate-500">simulated</span>}</td><td>{l.details?.actor ?? l.actor_id?.slice(0, 8)}</td><td>{target(l)}</td><td className="whitespace-nowrap text-slate-400">{when(l.created_at)}</td></tr>)}</tbody></table></Card>}</>
}

export function SettingsPage() {
  const A = useApp()
  return <><PageHead title="Settings" />
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4"><h2 className="mb-2 text-sm font-medium text-white">Account</h2><p className="text-sm text-slate-300">{A.actor}</p><p className="text-xs text-slate-500">{A.mode === 'demo' ? 'Demo data lives in memory only and never touches Supabase.' : A.session?.user.email}</p>
        <Btn className="mt-3" onClick={A.signOut}>{A.mode === 'demo' ? 'Exit demo' : 'Log out'}</Btn></Card>
      <Card className="p-4"><h2 className="mb-2 text-sm font-medium text-white">Backend</h2><div className="flex items-center gap-2 text-sm">Supabase <Badge label={A.supabaseReady ? 'Approved' : 'Failed'} text={A.supabaseReady ? 'Configured' : 'Not configured'} /></div>
        <p className="mt-2 text-xs text-slate-500">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then run supabase/migrations/001_patchwork.sql. Only the anon key belongs in the browser.</p></Card>
      <Card className="p-4 md:col-span-2"><h2 className="mb-2 text-sm font-medium text-white">Safety model</h2><ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
        <li>Patch code only runs inside an iframe with sandbox="allow-scripts" (no same-origin, forms, popups or navigation).</li>
        <li>JavaScript patches are checked against an allowlist first: no network, storage, eval, navigation or HTML injection.</li>
        <li>Deployment is simulated and affects the demo site only. Production deployment is disabled until an adapter is configured.</li>
        <li>External sites usually cannot be embedded or inspected from the browser, so they are not previewed.</li></ul></Card></div></>
}
