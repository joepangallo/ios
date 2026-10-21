// Secret leak: shows why an API key inside an app is never secret. The
// student builds a simulated app binary, runs a strings scan over its bytes
// and watches the app's traffic through a proxy, for three approaches.

import { el, on, idScope, frameThrottle } from './services-kit.js';

const NAME = 'networking-secret-leak';
const XOR = 0x5a;
const APPROACHES = [
  { key: 'plain', label: 'Key in the app' },
  { key: 'hidden', label: 'Key scrambled' },
  { key: 'server', label: 'Key on your server' },
];
const USER_TOKEN = 'eyJhbGciOi...user-42.expires-1h';
// The scan and the hex dump use at most this many key characters; real API
// keys are far shorter, and a pasted wall of text would otherwise build tens
// of thousands of rows on every keystroke.
const MAX_KEY = 4000;

const utf8 = (s) => new TextEncoder().encode(s);
const ascii = new TextDecoder();

// The constant-strings section of a pretend compiled app, as raw bytes
// (each string NUL-terminated, zero-padded to whole 8-byte rows), and the
// offset of the key's bytes, or -1 when the key is not stored as itself.
function binaryFor(approach, key) {
  const parts = [utf8('Could not load the weather.')];
  if (approach === 'server') parts.push(utf8('https://api.myweather.example/v1/now'));
  else parts.push(utf8('https://api.weather.example/v1/now'));
  const keyPart = approach === 'plain' ? utf8(key) : null;
  if (keyPart) parts.push(keyPart);
  if (approach === 'hidden') parts.push(utf8(key).map((b) => b ^ XOR));
  parts.push(utf8('Bearer '), utf8('Authorization'));
  let size = 0;
  for (const p of parts) size += p.length + 1;
  const bytes = new Uint8Array(Math.ceil(size / 8) * 8);
  let at = 0;
  let keyAt = -1;
  for (const p of parts) {
    if (p === keyPart) keyAt = at;
    bytes.set(p, at);
    at += p.length + 1;
  }
  return { bytes, keyAt };
}

// What the `strings` tool does: report runs of 6+ printable ASCII bytes.
function findStrings(bytes) {
  const found = [];
  let start = 0;
  const flush = (end) => { if (end - start >= 6) found.push(ascii.decode(bytes.subarray(start, end))); };
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] < 0x20 || bytes[i] > 0x7e) { flush(i); start = i + 1; }
  }
  flush(bytes.length);
  return found;
}

