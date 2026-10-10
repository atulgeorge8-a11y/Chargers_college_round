import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Play, Plus, Send, Trash2, Undo2, X } from 'lucide-react'
import { useApp } from '../lib/store'
import { buildDoc, staticCheck, TestResult, toPreviewPatch } from '../lib/engine'
import { Badge, Btn, Card, Confirm, Diff, Empty, Field, PageHead, inputCls, when } from '../ui'

const HINT: Record<string, string> = { CSS: 'Declarations (padding: 8px;) or full rules including @media.', JavaScript: 'Runs in the sandbox with `el` (target) and `document`. Network, storage and navigation are blocked.', Content: 'Replacement text for the target element (plain text only).' }
const newForm = (project_id: string) => ({ project_id, title: '', description: '', target_selector: '', patch_type: 'CSS', patch_code: '', note: '' })

export function PatchPicker() {
  const A = useApp()
  return <select aria-label="Patch" value={A.patchId ?? ''} onChange={(e) => A.setPatchId(e.target.value || null)} className="rounded-lg border border-line bg-ink-800 px-2 py-1.5 text-sm">
    <option value="">Select a patch…</option>{A.patches.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.status})</option>)}</select>
}

/** Sandboxed iframe: scripts allowed, but no same-origin, forms, popups or top navigation. */
export function SiteFrame({ patches, mobile }: { patches: any[]; mobile: boolean }) {
  const doc = useMemo(() => buildDoc({ mode: 'preview', nonce: 'preview', patches: patches.map(toPreviewPatch) }), [JSON.stringify(patches.map((p) => [p.id, p.patch_code, p.target_selector, p.patch_type]))]) // eslint-disable-line
  return <iframe title="Demo site preview" sandbox="allow-scripts" srcDoc={doc} className="mx-auto h-[460px] rounded-lg border border-line bg-white transition-[width]" style={{ width: mobile ? 375 : '100%' }} />
}

