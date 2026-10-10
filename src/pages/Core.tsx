import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store'
import { DEMO_URL } from '../lib/seed'
import { Badge, Btn, Card, Confirm, Empty, Field, Modal, PageHead, inputCls, when } from '../ui'

const STATUSES = ['Draft', 'Testing', 'Pending Review', 'Approved', 'Deployed', 'Failed', 'Rolled Back']
const BAR: Record<string, string> = { Draft: 'bg-slate-500', Testing: 'bg-sky-500', 'Pending Review': 'bg-amber-500', Approved: 'bg-emerald-400', Deployed: 'bg-emerald-600', Failed: 'bg-red-500', 'Rolled Back': 'bg-violet-500' }
export const ACTION = (a: string) => a.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export function Dashboard() {
  const A = useApp(), d = A.data, nav = useNavigate()
  const failed = d.patches.filter((p) => p.status === 'Failed' || p.target_metadata?.lastTest?.overall === 'Failed').length
  const stats: [string, number][] = [['Websites', d.projects.length], ['Patches', d.patches.length], ['Active patches', d.patches.filter((p) => p.status === 'Deployed').length],
    ['Pending reviews', d.patches.filter((p) => p.status === 'Pending Review').length], ['Failed tests', failed]]
  if (!d.projects.length) return <><PageHead title="Dashboard" />
    <Empty title="No websites yet" body="Create a project to start patching, or load the sample store with patches, test results and a conflict already set up.">
      <Btn variant="primary" onClick={() => nav('/app/projects?new=1')}><Plus className="h-4 w-4" />Create new project</Btn><Btn onClick={A.seedSample}>Create sample data</Btn></Empty></>
  const total = d.patches.length || 1, name = (id: string) => d.patches.find((p) => p.id === id)?.title ?? 'Deleted patch'
  return <><PageHead title="Dashboard" sub="Across all your websites">
    <Btn onClick={() => nav('/app/projects?new=1')}><Plus className="h-4 w-4" />Create new project</Btn><Btn variant="primary" onClick={() => { A.setPatchId(null); nav('/app/editor?new=1') }}><Plus className="h-4 w-4" />Create patch</Btn></PageHead>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{stats.map(([l, n]) => <Card key={l} className="p-4"><div className="text-2xl font-semibold text-white">{n}</div><div className="text-xs text-slate-400">{l}</div></Card>)}</div>
    <Card className="mt-4 p-4"><h2 className="mb-3 text-sm font-medium text-white">Patch status</h2>
      <div className="flex h-3 overflow-hidden rounded-full bg-ink-700">{STATUSES.map((s) => { const n = d.patches.filter((p) => p.status === s).length; return n ? <div key={s} className={BAR[s]} style={{ width: `${(n / total) * 100}%` }} title={`${s}: ${n}`} /> : null })}</div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">{STATUSES.map((s) => <span key={s} className="flex items-center gap-1"><i className={`h-2 w-2 rounded-full ${BAR[s]}`} />{s} {d.patches.filter((p) => p.status === s).length}</span>)}</div></Card>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card className="p-4"><h2 className="mb-2 text-sm font-medium text-white">Recently modified websites</h2>{[...d.projects].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 5).map((p) =>
        <button key={p.id} onClick={() => { A.setPid(p.id); nav('/app/projects') }} className="flex w-full items-center justify-between border-t border-line py-2 text-left text-sm first:border-0"><span>{p.name}</span><span className="text-xs text-slate-500">{when(p.updated_at)}</span></button>)}</Card>
      <Card className="p-4"><h2 className="mb-2 text-sm font-medium text-white">Recent deployments <span className="font-normal text-slate-500">(simulated)</span></h2>
        {!d.deployments.length && <p className="text-sm text-slate-500">No deployments yet.</p>}{d.deployments.slice(0, 5).map((x) =>
          <div key={x.id} className="flex items-center justify-between border-t border-line py-2 text-sm first:border-0"><span>{name(x.patch_id)} v{x.patch_version}</span><Badge label={x.status} /></div>)}</Card>
      <Card className="p-4"><h2 className="mb-2 text-sm font-medium text-white">Recent activity</h2>
        {!d.audit_logs.length && <p className="text-sm text-slate-500">Nothing yet.</p>}{d.audit_logs.slice(0, 6).map((x) =>
          <div key={x.id} className="border-t border-line py-2 text-sm first:border-0">{ACTION(x.action)}<div className="text-xs text-slate-500">{x.details?.actor} · {when(x.created_at)}</div></div>)}</Card></div></>
}