const hexByte = (b) => b.toString(16).padStart(2, '0');
const asciiByte = (b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.');

// One hex dump row of up to 8 bytes. Bytes inside [hitFrom, hitTo) are the
// key; each column gets one highlight span per run of key bytes instead of
// one element per byte.
function dumpRow(bytes, off, hitFrom, hitTo) {
  const hex = el('span');
  const text = el('span');
  const end = Math.min(off + 8, bytes.length);
  for (let j = off; j < end;) {
    const inKey = j >= hitFrom && j < hitTo;
    let k = j;
    let h = '';
    let t = '';
    while (k < end && (k >= hitFrom && k < hitTo) === inKey) {
      h += (k > j ? ' ' : '') + hexByte(bytes[k]);
      t += asciiByte(bytes[k]);
      k += 1;
    }
    if (j > off) hex.append(' ');
    hex.append(inKey ? el('span', { class: 'nsl-hit', text: h }) : h);
    text.append(inKey ? el('span', { class: 'nsl-hit', text: t }) : t);
    j = k;
  }
  return el('div', { class: 'nsl-row' }, el('span', { class: 'off', text: (0x4f20 + off).toString(16).padStart(6, '0') }), hex, text);
}

const SWIFT = {
  plain: (key) => [`let apiKey = "${key}"`, 'request.setValue("Bearer \\(apiKey)",', '                 forHTTPHeaderField: "Authorization")'],
  hidden: () => ['let apiKey = String(decoding: scrambled.map { $0 ^ 0x5A },', '                    as: UTF8.self)', 'request.setValue("Bearer \\(apiKey)", ...)'],
  server: () => ['// The app holds no weather key at all.', 'let token = savedToken()   // this user only, from sign-in', 'request.setValue("Bearer \\(token)", ...)'],
};

export default {
  name: 'networking-secret-leak',
  css: `
.w-${NAME} { container-type: size; container-name: nsl; height: 100%; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .nsl { box-sizing: border-box; height: 100%; padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.w-${NAME} .nsl-seg { display: flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .nsl-seg button { flex: 1; border: 0; background: transparent; color: var(--ink-2); font: 600 12px/1.15 var(--font-ui); padding: 7px 6px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .nsl-seg button[aria-checked="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} button:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .nsl-key { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-2); }
.w-${NAME} .nsl-key input { flex: 1; min-width: 0; font: 12px var(--font-code); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 7px; }
.w-${NAME} .nsl-key input:disabled { color: var(--ink-3); background: var(--panel-2); }
.w-${NAME} .nsl-note { margin: -4px 0 0; font-size: 11.5px; line-height: 1.35; color: var(--ink-3); }
.w-${NAME} pre { margin: 0; font: 11.5px/1.5 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; white-space: pre; overflow-x: auto; color: var(--ink); }
.w-${NAME} .nsl-actions { display: flex; gap: 6px; }
.w-${NAME} .nsl-btn { flex: 1; border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 600 12.5px var(--font-ui); padding: 7px 6px; border-radius: var(--r-sm); cursor: pointer; }
.w-${NAME} .nsl-btn[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); }
.w-${NAME} .nsl-out { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
.w-${NAME} .nsl-cap { margin: 0; font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
.w-${NAME} .nsl-dump { position: relative; flex: 1; min-height: 60px; overflow: auto; font: 11px/1.45 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 8px; }
.w-${NAME} .nsl-row { display: grid; grid-template-columns: 44px max-content max-content; justify-content: start; gap: 12px; white-space: pre; color: var(--ink-2); }
.w-${NAME} .nsl-row .off { color: var(--ink-3); }
.w-${NAME} .nsl-hit { background: var(--bad-soft); color: var(--bad); border-radius: 2px; }
.w-${NAME} .nsl-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; max-height: 96px; overflow: auto; }
.w-${NAME} .nsl-list li { font: 11.5px var(--font-code); padding: 3px 6px; border-radius: 4px; background: var(--panel-2); overflow-wrap: anywhere; }
.w-${NAME} .nsl-list li.secret { background: var(--bad-soft); color: var(--bad); font-weight: 700; }
.w-${NAME} .nsl-list li.safe { background: var(--ok-soft); }
.w-${NAME} .nsl-verdict { margin: 0; font-size: 12.5px; line-height: 1.4; padding: 7px 9px; border-radius: var(--r-sm); }
.w-${NAME} .nsl-verdict.bad { background: var(--bad-soft); }
.w-${NAME} .nsl-verdict.ok { background: var(--ok-soft); }
.w-${NAME} .nsl-flow { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 11.5px; color: var(--ink-2); }
.w-${NAME} .nsl-node { border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; background: var(--panel); }
.w-${NAME} .nsl-node.key { border-color: var(--ok); }
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    const id = idScope(NAME);
    const state = { approach: 'plain', key: 'sk_live_51Hx9WeatherPro2026', clipped: false, view: 'strings' };
    let scrollFrame = 0;

    const segBtns = APPROACHES.map((a) => el('button', { type: 'button', role: 'radio', id: id(`approach-${a.key}`), 'aria-checked': 'false', text: a.label }));
    const seg = el('div', { class: 'nsl-seg', role: 'radiogroup', 'aria-label': 'Where the API key lives' }, ...segBtns);
    const keyInput = el('input', { type: 'text', id: id('key'), value: state.key, spellcheck: 'false', autocomplete: 'off' });
    const keyRow = el('label', { class: 'nsl-key', for: id('key') }, 'Weather API key', keyInput);
    const note = el('p', { class: 'nsl-note', id: id('note'), hidden: true,
      text: `Only the first ${MAX_KEY.toLocaleString('en-US')} characters are used. Real API keys are much shorter.` });
    const code = el('pre', { id: id('code'), 'aria-label': 'Swift code for this approach' });
    const stringsBtn = el('button', { type: 'button', class: 'nsl-btn', id: id('strings'), 'aria-pressed': 'true', text: 'Scan the app binary' });
    const proxyBtn = el('button', { type: 'button', class: 'nsl-btn', id: id('proxy'), 'aria-pressed': 'false', text: 'Watch its traffic' });
    const out = el('div', { class: 'nsl-out', id: id('out'), 'aria-live': 'polite' });
    const verdict = el('p', { class: 'nsl-verdict', id: id('verdict') });
    root.append(el('div', { class: 'nsl' }, seg, keyRow, note, code, el('div', { class: 'nsl-actions' }, stringsBtn, proxyBtn), out, verdict));

    function renderStrings() {
      const { bytes, keyAt } = binaryFor(state.approach, state.key);
      // The plain key's bytes are highlighted in the dump.
      const keyLength = utf8(state.key).length;
      const start = keyAt >= 0 && keyLength ? keyAt : -1;
      const dump = el('div', { class: 'nsl-dump', id: id('dump'), tabindex: '0', role: 'region', 'aria-label': 'Hex dump' });
      for (let off = 0; off < bytes.length; off += 8) dump.append(dumpRow(bytes, off, start, start < 0 ? -1 : start + keyLength));
      const found = findStrings(bytes);
      const isKey = (f) => f.includes(state.key) && state.key.length >= 6;
      const leaked = found.some(isKey);
      const list = el('ul', { class: 'nsl-list', id: id('found') });
      for (const f of found) list.append(el('li', { class: isKey(f) ? 'secret' : '', text: f }));
      out.replaceChildren(
        el('p', { class: 'nsl-cap', text: 'Constant strings section of the compiled app (simulated bytes)' }),
        dump,
        el('p', { class: 'nsl-cap', text: `The strings tool found ${found.length} readable runs` }),
        list);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      if (start >= 0) {
        const row = dump.children[Math.floor(start / 8)];
        const scroll = () => { if (row && dump.isConnected) dump.scrollTop = Math.max(0, row.offsetTop - 4); };
        scroll();
        scrollFrame = requestAnimationFrame(scroll);
      }
      if (state.approach === 'plain') setVerdict('bad', leaked ? 'The key is sitting in the binary as plain bytes. Anyone who downloads the app can run strings and copy it.' : 'Keys shorter than six characters slip past this scan, but they are trivially guessed anyway.');
      else if (state.approach === 'hidden') setVerdict('bad', 'The scan no longer finds the key, which feels safe. But the app must unscramble it to use it. Now watch the traffic.');
      else setVerdict('ok', 'There is nothing to find: the app never contains the weather key.');
    }

    function renderProxy() {
      const sendsKey = state.approach !== 'server';
      const host = sendsKey ? 'api.weather.example' : 'api.myweather.example';
      const auth = sendsKey ? state.key : USER_TOKEN;
      out.replaceChildren(
        el('p', { class: 'nsl-cap', text: 'Request captured by a proxy on the user\'s own phone' }),
        el('pre', { id: id('request') }, `GET /v1/now?city=Tokyo HTTP/1.1\nHost: ${host}\nAuthorization: Bearer ${auth}`),
        el('ul', { class: 'nsl-list' }, el('li', { class: sendsKey ? 'secret' : 'safe', text: sendsKey ? `Captured: ${state.key}` : 'Captured: this user\'s own short-lived token' })),
        el('p', { class: 'nsl-cap', text: 'Who holds the weather key' }),
        el('div', { class: 'nsl-flow' }, ...(sendsKey
          ? [el('span', { class: 'nsl-node key', text: 'iPhone app (has key)' }), '->', el('span', { class: 'nsl-node', text: 'Weather API' })]
          : [el('span', { class: 'nsl-node', text: 'iPhone app (user token)' }), '->', el('span', { class: 'nsl-node key', text: 'Your server (has key)' }), '->', el('span', { class: 'nsl-node', text: 'Weather API' })])));
      if (sendsKey) setVerdict('bad', 'HTTPS stops strangers on the network, but not the device owner. A debugging proxy they trust shows every header the app sends, including the key, however well it was hidden.');
      else setVerdict('ok', 'The proxy only reveals the user\'s own token, which expires and can be revoked. The weather key never leaves your server.');
    }

    function setVerdict(tone, text) {
      verdict.className = `nsl-verdict ${tone}`;
      verdict.textContent = text;
    }

    function render() {
      segBtns.forEach((b, i) => b.setAttribute('aria-checked', String(APPROACHES[i].key === state.approach)));
      keyInput.disabled = state.approach === 'server';
      note.hidden = !state.clipped;
      if (state.clipped) keyInput.setAttribute('aria-describedby', id('note'));
      else keyInput.removeAttribute('aria-describedby');
      code.textContent = SWIFT[state.approach](state.key).join('\n');
      stringsBtn.setAttribute('aria-pressed', String(state.view === 'strings'));
      proxyBtn.setAttribute('aria-pressed', String(state.view === 'proxy'));
      if (state.view === 'strings') renderStrings(); else renderProxy();
    }

    // Typing re-renders at most once per animation frame.
    const paint = frameThrottle(render);
    const offs = [
      ...segBtns.map((b, i) => on(b, 'click', () => { state.approach = APPROACHES[i].key; render(); })),
      on(seg, 'keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const i = APPROACHES.findIndex((a) => a.key === state.approach);
        const n = (i + (e.key === 'ArrowRight' ? 1 : APPROACHES.length - 1)) % APPROACHES.length;
        state.approach = APPROACHES[n].key;
        render();
        segBtns[n].focus();
      }),
      on(keyInput, 'input', () => {
        const key = keyInput.value.replace(/[^\x20-\x7e]/g, '');
        state.key = key.slice(0, MAX_KEY);
        state.clipped = key.length > MAX_KEY;
        paint.request();
      }),
      on(stringsBtn, 'click', () => { state.view = 'strings'; render(); }),
      on(proxyBtn, 'click', () => { state.view = 'proxy'; render(); }),
    ];
    render();
    return {
      destroy() {
        paint.cancel();
        if (scrollFrame) cancelAnimationFrame(scrollFrame);
        offs.forEach((off) => off());
        root.replaceChildren();
        root.classList.remove(`w-${NAME}`);
      },
    };
  },
};
