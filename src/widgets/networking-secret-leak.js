// Secret leak: shows why an API key inside an app is never secret. The
// student builds a simulated app binary, runs a strings scan over its bytes
// and watches the app's traffic through a proxy, for three approaches.

const NAME = 'networking-secret-leak';
const XOR = 0x5a;
const APPROACHES = [
  { key: 'plain', label: 'Key in the app' },
  { key: 'hidden', label: 'Key scrambled' },
  { key: 'server', label: 'Key on your server' },
];
const USER_TOKEN = 'eyJhbGciOi...user-42.expires-1h';

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
}

const utf8 = (s) => [...new TextEncoder().encode(s)];

// The constant-strings section of a pretend compiled app, as raw bytes.
function binaryFor(approach, key) {
  const parts = [utf8('Could not load the weather.')];
  if (approach === 'server') parts.push(utf8('https://api.myweather.example/v1/now'));
  else parts.push(utf8('https://api.weather.example/v1/now'));
  if (approach === 'plain') parts.push(utf8(key));
  if (approach === 'hidden') parts.push(utf8(key).map((b) => b ^ XOR));
  parts.push(utf8('Bearer '), utf8('Authorization'));
  const bytes = [];
  parts.forEach((p) => { bytes.push(...p, 0); });
  while (bytes.length % 8) bytes.push(0);
  return bytes;
}

// What the `strings` tool does: report runs of 6+ printable ASCII bytes.
function findStrings(bytes) {
  const found = [];
  let run = [];
  const flush = () => { if (run.length >= 6) found.push(String.fromCharCode(...run)); run = []; };
  for (const b of bytes) { if (b >= 0x20 && b <= 0x7e) run.push(b); else flush(); }
  flush();
  return found;
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
    const id = (s) => `${NAME}-${s}`;
    const state = { approach: 'plain', key: 'sk_live_51Hx9WeatherPro2026', view: 'strings' };

    const segBtns = APPROACHES.map((a) => el('button', { type: 'button', role: 'radio', id: id(`approach-${a.key}`), 'aria-checked': 'false', text: a.label }));
    const seg = el('div', { class: 'nsl-seg', role: 'radiogroup', 'aria-label': 'Where the API key lives' }, ...segBtns);
    const keyInput = el('input', { type: 'text', id: id('key'), value: state.key, spellcheck: 'false', autocomplete: 'off' });
    const keyRow = el('label', { class: 'nsl-key', for: id('key') }, 'Weather API key', keyInput);
    const code = el('pre', { id: id('code'), 'aria-label': 'Swift code for this approach' });
    const stringsBtn = el('button', { type: 'button', class: 'nsl-btn', id: id('strings'), 'aria-pressed': 'true', text: 'Scan the app binary' });
    const proxyBtn = el('button', { type: 'button', class: 'nsl-btn', id: id('proxy'), 'aria-pressed': 'false', text: 'Watch its traffic' });
    const out = el('div', { class: 'nsl-out', id: id('out'), 'aria-live': 'polite' });
    const verdict = el('p', { class: 'nsl-verdict', id: id('verdict') });
    root.append(el('div', { class: 'nsl' }, seg, keyRow, code, el('div', { class: 'nsl-actions' }, stringsBtn, proxyBtn), out, verdict));

    function renderStrings() {
      const bytes = binaryFor(state.approach, state.key);
      const keyBytes = utf8(state.key);
      // Locate the plain key so its bytes can be highlighted in the dump.
      let start = -1;
      if (state.approach === 'plain') {
        for (let i = 0; i + keyBytes.length <= bytes.length; i++) if (keyBytes.every((b, j) => bytes[i + j] === b)) { start = i; break; }
      }
      const inKey = (i) => start >= 0 && i >= start && i < start + keyBytes.length;
      const rows = [];
      for (let off = 0; off < bytes.length; off += 8) {
        const slice = bytes.slice(off, off + 8);
        const hex = el('span');
        const ascii = el('span');
        slice.forEach((b, j) => {
          const hit = inKey(off + j);
          hex.append(el('span', { class: hit ? 'nsl-hit' : '', text: b.toString(16).padStart(2, '0') }), j < 7 ? ' ' : '');
          ascii.append(el('span', { class: hit ? 'nsl-hit' : '', text: b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.' }));
        });
        rows.push(el('div', { class: 'nsl-row' }, el('span', { class: 'off', text: (0x4f20 + off).toString(16).padStart(6, '0') }), hex, ascii));
      }
      const found = findStrings(bytes);
      const leaked = found.some((f) => f.includes(state.key) && state.key.length >= 6);
      out.replaceChildren(
        el('p', { class: 'nsl-cap', text: 'Constant strings section of the compiled app (simulated bytes)' }),
        el('div', { class: 'nsl-dump', id: id('dump'), tabindex: '0', role: 'region', 'aria-label': 'Hex dump' }, ...rows),
        el('p', { class: 'nsl-cap', text: `The strings tool found ${found.length} readable runs` }),
        el('ul', { class: 'nsl-list', id: id('found') }, ...found.map((f) => el('li', { class: f.includes(state.key) && state.key.length >= 6 ? 'secret' : '', text: f }))));
      if (start >= 0) {
        const dump = out.querySelector('.nsl-dump');
        const row = dump.children[Math.floor(start / 8)];
        const scroll = () => { if (row && dump.isConnected) dump.scrollTop = Math.max(0, row.offsetTop - 4); };
        scroll();
        requestAnimationFrame(scroll);
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
      code.textContent = SWIFT[state.approach](state.key).join('\n');
      stringsBtn.setAttribute('aria-pressed', String(state.view === 'strings'));
      proxyBtn.setAttribute('aria-pressed', String(state.view === 'proxy'));
      if (state.view === 'strings') renderStrings(); else renderProxy();
    }

    const on = (node, ev, fn) => { node.addEventListener(ev, fn); return () => node.removeEventListener(ev, fn); };
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
      on(keyInput, 'input', () => { state.key = keyInput.value.replace(/[^\x20-\x7e]/g, ''); render(); }),
      on(stringsBtn, 'click', () => { state.view = 'strings'; render(); }),
      on(proxyBtn, 'click', () => { state.view = 'proxy'; render(); }),
    ];
    render();
    return { destroy() { offs.forEach((off) => off()); root.replaceChildren(); root.classList.remove(`w-${NAME}`); } };
  },
};
