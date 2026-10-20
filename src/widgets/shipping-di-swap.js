// Dependency injection, made visible: the view, the view model and the
// WeatherService protocol stay fixed while the student swaps the injected
// implementation (live, mock or failing) and loads. Only the composition-root
// line changes. The live service calls the free Open-Meteo API and falls back
// to a clearly labeled offline sample when the network is unavailable.

const NAME = 'shipping-di-swap';
let uid = 0;

const LIVE_URL = 'https://api.open-meteo.com/v1/forecast?latitude=25.77&longitude=-80.19&current=temperature_2m';

const IMPLS = [
  { id: 'live', label: 'Live', type: 'LiveWeatherService', init: 'LiveWeatherService(latitude: 25.77, longitude: -80.19)', note: 'HTTPS request to Open-Meteo' },
  { id: 'mock', label: 'Mock', type: 'MockWeatherService', init: 'MockWeatherService()', note: 'returns 21.5 instantly' },
  { id: 'fail', label: 'Failing', type: 'FailingWeatherService', init: 'FailingWeatherService()', note: 'always throws' },
];

// Swift prints whole Doubles with ".0"; mirror that so the text matches.
const swiftDouble = (t) => (Number.isInteger(t) ? t.toFixed(1) : String(t));

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default {
  name: 'shipping-di-swap',
  css: `
.w-shipping-di-swap { display:flex; flex-direction:column; height:100%; box-sizing:border-box; padding:14px 16px; gap:8px; color:var(--ink); font:13px/1.4 var(--font-ui); min-width:0; }
.w-shipping-di-swap * { box-sizing:border-box; }
.w-shipping-di-swap .di-top { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.w-shipping-di-swap .di-title { margin:0; font:600 15px/1.25 var(--font-display); }
.w-shipping-di-swap .di-seg { display:flex; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:2px; gap:2px; }
.w-shipping-di-swap .di-seg label { position:relative; }
.w-shipping-di-swap .di-seg input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-di-swap .di-seg span { display:block; padding:3px 10px; border-radius:var(--r-sm); font-size:12.5px; font-weight:600; color:var(--ink-2); }
.w-shipping-di-swap .di-seg input:checked + span { background:var(--panel); color:var(--ink); box-shadow:var(--shadow); }
.w-shipping-di-swap .di-seg input:focus-visible + span { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-di-swap .di-root { margin:0; padding:6px 9px; border-radius:var(--r-sm); background:var(--code-bg); border:1px solid var(--line); font:11.5px/1.45 var(--font-code); overflow-wrap:anywhere; }
.w-shipping-di-swap .di-root .cap { display:block; font:700 9.5px var(--font-ui); letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); margin-bottom:1px; }
.w-shipping-di-swap .di-root .t-type { color:var(--type); }
.w-shipping-di-swap .di-root .t-num { color:var(--num); }
.w-shipping-di-swap .di-root mark { background:var(--accent-soft); color:var(--accent-ink); border-radius:3px; padding:0 2px; font-weight:700; }
.w-shipping-di-swap .di-stack { position:relative; flex:1; min-height:0; display:flex; flex-direction:column; justify-content:space-between; gap:0; }
.w-shipping-di-swap .di-layer { position:relative; z-index:1; display:flex; align-items:center; gap:9px; padding:7px 10px; border:1px solid var(--line); border-radius:var(--r-md); background:var(--panel-2); min-width:0; }
.w-shipping-di-swap .di-layer.fixed::after { content:'unchanged'; position:absolute; top:-7px; right:8px; padding:0 5px; font:700 9px var(--font-ui); letter-spacing:.05em; text-transform:uppercase; color:var(--ok); background:var(--panel); border:1px solid var(--ok); border-radius:999px; }
.w-shipping-di-swap .di-ic { flex:none; width:28px; height:28px; border-radius:8px; display:grid; place-items:center; background:var(--panel); border:1px solid var(--line); color:var(--ink-2); }
.w-shipping-di-swap .di-name { min-width:0; flex:1; }
.w-shipping-di-swap .di-name b { display:block; font:600 12.5px var(--font-code); overflow-wrap:anywhere; }
.w-shipping-di-swap .di-name small { display:block; color:var(--ink-3); font-size:11px; }
.w-shipping-di-swap .di-state { flex:none; max-width:52%; font:600 11.5px var(--font-code); padding:3px 7px; border-radius:var(--r-sm); background:var(--panel); border:1px solid var(--line); color:var(--ink); overflow-wrap:anywhere; text-align:right; }
.w-shipping-di-swap .di-state.bad { color:var(--bad); border-color:var(--bad); }
.w-shipping-di-swap .di-state.ok { color:var(--ok); border-color:var(--ok); }
.w-shipping-di-swap .di-card { flex:none; width:132px; padding:7px 9px; border-radius:12px; background:#FFFFFF; color:#000; box-shadow:0 1px 3px rgba(0,0,0,.18); font:12px/1.3 -apple-system, system-ui, sans-serif; }
.w-shipping-di-swap .di-card small { display:block; color:#8E8E93; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.w-shipping-di-swap .di-card span { display:block; font-size:13px; font-weight:600; margin-top:1px; }
.w-shipping-di-swap .di-card span.err { color:#FF3B30; font-size:12px; }
.w-shipping-di-swap .di-impls { display:flex; gap:4px; flex-wrap:wrap; margin-top:5px; }
.w-shipping-di-swap .di-impl { font:600 10.5px var(--font-code); padding:2px 6px; border-radius:999px; border:1px dashed var(--ink-3); color:var(--ink-3); }
.w-shipping-di-swap .di-impl.on { border-style:solid; border-color:var(--accent); background:var(--accent-soft); color:var(--accent-ink); }
.w-shipping-di-swap .di-link { position:relative; z-index:0; height:22px; margin-left:23px; border-left:2px solid var(--line); display:flex; align-items:center; padding-left:10px; font:11px var(--font-code); color:var(--ink-3); }
.w-shipping-di-swap .di-dot { position:absolute; z-index:2; left:20px; top:0; width:12px; height:12px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); opacity:0; transition:top .26s ease, opacity .15s; pointer-events:none; }
.w-shipping-di-swap .di-dot.show { opacity:1; }
.w-shipping-di-swap .di-bottom { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.w-shipping-di-swap .di-load { font:600 12.5px var(--font-ui); color:var(--on-accent); background:var(--accent); border:1px solid var(--accent); border-radius:var(--r-sm); padding:5px 14px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.w-shipping-di-swap .di-load:disabled { opacity:.55; cursor:default; }
.w-shipping-di-swap .di-load:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-di-swap .di-count { font-size:11.5px; color:var(--ink-2); }
.w-shipping-di-swap .di-count b { color:var(--ok); }
.w-shipping-di-swap .di-log { margin:0; font-size:11.5px; color:var(--ink-3); min-height:16px; }
.w-shipping-di-swap .di-tag { display:inline-block; margin-left:4px; padding:0 5px; border-radius:4px; background:var(--warn-soft); color:var(--warn); font-size:10px; font-weight:700; }
.w-shipping-di-swap.still * { transition:none !important; }
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    const still = !!(ctx && ctx.reducedMotion);
    if (still) el.classList.add('still');
    const n = ++uid;
    const icon = (name, size = 16) => (ctx && ctx.icon ? ctx.icon(name, size) : '');
    const state = { impl: 'mock', summary: 'Not loaded', busy: false, offline: false, log: '', token: 0 };
    const timers = [];
    const wait = (ms) => new Promise((resolve) => { timers.push(setTimeout(resolve, still ? 0 : ms)); });

    el.innerHTML = `
      <div class="di-top">
        <p class="di-title">Swap the dependency</p>
        <div class="di-seg" role="radiogroup" aria-label="Injected service">
          ${IMPLS.map((m) => `<label><input type="radio" name="${NAME}-impl-${n}" id="${NAME}-impl-${m.id}" value="${m.id}"${m.id === state.impl ? ' checked' : ''}><span>${m.label}</span></label>`).join('')}
        </div>
      </div>
      <p class="di-root" id="${NAME}-root"></p>
      <div class="di-stack" id="${NAME}-stack">
        <div class="di-layer fixed" data-layer="view">
          <span class="di-ic">${icon('iphone', 16)}</span>
          <span class="di-name"><b>WeatherView</b><small>SwiftUI view</small></span>
          <div class="di-card" aria-live="polite"><small>Miami</small><span id="${NAME}-card"></span></div>
        </div>
        <div class="di-link" aria-hidden="true">load() ↓ · summary ↑</div>
        <div class="di-layer fixed" data-layer="vm">
          <span class="di-ic">${icon('cpu', 16)}</span>
          <span class="di-name"><b>WeatherViewModel</b><small>@Observable</small></span>
          <span class="di-state" id="${NAME}-summary"></span>
        </div>
        <div class="di-link" aria-hidden="true">currentTemperature() ↓ · Double or error ↑</div>
        <div class="di-layer" data-layer="svc">
          <span class="di-ic">${icon('network', 16)}</span>
          <span class="di-name"><b>any WeatherService</b><small id="${NAME}-note"></small>
            <span class="di-impls" id="${NAME}-impls"></span></span>
        </div>
        <span class="di-dot" id="${NAME}-dot" aria-hidden="true"></span>
      </div>
      <div class="di-bottom">
        <button type="button" class="di-load" id="${NAME}-load">${icon('arrow.clockwise', 13)}Load</button>
        <span class="di-count">Lines changed in WeatherView: <b>0</b> · WeatherViewModel: <b>0</b></span>
      </div>
      <p class="di-log" id="${NAME}-log" role="status"></p>`;

    const $ = (sel) => el.querySelector(sel);
    const impl = () => IMPLS.find((m) => m.id === state.impl);
    const dot = $(`#${NAME}-dot`);

    function render() {
      const m = impl();
      $(`#${NAME}-root`).innerHTML = `<span class="cap">Composition root, the only line that changes</span><span class="t-type">WeatherViewModel</span>(service: <mark>${esc(m.init).replace(/(\d+\.\d+)/g, '<span class="t-num">$1</span>')}</mark>)`;
      $(`#${NAME}-note`).textContent = `protocol · now ${m.type}: ${m.note}`;
      $(`#${NAME}-impls`).innerHTML = IMPLS.map((x) => `<span class="di-impl${x.id === m.id ? ' on' : ''}">${x.type}</span>`).join('');
      const failed = state.summary === 'Could not load weather';
      const sum = $(`#${NAME}-summary`);
      sum.textContent = `"${state.summary}"`;
      sum.className = `di-state${failed ? ' bad' : state.summary.startsWith('Now') ? ' ok' : ''}`;
      const card = $(`#${NAME}-card`);
      card.className = failed ? 'err' : '';
      card.innerHTML = `${esc(state.summary)}${state.offline ? '<span class="di-tag">Offline sample</span>' : ''}`;
      $(`#${NAME}-log`).textContent = state.log;
      $(`#${NAME}-load`).disabled = state.busy;
    }

    // Moves the token to the vertical center of a layer.
    function moveDot(layer) {
      const stack = $(`#${NAME}-stack`);
      const box = stack.querySelector(`[data-layer="${layer}"]`);
      if (!box) return;
      dot.style.top = `${box.offsetTop + box.offsetHeight / 2 - 6}px`;
    }

    async function load() {
      const token = ++state.token;
      const alive = () => token === state.token;
      const m = impl();
      state.busy = true; state.offline = false; state.summary = 'Loading…'; state.log = 'View calls model.load()';
      render();
      moveDot('view'); dot.classList.add('show');
      await wait(260); if (!alive()) return;
      moveDot('vm');
      await wait(300); if (!alive()) return;
      state.log = `View model awaits service.currentTemperature() on ${m.type}`;
      render();
      moveDot('svc');
      await wait(300); if (!alive()) return;
      let reading = null;
      let error = null;
      const started = performance.now();
      if (m.id === 'mock') reading = 21.5;
      else if (m.id === 'fail') error = 'Offline';
      else {
        try {
          const res = await ctx.fetchJSON(LIVE_URL, { timeoutMs: 6000 });
          const t = res && res.ok && res.json && res.json.current && res.json.current.temperature_2m;
          if (typeof t !== 'number') throw new Error('unexpected reply');
          reading = t;
        } catch {
          reading = 27.0;
          state.offline = true;
        }
      }
      if (!alive()) return;
      const ms = Math.round(performance.now() - started);
      moveDot('vm');
      await wait(300); if (!alive()) return;
      if (error) {
        state.summary = 'Could not load weather';
        state.log = `${m.type} threw an error; the view model's catch block set the failure message.`;
      } else {
        state.summary = `Now: ${swiftDouble(reading)} °C`;
        state.log = state.offline
          ? `No network here, so the live service shows an offline sample instead of a real reading.`
          : `${m.type} returned ${swiftDouble(reading)} in ${m.id === 'live' ? `${ms} ms` : 'no time'}; summary updated.`;
      }
      render();
      moveDot('view');
      await wait(300); if (!alive()) return;
      dot.classList.remove('show');
      state.busy = false;
      render();
    }

    const onChange = (e) => {
      if (e.target.name !== `${NAME}-impl-${n}`) return;
      state.token += 1;
      while (timers.length) clearTimeout(timers.pop());
      dot.classList.remove('show');
      state.impl = e.target.value;
      state.summary = 'Not loaded';
      state.offline = false;
      state.busy = false;
      state.log = `Injected ${impl().type}. Press Load.`;
      render();
    };
    el.addEventListener('change', onChange);
    $(`#${NAME}-load`).addEventListener('click', load);
    state.log = 'Pick a service to inject, then press Load.';
    render();

    return {
      destroy() {
        state.token += 1;
        while (timers.length) clearTimeout(timers.pop());
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'still');
      },
    };
  },
};
