// Cache lab: a simulated URLSession + URLCache + server, driven by the
// student (clock, server updates, cache policy, network), plus a real
// conditional request against a public server that answers 304.

import { el, on, idScope } from './services-kit.js';

const NAME = 'networking-cache-lab';
const BODY_KB = 18;
const HEADERS_KB = 0.4;
const RTT_MS = 120;
const TRANSFER_MS = 90;
const POLICIES = [
  { key: 'protocol', label: '.useProtocolCachePolicy' },
  { key: 'reload', label: '.reloadIgnoringLocalCacheData' },
  { key: 'elseLoad', label: '.returnCacheDataElseLoad' },
  { key: 'dontLoad', label: '.returnCacheDataDontLoad' },
];

// One request through URLCache, following each policy's documented rules.
function perform(s) {
  const entry = s.cache;
  const age = entry ? s.clock - entry.storedAt : null;
  const fresh = entry && age < entry.maxAge;
  const full = () => {
    s.cache = { version: s.server.version, storedAt: s.clock, maxAge: s.server.maxAge };
    return { outcome: 'download', status: '200', bytes: BODY_KB + HEADERS_KB, ms: RTT_MS + TRANSFER_MS, path: 'server', detail: `Full download of version ${s.server.version}, stored in the cache.`,
      wire: `GET /schedule HTTP/1.1${entry && s.policy === 'protocol' ? `\nIf-None-Match: "v${entry.version}"` : ''}\n\nHTTP/1.1 200 OK\nETag: "v${s.server.version}"\nCache-Control: max-age=${s.server.maxAge}\nContent-Length: ${BODY_KB * 1024}` };
  };
  const offline = (detail) => ({ outcome: 'error', status: 'error', bytes: 0, ms: 0, path: 'none', detail });
  switch (s.policy) {
    case 'protocol':
      if (fresh) return { outcome: 'hit', status: '200 (cache)', bytes: 0, ms: 2, path: 'cache', detail: `Fresh: ${age} s old, max-age ${entry.maxAge} s. Answered from the cache, no network.` };
      if (!s.online) return offline('Offline, and the cached copy is stale or missing, so this policy fails: URLError(.notConnectedToInternet).');
      if (entry) {
        if (entry.version === s.server.version) {
          entry.storedAt = s.clock;
          entry.maxAge = s.server.maxAge;
          return { outcome: 'revalidate', status: '304 -> 200', bytes: HEADERS_KB, ms: RTT_MS, path: 'revalidate',
            wire: `GET /schedule HTTP/1.1\nIf-None-Match: "v${entry.version}"\n\nHTTP/1.1 304 Not Modified\nETag: "v${entry.version}"\nCache-Control: max-age=${s.server.maxAge}\n(no body)`, detail: `Stale, so URLSession asked If-None-Match: "v${entry.version}". The server said 304 Not Modified; your code still receives the cached body as 200.` };
        }
        const r = full();
        r.wire = `GET /schedule HTTP/1.1\nIf-None-Match: "v${entry.version}"\n\nHTTP/1.1 200 OK\nETag: "v${s.server.version}"\nCache-Control: max-age=${s.server.maxAge}\nContent-Length: ${BODY_KB * 1024}`;
        r.detail = `Stale. The server's ETag changed to "v${s.server.version}", so it sent the new body with 200.`;
        return r;
      }
      return full();
    case 'reload':
      if (!s.online) return offline('Offline. This policy always goes to the network, so it fails.');
      { const r = full(); r.detail = 'The cache was ignored on purpose (as for pull to refresh). Full download.'; return r; }
    case 'elseLoad':
      if (entry) return { outcome: 'hit', status: '200 (cache)', bytes: 0, ms: 2, path: 'cache', detail: `Cached copy used regardless of age (${age} s old)${entry.version !== s.server.version ? ', even though the server has newer data' : ''}.` };
      if (!s.online) return offline('Offline and nothing cached yet, so the load fails.');
      return full();
    default:
      if (entry) return { outcome: 'hit', status: '200 (cache)', bytes: 0, ms: 2, path: 'cache', detail: `Cached copy used (${age} s old). This policy never touches the network.` };
      return offline('Nothing cached, and this policy never loads from the network, so it fails.');
  }
}