export function Editor() {
  const A = useApp(), nav = useNavigate(), p = A.patch
  const [f, setF] = useState<any>(null), [errs, setErrs] = useState<string[]>([]), [tab, setTab] = useState<'edit' | 'versions'>('edit'), [del, setDel] = useState(false), [va, setVa] = useState(0), [vb, setVb] = useState(0)
  const creating = !p && new URLSearchParams(location.search).get('new')
  useEffect(() => { if (p) setF({ ...p, note: '' }); else if (A.pid && creating) setF(newForm(A.pid)); else setF(null) }, [p?.id, p?.current_version, A.pid, !!creating]) // eslint-disable-line
  const versions = A.data.patch_versions.filter((v) => v.patch_id === p?.id).sort((a, b) => b.version_number - a.version_number)
  useEffect(() => { if (versions.length) { setVb(versions[0].version_number); setVa(versions[1]?.version_number ?? versions[0].version_number) } }, [p?.id, versions.length]) // eslint-disable-line
  const validate = () => { const e: string[] = []; if (!f.title.trim()) e.push('Title is required.'); if (!f.target_selector.trim()) e.push('Target selector is required.'); e.push(...staticCheck(f)); const u = [...new Set(e)]; setErrs(u); return !u.length }
  const save = async () => { if (validate()) await A.savePatch(f, p ?? undefined, f.note) }
  const meta = p?.target_metadata ?? {}
  return <><PageHead title="Patch editor" sub={A.cur?.name}><Btn variant="primary" disabled={!A.pid} onClick={() => { A.setPatchId(null); setErrs([]); setF(newForm(A.pid!)); nav('/app/editor?new=1') }}><Plus className="h-4 w-4" />New patch</Btn></PageHead>
    {!A.pid ? <Empty title="No project selected" body="Create a project first." /> : <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit p-2">{!A.patches.length && <p className="p-3 text-sm text-slate-500">No patches yet.</p>}{A.patches.map((x) =>
        <button key={x.id} onClick={() => { A.setPatchId(x.id); setErrs([]) }} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${x.id === A.patchId ? 'bg-indigo-500/15 text-white' : 'text-slate-300 hover:bg-ink-700/60'}`}><span className="truncate">{x.title}</span><Badge label={x.status} /></button>)}</Card>
      {!f ? <Empty title="Pick a patch or start a new one" body="Patches target an element by CSS selector and change its style, text or behaviour." /> : <Card className="p-4">
        {p && <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Badge label={p.status} /><span>v{p.current_version}</span><span>by {A.data.audit_logs.find((l) => l.entity_id === p.id && l.action === 'patch_created')?.details?.actor ?? 'author'}</span><span>created {when(p.created_at)}</span><span>edited {when(p.updated_at)}</span>
          {meta.tracking && <Badge label={meta.tracking} />}</div>}
        {p && <div className="mb-3 flex gap-2 text-sm">{(['edit', 'versions'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1 ${tab === t ? 'bg-ink-600 text-white' : 'text-slate-400'}`}>{t === 'edit' ? 'Details' : `Versions (${versions.length})`}</button>)}</div>}
        {tab === 'versions' && p ? <div className="space-y-3"><div className="flex gap-2 text-sm">{[[va, setVa], [vb, setVb]].map(([v, set]: any, i) => <select key={i} aria-label={i ? 'Newer' : 'Older'} className={inputCls + ' !w-auto'} value={v} onChange={(e) => set(+e.target.value)}>{versions.map((x) => <option key={x.id} value={x.version_number}>v{x.version_number}</option>)}</select>)}</div>
          <Diff a={versions.find((v) => v.version_number === va)?.patch_code ?? ''} b={versions.find((v) => v.version_number === vb)?.patch_code ?? ''} />
          {versions.map((v) => <div key={v.id} className="border-t border-line py-2 text-xs text-slate-400">v{v.version_number} · {v.change_description} · {when(v.created_at)}</div>)}</div> :
        <div className="space-y-3">
          <Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Problem description"><textarea rows={2} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Target selector" hint="Try #checkout-btn, nav a, .products, #product-1 .desc"><input className={inputCls + ' font-mono'} value={f.target_selector} onChange={(e) => setF({ ...f, target_selector: e.target.value })} /></Field>
            <Field label="Patch type"><select className={inputCls} value={f.patch_type} onChange={(e) => setF({ ...f, patch_type: e.target.value })}>{['CSS', 'JavaScript', 'Content'].map((x) => <option key={x}>{x}</option>)}</select></Field></div>
          <Field label="Patch code" hint={HINT[f.patch_type]}><textarea rows={8} spellCheck={false} className={inputCls + ' font-mono'} value={f.patch_code} onChange={(e) => setF({ ...f, patch_code: e.target.value })} /></Field>
          <Field label="Change description (saved with the new version)"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          {p && meta.fingerprint && <p className="text-xs text-slate-500">Tracked element: &lt;{meta.fingerprint.tag}&gt; {meta.fingerprint.id && `#${meta.fingerprint.id}`} {meta.fingerprint.testid && `[data-testid=${meta.fingerprint.testid}]`} {meta.fingerprint.text && `"${meta.fingerprint.text}"`}</p>}
          {errs.length > 0 && <ul className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
          <div className="flex flex-wrap gap-2"><Btn variant="primary" onClick={save}>{p ? 'Save new version' : 'Save draft'}</Btn>
            {p && <><Btn onClick={() => nav('/app/preview')}><Play className="h-4 w-4" />Preview and test</Btn>
              <Btn disabled={p.status === 'Pending Review' || p.status === 'Deployed'} onClick={() => validate() && A.submitForReview(p)}><Send className="h-4 w-4" />Submit for review</Btn>
              <Btn variant="danger" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /></Btn></>}</div></div>}</Card>}</div>}
    <Confirm open={del} title="Delete patch?" body="The patch and its version history will be deleted." label="Delete patch" onNo={() => setDel(false)} onYes={async () => { setDel(false); await A.deletePatch(p!) }} /></>
}

