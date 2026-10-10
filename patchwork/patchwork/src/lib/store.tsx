import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { Db, emptySnap, liveDb, makeDemoDb, Row, Snapshot, TABLES } from './db'
import { buildSeed, DEMO_UID } from './seed'
import { detectConflicts, runTest, TestResult } from './engine'

export type Toast = { id: number; msg: string; kind: 'ok' | 'err' }
const byDesc = (k: string) => (a: Row, b: Row) => (a[k] < b[k] ? 1 : -1)

function useStore() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(!!supabase)
  const [demo, setDemo] = useState(false)
  const [data, setData] = useState<Snapshot>(emptySnap())
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pid, setPid] = useState<string | null>(null)
  const [patchId, setPatchId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const demoDb = useRef<Db | null>(null)

  const mode: 'demo' | 'live' | null = demo ? 'demo' : session ? 'live' : null
  const db: Db | null = mode === 'demo' ? demoDb.current : mode === 'live' ? liveDb : null
  const uid = mode === 'demo' ? DEMO_UID : session?.user.id
  const actor = mode === 'demo' ? 'Demo user' : session?.user.user_metadata?.display_name || session?.user.email || 'You'

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setBooting(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const t = { id: Date.now() + Math.random(), msg, kind }
    setToasts((x) => [...x, t]); setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), kind === 'err' ? 7000 : 3500)
  }, [])

  const reload = useCallback(async () => {
    if (!db) return
    setLoading(true)
    try { setData(await db.load()); setLoadError(null) } catch (e: any) { setLoadError(e.message) } finally { setLoading(false) }
  }, [db])

  useEffect(() => { if (mode) reload(); else { setData(emptySnap()); setPid(null) } }, [mode, session?.user.id]) // eslint-disable-line
  useEffect(() => { if (!data.projects.find((p) => p.id === pid)) setPid(data.projects[0]?.id ?? null) }, [data.projects, pid])

  const enterDemo = () => { demoDb.current = makeDemoDb(buildSeed(DEMO_UID, 'Demo user')); setDemo(true) }
  const exitDemo = () => { setDemo(false); demoDb.current = null }
  const signOut = async () => { exitDemo(); await supabase?.auth.signOut() }

  const cur = data.projects.find((p) => p.id === pid) ?? null
  const patches = useMemo(() => data.patches.filter((p) => p.project_id === pid).sort(byDesc('created_at')), [data.patches, pid])
  const patch = patches.find((p) => p.id === patchId) ?? null

  /** Runs a mutation, refreshes from the backend, and only reports success if nothing threw. */
  const run = async <T,>(fn: (db: Db) => Promise<T>, ok?: string): Promise<T | null> => {
    if (!db) return null
    try { const r = await fn(db); await reload(); if (ok) toast(ok); return r }
    catch (e: any) { toast(e.message || 'Operation failed', 'err'); await reload(); return null }
  }
  const log = (d: Db, project_id: string, action: string, entity_type: string, entity_id: string, details: Row = {}) =>
    d.insert('audit_logs', { project_id, actor_id: uid, action, entity_type, entity_id, details: { ...details, actor } })
  const addVersion = (d: Db, p: Row, v: number, note: string) =>
    d.insert('patch_versions', { patch_id: p.id, version_number: v, target_selector: p.target_selector, patch_type: p.patch_type, patch_code: p.patch_code, change_description: note, author_id: uid })

  async function scan(d: Db, project_id: string) {
    const snap = await d.load()
    const ps = snap.patches.filter((p) => p.project_id === project_id)
    const key = (a: string, b: string, t: string) => [a, b].sort().join('|') + t
    const known = new Set(snap.patch_conflicts.map((c) => key(c.patch_id, c.conflicting_patch_id, c.conflict_type)))
    for (const c of detectConflicts(ps)) {
      if (known.has(key(c.patch_id, c.conflicting_patch_id, c.conflict_type))) continue
      const c2 = await d.insert('patch_conflicts', { project_id, ...c, status: 'open' })
      await log(d, project_id, 'conflict_detected', 'patch', c.patch_id, { type: c.conflict_type, description: c.description }); void c2
    }
  }

  const A = {
    mode, booting, session, uid, actor, data, loading, loadError, reload, pid, setPid, cur, patches, patchId, setPatchId, patch,
    toasts, toast, enterDemo, exitDemo, signOut, supabaseReady: !!supabase,

    saveProject: (f: Row, id?: string) => run(async (d) => {
      const body = { name: f.name.trim(), website_url: f.website_url.trim(), description: f.description ?? '', environment: f.environment }
      if (id) { await d.update('projects', id, body); await log(d, id, 'project_updated', 'project', id, { name: body.name }) }
      else { const p = await d.insert('projects', { ...body, owner_id: uid }); await log(d, p.id, 'project_created', 'project', p.id, { name: body.name }); setPid(p.id) }
    }, id ? 'Project saved' : 'Project created'),

    deleteProject: (p: Row) => run((d) => d.remove('projects', p.id), `Deleted ${p.name}`),

    savePatch: (f: Row, existing?: Row, note = '') => run(async (d) => {
      const base = { title: f.title.trim(), description: f.description ?? '', target_selector: f.target_selector.trim(), patch_type: f.patch_type, patch_code: f.patch_code }
      if (!existing) {
        const p = await d.insert('patches', { ...base, project_id: f.project_id, author_id: uid, status: 'Draft', current_version: 1, target_metadata: {} })
        await addVersion(d, p, 1, note || 'Initial draft'); await log(d, p.project_id, 'patch_created', 'patch', p.id, { title: p.title }); setPatchId(p.id)
        await scan(d, p.project_id); return p
      }
      const changed = (['target_selector', 'patch_type', 'patch_code'] as const).some((k) => existing[k] !== base[k])
      const v = changed ? existing.current_version + 1 : existing.current_version
      const selChanged = base.target_selector !== existing.target_selector
      const p = await d.update('patches', existing.id, { ...base, current_version: v, status: changed ? 'Draft' : existing.status,
        target_metadata: selChanged ? { ...existing.target_metadata, fingerprint: undefined, lastTest: undefined, tracking: undefined } : existing.target_metadata })
      if (changed) await addVersion(d, p, v, note || 'Edited patch')
      await log(d, p.project_id, 'patch_edited', 'patch', p.id, { title: p.title, version: v })
      await scan(d, p.project_id); return p
    }, 'Patch saved'),

    deletePatch: (p: Row) => run(async (d) => { await d.remove('patches', p.id); await log(d, p.project_id, 'patch_deleted', 'patch', p.id, { title: p.title }); setPatchId(null) }, 'Patch deleted'),

    submitForReview: (p: Row) => run(async (d) => {
      await d.update('patches', p.id, { status: 'Pending Review' })
      await log(d, p.project_id, 'patch_submitted', 'patch', p.id, { title: p.title, version: p.current_version }); await scan(d, p.project_id)
    }, 'Submitted for review'),

    checkPatch: async (p: Row): Promise<TestResult | null> => {
      const r = await runTest(p)
      await run(async (d) => {
        const meta = { ...p.target_metadata, lastTest: { ...r, version: p.current_version }, tracking: r.tracking?.status, fingerprint: p.target_metadata?.fingerprint ?? r.tracking?.fingerprint ?? undefined }
        const status = r.overall === 'Failed' ? 'Failed' : ['Draft', 'Failed'].includes(p.status) ? 'Testing' : p.status
        await d.update('patches', p.id, { target_metadata: meta, status })
        await log(d, p.project_id, 'test_executed', 'patch', p.id, { overall: r.overall, version: p.current_version })
        if (status === 'Testing') await scan(d, p.project_id)
      })
      return r
    },

    retarget: (p: Row, sel: string) => run(async (d) => {
      const np = await d.update('patches', p.id, { target_selector: sel, current_version: p.current_version + 1, status: 'Draft', target_metadata: { ...p.target_metadata, lastTest: undefined, tracking: undefined } })
      await addVersion(d, np, np.current_version, `Re-targeted to ${sel} (confirmed by user)`)
      await log(d, p.project_id, 'patch_retargeted', 'patch', p.id, { from: p.target_selector, to: sel })
    }, 'Target updated. Re-run checks.'),

    review: (p: Row, status: 'Approved' | 'Rejected', comments: string) => run(async (d) => {
      const t = p.target_metadata?.lastTest
      if (status === 'Approved' && (!t || t.version !== p.current_version || t.overall === 'Failed')) throw new Error(`Run checks on v${p.current_version} first. Approval needs a current, non-failing test.`)
      await d.insert('patch_reviews', { patch_id: p.id, reviewer_id: uid, status, comments })
      await d.update('patches', p.id, { status: status === 'Approved' ? 'Approved' : 'Draft' })
      await log(d, p.project_id, status === 'Approved' ? 'patch_approved' : 'patch_rejected', 'patch', p.id, { comments })
    }, 'Review recorded'),

    deploy: (p: Row) => run(async (d) => {
      const t = p.target_metadata?.lastTest
      if (p.status !== 'Approved') throw new Error('Only approved patches can be deployed.')
      if (!t || t.version !== p.current_version || t.overall === 'Failed') throw new Error(`Run passing checks on v${p.current_version} before deploying.`)
      await d.insert('deployments', { project_id: p.project_id, patch_id: p.id, patch_version: p.current_version, environment: 'demo (simulated)', status: 'simulated_deployed', test_results: t, error_details: null })
      await d.update('patches', p.id, { status: 'Deployed' })
      await log(d, p.project_id, 'demo_deploy_completed', 'patch', p.id, { version: p.current_version, simulated: true })
    }, 'Simulated deployment completed (demo site only)'),

    rollback: (p: Row) => run(async (d) => {
      const vs = data.patch_versions.filter((v) => v.patch_id === p.id)
      const deps = data.deployments.filter((x) => x.patch_id === p.id && x.status === 'simulated_deployed').sort(byDesc('created_at'))
      const prev = deps.map((x) => vs.find((v) => v.version_number === x.patch_version)).find((v) => v && v.patch_code !== p.patch_code)
      if (prev) {
        const nv = p.current_version + 1
        const np = await d.update('patches', p.id, { patch_code: prev.patch_code, target_selector: prev.target_selector, patch_type: prev.patch_type, current_version: nv, status: 'Deployed' })
        await addVersion(d, np, nv, `Rollback: restored v${prev.version_number}`)
        await d.insert('deployments', { project_id: p.project_id, patch_id: p.id, patch_version: nv, environment: 'demo (simulated)', status: 'rolled_back', test_results: null, error_details: `Restored v${prev.version_number} as v${nv}` })
      } else {
        await d.update('patches', p.id, { status: 'Rolled Back' })
        await d.insert('deployments', { project_id: p.project_id, patch_id: p.id, patch_version: p.current_version, environment: 'demo (simulated)', status: 'rolled_back', test_results: null, error_details: 'No earlier deployed version. Patch removed from the demo environment.' })
      }
      await log(d, p.project_id, 'patch_rolled_back', 'patch', p.id, { restored: prev?.version_number ?? null })
    }, 'Rolled back. History kept.'),

    scanProject: () => run(async (d) => { await scan(d, pid!) }, 'Conflict scan finished'),

    setConflict: (c: Row, status: string, approve?: Row) => run(async (d) => {
      await d.update('patch_conflicts', c.id, { status })
      if (approve) { await d.update('patches', approve.id, { status: 'Approved' }); await log(d, c.project_id, 'patch_approved', 'patch', approve.id, { reason: 'conflict resolution' }) }
    }, 'Conflict updated'),

    seedSample: () => run(async (d) => {
      const s = buildSeed(uid!, actor, true)
      for (const t of TABLES) for (const r of s[t]) await d.insert(t, r)
    }, 'Sample project created'),
  }
  return A
}

const Ctx = createContext<ReturnType<typeof useStore>>(null!)
export const AppProvider = ({ children }: any) => <Ctx.Provider value={useStore()}>{children}</Ctx.Provider>
export const useApp = () => useContext(Ctx)
