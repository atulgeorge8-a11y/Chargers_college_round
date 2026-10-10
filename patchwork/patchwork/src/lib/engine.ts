import type { Row } from './db'

export const ACTIVE = ['Testing', 'Pending Review', 'Approved', 'Deployed']
export type Result = { name: string; status: 'Passed' | 'Failed' | 'Needs Review'; detail: string }
export type TestResult = {
  at: string; version?: number; overall: 'Passed' | 'Failed' | 'Needs Review'; results: Result[]
  tracking: { status: string; candidates: string[]; fingerprint: any } | null; scope: string
}

const BLOCKED: [RegExp, string][] = [
  [/\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, 'network access'],
  [/\beval\b|\bFunction\s*\(|\bimport\s*\(|setTimeout\s*\(\s*['"`]/, 'dynamic code execution'],
  [/document\.cookie|localStorage|sessionStorage|indexedDB/, 'browser storage'],
  [/window\.(open|top|parent)|\b(top|parent)\s*[.[]|\blocation\b|\bhistory\b/, 'navigation or frame access'],
  [/<\s*script|<\s*iframe|innerHTML|outerHTML\s*=|insertAdjacentHTML|document\.write/i, 'raw HTML injection'],
]
export const cssProps = (code: string) =>
  [...code.replace(/[^{};]*\{/g, ' ').matchAll(/([a-z-]+)\s*:\s*[^;{}]+/gi)].map((m) => m[1].toLowerCase())

/** Static allowlist checks that run in the parent before anything touches the sandbox. */
export function staticCheck(p: Row): string[] {
  const out: string[] = []
  try { document.createDocumentFragment().querySelector(p.target_selector) } catch { out.push('Selector is not valid CSS.') }
  if (!p.patch_code?.trim()) out.push('Patch code is empty.')
  if (p.patch_type === 'JavaScript') for (const [re, why] of BLOCKED) if (re.test(p.patch_code)) out.push(`Blocked by allowlist: ${why}. Patch JS may only change the target element.`)
  if (p.patch_type === 'CSS' && /@import|url\s*\(\s*['"]?(https?:|\/\/)/i.test(p.patch_code)) out.push('Blocked by allowlist: external CSS resources.')
  return out
}

export type Conflict = { patch_id: string; conflicting_patch_id: string; conflict_type: string; description: string }
export function detectConflicts(patches: Row[]): Conflict[] {
  const live = patches.filter((p) => ACTIVE.includes(p.status))
  const out: Conflict[] = []
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]
    if (a.project_id !== b.project_id) continue
    const same = a.target_selector.trim() === b.target_selector.trim()
    const mk = (conflict_type: string, description: string) => out.push({ patch_id: a.id, conflicting_patch_id: b.id, conflict_type, description })
    if (same && a.patch_type === 'CSS' && b.patch_type === 'CSS') {
      const shared = cssProps(a.patch_code).filter((x) => cssProps(b.patch_code).includes(x))
      shared.length ? mk('css_property', `Both set ${[...new Set(shared)].join(', ')} on ${a.target_selector}`) : mk('same_element', `Both target ${a.target_selector}`)
    } else if (same && a.patch_type === 'Content' && b.patch_type === 'Content') mk('content_replace', `Both replace the text of ${a.target_selector}`)
    else if (same) mk('same_element', `Both target ${a.target_selector}`)
    else for (const [x, y] of [[a, b], [b, a]]) if (x.patch_type === 'JavaScript' && x.patch_code.includes(y.target_selector)) { mk('target_modified', `${x.title} references ${y.target_selector}, which ${y.title} modifies`); break }
  }
  return out
}

export const SITE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,sans-serif;color:#1f2937;background:#fafaf9}
nav{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:#fff;border-bottom:1px solid #e5e7eb}
nav .links{display:flex}nav a{color:#374151;text-decoration:none}.brand{font-weight:700}
main{padding:24px}.products{display:grid;grid-template-columns:repeat(3,260px);gap:16px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px}.card h3{margin:0 0 4px}.desc{color:#6b7280;margin:0 0 8px}
button{font:inherit;padding:8px 14px;border-radius:6px;border:0;background:#111827;color:#fff;cursor:pointer}
button[disabled]{background:#9ca3af;cursor:not-allowed}
form{margin-top:24px;background:#fff;border:1px solid #e5e7eb;padding:14px;border-radius:8px;max-width:420px}
input{width:100%;padding:8px;margin:6px 0 10px;border:1px solid #d1d5db;border-radius:6px}
footer{padding:20px 24px;color:#6b7280;border-top:1px solid #e5e7eb;margin-top:32px}#status{margin-top:12px;color:#047857}
</style></head><body>
<nav><span class="brand">ShopEase</span><div class="links"><a href="#">Shop</a><a href="#">Deals</a><a href="#">Support</a></div></nav>
<main><h1>Spring collection</h1>
<section class="products">
<article class="card" id="product-1"><h3>Leather backpack</h3><p class="desc">Hand-stitched leather backpack. Ships in 5-7 weeks.</p><strong>$129</strong></article>
<article class="card" id="product-2"><h3>Canvas tote</h3><p class="desc">Everyday tote with an inner zip pocket.</p><strong>$48</strong></article>
<article class="card" id="product-3"><h3>Travel pouch</h3><p class="desc">Water-resistant organiser for cables and cards.</p><strong>$24</strong></article>
</section>
<p><button id="checkout-btn" data-testid="checkout" aria-label="Checkout" disabled>Checkout</button></p><p id="status"></p>
<form id="signup"><label>Email<input name="email" type="email" placeholder="you@example.com"></label><button id="newsletter-submit" type="submit">Subscribe</button></form>
</main><footer>ShopEase demo store. Not a real shop.</footer>
<script>document.getElementById('checkout-btn').addEventListener('click',function(){document.getElementById('status').textContent='Order placed.'});
document.getElementById('signup').addEventListener('submit',function(e){e.preventDefault();document.getElementById('status').textContent='Subscribed.'})</script>
</body></html>`

// Runs INSIDE the sandboxed iframe (sandbox="allow-scripts", no same-origin). Plain ES5, no template literals.
const RUNNER = `(function(){
var C=window.__PW;delete window.__PW;
var post=function(m){m.pw=true;m.nonce=C.nonce;parent.postMessage(m,'*')};
var errs=[];window.addEventListener('error',function(e){errs.push(e.message||'Script error')});
function apply(p){
 if(p.type==='CSS'){var s=document.createElement('style');s.textContent=p.code.indexOf('{')>-1?p.code:p.selector+'{'+p.code+'}';document.head.appendChild(s);return}
 var el=document.querySelector(p.selector);if(!el)throw new Error('Element not found: '+p.selector);
 if(p.type==='Content'){el.textContent=p.code;return}
 new Function('el','document',p.code)(el,document)}
function sel(e){if(e.id)return '#'+e.id;var t=e.getAttribute('data-testid');if(t)return e.tagName.toLowerCase()+'[data-testid="'+t+'"]';return e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\\s+/).join('.'):'')}
function fp(e){return{tag:e.tagName.toLowerCase(),id:e.id||null,testid:e.getAttribute('data-testid'),aria:e.getAttribute('aria-label'),text:(e.textContent||'').trim().slice(0,60)}}
function find(m){var out=[];function add(q){try{document.querySelectorAll(q).forEach(function(e){var s=sel(e);if(out.indexOf(s)<0)out.push(s)})}catch(x){}}
 if(m.id)add('#'+m.id);if(m.testid)add('[data-testid="'+m.testid+'"]');if(m.aria)add('[aria-label="'+m.aria+'"]');
 if(m.text)document.querySelectorAll('button,a,h1,h2,h3,p,label,input,li').forEach(function(e){if((e.textContent||'').trim()===m.text){var s=sel(e);if(out.indexOf(s)<0)out.push(s)}});
 return out.slice(0,4)}
var KEYS=['display','pointer-events','opacity','visibility','color','background-color','margin','padding'];
function snap(e){var c=getComputedStyle(e);return e.outerHTML+KEYS.map(function(k){return c.getPropertyValue(k)}).join('|')}
if(C.mode==='preview'){C.patches.forEach(function(p){try{apply(p)}catch(e){errs.push(p.title+': '+e.message)}});post({kind:'preview',errors:errs});return}
var p=C.patch,R=[],d=[];function add(n,s,t){R.push({name:n,status:s,detail:t})}
var el=null,bad=false;try{el=document.querySelector(p.selector)}catch(e){bad=true}
var f=(p.meta||{}).fingerprint||{},track={status:'Element Found',candidates:[],fingerprint:null};
if(bad){track.status='Element Missing';add('Target element','Failed','Selector is not valid CSS.')}
else if(!el){var c=find(f);track.candidates=c;track.status=c.length?'Possible Element Change':'Element Missing';
 add('Target element','Failed',c.length?'Selector no longer matches. Possible new target(s): '+c.join(', ')+'. Review and confirm before re-targeting. Nothing was applied.':'Selector matches nothing on the demo site.')}
else{track.fingerprint=fp(el);
 if(f.tag&&f.tag!==track.fingerprint.tag){track.status='Patch Needs Review';add('Target element','Needs Review','Matched <'+track.fingerprint.tag+'> but the patch was written for <'+f.tag+'>.')}
 else add('Target element','Passed','Matched <'+track.fingerprint.tag+'>.')}
var syn=true;
if(p.type==='JavaScript'){try{new Function('el','document',p.code);add('Syntax','Passed','JavaScript parses.')}catch(e){syn=false;add('Syntax','Failed',e.message)}}
else if(p.type==='CSS'){p.code.replace(/[^{};]*\\{/g,' ').replace(/([a-z-]+)\\s*:\\s*([^;{}]+)/gi,function(m,a,b){d.push([a.toLowerCase(),b.trim()]);return m});
 var badd=d.filter(function(x){return !CSS.supports(x[0],x[1])});
 if(!d.length||badd.length){syn=false;add('Syntax','Failed',!d.length?'No CSS declarations found.':'Unsupported declaration: '+badd.map(function(x){return x[0]+': '+x[1]}).join('; '))}else add('Syntax','Passed',d.length+' declaration(s) valid.')}
else{if(p.code.trim())add('Syntax','Passed','Replacement text provided.');else{syn=false;add('Syntax','Failed','Replacement text is empty.')}}
var before=null;if(el){var cs=getComputedStyle(el);before={snap:snap(el),vals:d.map(function(x){return cs.getPropertyValue(x[0])})}}
var applied=false;
if(el&&syn){try{apply(p);applied=true;add('Applies cleanly','Passed','Patch ran in the sandbox without throwing.')}catch(e){add('Applies cleanly','Failed',e.message)}}
if(applied){var changed;
 if(p.type==='Content')changed=el.textContent===p.code;
 else if(p.type==='CSS'){var c2=getComputedStyle(el);changed=d.some(function(x,i){return c2.getPropertyValue(x[0])!==before.vals[i]})}
 else changed=snap(el)!==before.snap;
 add('Expected change appears',changed?'Passed':(p.type==='Content'?'Failed':'Needs Review'),changed?'Change detected on the target element.':(p.type==='Content'?'Target text does not match the replacement.':'No computed change at this viewport. A more specific rule may override it, or it may only apply at other screen sizes.'));
 var n0=errs.length;
 try{document.querySelectorAll('button,a').forEach(function(b){b.addEventListener('click',function(ev){ev.preventDefault()},true);b.click()});document.querySelectorAll('form').forEach(function(fm){fm.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))})}catch(e){errs.push(e.message)}
 var dis=el.disabled||getComputedStyle(el).pointerEvents==='none';
 add('Basic interactions',errs.length>n0?'Failed':dis?'Needs Review':'Passed',errs.length>n0?'A click or submit raised an error.':dis?'Target is still disabled or not clickable. Confirm that is intended.':'Clicked every button and link and submitted forms; nothing threw.');
 add('Runtime errors',errs.length?'Failed':'Passed',errs.length?errs.join('; '):'No errors reported.')}
post({kind:'test',results:R,tracking:track});
})();`

export function buildDoc(cfg: Record<string, any>) {
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c')
  return SITE.replace('</body>', () => `<script>window.__PW=${json}</script><script>${RUNNER}</script></body>`)
}

const finish = (results: Result[], tracking: TestResult['tracking']): TestResult => ({
  at: new Date().toISOString(), tracking, results,
  overall: results.some((r) => r.status === 'Failed') ? 'Failed' : results.some((r) => r.status === 'Needs Review') ? 'Needs Review' : 'Passed',
  scope: 'Basic automated checks on the demo site only. This is not a full regression test.',
})

export function runTest(p: Row): Promise<TestResult> {
  const issues = staticCheck(p)
  if (issues.length) return Promise.resolve(finish([{ name: 'Safety and validity', status: 'Failed', detail: issues.join(' ') }], { status: 'Patch Needs Review', candidates: [], fingerprint: null }))
  return new Promise((resolve) => {
    const nonce = crypto.randomUUID()
    const f = document.createElement('iframe')
    f.setAttribute('sandbox', 'allow-scripts'); f.style.display = 'none'
    const done = (r: TestResult) => { window.removeEventListener('message', h); clearTimeout(t); f.remove(); resolve(r) }
    const h = (e: MessageEvent) => { if (e.source === f.contentWindow && e.data?.pw && e.data.nonce === nonce && e.data.kind === 'test') done(finish(e.data.results, e.data.tracking)) }
    const t = setTimeout(() => done(finish([{ name: 'Sandbox run', status: 'Failed', detail: 'Timed out. The patch may loop forever.' }], null)), 4000)
    window.addEventListener('message', h)
    f.srcdoc = buildDoc({ mode: 'test', nonce, patch: { id: p.id, title: p.title, type: p.patch_type, selector: p.target_selector, code: p.patch_code, meta: p.target_metadata } })
    document.body.appendChild(f)
  })
}

export const toPreviewPatch = (p: Row) => ({ id: p.id, title: p.title, type: p.patch_type, selector: p.target_selector, code: p.patch_code })
