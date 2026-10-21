// URL anatomy: builds a geocoding URL from the user's text the way
// URLComponents does (byte-for-byte, verified against Foundation), compares
// it with naive string concatenation, shows what the server will parse, and
// can send the request for real.

import { el, on, idScope, frameThrottle } from './services-kit.js';

const NAME = 'networking-url-anatomy';
const HOST = 'geocoding-api.open-meteo.com';
const PATH = '/v1/search';
const PRESETS = ['São Paulo', 'New York', 'A&W #2', 'C++'];
// Longest city the field accepts, like a real city name field.
const MAX_CITY = 200;

// At most MAX_CITY UTF-16 units, without splitting a surrogate pair.
function clipCity(text) {
  if (text.length <= MAX_CITY) return text;
  const cut = text.slice(0, MAX_CITY);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

// Characters URLComponents leaves alone inside a query item (measured with
// Foundation on macOS 26 for every printable ASCII character).
const KEEP = /[A-Za-z0-9\-._~!$'()*+,/:;?@]/;
// Characters that make URL(string:) treat a string as needing repair.
const URL_LEGAL = /[A-Za-z0-9\-._~:/?#@!$&'()*+,;=%]/;

const SAMPLE = {
  results: [{ name: 'São Paulo', country: 'Brazil', latitude: -23.5475, longitude: -46.63611 }],
};

function utf8Hex(ch) {
  return [...new TextEncoder().encode(ch)].map((b) => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
}

// Returns [{text, encoded:boolean, source}] pieces so encoded runs can be highlighted.
function encodeComponents(value) {
  return [...value].map((ch) => (KEEP.test(ch) ? { text: ch, encoded: false } : { text: utf8Hex(ch), encoded: true, source: ch }));
}

// What URL(string:) does with an invalid string on iOS 17 and later: it
// percent-encodes characters that are never legal in a URL, and every %,
// but leaves delimiters such as & = # + untouched.
function encodeNaive(value, wholeIsInvalid) {
  return [...value].map((ch) => {
    if (ch === '%' && wholeIsInvalid) return { text: '%25', encoded: true, source: '%' };
    if (URL_LEGAL.test(ch)) return { text: ch, encoded: false };
    return { text: utf8Hex(ch), encoded: true, source: ch };
  });
}

function decodeForm(s) {
  const plus = s.replace(/\+/g, ' ');
  try { return decodeURIComponent(plus); } catch { return plus; }
}

// How a typical server reads the query: everything after ? and before #,
// split on &, then on the first =, with + read as a space.
function serverReads(query) {
  const hash = query.indexOf('#');
  const sent = hash >= 0 ? query.slice(0, hash) : query;
  const fragment = hash >= 0 ? query.slice(hash + 1) : null;
  const items = sent.split('&').filter((p) => p.length).map((pair) => {
    const eq = pair.indexOf('=');
    const rawName = eq >= 0 ? pair.slice(0, eq) : pair;
    const rawValue = eq >= 0 ? pair.slice(eq + 1) : '';
    return { name: decodeForm(rawName), value: decodeForm(rawValue), plus: rawValue.includes('+') };
  });
  return { items, fragment };
}

export default {
  name: 'networking-url-anatomy',
  css: `
.w-${NAME} { container-type: size; container-name: nua; height: 100%; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .nua { box-sizing: border-box; height: 100%; padding: 12px; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 12px 16px; align-content: start; overflow: hidden; }
.w-${NAME} .nua-col { display: flex; flex-direction: column; gap: 9px; min-width: 0; min-height: 0; }
.w-${NAME} .nua-label { font: 700 11px/1.2 var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); margin: 0; }
.w-${NAME} .nua-input { width: 100%; box-sizing: border-box; font: 15px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 10px; }
.w-${NAME} input:focus-visible, .w-${NAME} button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .nua-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.w-${NAME} .nua-chip { border: 1px solid var(--line); background: var(--panel-2); color: var(--ink-2); font: 600 12px var(--font-code); padding: 4px 9px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .nua-chip:hover { color: var(--ink); }
.w-${NAME} .nua-seg { display: inline-flex; align-self: flex-start; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .nua-seg button { border: 0; background: transparent; color: var(--ink-2); font: 600 12.5px/1 var(--font-ui); padding: 7px 11px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .nua-seg button[aria-checked="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} .nua-url { margin: 0; font: 13px/1.55 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 10px; word-break: break-all; }
.w-${NAME} .s-scheme { color: var(--kw); } .w-${NAME} .s-host { color: var(--type); } .w-${NAME} .s-path { color: var(--fn); }
.w-${NAME} .s-query { color: var(--str); } .w-${NAME} .s-punct { color: var(--ink-3); }
.w-${NAME} .s-frag { color: var(--ink-3); text-decoration: line-through; }
.w-${NAME} .s-enc { background: var(--accent-soft); color: var(--accent-ink); border-radius: 3px; }
.w-${NAME} .nua-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--ink-3); }
.w-${NAME} .nua-legend b { font-weight: 600; }
.w-${NAME} table { width: 100%; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
.w-${NAME} th { text-align: left; font: 700 11px var(--font-ui); color: var(--ink-3); text-transform: uppercase; letter-spacing: .04em; padding: 4px 6px; border-bottom: 1px solid var(--line); }
.w-${NAME} td { padding: 5px 6px; border-bottom: 1px solid var(--line); font-family: var(--font-code); word-break: break-all; vertical-align: top; }
.w-${NAME} td.bad { color: var(--bad); }
.w-${NAME} .nua-notes { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }
.w-${NAME} .nua-notes li { font-size: 12.5px; line-height: 1.4; padding: 6px 8px; border-radius: var(--r-sm); background: var(--ok-soft); color: var(--ink); }
.w-${NAME} .nua-notes li.warn { background: var(--warn-soft); }
.w-${NAME} .nua-notes li.bad { background: var(--bad-soft); }
.w-${NAME} .nua-send { display: flex; gap: 8px; align-items: center; }
.w-${NAME} .nua-btn { border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); font: 600 13px var(--font-ui); padding: 8px 14px; border-radius: var(--r-sm); cursor: pointer; white-space: nowrap; }
.w-${NAME} .nua-btn:disabled { opacity: .6; cursor: default; }
.w-${NAME} .nua-result { font-size: 12.5px; line-height: 1.4; color: var(--ink-2); min-width: 0; }
.w-${NAME} .nua-result b { color: var(--ink); }
.w-${NAME} .nua-tag { display: inline-block; font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; padding: 2px 6px; border-radius: 4px; background: var(--warn-soft); color: var(--warn); margin-right: 4px; }
.w-${NAME} .nua-props { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
@container nua (max-width: 620px) {
  .w-${NAME} .nua-props { display: none; }
  .w-${NAME} .nua { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 10px; }
  .w-${NAME} .nua-col { gap: 7px; }
  .w-${NAME} .nua-url { font-size: 12px; padding: 6px 8px; }
  .w-${NAME} .nua-legend { display: none; }
  .w-${NAME} td { padding: 3px 6px; font-size: 12px; }
  .w-${NAME} .nua-notes li { font-size: 12px; padding: 4px 7px; }
  .w-${NAME} .nua-notes li:nth-child(n+3) { display: none; }
}
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    const id = idScope(NAME);
    const state = { city: clipCity(props.city || 'São Paulo'), mode: 'components', busy: false };

    const input = el('input', { class: 'nua-input', id: id('city'), type: 'text', value: state.city, maxlength: String(MAX_CITY), autocomplete: 'off', spellcheck: 'false' });
    const chips = el('div', { class: 'nua-chips', role: 'group', 'aria-label': 'Example inputs' },
      ...PRESETS.map((p, i) => el('button', { type: 'button', class: 'nua-chip', id: id(`preset-${i}`), text: p })));
    const segA = el('button', { type: 'button', role: 'radio', id: id('mode-components'), 'aria-checked': 'true', text: 'URLComponents' });
    const segB = el('button', { type: 'button', role: 'radio', id: id('mode-naive'), 'aria-checked': 'false', text: 'String concatenation' });
    const seg = el('div', { class: 'nua-seg', role: 'radiogroup', 'aria-label': 'How the URL is built' }, segA, segB);
    const url = el('p', { class: 'nua-url', id: id('url'), 'aria-live': 'polite' });
    const legend = el('div', { class: 'nua-legend' },
      el('span', {}, el('b', { class: 's-scheme', text: 'scheme' })), el('span', {}, el('b', { class: 's-host', text: 'host' })),
      el('span', {}, el('b', { class: 's-path', text: 'path' })), el('span', {}, el('b', { class: 's-query', text: 'query' })),
      el('span', {}, el('b', { class: 's-enc', text: '%XX' }), ' percent-encoded'));
    const sendBtn = el('button', { type: 'button', class: 'nua-btn', id: id('send'), text: 'Send request' });
    const result = el('div', { class: 'nua-result', id: id('result'), 'aria-live': 'polite', text: 'Send the URL to the real geocoding API.' });
    const left = el('div', { class: 'nua-col' },
      el('label', { class: 'nua-label', for: id('city'), text: 'City the user typed' }), input, chips, seg,
      el('p', { class: 'nua-label', text: 'Resulting URL' }), url, legend, el('div', { class: 'nua-send' }, sendBtn, result));

    const tbody = el('tbody', { id: id('reads') });
    const table = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Name' }), el('th', { text: 'Value the server sees' }))), tbody);
    const notes = el('ul', { class: 'nua-notes', id: id('notes') });
    const propsBody = el('tbody', { id: id('props') });
    const propsBox = el('div', { class: 'nua-props' }, el('p', { class: 'nua-label', text: 'The URLComponents value in Swift' }),
      el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Property' }), el('th', { text: 'Value' }))), propsBody));
    const right = el('div', { class: 'nua-col' }, el('p', { class: 'nua-label', text: 'What the server reads' }), table, notes, propsBox);

    root.append(el('div', { class: 'nua' }, left, right));

    function build() {
      const city = state.city;
      let pieces;
      if (state.mode === 'components') {
        pieces = encodeComponents(city);
      } else {
        const whole = `https://${HOST}${PATH}?name=${city}&count=1`;
        const invalid = [...whole].some((ch) => !URL_LEGAL.test(ch));
        pieces = encodeNaive(city, invalid);
      }
      const value = pieces.map((p) => p.text).join('');
      const query = `name=${value}&count=1`;
      return { pieces, value, query, full: `https://${HOST}${PATH}?${query}` };
    }

    function render() {
      const b = build();
      segA.setAttribute('aria-checked', String(state.mode === 'components'));
      segB.setAttribute('aria-checked', String(state.mode === 'naive'));
      const span = (cls, text) => el('span', { class: cls, text });
      const line = document.createDocumentFragment();
      line.append(span('s-scheme', 'https'), span('s-punct', '://'), span('s-host', HOST), span('s-path', PATH), span('s-punct', '?'), span('s-query', 'name='));
      // One span per run of characters that share a color, not one per character.
      const runs = [];
      let inFragment = false;
      for (const p of b.pieces) {
        if (!p.encoded && p.text === '#') inFragment = true;
        const cls = inFragment ? 's-frag' : p.encoded ? 's-enc' : 's-query';
        let run = runs[runs.length - 1];
        if (!run || run.cls !== cls) { run = { cls, text: '', source: '' }; runs.push(run); }
        run.text += p.text;
        if (p.encoded && p.source) run.source += p.source;
      }
      for (const r of runs) {
        const node = span(r.cls, r.text);
        if (r.source) node.title = `"${r.source}" encoded as UTF-8 bytes`;
        line.append(node);
      }
      line.append(span(inFragment ? 's-frag' : 's-query', '&count=1'));
      url.replaceChildren(line);

      const reads = serverReads(b.query);
      const readRows = document.createDocumentFragment();
      for (const it of reads.items.length ? reads.items : [{ name: '(nothing)', value: '' }]) {
        const unexpected = !['name', 'count'].includes(it.name);
        const changed = it.name === 'name' && it.value !== state.city;
        readRows.append(el('tr', {},
          el('td', { class: unexpected ? 'bad' : '', text: it.name || '(empty)' }),
          el('td', { class: changed ? 'bad' : '', text: JSON.stringify(it.value) })));
      }
      tbody.replaceChildren(readRows);

      const list = [];
      const nameItem = reads.items.find((i) => i.name === 'name');
      if (nameItem && nameItem.value === state.city) list.push(['ok', 'The server receives exactly what the user typed.']);
      if (reads.fragment !== null) list.push(['bad', `Everything after # became a fragment, which never leaves the phone: "${reads.fragment}" is lost, including count=1.`]);
      const extras = reads.items.filter((i) => !['name', 'count'].includes(i.name));
      if (extras.length) list.push(['bad', `The & split the text: the server sees an unexpected item named ${JSON.stringify(extras[0].name)}.`]);
      if (nameItem && nameItem.plus) list.push(['warn', '+ is legal in a query, so URLComponents keeps it, but this server (like many) reads + as a space. Encode + yourself as %2B when values can contain it.']);
      const encodedCount = b.pieces.filter((p) => p.encoded).length;
      if (encodedCount) list.push(['ok', `${encodedCount} character${encodedCount === 1 ? '' : 's'} percent-encoded as UTF-8 bytes.`]);
      const swiftRows = state.mode === 'components'
        ? [['scheme', '"https"'], ['host', JSON.stringify(HOST)], ['path', JSON.stringify(PATH)],
          ['queryItems', `[name=${JSON.stringify(state.city)}, count="1"]`], ['percentEncodedQuery', JSON.stringify(b.query)]]
        : [['(no URLComponents)', 'URL(string:) parses one long string'], ['query', JSON.stringify(b.query.split('#')[0])], ['fragment', b.query.includes('#') ? JSON.stringify(b.query.split('#').slice(1).join('#')) : 'nil']];
      propsBody.replaceChildren(...swiftRows.map(([k, v]) => el('tr', {}, el('td', { text: k }), el('td', { text: v }))));
      notes.replaceChildren(...list.map(([tone, text]) => el('li', { class: tone === 'ok' ? '' : tone, text })));
    }

    async function send() {
      if (state.busy) return;
      state.busy = true;
      sendBtn.disabled = true;
      const b = build();
      result.textContent = 'Waiting for the server...';
      const describe = (json) => {
        const r = json && Array.isArray(json.results) ? json.results[0] : null;
        if (!r) return 'no matching place';
        return `${r.name}, ${r.country} (${Number(r.latitude).toFixed(2)}, ${Number(r.longitude).toFixed(2)})`;
      };
      try {
        const res = await ctx.fetchJSON(b.full, { timeoutMs: 8000 });
        result.replaceChildren(el('b', { text: `${res.status} ${res.statusText || ''}`.trim() }), ` in ${res.ms} ms: ${describe(res.json)}`);
      } catch {
        result.replaceChildren(el('span', { class: 'nua-tag', text: 'Offline sample' }), `Network unavailable. A real reply for São Paulo looks like: ${describe(SAMPLE)}`);
      } finally {
        state.busy = false;
        sendBtn.disabled = false;
      }
    }

    // Typing re-renders at most once per animation frame.
    const paint = frameThrottle(render);
    const offs = [
      on(input, 'input', () => {
        state.city = clipCity(input.value);
        if (input.value !== state.city) input.value = state.city;
        paint.request();
      }),
      on(segA, 'click', () => { state.mode = 'components'; render(); }),
      on(segB, 'click', () => { state.mode = 'naive'; render(); }),
      on(seg, 'keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        state.mode = state.mode === 'components' ? 'naive' : 'components';
        render();
        (state.mode === 'components' ? segA : segB).focus();
      }),
      on(sendBtn, 'click', send),
      ...[...chips.children].map((c) => on(c, 'click', () => { state.city = c.textContent; input.value = state.city; render(); })),
    ];
    render();
    return { destroy() { paint.cancel(); offs.forEach((off) => off()); root.replaceChildren(); root.classList.remove(`w-${NAME}`); } };
  },
};
