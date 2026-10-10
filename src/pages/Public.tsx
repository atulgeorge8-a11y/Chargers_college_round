import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Boxes, FlaskConical, GitMerge, MousePointerClick, ScanSearch, Undo2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/store'
import { Badge, Btn, Card, Field, inputCls } from '../ui'

const FEATURES = [[MousePointerClick, 'Visual patching', 'Write CSS, JavaScript or content patches against a selector and see the intended change before anything ships.'],
  [ScanSearch, 'Smart element tracking', 'Each patch remembers its target. When the selector stops matching, you get a review prompt, never a silent re-target.'],
  [FlaskConical, 'Isolated testing', 'Patches run in a sandboxed frame with no access to the app, your session or your keys.'],
  [GitMerge, 'Conflict detection', 'Overlapping selectors, CSS properties and replaced text are flagged before two patches collide.'],
  [Undo2, 'Instant rollback', 'Every save is a version. Rolling back adds a history entry instead of erasing the old one.']] as const

export function Landing() {
  const A = useApp(), nav = useNavigate()
  return <div className="min-h-screen">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><span className="flex items-center gap-2 font-semibold text-white"><Boxes className="h-5 w-5 text-indigo-400" />PATCHWORK</span>
      <nav className="flex gap-2"><Btn onClick={() => { A.enterDemo(); nav('/app/dashboard') }}>Explore demo</Btn><Link to="/auth"><Btn variant="primary">Get started</Btn></Link></nav></header>
    <section className="mx-auto max-w-6xl px-5 pb-10 pt-14">
      <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">Fix websites without rebuilding everything.</h1>
      <p className="mt-4 max-w-2xl text-slate-400">Ship small, independent patches to a live site. Preview each one in isolation, run automated checks, and roll back in one click if something breaks.</p>
      <div className="mt-6 flex gap-3"><Link to="/auth"><Btn variant="primary" className="px-4 py-2">Get started</Btn></Link><Btn className="px-4 py-2" onClick={() => { A.enterDemo(); nav('/app/dashboard') }}>Explore demo</Btn></div>
      <Card className="mt-10 p-4"><div className="mb-3 flex items-center justify-between text-sm"><span className="text-white">ShopEase Demo Store</span><Badge label="Staging" /></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[['Fix Checkout Button', 'Deployed'], ['Repair Navigation Spacing', 'Approved'], ['Update Product Description', 'Pending Review'], ['Fix Mobile Product Layout', 'Testing']].map(([t, s]) =>
          <div key={t} className="flex items-center justify-between rounded-lg border border-line bg-ink-900 p-3 text-sm"><span>{t}</span><Badge label={s} /></div>)}
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><span>Conflict on #checkout-btn</span><Badge label="open" /></div></div></Card></section>
    <section className="mx-auto grid max-w-6xl gap-3 px-5 pb-12 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([Icon, t, d]) =>
      <Card key={t} className="p-4"><Icon className="mb-2 h-5 w-5 text-violet-300" /><h3 className="font-medium text-white">{t}</h3><p className="mt-1 text-sm text-slate-400">{d}</p></Card>)}</section>
    <section className="mx-auto max-w-6xl px-5 pb-16"><Card className="p-8 text-center"><h2 className="text-2xl font-semibold text-white">Patch your first bug in a few minutes</h2>
      <p className="mt-2 text-slate-400">Try the sample store with no account, or sign up to keep your own projects.</p>
      <div className="mt-5 flex justify-center gap-3"><Link to="/auth"><Btn variant="primary">Get started</Btn></Link><Btn onClick={() => { A.enterDemo(); nav('/app/dashboard') }}>Explore demo</Btn></div></Card></section></div>
}

export function Auth() {
  const A = useApp(), nav = useNavigate()
  const [signup, setSignup] = useState(false), [f, setF] = useState({ name: '', email: '', password: '' }), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ err?: string; ok?: string }>({})
  if (A.mode === 'live') return <Navigate to="/app/dashboard" replace />
  const submit = async () => {
    setMsg({})
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setMsg({ err: 'Enter a valid email address.' })
    if (f.password.length < 8) return setMsg({ err: 'Password must be at least 8 characters.' })
    if (signup && !f.name.trim()) return setMsg({ err: 'Enter a display name.' })
    setBusy(true)
    const r = signup ? await supabase!.auth.signUp({ email: f.email, password: f.password, options: { data: { display_name: f.name.trim() } } }) : await supabase!.auth.signInWithPassword({ email: f.email, password: f.password })
    setBusy(false)
    if (r.error) return setMsg({ err: r.error.message })
    if (signup && !r.data.session) setMsg({ ok: 'Account created. Check your email to confirm, then log in.' }); else nav('/app/dashboard')
  }
  return <div className="flex min-h-screen items-center justify-center p-4"><Card className="w-full max-w-sm p-6">
    <Link to="/" className="text-sm font-semibold text-white">PATCHWORK</Link><h1 className="mb-4 mt-3 text-xl font-semibold text-white">{signup ? 'Create your account' : 'Log in'}</h1>
    {!A.supabaseReady ? <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and set the URL and anon key, or use the demo.</div> :
      <div className="space-y-3">{signup && <Field label="Display name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>}
        <Field label="Email"><input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><input type="password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
        {msg.err && <p className="text-sm text-red-300">{msg.err}</p>}{msg.ok && <p className="text-sm text-emerald-300">{msg.ok}</p>}
        <Btn variant="primary" className="w-full" disabled={busy} onClick={submit}>{busy ? 'Working…' : signup ? 'Create account' : 'Log in'}</Btn>
        <button className="w-full text-sm text-slate-400 hover:text-white" onClick={() => { setSignup(!signup); setMsg({}) }}>{signup ? 'Have an account? Log in' : 'New here? Create an account'}</button></div>}
    <div className="mt-4 border-t border-line pt-4"><Btn className="w-full" onClick={() => { A.enterDemo(); nav('/app/dashboard') }}>Explore the demo without an account</Btn></div></Card></div>
}
