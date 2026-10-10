# PATCHWORK – Hotfix the Internet

React + Vite + TypeScript + Tailwind + Supabase. Independent website patches with sandboxed preview, automated checks, conflict detection, versioning and rollback.

## Setup
1. `npm install`
2. Create a Supabase project. In **SQL Editor**, run `supabase/migrations/001_patchwork.sql`.
3. `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon/publishable key only; never the service_role key).
4. In Supabase → Authentication, disable "Confirm email" for faster local testing (optional).
5. `npm run dev`. Sign up, then use **Create sample data** on the dashboard to get the ShopEase project.

No Supabase yet? Click **Explore demo**. Demo data is in-memory only and resets on refresh.

## Fully implemented
Auth (sign up, login, logout, persisted session, protected routes) · project CRUD · patch CRUD · version per change · version diff · review workflow · conflict detection (same element, shared CSS property, same content, JS referencing another patch's target) · element tracking with fallback candidates (user must confirm) · audit logs · deployment and rollback history (append-only) · RLS on every table, including membership-based access.

## Simulated or limited
- **Deployment is simulated.** It updates the demo site only; no production adapter exists.
- **Previews run only on the built-in ShopEase demo site.** External sites usually block iframes and cross-origin DOM access.
- Checks are basic (target exists, syntax, expected change, click/submit smoke test, runtime errors). They are not a full regression test.
- Patch editor is a plain monospace textarea, not Monaco. shadcn/ui is not installed; components are hand-written Tailwind equivalents.
- No UI for adding project members yet; the `project_members` table and RLS support it.
- Real-time collaborative editing is not implemented.
- Not compiled or run in this environment: run `npm run build` first to surface any type errors.
