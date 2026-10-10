import { emptySnap, Snapshot } from './db'

export const DEMO_UID = '00000000-0000-4000-8000-000000000001'
export const DEMO_URL = 'demo://shopease'
const id = () => crypto.randomUUID()
const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString()
const pass = (v: number, h: number, overall = 'Passed', extra: any[] = []) => ({
  at: ago(h), version: v, overall, tracking: { status: 'Element Found', candidates: [], fingerprint: null },
  scope: 'Basic automated checks on the demo site only. This is not a full regression test.',
  results: [{ name: 'Target element', status: 'Passed', detail: 'Matched target.' }, { name: 'Syntax', status: 'Passed', detail: 'Patch parses.' },
    { name: 'Expected change appears', status: 'Passed', detail: 'Change detected on the target element.' }, ...extra],
})

/** Sample "ShopEase Demo Store" data: patches, versions, test results, deployments and one conflict. */
export function buildSeed(uid: string, actor: string, live = false): Snapshot {
  const s = emptySnap(), pid = id()
  s.projects.push({ id: pid, owner_id: uid, name: live ? 'ShopEase Demo Store (sample)' : 'ShopEase Demo Store', website_url: DEMO_URL,
    description: 'Sample storefront bundled with PATCHWORK. Patches run against the built-in demo site.', environment: 'Staging', created_at: ago(96), updated_at: ago(2) })
  const mk = (title: string, description: string, sel: string, type: string, code: string, status: string, ver: number, h: number, meta: any, prev?: string) => {
    const p = { id: id(), project_id: pid, author_id: uid, title, description, target_selector: sel, target_metadata: meta, patch_type: type, patch_code: code, status, current_version: ver, created_at: ago(h), updated_at: ago(h / 2) }
    s.patches.push(p)
    for (let v = 1; v <= ver; v++) s.patch_versions.push({ id: id(), patch_id: p.id, version_number: v, target_selector: sel, patch_type: type, patch_code: v === ver ? code : prev ?? code, author_id: uid, change_description: v === 1 ? 'Initial draft' : 'Refine fix after testing', created_at: ago(h - v) })
    return p
  }
  const fpCheckout = { tag: 'button', id: 'checkout-btn', testid: 'checkout', aria: 'Checkout', text: 'Checkout' }
  const checkout = mk('Fix Checkout Button', 'Checkout button ships disabled after the last release, so nobody can pay.', '#checkout-btn', 'JavaScript',
    "el.removeAttribute('disabled');\nel.style.pointerEvents = 'auto';", 'Deployed', 2, 60, { fingerprint: fpCheckout, tracking: 'Element Found', lastTest: pass(2, 40, 'Passed', [{ name: 'Basic interactions', status: 'Passed', detail: 'Clicked every button and link; nothing threw.' }]) },
    "el.removeAttribute('disabled');")
  const nav = mk('Repair Navigation Spacing', 'Nav links are touching each other.', 'nav a', 'CSS', 'margin-right: 24px;\npadding: 8px 12px;', 'Approved', 1, 48,
    { fingerprint: { tag: 'a', id: null, testid: null, aria: null, text: 'Shop' }, tracking: 'Element Found', lastTest: pass(1, 30) })
  const desc = mk('Update Product Description', 'Shipping estimate is out of date.', '#product-1 .desc', 'Content', 'Hand-stitched leather backpack. Now ships in 2-3 days.', 'Pending Review', 1, 24,
    { fingerprint: { tag: 'p', id: null, testid: null, aria: null, text: 'Hand-stitched leather backpack. Ships in 5-7 weeks.' }, tracking: 'Element Found', lastTest: pass(1, 12) })
  mk('Fix Mobile Product Layout', 'Product grid overflows on phones.', '.products', 'CSS', 'grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));', 'Testing', 1, 10,
    { fingerprint: { tag: 'section', id: null, testid: null, aria: null, text: '' }, tracking: 'Element Found', lastTest: pass(1, 4, 'Needs Review') })
  const maint = mk('Disable Checkout During Maintenance', 'Block checkout while the payment provider is down.', '#checkout-btn', 'JavaScript', "el.disabled = true;\nel.textContent = 'Back soon';", 'Pending Review', 1, 6, { fingerprint: fpCheckout })

  const dep = (p: any, v: number, status: string, h: number, err: string | null = null) =>
    s.deployments.push({ id: id(), project_id: pid, patch_id: p.id, patch_version: v, environment: 'demo (simulated)', status, test_results: pass(v, h + 1), error_details: err, created_at: ago(h) })
  dep(checkout, 1, 'simulated_deployed', 50); dep(checkout, 2, 'simulated_deployed', 36)
  s.patch_conflicts.push({ id: id(), project_id: pid, patch_id: maint.id, conflicting_patch_id: checkout.id, conflict_type: 'same_element', description: 'Both target #checkout-btn', status: 'open', created_at: ago(5) })
  s.patch_reviews.push({ id: id(), patch_id: nav.id, reviewer_id: uid, status: 'Approved', comments: 'Spacing matches the design.', created_at: ago(20) })
  const log = (action: string, type: string, eid: string, h: number, details: any = {}) =>
    s.audit_logs.push({ id: id(), project_id: pid, actor_id: uid, action, entity_type: type, entity_id: eid, details: { ...details, actor: actor }, created_at: ago(h) })
  log('project_created', 'project', pid, 96, { name: s.projects[0].name })
  log('patch_created', 'patch', checkout.id, 60, { title: checkout.title }); log('test_executed', 'patch', checkout.id, 40, { overall: 'Passed' })
  log('demo_deploy_completed', 'patch', checkout.id, 36, { version: 2 }); log('patch_approved', 'patch', nav.id, 20)
  log('patch_submitted', 'patch', desc.id, 12, { title: desc.title }); log('conflict_detected', 'patch', maint.id, 5, { with: checkout.title })
  return s
}