export default {
  name: 'networking-cache-lab',
  css: `
.w-${NAME} { container-type: size; container-name: ncl; height: 100%; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .ncl { box-sizing: border-box; height: 100%; padding: 12px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px 14px; }
.w-${NAME} .ncl-top { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; }
.w-${NAME} .ncl-btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 600 12.5px var(--font-ui); padding: 7px 11px; border-radius: var(--r-sm); cursor: pointer; }
.w-${NAME} .ncl-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${NAME} .ncl-btn:disabled { opacity: .55; cursor: default; }
.w-${NAME} .ncl-field { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
.w-${NAME} .ncl-field input { width: 15px; height: 15px; margin: 0; accent-color: var(--accent); }
.w-${NAME} select { font: 12px var(--font-code); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 6px; max-width: 100%; }
.w-${NAME} button:focus-visible, .w-${NAME} select:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .ncl-left { display: flex; flex-direction: column; gap: 8px; min-height: 0; min-width: 0; }
.w-${NAME} .ncl-diagram { display: grid; grid-template-columns: 1fr 36px 1fr 36px 1fr; align-items: center; gap: 0; }
.w-${NAME} .ncl-node { border: 1.5px solid var(--line); border-radius: var(--r-md); padding: 7px 6px; text-align: center; background: var(--panel); font-size: 12px; font-weight: 700; min-width: 0; }
.w-${NAME} .ncl-node small { display: block; font-weight: 500; color: var(--ink-3); font-size: 10.5px; margin-top: 2px; }
.w-${NAME} .ncl-node.on { border-color: var(--accent); background: var(--accent-soft); }
.w-${NAME} .ncl-link { height: 3px; background: var(--line); border-radius: 2px; position: relative; }
.w-${NAME} .ncl-link.on { background: var(--accent); }
.w-${NAME} .ncl-link.small { background: var(--ok); }
.w-${NAME} .ncl-link.cut { background: repeating-linear-gradient(90deg, var(--bad) 0 4px, transparent 4px 8px); }
.w-${NAME} .ncl-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.w-${NAME} .ncl-card { border: 1px solid var(--line); background: var(--panel-2); border-radius: var(--r-sm); padding: 6px 8px; font-size: 12px; min-width: 0; }
.w-${NAME} .ncl-card h4 { margin: 0 0 3px; font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
.w-${NAME} .ncl-card code { font: 11.5px var(--font-code); display: block; overflow-wrap: anywhere; }
.w-${NAME} .ncl-fresh { font-weight: 700; }
.w-${NAME} .ncl-fresh.ok { color: var(--ok); } .w-${NAME} .ncl-fresh.stale { color: var(--warn); }
.w-${NAME} .ncl-detail { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--ink); background: var(--panel-2); border-left: 3px solid var(--accent); padding: 6px 9px; border-radius: 0 var(--r-sm) var(--r-sm) 0; }
.w-${NAME} .ncl-cap { margin: 2px 0 0; font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
.w-${NAME} .ncl-wire { margin: 0; flex: 1; min-height: 0; overflow: auto; font: 11.5px/1.45 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; white-space: pre-wrap; color: var(--ink); }
.w-${NAME} .ncl-right { display: flex; flex-direction: column; gap: 6px; min-height: 0; min-width: 0; }
.w-${NAME} .ncl-logwrap { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--line); border-radius: var(--r-sm); }
.w-${NAME} table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.w-${NAME} th, .w-${NAME} td { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
.w-${NAME} th { position: sticky; top: 0; background: var(--panel-2); font: 700 10px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
.w-${NAME} td { font-family: var(--font-code); }
.w-${NAME} td.num { text-align: right; }
.w-${NAME} .o-hit { color: var(--ok); font-weight: 700; } .w-${NAME} .o-revalidate { color: var(--type); font-weight: 700; }
.w-${NAME} .o-download { color: var(--ink); font-weight: 700; } .w-${NAME} .o-error { color: var(--bad); font-weight: 700; }
.w-${NAME} .ncl-totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.w-${NAME} .ncl-total { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 8px; }
.w-${NAME} .ncl-total b { display: block; font: 700 14px var(--font-code); }
.w-${NAME} .ncl-total small { font-size: 10.5px; color: var(--ink-3); }
.w-${NAME} .ncl-real { grid-column: 1 / -1; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 12px; align-items: center; border-top: 1px solid var(--line); padding-top: 8px; }
.w-${NAME} .ncl-real p { margin: 0; font: 12px/1.45 var(--font-code); color: var(--ink-2); }
.w-${NAME} .ncl-tag { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; padding: 1px 5px; border-radius: 4px; background: var(--warn-soft); color: var(--warn); }
@container ncl (max-width: 620px) {
  .w-${NAME} .ncl { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(120px, 1fr) auto; padding: 10px; gap: 8px; }
  .w-${NAME} .ncl-btn { padding: 6px 8px; font-size: 12px; }
  .w-${NAME} .ncl-detail { font-size: 12px; }
  .w-${NAME} .ncl-real { grid-template-columns: minmax(0, 1fr); }
  .w-${NAME} .ncl-wire { flex: none; max-height: 7.5em; }
  .w-${NAME} th:nth-child(3), .w-${NAME} td:nth-child(3) { display: none; }
}
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    const id = idScope(NAME);
    const s = { clock: 0, server: { version: 1, maxAge: 60 }, cache: null, policy: 'protocol', online: true, log: [], last: null };

    const reqBtn = el('button', { type: 'button', class: 'ncl-btn primary', id: id('request'), text: 'Request /schedule' });
    const waitBtn = el('button', { type: 'button', class: 'ncl-btn', id: id('wait'), text: 'Wait 30 s' });
    const pubBtn = el('button', { type: 'button', class: 'ncl-btn', id: id('publish'), text: 'Server updates data' });
    const offBox = el('input', { type: 'checkbox', id: id('offline') });
    const policySel = el('select', { id: id('policy') }, ...POLICIES.map((p) => el('option', { value: p.key, text: p.label })));
    const ageSel = el('select', { id: id('max-age') }, ...[0, 60, 300].map((a) => el('option', { value: String(a), text: `max-age=${a}` })));
    const top = el('div', { class: 'ncl-top' }, reqBtn, waitBtn, pubBtn,
      el('label', { class: 'ncl-field', for: id('offline') }, offBox, 'Offline'),
      el('label', { class: 'ncl-field', for: id('policy') }, 'Policy', policySel),
      el('label', { class: 'ncl-field', for: id('max-age') }, 'Server', ageSel));

    const nCode = el('div', { class: 'ncl-node', id: id('node-code') }, 'Your code', el('small', { text: 'data(for:)' }));
    const nCache = el('div', { class: 'ncl-node', id: id('node-cache') }, 'URLCache', el('small', { text: 'on the phone' }));
    const nServer = el('div', { class: 'ncl-node', id: id('node-server') }, 'Server', el('small', { text: '/schedule' }));
    const l1 = el('div', { class: 'ncl-link' });
    const l2 = el('div', { class: 'ncl-link' });
    const diagram = el('div', { class: 'ncl-diagram', role: 'img', id: id('diagram') }, nCode, l1, nCache, l2, nServer);
    const cacheCard = el('div', { class: 'ncl-card', id: id('cache-card') });
    const serverCard = el('div', { class: 'ncl-card', id: id('server-card') });
    const detail = el('p', { class: 'ncl-detail', id: id('detail'), 'aria-live': 'polite' });
    const wire = el('pre', { class: 'ncl-wire', id: id('wire') });
    const left = el('div', { class: 'ncl-left' }, diagram, el('div', { class: 'ncl-cards' }, cacheCard, serverCard), detail,
      el('p', { class: 'ncl-cap', text: 'On the wire' }), wire);

    const tbody = el('tbody', { id: id('log') });
    const table = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Time' }), el('th', { text: 'Result' }), el('th', { text: 'Status' }), el('th', { text: 'KB' }), el('th', { text: 'ms' }))), tbody);
    const totals = el('div', { class: 'ncl-totals' });
    const right = el('div', { class: 'ncl-right' }, el('div', { class: 'ncl-logwrap', tabindex: '0', role: 'region', 'aria-label': 'Request log' }, table), totals);

    const realBtn = el('button', { type: 'button', class: 'ncl-btn', id: id('real'), text: 'Send a real conditional request' });
    const realOut = el('p', { id: id('real-out'), 'aria-live': 'polite', text: 'Asks a public test server for a resource, then asks again with If-None-Match.' });
    const real = el('div', { class: 'ncl-real' }, realBtn, realOut);
    root.append(el('div', { class: 'ncl' }, top, left, right, real));

    const fmtClock = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

    function render() {
      policySel.value = s.policy;
      ageSel.value = String(s.server.maxAge);
      offBox.checked = !s.online;
      const e = s.cache;
      if (e) {
        const age = s.clock - e.storedAt;
        const fresh = age < e.maxAge;
        cacheCard.replaceChildren(el('h4', { text: 'Cached copy' }),
          el('code', { text: `ETag "v${e.version}", age ${age} s` }),
          el('code', {}, el('span', { class: `ncl-fresh ${fresh ? 'ok' : 'stale'}`, text: fresh ? 'fresh' : 'stale' }), ` (max-age ${e.maxAge})`));
      } else {
        cacheCard.replaceChildren(el('h4', { text: 'Cached copy' }), el('code', { text: 'empty' }));
      }
      serverCard.replaceChildren(el('h4', { text: `Server at ${fmtClock(s.clock)}` }),
        el('code', { text: `ETag "v${s.server.version}"` }), el('code', { text: `Cache-Control: max-age=${s.server.maxAge}` }));
      const path = s.last?.path;
      nCode.className = 'ncl-node' + (s.last ? ' on' : '');
      nCache.className = 'ncl-node' + (path && path !== 'none' ? ' on' : '');
      nServer.className = 'ncl-node' + (path === 'server' || path === 'revalidate' ? ' on' : '');
      l1.className = 'ncl-link' + (path && path !== 'none' ? ' on' : '');
      l2.className = 'ncl-link' + (path === 'server' ? ' on' : path === 'revalidate' ? ' small' : !s.online ? ' cut' : '');
      diagram.setAttribute('aria-label', s.last ? `Last request: ${s.last.outcome}` : 'No request yet');
      detail.textContent = s.last ? s.last.detail : s.log.length ? 'Ready. Request again to see what the cache does now.' : 'Press Request. The first request has nothing cached, so it must download.';
      wire.textContent = !s.last ? '(no request yet)' : s.last.wire || (s.last.outcome === 'hit' ? 'Nothing was sent. URLCache answered on the phone.' : 'Nothing could be sent.');
      const label = { hit: 'cache hit', revalidate: 'revalidated', download: 'downloaded', error: 'failed' };
      tbody.replaceChildren(...s.log.slice().reverse().map((r) => el('tr', {},
        el('td', { text: fmtClock(r.clock) }), el('td', { class: `o-${r.outcome}`, text: label[r.outcome] }),
        el('td', { text: r.status }), el('td', { class: 'num', text: r.bytes ? r.bytes.toFixed(1) : '0' }), el('td', { class: 'num', text: String(r.ms) }))));
      const sent = s.log.filter((r) => r.outcome !== 'error');
      const kb = sent.reduce((t, r) => t + r.bytes, 0);
      const saved = sent.length * (BODY_KB + HEADERS_KB) - kb;
      const avg = sent.length ? Math.round(sent.reduce((t, r) => t + r.ms, 0) / sent.length) : 0;
      totals.replaceChildren(
        el('div', { class: 'ncl-total' }, el('b', { id: id('total-kb'), text: `${kb.toFixed(1)} KB` }), el('small', { text: 'downloaded' })),
        el('div', { class: 'ncl-total' }, el('b', { id: id('total-saved'), text: `${saved.toFixed(1)} KB` }), el('small', { text: 'saved by caching' })),
        el('div', { class: 'ncl-total' }, el('b', { text: `${avg} ms` }), el('small', { text: 'average wait' })));
    }

    async function realConditional() {
      realBtn.disabled = true;
      const url = 'https://httpbin.org/etag/schedule-v1';
      realOut.textContent = 'Sending...';
      try {
        const a = await ctx.fetchJSON(url, { timeoutMs: 8000 });
        const b = await ctx.fetchJSON(url, { headers: { 'If-None-Match': '"schedule-v1"' }, timeoutMs: 8000 });
        realOut.replaceChildren(`1st: ${a.status} with ${a.text.length} bytes of body in ${a.ms} ms. `,
          `2nd, with If-None-Match: ${b.status}${b.status === 304 ? ' Not Modified' : ''}, ${b.text.length} bytes in ${b.ms} ms. `,
          'The browser hides the ETag header from this page, so it sends the value this server is known to use.');
      } catch {
        realOut.replaceChildren(el('span', { class: 'ncl-tag', text: 'Offline sample' }), ' 1st: 200 with 759 bytes in 180 ms. 2nd, with If-None-Match: 304 Not Modified, 0 bytes in 95 ms.');
      } finally { realBtn.disabled = false; }
    }

    const offs = [
      on(reqBtn, 'click', () => { const r = perform(s); s.last = r; s.log.push({ ...r, clock: s.clock }); render(); }),
      on(waitBtn, 'click', () => { s.clock += 30; s.last = null; render(); }),
      on(pubBtn, 'click', () => { s.server.version += 1; s.last = null; render(); detail.textContent = `The server now has version ${s.server.version}, with a new ETag. The phone does not know yet.`; }),
      on(offBox, 'change', () => { s.online = !offBox.checked; s.last = null; render(); }),
      on(policySel, 'change', () => { s.policy = policySel.value; render(); }),
      on(ageSel, 'change', () => { s.server.maxAge = Number(ageSel.value); render(); }),
      on(realBtn, 'click', realConditional),
    ];
    render();
    return { destroy() { offs.forEach((off) => off()); root.replaceChildren(); root.classList.remove(`w-${NAME}`); } };
  },
};
