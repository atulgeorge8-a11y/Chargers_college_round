import { useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { FlaskConical, FolderGit2, GitMerge, History, LayoutDashboard, LogOut, Menu, ScrollText, Settings as Cog, SquarePen } from 'lucide-react'
import { useApp } from './lib/store'
import { Badge, Spinner, Toasts, cx } from './ui'
import { Auth, Landing } from './pages/Public'
import { Dashboard, Projects } from './pages/Core'
import { Editor, Preview, HistoryPage } from './pages/Work'
import { Review, Audit, SettingsPage } from './pages/Admin'

const NAV: [string, string, any][] = [['dashboard', 'Dashboard', LayoutDashboard], ['projects', 'Websites', FolderGit2], ['editor', 'Patch editor', SquarePen],
  ['preview', 'Preview & testing', FlaskConical], ['history', 'History & rollback', History], ['review', 'Review & conflicts', GitMerge], ['audit', 'Audit logs', ScrollText], ['settings', 'Settings', Cog]]

function Shell() {
  const A = useApp(), nav = useNavigate(), [open, setOpen] = useState(false)
  if (A.booting) return <Spinner />
  if (!A.mode) return <Navigate to="/auth" replace />
  const links = <nav className="flex flex-col gap-1 p-3">{NAV.map(([to, label, Icon]) =>
    <NavLink key={to} to={`/app/${to}`} onClick={() => setOpen(false)} className={({ isActive }) => cx('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-indigo-500/15 text-white' : 'text-slate-400 hover:bg-ink-700/60 hover:text-slate-200')}><Icon className="h-4 w-4" />{label}</NavLink>)}</nav>
  return <div className="min-h-screen md:flex">
    <aside className={cx('fixed inset-y-0 left-0 z-40 w-60 border-r border-line bg-ink-950 md:static md:block', open ? 'block' : 'hidden')}>
      <div className="px-5 py-4 text-sm font-semibold tracking-wide text-white">PATCHWORK</div>{links}</aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-line bg-ink-900/90 px-4 py-2 backdrop-blur">
        <button className="md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}><Menu className="h-5 w-5" /></button>
        <select aria-label="Project" value={A.pid ?? ''} onChange={(e) => A.setPid(e.target.value)} className="rounded-lg border border-line bg-ink-800 px-2 py-1.5 text-sm">
          {!A.data.projects.length && <option value="">No projects yet</option>}{A.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {A.mode === 'demo' && <Badge label="Testing" text="Demo mode: in-memory, resets on refresh" />}
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400"><span className="hidden sm:inline">{A.actor}</span>
          <button className="flex items-center gap-1 hover:text-white" onClick={async () => { await A.signOut(); nav('/') }}><LogOut className="h-4 w-4" />{A.mode === 'demo' ? 'Exit demo' : 'Log out'}</button></div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{A.loadError && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">Could not load data: {A.loadError}. Check that the SQL migration has been run.</div>}
        {A.loading && !A.data.projects.length ? <Spinner /> : <Outlet />}</main>
    </div></div>
}

export default function App() {
  const A = useApp()
  return <><Routes>
    <Route path="/" element={<Landing />} /><Route path="/auth" element={<Auth />} />
    <Route path="/app" element={<Shell />}><Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} /><Route path="projects" element={<Projects />} /><Route path="editor" element={<Editor />} />
      <Route path="preview" element={<Preview />} /><Route path="history" element={<HistoryPage />} /><Route path="review" element={<Review />} />
      <Route path="audit" element={<Audit />} /><Route path="settings" element={<SettingsPage />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} /></Routes><Toasts items={A.toasts} /></>
}