export function Preview() {
  const A = useApp(), p = A.patch, [view, setView] = useState<'original' | 'patched' | 'live'>('patched'), [mobile, setMobile] = useState(false), [busy, setBusy] = useState(false), [res, setRes] = useState<TestResult | null>(null), [note, setNote] = useState('')
  const t: TestResult | null = res ?? p?.target_metadata?.lastTest ?? null
  useEffect(() => setRes(null), [p?.id, p?.current_version])
  const live = A.patches.filter((x) => x.status === 'Deployed')
  const patches = view === 'original' ? [] : view === 'patched' && p ? [p] : view === 'live' ? live : []
  const run = async () => { setBusy(true); setRes(await A.checkPatch(p!)); setBusy(false) }
  return <><PageHead title="Preview and testing" sub="Runs in a sandboxed frame. The original demo site is never modified."><PatchPicker /></PageHead>
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card className="p-3"><div className="mb-2 flex flex-wrap items-center gap-2 text-sm">{([['original', 'Original'], ['patched', 'With selected patch'], ['live', `Live demo (${live.length} deployed)`]] as const).map(([k, l]) =>
        <button key={k} onClick={() => setView(k)} className={`rounded-lg px-3 py-1 ${view === k ? 'bg-indigo-500/20 text-white' : 'text-slate-400'}`}>{l}</button>)}
        <label className="ml-auto flex items-center gap-1 text-slate-400"><input type="checkbox" checked={mobile} onChange={(e) => setMobile(e.target.checked)} />Mobile width</label></div>
        <SiteFrame patches={patches} mobile={mobile} /><p className="mt-2 text-xs text-slate-500">Frame sandbox: allow-scripts only. No access to this app, your session or Supabase.</p></Card>
      <Card className="h-fit p-4">{!p ? <p className="text-sm text-slate-400">Select a patch to run checks.</p> : <div className="space-y-3">
        <div><div className="font-medium text-white">{p.title}</div><div className="text-xs text-slate-400">v{p.current_version} · {p.patch_type} · <code>{p.target_selector}</code></div></div>
        <Btn variant="primary" disabled={busy} onClick={run}><Play className="h-4 w-4" />{busy ? 'Running…' : 'Run checks'}</Btn>
        {t && <div className="space-y-2"><div className="flex items-center gap-2 text-sm">Result: <Badge label={t.overall} />{t.version && t.version !== p.current_version && <span className="text-xs text-amber-300">from v{t.version}, re-run</span>}</div>
          {t.tracking && <div className="text-xs text-slate-400">Element: <Badge label={t.tracking.status} /></div>}
          {t.tracking?.candidates?.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">Possible new targets (not applied):{t.tracking.candidates.map((c) => <div key={c} className="mt-1 flex items-center justify-between gap-2"><code>{c}</code><Btn onClick={() => A.retarget(p, c)}>Confirm as target</Btn></div>)}</div>}
          {t.results.map((r) => <div key={r.name} className="border-t border-line pt-2 text-sm"><div className="flex items-center justify-between">{r.name}<Badge label={r.status} /></div><div className="text-xs text-slate-400">{r.detail}</div></div>)}
          <p className="text-xs text-slate-500">{t.scope}</p></div>}
        <div className="space-y-2 border-t border-line pt-3"><input className={inputCls} placeholder="Review comment (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2"><Btn onClick={() => A.review(p, 'Approved', note)}><Check className="h-4 w-4" />Approve</Btn><Btn variant="danger" onClick={() => A.review(p, 'Rejected', note)}><X className="h-4 w-4" />Reject</Btn>
            <Btn disabled={p.status !== 'Approved'} onClick={() => A.deploy(p)}>Simulate deploy</Btn></div>
          <p className="text-xs text-slate-500">Deploy is simulated: it updates the demo site only. No production adapter is configured.</p></div></div>}</Card></div></>
}

export function HistoryPage() {
  const A = useApp(), p = A.patch, [ask, setAsk] = useState(false)
  const deps = A.data.deployments.filter((d) => d.patch_id === p?.id)
  const vers = A.data.patch_versions.filter((v) => v.patch_id === p?.id).sort((a, b) => b.version_number - a.version_number)
  const can = p && p.status === 'Deployed'
  return <><PageHead title="History and rollback" sub="Rollback adds a new version and a new event. Earlier records are kept."><PatchPicker />
    <Btn variant="danger" disabled={!can} onClick={() => setAsk(true)}><Undo2 className="h-4 w-4" />Roll back</Btn></PageHead>
    {!p ? <Empty title="Select a patch" body="Pick a patch to see its versions and deployment history." /> : <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4"><h2 className="mb-2 text-sm font-medium text-white">Versions</h2>{vers.map((v) => <div key={v.id} className="border-t border-line py-2 text-sm first:border-0"><div className="flex justify-between"><span>v{v.version_number} · {v.change_description}</span><span className="text-xs text-slate-500">{when(v.created_at)}</span></div><pre className="mt-1 overflow-auto rounded bg-ink-950/60 p-2 font-mono text-xs text-slate-400">{v.patch_code}</pre></div>)}</Card>
      <Card className="p-4"><h2 className="mb-2 text-sm font-medium text-white">Deployments <span className="font-normal text-slate-500">(simulated, demo environment)</span></h2>
        {!deps.length && <p className="text-sm text-slate-500">Not deployed yet. Approve it in Preview, then simulate a deploy.</p>}{deps.map((d) => <div key={d.id} className="border-t border-line py-2 text-sm first:border-0"><div className="flex items-center justify-between"><span>v{d.patch_version} → {d.environment}</span><Badge label={d.status} /></div>
          <div className="text-xs text-slate-500">{when(d.created_at)}{d.test_results && ` · checks: ${d.test_results.overall}`}</div>{d.error_details && <div className="text-xs text-slate-400">{d.error_details}</div>}</div>)}</Card></div>}
    <Confirm open={ask} title="Roll back this patch?" body="The previous deployed version is restored in the demo environment as a new version. Existing history stays in place." label="Roll back" onNo={() => setAsk(false)} onYes={async () => { setAsk(false); await A.rollback(p!) }} /></>
}
