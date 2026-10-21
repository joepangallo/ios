// Live weather fetch: performs the real Open-Meteo request from the page and
// lights up each line of the Swift load function as the matching phase
// actually happens, with measured timings and a phone showing the LoadState.

import { esc, el, on, idScope, highlightSwift, iosThemeCss, phoneFrameCss } from './services-kit.js';

const NAME = 'networking-weather-live';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const CITIES = [
  { key: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { key: 'london', name: 'London', lat: 51.51, lon: -0.13 },
  { key: 'newyork', name: 'New York', lat: 40.71, lon: -74.01 },
  { key: 'saopaulo', name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { key: 'nairobi', name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { key: 'sydney', name: 'Sydney', lat: -33.87, lon: 151.21 },
  { key: 'reykjavik', name: 'Reykjavík', lat: 64.15, lon: -21.94 },
];
const SAMPLE = { current: { time: '2026-10-20T14:15', interval: 900, temperature_2m: 18.4, wind_speed_10m: 9.7 } };

const CODE = [
  'func load(_ city: City) async {',
  '    state = .loading',
  '    do {',
  '        var parts = URLComponents(string: forecastURL)!',
  '        parts.queryItems = [',
  '            URLQueryItem(name: "latitude", value: "\\(city.lat)"),',
  '            URLQueryItem(name: "longitude", value: "\\(city.lon)"),',
  '            URLQueryItem(name: "current",',
  '                         value: "temperature_2m,wind_speed_10m")',
  '        ]',
  '        let (data, response) =',
  '            try await session.data(from: parts.url!)',
  '        guard let http = response as? HTTPURLResponse,',
  '              http.statusCode == 200 else {',
  '            throw URLError(.badServerResponse)',
  '        }',
  '        let forecast = try JSONDecoder()',
  '            .decode(Forecast.self, from: data)',
  '        state = .loaded(forecast.current)',
  '    } catch {',
  '        state = .failed("Could not load the weather.")',
  '    }',
  '}',
];
const PHASES = {
  loading: { label: 'state = .loading', lines: [1] },
  build: { label: 'Build the URL', lines: [3, 4, 5, 6, 7, 8, 9] },
  network: { label: 'await the network', lines: [10, 11] },
  status: { label: 'Check the status', lines: [12, 13] },
  throw: { label: 'Bad status: throw', lines: [14] },
  decode: { label: 'Decode the JSON', lines: [16, 17] },
  loaded: { label: 'state = .loaded', lines: [18] },
  failed: { label: 'catch: state = .failed', lines: [19, 20] },
};

const fmtMs = (ms) => (ms == null ? '' : ms < 1 ? `${ms.toFixed(2)} ms` : `${Math.round(ms)} ms`);

export default {
  name: 'networking-weather-live',
  css: `
.w-${NAME} { container-type: size; container-name: nwl; height: 100%; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .nwl { box-sizing: border-box; height: 100%; padding: 12px; display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 14px; min-height: 0; }
.w-${NAME}.phone-mode .nwl { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.w-${NAME} .nwl-left { display: flex; flex-direction: column; gap: 8px; min-height: 0; min-width: 0; }
.w-${NAME} .nwl-right { display: flex; flex-direction: column; gap: 8px; min-height: 0; min-width: 0; }
.w-${NAME} .nwl-label { font: 700 11px/1.2 var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); margin: 0; }
.w-${NAME} select { width: 100%; box-sizing: border-box; font: 13px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; }
.w-${NAME} .nwl-checks { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.w-${NAME} .nwl-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.w-${NAME} .nwl-check input { width: 15px; height: 15px; margin: 0; accent-color: var(--accent); }
.w-${NAME} .nwl-ctl { display: flex; flex-direction: column; gap: 7px; }
.w-${NAME} .nwl-ctl-row { display: flex; flex-direction: column; gap: 7px; }
.w-${NAME} .nwl-codewrap { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
.w-${NAME} .nwl-timewrap { display: flex; flex-direction: column; gap: 6px; }
.w-${NAME} .nwl-fetch { white-space: nowrap; border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); font: 700 13.5px var(--font-ui); padding: 8px; border-radius: var(--r-sm); cursor: pointer; }
.w-${NAME} .nwl-fetch:disabled { opacity: .55; cursor: default; }
.w-${NAME} button:focus-visible, .w-${NAME} select:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .nwl-phone-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
${iosThemeCss(`.w-${NAME} .nwl-phone`, { light: { 'ios-bg': '#F2F2F7' } })}
${phoneFrameCss(`.w-${NAME}`, { frame: '.nwl-phone', screen: '.nwl-phone', bezel: 'border', shadow: 'none' })}
.w-${NAME} .nwl-phone { flex: 1; min-height: 150px; max-height: 330px; aspect-ratio: 9 / 17.5; max-width: 100%; display: flex; flex-direction: column; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .w-${NAME} .nwl-phone { border-color: #3a3a3c; } }
:root[data-theme="dark"] .w-${NAME} .nwl-phone { border-color: #3a3a3c; }
.w-${NAME} .nwl-island { width: 34%; height: 11px; background: #000; border-radius: 999px; margin: 5px auto 0; flex: none; }
.w-${NAME} .nwl-screen { flex: 1; display: flex; flex-direction: column; padding: 10px 12px; gap: 6px; min-height: 0; }
.w-${NAME} .nwl-title { font: 700 19px/1.1 -apple-system, system-ui, var(--font-ui); margin: 6px 0 2px; }
.w-${NAME} .nwl-city { font-size: 12px; color: var(--ios-label-2); }
.w-${NAME} .nwl-content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
.w-${NAME} .nwl-spinner { width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid color-mix(in srgb, var(--ios-label-2) 40%, transparent); border-top-color: var(--ios-label-2); animation: nwl-spin .8s linear infinite; }
.w-${NAME}.reduced .nwl-spinner { animation: none; border-style: dotted; }
@keyframes nwl-spin { to { transform: rotate(360deg); } }
.w-${NAME} .nwl-temp { font: 300 38px/1 -apple-system, system-ui, var(--font-ui); }
.w-${NAME} .nwl-sub { font-size: 12px; color: var(--ios-label-2); }
.w-${NAME} .nwl-try { border: 0; background: var(--ios-blue); color: #fff; font: 600 12.5px -apple-system, system-ui, var(--font-ui); padding: 6px 12px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .nwl-state { font: 12px var(--font-code); color: var(--ink-2); text-align: center; }
.w-${NAME} .nwl-state b { color: var(--accent-ink); }
.w-${NAME} .nwl-code { flex: 1; min-height: 0; overflow: auto; background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-md); padding: 6px 0; font: 12px/1.5 var(--font-code); }
.w-${NAME} .nwl-line { display: grid; grid-template-columns: 30px minmax(0, 1fr); white-space: pre; border-left: 3px solid transparent; transition: background-color .2s; }
.w-${NAME}.reduced .nwl-line { transition: none; }
.w-${NAME} .nwl-line .ln { color: var(--ink-3); text-align: right; padding-right: 10px; user-select: none; }
.w-${NAME} .nwl-line.done { background: color-mix(in srgb, var(--ok-soft) 60%, transparent); }
.w-${NAME} .nwl-line.now { background: var(--code-line); border-left-color: var(--accent); }
.w-${NAME} .nwl-line.err { background: var(--bad-soft); border-left-color: var(--bad); }
.w-${NAME} .t-kw { color: var(--kw); font-weight: 600; } .w-${NAME} .t-str { color: var(--str); } .w-${NAME} .t-num { color: var(--num); } .w-${NAME} .t-type { color: var(--type); }
.w-${NAME} .nwl-timeline { display: flex; flex-direction: column; gap: 3px; }
.w-${NAME} .nwl-trow { display: grid; grid-template-columns: 150px minmax(0, 1fr) 70px; gap: 8px; align-items: center; font-size: 12px; color: var(--ink-2); }
.w-${NAME} .nwl-trow.active { color: var(--ink); font-weight: 600; }
.w-${NAME} .nwl-trow.skipped { opacity: .45; }
.w-${NAME} .nwl-trow.failed { color: var(--bad); }
.w-${NAME} .nwl-track { height: 8px; background: var(--panel-3); border-radius: 999px; overflow: hidden; }
.w-${NAME} .nwl-bar { height: 100%; width: 0; background: var(--ok); border-radius: 999px; }
.w-${NAME} .nwl-trow.active .nwl-bar { background: var(--accent); }
.w-${NAME} .nwl-trow.failed .nwl-bar { background: var(--bad); }
.w-${NAME} .nwl-ms { font: 600 11.5px var(--font-code); text-align: right; }
.w-${NAME} .nwl-note { margin: 0; font-size: 12px; color: var(--ink-2); min-height: 1.4em; }
.w-${NAME} .nwl-tag { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; padding: 2px 6px; border-radius: 4px; background: var(--warn-soft); color: var(--warn); margin-right: 4px; }
@container nwl (max-width: 620px) {
  .w-${NAME} .nwl, .w-${NAME}.phone-mode .nwl { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); grid-template-rows: auto auto minmax(0, 1fr) auto;
    grid-template-areas: "ctl ctl" "phone time" "code code" "note note"; padding: 10px; gap: 8px 10px; }
  .w-${NAME}.phone-mode .nwl { grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "ctl ctl" "phone time" "note note"; }
  .w-${NAME} .nwl-left, .w-${NAME} .nwl-right { display: contents; }
  .w-${NAME} .nwl-ctl { grid-area: ctl; }
  .w-${NAME} .nwl-ctl-row { flex-direction: row; }
  .w-${NAME} .nwl-ctl-row select { flex: 1; min-width: 0; }
  .w-${NAME} .nwl-phone-wrap { grid-area: phone; min-height: 0; }
  .w-${NAME} .nwl-phone { flex: 1; min-height: 0; max-height: 280px; border-width: 5px; border-radius: 24px; }
  .w-${NAME} .nwl-temp { font-size: 30px; }
  .w-${NAME} .nwl-timewrap { grid-area: time; align-self: start; }
  .w-${NAME} .nwl-codewrap { grid-area: code; }
  .w-${NAME} .nwl-code { font-size: 11px; }
  .w-${NAME} .nwl-note { grid-area: note; }
  .w-${NAME} .nwl-trow { grid-template-columns: minmax(0, 1fr) 54px; gap: 4px; }
  .w-${NAME} .nwl-trow .nwl-track { grid-column: 1 / -1; grid-row: 2; height: 5px; }
  .w-${NAME} .nwl-state { font-size: 11px; }
}
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    const phoneMode = props.mode === 'phone';
    if (phoneMode) root.classList.add('phone-mode');
    if (ctx?.reducedMotion) root.classList.add('reduced');
    const id = idScope(NAME);
    const HOLD = ctx?.reducedMotion ? 120 : 420;
    let alive = true;
    const state = { city: CITIES[0], busy: false, model: 'idle', data: null, offline: false, badCoords: false, timings: {}, path: [], active: null, firstNetwork: null, note: '' };

    const citySel = el('select', { id: id('city') }, ...CITIES.map((c) => el('option', { value: c.key, text: c.name })));
    const offlineBox = el('input', { type: 'checkbox', id: id('offline') });
    const badBox = el('input', { type: 'checkbox', id: id('bad') });
    const fetchBtn = el('button', { type: 'button', class: 'nwl-fetch', id: id('fetch'), text: 'Fetch weather' });
    const screen = el('div', { class: 'nwl-screen' });
    const phone = el('div', { class: 'nwl-phone', role: 'img', id: id('phone') }, el('div', { class: 'nwl-island' }), screen);
    const stateLine = el('p', { class: 'nwl-state', id: id('state'), 'aria-live': 'polite' });
    const ctl = el('div', { class: 'nwl-ctl' },
      el('label', { class: 'nwl-label', for: id('city'), text: 'City' }),
      el('div', { class: 'nwl-ctl-row' }, citySel, fetchBtn),
      el('div', { class: 'nwl-checks' },
        el('label', { class: 'nwl-check', for: id('bad') }, badBox, 'Invalid latitude'),
        el('label', { class: 'nwl-check', for: id('offline') }, offlineBox, 'Simulate offline')));
    const phoneWrap = el('div', { class: 'nwl-phone-wrap' }, phone, stateLine);
    const left = el('div', { class: 'nwl-left' }, ctl, phoneWrap);

    const codeBox = el('div', { class: 'nwl-code', id: id('code'), role: 'region', 'aria-label': 'Swift load function', tabindex: '0' },
      ...CODE.map((line, i) => {
        const row = el('div', { class: 'nwl-line', 'data-line': String(i) }, el('span', { class: 'ln', text: String(i + 1) }));
        const code = el('span');
        code.innerHTML = highlightSwift(line, { prefix: 't-' });
        row.append(code);
        return row;
      }));
    const timeline = el('div', { class: 'nwl-timeline', id: id('timeline'), role: 'list', 'aria-label': 'Measured phases' });
    const note = el('p', { class: 'nwl-note', id: id('note'), 'aria-live': 'polite' });
    const codeWrap = phoneMode ? null : el('div', { class: 'nwl-codewrap' }, el('p', { class: 'nwl-label', text: 'The Swift that runs, line by line' }), codeBox);
    const timeWrap = el('div', { class: 'nwl-timewrap' }, el('p', { class: 'nwl-label', text: 'Measured in this page' }), timeline);
    const right = el('div', { class: 'nwl-right' }, codeWrap, timeWrap, note);
    root.append(el('div', { class: 'nwl' }, left, right));

    const tickers = new Set();
    // Hold timers are tracked so destroy() can clear them; a cleared hold
    // resolves at once and the alive checks in phase() end the run.
    const holds = new Map();
    const sleep = (ms) => new Promise((resolve) => {
      const t = setTimeout(() => { holds.delete(t); resolve(); }, ms);
      holds.set(t, resolve);
    });

    function renderPhone() {
      const c = state.city;
      const kids = [el('div', { class: 'nwl-title', text: 'Weather' }), el('div', { class: 'nwl-city', text: c.name })];
      let content;
      if (state.model === 'idle') content = [el('div', { class: 'nwl-sub', text: 'Tap Fetch weather to load.' })];
      else if (state.model === 'loading') content = [el('div', { class: 'nwl-spinner', 'aria-hidden': 'true' }), el('div', { class: 'nwl-sub', text: 'Loading weather' })];
      else if (state.model === 'loaded') {
        const cur = state.data;
        content = [el('div', { class: 'nwl-temp', text: `${cur.temperature_2m.toFixed(1)} °C` }), el('div', { class: 'nwl-sub', text: `Wind ${cur.wind_speed_10m.toFixed(1)} km/h` }), el('div', { class: 'nwl-sub', text: cur.time.replace('T', ' ') + ' UTC' })];
      } else {
        const tryBtn = el('button', { type: 'button', class: 'nwl-try', id: id('try'), text: 'Try Again' });
        tryBtn.disabled = state.busy;
        tryBtn.addEventListener('click', run);
        content = [el('div', { class: 'nwl-sub', text: 'Could not load the weather.' }), tryBtn];
      }
      kids.push(el('div', { class: 'nwl-content' }, ...content));
      screen.replaceChildren(...kids);
      const described = { idle: '.idle', loading: '.loading', loaded: '.loaded(CurrentWeather)', failed: '.failed("Could not load the weather.")' }[state.model];
      stateLine.replaceChildren('model.state = ', el('b', { text: described }));
      phone.setAttribute('aria-label', `Simulated iPhone showing state ${described}`);
    }

    function renderCode() {
      const done = new Set();
      const err = new Set();
      for (const p of state.path) {
        if (p === state.active) continue;
        PHASES[p].lines.forEach((l) => (p === 'throw' || p === 'failed' ? err : done).add(l));
      }
      const now = new Set(state.active ? PHASES[state.active].lines : []);
      codeBox.querySelectorAll('.nwl-line').forEach((row) => {
        const i = Number(row.dataset.line);
        row.className = 'nwl-line' + (now.has(i) ? (state.active === 'throw' || state.active === 'failed' ? ' err' : ' now') : err.has(i) ? ' err' : done.has(i) ? ' done' : '');
      });
      const first = codeBox.querySelector('.nwl-line.now, .nwl-line.err');
      if (first && state.active && typeof first.scrollIntoView === 'function') {
        const box = codeBox.getBoundingClientRect();
        const r = first.getBoundingClientRect();
        if (r.top < box.top || r.bottom > box.bottom) codeBox.scrollTop += r.top - box.top - 30;
      }
    }

    function renderTimeline() {
      const order = ['loading', 'build', 'network', 'status', 'decode', 'loaded'];
      const failedRun = state.path.includes('failed');
      const rows = failedRun ? state.path.filter((p) => p !== 'throw') : order;
      const max = Math.max(1, ...Object.values(state.timings).map((t) => t.ms || 0));
      timeline.replaceChildren(...rows.map((p) => {
        const t = state.timings[p];
        const cls = ['nwl-trow'];
        if (state.active === p) cls.push('active');
        if (!t && state.path.length && !state.path.includes(p)) cls.push('skipped');
        if (p === 'failed' || (p === 'status' && state.path.includes('throw'))) cls.push('failed');
        const bar = el('div', { class: 'nwl-bar' });
        bar.style.width = t ? `${Math.max(2, (t.ms / max) * 100)}%` : '0';
        return el('div', { class: cls.join(' '), role: 'listitem', id: id(`phase-${p}`) },
          el('span', { text: PHASES[p].label }), el('div', { class: 'nwl-track' }, bar),
          el('span', { class: 'nwl-ms', text: t ? (t.label || fmtMs(t.ms)) : '' }));
      }));
    }

    function render() {
      citySel.value = state.city.key;
      citySel.disabled = state.busy;
      offlineBox.checked = state.offline;
      badBox.checked = state.badCoords;
      offlineBox.disabled = badBox.disabled = state.busy;
      fetchBtn.disabled = state.busy;
      fetchBtn.textContent = state.busy ? 'Loading...' : 'Fetch weather';
      renderPhone();
      if (!phoneMode) renderCode();
      renderTimeline();
      if (typeof state.note === 'string') note.textContent = state.note;
      else note.replaceChildren(...state.note);
    }

    async function phase(name, work) {
      if (!alive) throw Object.assign(new Error('destroyed'), { destroyed: true });
      state.active = name;
      state.path.push(name);
      render();
      const started = performance.now();
      // The network wait is the only phase long enough to watch; tick its clock live.
      const ticker = name === 'network' ? setInterval(() => {
        state.timings.network = { ms: performance.now() - started, label: `${Math.round(performance.now() - started)} ms` };
        renderTimeline();
      }, 50) : null;
      if (ticker) tickers.add(ticker);
      let result;
      try { result = await work(); } finally { if (ticker) { clearInterval(ticker); tickers.delete(ticker); } }
      if (!alive) throw Object.assign(new Error('destroyed'), { destroyed: true });
      const ms = performance.now() - started;
      state.timings[name] = { ms: result?.ms ?? ms, label: result?.label };
      render();
      const hold = Math.max(0, HOLD - (performance.now() - started));
      if (hold) await sleep(hold);
      if (!alive) throw Object.assign(new Error('destroyed'), { destroyed: true });
      return result;
    }

    async function run() {
      if (state.busy) return;
      try { await runInner(); } catch (e) { if (!(e && e.destroyed)) throw e; }
    }

    async function runInner() {
      state.busy = true;
      state.path = [];
      state.timings = {};
      state.note = '';
      const city = state.city;
      try {
        await phase('loading', () => { state.model = 'loading'; return null; });
        const built = await phase('build', () => {
          const t0 = performance.now();
          const u = new URL(FORECAST);
          u.searchParams.set('latitude', String(state.badCoords ? 200 : city.lat));
          u.searchParams.set('longitude', String(city.lon));
          u.searchParams.set('current', 'temperature_2m,wind_speed_10m');
          return { url: u.toString().replace('%2C', ','), ms: performance.now() - t0 };
        });
        let res;
        let sample = false;
        await phase('network', async () => {
          if (state.offline) {
            await sleep(60);
            throw Object.assign(new Error('offline'), { simulated: true });
          }
          try {
            res = await ctx.fetchJSON(built.url, { timeoutMs: 9000 });
            return { ms: res.ms };
          } catch {
            sample = true;
            res = { ok: true, status: 200, text: JSON.stringify(SAMPLE), ms: null };
            return { ms: 0, label: 'sample' };
          }
        });
        if (!alive) return;
        await phase('status', () => null);
        if (res.status !== 200) {
          await phase('throw', () => null);
          throw Object.assign(new Error('status'), { status: res.status, body: res.json });
        }
        const decoded = await phase('decode', () => {
          const t0 = performance.now();
          const json = JSON.parse(res.text);
          const cur = json.current;
          if (typeof cur?.temperature_2m !== 'number' || typeof cur?.wind_speed_10m !== 'number') throw new Error('decode');
          return { cur, ms: performance.now() - t0 };
        });
        await phase('loaded', () => { state.model = 'loaded'; state.data = decoded.cur; return null; });
        state.active = null;
        const net = state.timings.network.ms;
        if (sample) {
          state.note = [el('span', { class: 'nwl-tag', text: 'Offline sample' }), 'The network was unavailable, so a stored reply was decoded instead.'];
        } else if (state.firstNetwork && net < state.firstNetwork * 0.7) {
          state.note = `The network wait dropped from ${Math.round(state.firstNetwork)} ms to ${Math.round(net)} ms. Connection reuse, caching, or a faster server response could explain it; elapsed time alone does not identify the cause.`;
        } else {
          state.note = `The network took ${fmtMs(net)}; building the URL took ${fmtMs(state.timings.build.ms)}, and decoding took ${fmtMs(state.timings.decode.ms)}. Fetch again to compare timings. Connection reuse is one possible reason for a faster repeat request.`;
          if (!state.firstNetwork) state.firstNetwork = net;
        }
      } catch (err) {
        if (!alive) return;
        await phase('failed', () => { state.model = 'failed'; return null; });
        state.active = null;
        state.note = err.simulated
          ? 'Simulated offline: data(from:) threw URLError(.notConnectedToInternet), so execution jumped straight to catch.'
          : err.status
            ? `The server answered ${err.status}${err.body?.reason ? `: "${err.body.reason}"` : ''}. URLSession did not throw; the guard did.`
            : 'Decoding failed, so the decoder threw and catch ran.';
      } finally {
        state.busy = false;
        state.active = null;
        if (alive) render();
      }
    }

    const offs = [
      on(citySel, 'change', () => { if (state.busy) { render(); return; } state.city = CITIES.find((c) => c.key === citySel.value); state.model = 'idle'; state.path = []; state.timings = {}; state.note = ''; render(); }),
      on(offlineBox, 'change', () => { if (state.busy) { render(); return; } state.offline = offlineBox.checked; }),
      on(badBox, 'change', () => { if (state.busy) { render(); return; } state.badCoords = badBox.checked; }),
      on(fetchBtn, 'click', run),
    ];
    render();
    return {
      destroy() {
        alive = false;
        tickers.forEach(clearInterval);
        tickers.clear();
        holds.forEach((resolve, t) => { clearTimeout(t); resolve(); });
        holds.clear();
        offs.forEach((off) => off());
        root.replaceChildren();
        root.classList.remove(`w-${NAME}`, 'phone-mode', 'reduced');
      },
    };
  },
};
