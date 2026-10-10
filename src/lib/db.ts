import { supabase } from './supabase'

export const TABLES = ['projects', 'patches', 'patch_versions', 'deployments', 'patch_reviews', 'patch_conflicts', 'audit_logs'] as const
export type Table = (typeof TABLES)[number]
export type Row = Record<string, any>
export type Snapshot = Record<Table, Row[]>
export const emptySnap = (): Snapshot => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Snapshot

export interface Db {
  load(): Promise<Snapshot>
  insert(t: Table, r: Row): Promise<Row>
  update(t: Table, id: string, r: Row): Promise<Row>
  remove(t: Table, id: string): Promise<void>
}

/** Real backend. Every failure throws so the UI never shows a fake success. */
export const liveDb: Db = {
  async load() {
    const s = emptySnap()
    await Promise.all(TABLES.map(async (t) => {
      const { data, error } = await supabase!.from(t).select('*').order('created_at', { ascending: false })
      if (error) throw new Error(`${t}: ${error.message}`)
      s[t] = data ?? []
    }))
    return s
  },
  async insert(t, r) {
    const { data, error } = await supabase!.from(t).insert(r).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  async update(t, id, r) {
    const { data, error } = await supabase!.from(t).update(r).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  async remove(t, id) {
    const { error } = await supabase!.from(t).delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}

/** In-memory demo backend. Never touches Supabase or localStorage; resets on refresh. */
export function makeDemoDb(seed: Snapshot): Db {
  const s: Snapshot = structuredClone(seed)
  return {
    async load() { return structuredClone(s) },
    async insert(t, r) {
      const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r }
      s[t].unshift(row)
      return structuredClone(row)
    },
    async update(t, id, r) {
      const i = s[t].findIndex((x) => x.id === id)
      if (i < 0) throw new Error('Record not found')
      s[t][i] = { ...s[t][i], ...r, ...(t === 'projects' || t === 'patches' ? { updated_at: new Date().toISOString() } : {}) }
      return structuredClone(s[t][i])
    },
    async remove(t, id) {
      s[t] = s[t].filter((x) => x.id !== id)
      if (t === 'projects') {
        const pids = new Set(s.patches.filter((p) => p.project_id === id).map((p) => p.id))
        for (const k of TABLES) s[k] = s[k].filter((x) => x.project_id !== id && !pids.has(x.patch_id) && !pids.has(x.conflicting_patch_id))
      }
    },
  }
}
