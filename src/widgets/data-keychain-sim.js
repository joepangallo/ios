// Keychain simulator: mirrors a small TokenStore wrapper around SecItemAdd,
// SecItemUpdate, SecItemCopyMatching, and SecItemDelete, printing the exact
// calls and OSStatus codes. A comparison card shows the same token sitting in
// a UserDefaults plist as plain text.

import { esc } from './services-kit.js';

const STATUS = {
  0: 'errSecSuccess',
  '-25299': 'errSecDuplicateItem',
  '-25300': 'errSecItemNotFound',
  '-25308': 'errSecInteractionNotAllowed',
};

// Deterministic "ciphertext" so the same token always shows the same bytes.
function cipherBytes(token) {
  let h = 0x811c9dc5;
  for (const ch of token) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  const count = Math.min(new TextEncoder().encode(token).length + 16, 40);
  const out = [];
  let x = h || 0x9e3779b9;
  for (let k = 0; k < count; k++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    out.push((x & 0xff).toString(16).padStart(2, '0'));
  }
  return out;
}

export default {
  name: 'data-keychain-sim',
  css: `
.w-data-keychain-sim { height: 100%; box-sizing: border-box; container-type: inline-size; overflow: hidden; font: 14px/1.45 var(--font-ui); color: var(--ink); }
.w-data-keychain-sim * { box-sizing: border-box; }
.w-data-keychain-sim .inner { height: 100%; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 14px; padding: 14px; }
.w-data-keychain-sim .left { display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 0; }
.w-data-keychain-sim .lbl { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
.w-data-keychain-sim .app { display: grid; gap: 8px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px; }
.w-data-keychain-sim .row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.w-data-keychain-sim .tokenrow label { font: 600 13px var(--font-ui); color: var(--ink-2); }
.w-data-keychain-sim .tokenrow input { flex: 1; min-width: 0; font: 13px var(--font-code); color: var(--ink); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 8px; }
.w-data-keychain-sim button { font: 600 13px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 10px; cursor: pointer; }
.w-data-keychain-sim button:hover { background: var(--panel-3); }
.w-data-keychain-sim button.code { font: 600 12.5px var(--font-code); }
.w-data-keychain-sim button.primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.w-data-keychain-sim button.primary:hover { filter: brightness(1.06); }
.w-data-keychain-sim button.danger { color: var(--bad); }
.w-data-keychain-sim button:focus-visible, .w-data-keychain-sim input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-data-keychain-sim .switch { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.w-data-keychain-sim .switch input { accent-color: var(--accent); width: 15px; height: 15px; margin: 0; }
.w-data-keychain-sim .spacer { flex: 1; }
.w-data-keychain-sim .cards { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); min-height: 0; }
.w-data-keychain-sim .card { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel); padding: 9px 10px; display: flex; flex-direction: column; gap: 5px; min-width: 0; position: relative; }
.w-data-keychain-sim .card .head { display: flex; align-items: center; gap: 6px; font: 600 13.5px var(--font-display); }
.w-data-keychain-sim .card .head svg { flex: none; }
.w-data-keychain-sim .card.kc .head svg { color: var(--ok); }
.w-data-keychain-sim .card.ud .head svg { color: var(--bad); }
.w-data-keychain-sim .attrs { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1px 10px; font: 11.5px/1.45 var(--font-code); margin: 0; }
.w-data-keychain-sim .attrs dt { color: var(--ink-3); }
.w-data-keychain-sim .attrs dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; }
.w-data-keychain-sim .hex { color: var(--ink-2); letter-spacing: .02em; }
.w-data-keychain-sim .foot { font-size: 12px; color: var(--ink-3); }
.w-data-keychain-sim .empty { font-size: 12.5px; color: var(--ink-3); padding: 4px 0; }
.w-data-keychain-sim .badge { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .05em; border-radius: 999px; padding: 1px 7px; margin-left: auto; white-space: nowrap; }
.w-data-keychain-sim .badge.lock { background: var(--warn-soft); color: var(--warn); }
.w-data-keychain-sim .badge.kept { background: var(--ok-soft); color: var(--ok); }
.w-data-keychain-sim .plist { margin: 0; font: 11.5px/1.45 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 7px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
.w-data-keychain-sim .plist .str { color: var(--str); }
.w-data-keychain-sim .warn { font-size: 12px; color: var(--bad); }
.w-data-keychain-sim .path { font: 11px var(--font-code); color: var(--ink-3); overflow-wrap: anywhere; }
.w-data-keychain-sim .legend { border: 1px dashed var(--line); border-radius: var(--r-md); padding: 8px 10px; display: grid; gap: 4px; }
.w-data-keychain-sim .legend[hidden] { display: none; }
.w-data-keychain-sim .legend dl { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 10px; font-size: 12.5px; color: var(--ink-2); }
.w-data-keychain-sim .legend dt { font: 600 12px var(--font-code); text-align: right; }
.w-data-keychain-sim .legend dd { margin: 0; }
.w-data-keychain-sim .legend code { font: 12px var(--font-code); color: var(--ink); }
.w-data-keychain-sim .legend .ok { color: var(--ok); } .w-data-keychain-sim .legend .warnc { color: var(--warn); } .w-data-keychain-sim .legend .bad { color: var(--bad); }
.w-data-keychain-sim .logwrap { display: flex; flex-direction: column; gap: 6px; min-height: 0; min-width: 0; }
.w-data-keychain-sim .log { flex: 1; min-height: 0; overflow: auto; font: 12px/1.5 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 10px; }
.w-data-keychain-sim .log .entry { padding: 3px 0 5px; border-bottom: 1px dashed var(--line); }
.w-data-keychain-sim .log .entry:last-child { border-bottom: 0; }
.w-data-keychain-sim .log .call { color: var(--ink); font-weight: 600; }
.w-data-keychain-sim .log .ln { color: var(--ink-2); padding-left: 12px; overflow-wrap: anywhere; }
.w-data-keychain-sim .log .ok { color: var(--ok); }
.w-data-keychain-sim .log .warnc { color: var(--warn); }
.w-data-keychain-sim .log .bad { color: var(--bad); }
.w-data-keychain-sim .log .muted { color: var(--ink-3); }
.w-data-keychain-sim .log .placeholder { color: var(--ink-3); font-family: var(--font-ui); }
@container (max-width: 700px) {
  .w-data-keychain-sim .inner { display: flex; flex-direction: column; gap: 8px; padding: 10px; }
  .w-data-keychain-sim .left { flex: none; gap: 8px; }
  .w-data-keychain-sim .app { padding: 8px; gap: 6px; }
  .w-data-keychain-sim .logwrap { flex: 1; min-height: 80px; gap: 4px; }
  .w-data-keychain-sim .cards.compare .detail { display: none; }
  .w-data-keychain-sim .legend { display: none; }
  .w-data-keychain-sim .cards.compare .card { padding: 7px 10px; gap: 3px; }
  .w-data-keychain-sim .cards.compare .foot { display: none; }
}
`,
  mount(el, props, ctx) {
    el.classList.add('w-data-keychain-sim');
    const state = {
      item: null,          // { token, bytes, survivedReinstall }
      locked: false,
      compare: false,
      defaultsToken: null, // what a careless app would have put in UserDefaults
      entries: [],
    };
    el.innerHTML = `
      <div class="inner">
        <div class="left">
          <div class="app" role="group" aria-label="Your app calling TokenStore">
            <div class="row tokenrow">
              <label for="data-keychain-sim-token">Token</label>
              <input id="data-keychain-sim-token" type="text" value="tok_8f2a91c4e7" spellcheck="false" autocomplete="off">
            </div>
            <div class="row">
              <button type="button" class="code primary" id="data-keychain-sim-save">save()</button>
              <button type="button" class="code" id="data-keychain-sim-read">read()</button>
              <button type="button" class="code" id="data-keychain-sim-delete">delete()</button>
              <span class="spacer"></span>
              <label class="switch" for="data-keychain-sim-locked"><input type="checkbox" id="data-keychain-sim-locked"> Device locked</label>
            </div>
            <div class="row">
              <button type="button" class="danger" id="data-keychain-sim-reinstall">Delete and reinstall app</button>
              <span class="spacer"></span>
              <label class="switch" for="data-keychain-sim-compare"><input type="checkbox" id="data-keychain-sim-compare"> Compare with UserDefaults</label>
            </div>
          </div>
          <div class="cards" id="data-keychain-sim-cards"></div>
          <section class="legend" id="data-keychain-sim-legend" aria-label="OSStatus codes">
            <div class="lbl">OSStatus codes you will see</div>
            <dl>
              <dt class="ok">0</dt><dd><code>errSecSuccess</code>: the call worked.</dd>
              <dt class="warnc">-25299</dt><dd><code>errSecDuplicateItem</code>: an item with this service and account already exists.</dd>
              <dt class="warnc">-25300</dt><dd><code>errSecItemNotFound</code>: nothing matches the query.</dd>
              <dt class="bad">-25308</dt><dd><code>errSecInteractionNotAllowed</code>: the item is protected right now, for example while the device is locked.</dd>
            </dl>
          </section>
        </div>
        <div class="logwrap">
          <div class="lbl">Call log</div>
          <div class="log" id="data-keychain-sim-log" role="log" aria-live="polite" aria-label="Keychain call log"></div>
        </div>
      </div>`;

    const $ = (id) => el.querySelector('#data-keychain-sim-' + id);
    const tokenInput = $('token');
    const cardsEl = $('cards');
    const logEl = $('log');
    const legendEl = $('legend');

    const st = (code) => {
      const cls = code === 0 ? 'ok' : code === -25308 ? 'bad' : 'warnc';
      return `<span class="${cls}">${STATUS[code]} (${code})</span>`;
    };

    function log(call, lines) {
      state.entries.push({ call, lines });
      if (state.entries.length > 40) state.entries.shift();
      renderLog();
    }

    function renderLog() {
      if (!state.entries.length) {
        logEl.innerHTML = '<div class="placeholder">Press save(), read(), or delete(). Every Security framework call and its OSStatus result appears here.</div>';
        return;
      }
      logEl.innerHTML = state.entries.map((e) => `<div class="entry"><div class="call">${e.call}</div>${e.lines.map((l) => `<div class="ln">${l}</div>`).join('')}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    function renderCards() {
      cardsEl.classList.toggle('compare', state.compare);
      legendEl.hidden = state.compare;
      const kc = state.item
        ? `<dl class="attrs">
             <dt class="detail">kSecClass</dt><dd class="detail">genp (generic password)</dd>
             <dt class="detail">kSecAttrService</dt><dd class="detail">com.example.trailhead</dd>
             <dt class="detail">kSecAttrAccount</dt><dd class="detail">accessToken</dd>
             <dt>kSecAttrAccessible</dt><dd>WhenUnlockedThisDeviceOnly</dd>
             <dt>kSecValueData</dt><dd class="hex" aria-label="Encrypted bytes">${state.item.bytes.slice(0, 15).join(' ')} …</dd>
           </dl>
           <div class="foot">${state.locked ? 'Device locked: the key that decrypts this item is unavailable.' : 'Encrypted. Decrypted only for this app, only while the device is unlocked.'}</div>`
        : '<div class="empty">No item matches this service and account.</div>';
      const badge = state.locked
        ? '<span class="badge lock">Locked</span>'
        : state.item && state.item.survivedReinstall ? '<span class="badge kept">Survived reinstall</span>' : '';
      let html = `<section class="card kc" aria-label="Keychain item">
          <div class="head">${ctx.icon('lock.fill', 15)}<span>Keychain (managed by iOS)</span>${badge}</div>
          ${kc}
        </section>`;
      if (state.compare) {
        const body = state.defaultsToken === null
          ? esc('<dict/>')
          : `${esc('<key>accessToken</key>')}\n${esc('<string>')}<span class="str">${esc(state.defaultsToken)}</span>${esc('</string>')}`;
        html += `<section class="card ud" aria-label="UserDefaults plist file">
            <div class="head">${ctx.icon('doc.text', 15)}<span>UserDefaults plist</span></div>
            <div class="path">Library/Preferences/com.example.trailhead.plist</div>
            <pre class="plist">${body}</pre>
            <div class="warn">Plain, unencrypted text in your container, copied into every backup. Never store secrets here.</div>
          </section>`;
      }
      cardsEl.innerHTML = html;
    }

    const quote = (s) => `"${esc(s)}"`;

    function save() {
      const token = tokenInput.value;
      const lines = [];
      if (state.locked) {
        lines.push(`SecItemAdd → ${st(-25308)}`);
        lines.push('<span class="bad">throw KeychainError.unexpectedStatus(-25308)</span>');
        lines.push('<span class="muted">A WhenUnlocked item cannot be written while the device is locked.</span>');
        log(`save(${quote(token)})`, lines);
        return;
      }
      if (!state.item) {
        lines.push(`SecItemAdd → ${st(0)}`);
        lines.push('<span class="ok">save() finished: new item stored</span>');
      } else {
        lines.push(`SecItemAdd → ${st(-25299)}`);
        lines.push(`SecItemUpdate → ${st(0)}`);
        lines.push('<span class="ok">save() finished: existing item updated</span>');
      }
      state.item = { token, bytes: cipherBytes(token), survivedReinstall: false };
      if (state.compare) {
        state.defaultsToken = token;
        lines.push('<span class="muted">Comparison only: UserDefaults.standard.set(token, forKey: "accessToken")</span>');
      }
      log(`save(${quote(token)})`, lines);
      renderCards();
    }

    function read() {
      const lines = [];
      if (state.locked && state.item) {
        lines.push(`SecItemCopyMatching → ${st(-25308)}`);
        lines.push('<span class="bad">throw KeychainError.unexpectedStatus(-25308)</span>');
        lines.push('<span class="muted">A background task cannot read a WhenUnlocked item while the screen is locked.</span>');
      } else if (!state.item) {
        lines.push(`SecItemCopyMatching → ${st(-25300)}; read() returns nil`);
        lines.push('<span class="muted">No token yet: the app should show its sign-in screen.</span>');
      } else {
        lines.push(`SecItemCopyMatching → ${st(0)}`);
        lines.push(`<span class="ok">read() returned ${quote(state.item.token)}</span>`);
      }
      log('read()', lines);
    }

    function del() {
      const lines = [];
      if (state.locked && state.item) {
        lines.push(`SecItemDelete → ${st(-25308)}`);
        lines.push('<span class="bad">throw KeychainError.unexpectedStatus(-25308)</span>');
      } else if (!state.item) {
        lines.push(`SecItemDelete → ${st(-25300)}`);
        lines.push('<span class="muted">Nothing to delete, which delete() treats as success.</span>');
      } else {
        lines.push(`SecItemDelete → ${st(0)}`);
        lines.push('<span class="ok">delete() finished: item removed</span>');
        state.item = null;
      }
      if (state.compare && state.defaultsToken !== null && !(state.locked && state.item)) {
        state.defaultsToken = null;
        lines.push('<span class="muted">Comparison only: UserDefaults.standard.removeObject(forKey: "accessToken")</span>');
      }
      log('delete()', lines);
      renderCards();
    }

    function reinstall() {
      const lines = [
        '<span class="muted">App deleted: its container (Documents, Library, tmp) is removed, including the UserDefaults plist.</span>',
      ];
      state.defaultsToken = null;
      if (state.item) {
        state.item.survivedReinstall = true;
        lines.push('<span class="ok">Keychain item still present: it lives outside the container.</span>');
        lines.push('<span class="muted">Do not rely on either behavior. On first launch, decide whether to reuse or clear an old token.</span>');
      } else {
        lines.push('<span class="muted">There was no Keychain item to keep.</span>');
      }
      lines.push('App reinstalled: first launch.');
      log('Delete and reinstall app', lines);
      renderCards();
    }

    const onLock = (e) => {
      state.locked = e.target.checked;
      log(state.locked ? 'Device locked' : 'Device unlocked', [state.locked
        ? '<span class="muted">Imagine a background task in your app running now.</span>'
        : '<span class="muted">Items protected by WhenUnlocked are readable again.</span>']);
      renderCards();
    };
    const onCompare = (e) => {
      state.compare = e.target.checked;
      if (state.compare && state.item) state.defaultsToken = state.item.token;
      if (!state.compare) state.defaultsToken = null;
      renderCards();
    };

    const handlers = [
      [$('save'), 'click', save],
      [$('read'), 'click', read],
      [$('delete'), 'click', del],
      [$('reinstall'), 'click', reinstall],
      [$('locked'), 'change', onLock],
      [$('compare'), 'change', onCompare],
    ];
    handlers.forEach(([node, type, fn]) => node.addEventListener(type, fn));

    renderCards();
    renderLog();

    // Keep the newest call in view when the panel changes size.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { logEl.scrollTop = logEl.scrollHeight; }) : null;
    if (ro) ro.observe(logEl);

    return {
      destroy() {
        if (ro) ro.disconnect();
        handlers.forEach(([node, type, fn]) => node.removeEventListener(type, fn));
        el.innerHTML = '';
        el.classList.remove('w-data-keychain-sim');
      },
    };
  },
};