const blank = { name: '', website_url: '', description: '', environment: 'Development' }
export function Projects() {
  const A = useApp(), d = A.data, nav = useNavigate()
  const [form, setForm] = useState<any>(null), [editId, setEditId] = useState<string>(), [del, setDel] = useState<any>(null), [err, setErr] = useState('')
  if (!form && new URLSearchParams(location.search).get('new')) { history.replaceState(null, '', '/app/projects'); setTimeout(() => setForm(blank), 0) }
  const save = async () => {
    if (!form.name.trim()) return setErr('Give the project a name.')
    try { new URL(form.website_url.trim()) } catch { return setErr('Enter a full URL, e.g. https://example.com') }
    setErr(''); await A.saveProject(form, editId); setForm(null)
  }
  const cur = A.cur, ps = A.patches
  return <><PageHead title="Websites" sub="Projects you own or have been added to"><Btn variant="primary" onClick={() => { setEditId(undefined); setForm(blank) }}><Plus className="h-4 w-4" />New project</Btn></PageHead>
    {!d.projects.length ? <Empty title="No websites yet" body="Add a site URL to start creating patches."><Btn variant="primary" onClick={() => setForm(blank)}>New project</Btn><Btn onClick={A.seedSample}>Create sample data</Btn></Empty> :
      <div className="grid gap-3 md:grid-cols-2">{d.projects.map((p) => <Card key={p.id} className={`p-4 ${p.id === A.pid ? 'border-indigo-500/60' : ''}`}>
        <div className="flex items-start justify-between gap-2"><div><button className="font-medium text-white hover:underline" onClick={() => A.setPid(p.id)}>{p.name}</button>
          <div className="text-xs text-slate-500">{p.website_url === DEMO_URL ? <Badge label="Testing" text="Sample demo site" /> : p.website_url}</div></div><Badge label={p.environment === 'Production' ? 'Failed' : 'Draft'} text={p.environment} /></div>
        <p className="mt-2 text-sm text-slate-400">{p.description || 'No description.'}</p>
        <div className="mt-2 text-xs text-slate-500">Owner: {p.owner_id === A.uid ? 'you' : 'shared'} · Created {when(p.created_at)} · Updated {when(p.updated_at)}</div>
        <div className="mt-3 flex gap-2"><Btn onClick={() => A.setPid(p.id)}>Open</Btn>{p.owner_id === A.uid && <><Btn aria-label="Edit" onClick={() => { setEditId(p.id); setForm(p) }}><Pencil className="h-4 w-4" /></Btn><Btn aria-label="Delete" variant="danger" onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></Btn></>}</div></Card>)}</div>}
    {cur && <div className="mt-6"><h2 className="mb-2 font-medium text-white">{cur.name}</h2>
      {cur.website_url !== DEMO_URL && <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Most external sites block embedding (X-Frame-Options or CSP frame-ancestors), and browsers block cross-origin DOM access, so PATCHWORK cannot preview <b>{cur.website_url}</b> directly. Patches are tested on the built-in demo site. <a className="inline-flex items-center gap-1 underline" href={cur.website_url} target="_blank" rel="noreferrer noopener">Open the real site <ExternalLink className="h-3 w-3" /></a></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4"><h3 className="mb-2 text-sm font-medium text-white">Patches ({ps.length})</h3>{!ps.length && <p className="text-sm text-slate-500">No patches yet.</p>}{ps.map((p) =>
          <Link key={p.id} to="/app/editor" onClick={() => A.setPatchId(p.id)} className="flex items-center justify-between border-t border-line py-2 text-sm first:border-0"><span>{p.title}</span><Badge label={p.status} /></Link>)}</Card>
        <Card className="p-4"><h3 className="mb-2 text-sm font-medium text-white">Test results</h3>{ps.filter((p) => p.target_metadata?.lastTest).map((p) =>
          <div key={p.id} className="flex items-center justify-between border-t border-line py-2 text-sm first:border-0"><span>{p.title}</span><Badge label={p.target_metadata.lastTest.overall} /></div>)}{!ps.some((p) => p.target_metadata?.lastTest) && <p className="text-sm text-slate-500">No checks run yet.</p>}</Card>
        <Card className="p-4"><h3 className="mb-2 text-sm font-medium text-white">Deployments and changes</h3>{d.deployments.filter((x) => x.project_id === cur.id).slice(0, 3).map((x) =>
          <div key={x.id} className="border-t border-line py-2 text-sm first:border-0">v{x.patch_version} <Badge label={x.status} /><div className="text-xs text-slate-500">{when(x.created_at)}</div></div>)}
          {d.patch_versions.filter((v) => ps.some((p) => p.id === v.patch_id)).slice(0, 3).map((v) => <div key={v.id} className="border-t border-line py-2 text-xs text-slate-400">{v.change_description} · v{v.version_number}</div>)}</Card></div></div>}
    <Modal open={!!form} title={editId ? 'Edit project' : 'New project'} onClose={() => setForm(null)}>{form && <div className="space-y-3">
      <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Website URL" hint="Previews run on the built-in demo site; the URL is recorded for reference."><input className={inputCls} value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://example.com" /></Field>
      <Field label="Description"><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Environment"><select className={inputCls} value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>{['Development', 'Staging', 'Production'].map((x) => <option key={x}>{x}</option>)}</select></Field>
      {err && <p className="text-sm text-red-300">{err}</p>}<div className="flex justify-end gap-2"><Btn onClick={() => setForm(null)}>Cancel</Btn><Btn variant="primary" onClick={save}>Save project</Btn></div></div>}</Modal>
    <Confirm open={!!del} title="Delete project?" body={`This permanently deletes ${del?.name}, its patches, versions, deployments and logs.`} label="Delete project" onNo={() => setDel(null)} onYes={async () => { await A.deleteProject(del); setDel(null) }} />
  </>
}
