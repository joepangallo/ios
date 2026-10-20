// Retry lab: 200 simulated phones lose their requests when a server crashes,
// then retry with one of four policies while the server recovers. A second
// panel triggers real failures (a timeout, a 503, a real retry loop).

const NAME = 'networking-retry-lab';
const N = 200;
const TICK = 50;
const HORIZON = 8000;
const OUTAGE = 400;
const MAX_ATTEMPTS = 6;
const POLICIES = [
  { key: 'none', label: 'No retries', short: 'None' },
  { key: 'immediate', label: 'Retry immediately', short: 'Immediate' },
  { key: 'backoff', label: 'Exponential backoff', short: 'Backoff' },
  { key: 'jitter', label: 'Backoff + jitter', short: 'Jitter' },
];
const EXPLAIN = {
  none: 'Every request was in flight when the server crashed, so every user sees an error, even though the server is back 400 ms later.',
  immediate: 'Phones retry every 50 ms, burn through all six attempts during the outage, and give up before the server returns. Lots of load, no successes.',
  backoff: 'Waiting 200, 400, 800 ms... outlasts the outage, but every phone failed at the same instant, so they all come back at the same instant. Each wave overwhelms the server again.',
  jitter: 'Each phone waits a random time between 0 and the backoff delay. Retries spread out, the server handles them at its capacity, and everyone gets through quickly.',
};

function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(policy, capacity, seed = 11) {
  const rng = mulberry32(seed);
  const maxAttempts = policy === 'none' ? 1 : MAX_ATTEMPTS;
  const ticks = HORIZON / TICK;
  const clients = Array.from({ length: N }, () => ({ next: 0, attempts: 0, state: 'waiting', at: null }));
  const load = [];
  for (let t = 0; t < ticks; t++) {
    const due = clients.filter((c) => c.state === 'waiting' && c.next === t);
    for (let i = due.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [due[i], due[j]] = [due[j], due[i]]; }
    const cap = t * TICK < OUTAGE ? 0 : capacity;
    due.forEach((c, idx) => {
      c.attempts++;
      if (idx < cap) { c.state = 'ok'; c.at = t * TICK; return; }
      if (c.attempts >= maxAttempts) { c.state = 'gaveup'; return; }
      const base = 200 * 2 ** (c.attempts - 1);
      const ms = policy === 'immediate' ? TICK : policy === 'backoff' ? base : rng() * base;
      c.next = t + Math.max(1, Math.round(ms / TICK));
    });
    load.push({ sent: due.length, served: Math.min(cap, due.length) });
  }
  const ok = clients.filter((c) => c.state === 'ok').map((c) => c.at).sort((a, b) => a - b);
  return {
    load,
    ok: ok.length,
    gaveUp: clients.filter((c) => c.state === 'gaveup').length,
    waiting: clients.filter((c) => c.state === 'waiting').length,
    sent: load.reduce((s, l) => s + l.sent, 0),
    rejected: load.reduce((s, l) => s + l.sent - l.served, 0),
    peak: Math.max(...load.slice(OUTAGE / TICK).map((l) => l.sent), 0),
    median: ok.length ? ok[Math.floor(ok.length / 2)] : null,
  };
}

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
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const fmtS = (ms) => (ms == null ? 'n/a' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export default {
  name: 'networking-retry-lab',
  css: `
.w-${NAME} { container-type: size; container-name: nrl; height: 100%; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .nrl { box-sizing: border-box; height: 100%; padding: 12px; display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px 14px; }
.w-${NAME} .nrl-top { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.w-${NAME} .nrl-seg { display: inline-flex; flex-wrap: wrap; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .nrl-seg button { border: 0; background: transparent; color: var(--ink-2); font: 600 12.5px/1 var(--font-ui); padding: 7px 11px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .nrl-seg button[aria-checked="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} .nrl-cap { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-2); }
.w-${NAME} .nrl-cap input { width: 110px; accent-color: var(--accent); }
.w-${NAME} .nrl-cap output { font: 600 12px var(--font-code); color: var(--ink); min-width: 64px; }
.w-${NAME} .nrl-btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 600 12.5px var(--font-ui); padding: 7px 12px; border-radius: var(--r-sm); cursor: pointer; }
.w-${NAME} .nrl-btn.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.w-${NAME} .nrl-btn:disabled { opacity: .55; cursor: default; }
.w-${NAME} button:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .nrl-chart { position: relative; min-height: 0; min-width: 0; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.w-${NAME} .nrl-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.w-${NAME} .nrl-side { display: flex; flex-direction: column; gap: 8px; min-height: 0; min-width: 0; }
.w-${NAME} .nrl-explain { margin: 0; font-size: 13px; line-height: 1.45; color: var(--ink-2); }
.w-${NAME} .nrl-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.w-${NAME} .nrl-stat { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 8px; }
.w-${NAME} .nrl-stat b { display: block; font: 700 16px/1.2 var(--font-code); }
.w-${NAME} .nrl-stat small { font-size: 11px; color: var(--ink-3); }
.w-${NAME} .nrl-stat.good b { color: var(--ok); } .w-${NAME} .nrl-stat.bad b { color: var(--bad); }
.w-${NAME} table { width: 100%; border-collapse: collapse; font-size: 12px; }
.w-${NAME} th, .w-${NAME} td { text-align: right; padding: 3px 5px; border-bottom: 1px solid var(--line); }
.w-${NAME} th:first-child, .w-${NAME} td:first-child { text-align: left; }
.w-${NAME} th { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
.w-${NAME} td { font-family: var(--font-code); }
.w-${NAME} tr.sel td { background: var(--accent-soft); color: var(--ink); font-weight: 700; }
.w-${NAME} .nrl-real { grid-column: 1 / -1; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 12px; align-items: start; border-top: 1px solid var(--line); padding-top: 8px; }
.w-${NAME} .nrl-real-btns { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.w-${NAME} .nrl-real-label { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); margin-right: 4px; }
.w-${NAME} .nrl-log { margin: 0; font: 12px/1.45 var(--font-code); color: var(--ink-2); max-height: 4.4em; overflow: auto; white-space: pre-wrap; }
.w-${NAME} .nrl-tag { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; padding: 1px 5px; border-radius: 4px; background: var(--warn-soft); color: var(--warn); }
@container nrl (max-width: 620px) {
  .w-${NAME} .nrl { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 170px auto auto; padding: 10px; gap: 8px; overflow: hidden; }
  .w-${NAME} .nrl-seg button { padding: 6px 8px; font-size: 12px; }
  .w-${NAME} .nrl-explain { font-size: 12px; }
  .w-${NAME} .nrl-stats { grid-template-columns: repeat(4, 1fr); }
  .w-${NAME} .nrl-stat b { font-size: 13px; }
  .w-${NAME} .nrl-side table { display: none; }
  .w-${NAME} .nrl-real { grid-template-columns: minmax(0, 1fr); }
}
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    const id = (s) => `${NAME}-${s}`;
    const state = { policy: 'backoff', capacity: 20, shown: Infinity, raf: null, busy: false };
    let results = {};

    const segBtns = POLICIES.map((p) => el('button', { type: 'button', role: 'radio', id: id(`policy-${p.key}`), 'aria-checked': 'false', text: p.label }));
    const seg = el('div', { class: 'nrl-seg', role: 'radiogroup', 'aria-label': 'Retry policy' }, ...segBtns);
    const capInput = el('input', { type: 'range', id: id('capacity'), min: '10', max: '60', step: '5', value: String(state.capacity) });
    const capOut = el('output', { for: id('capacity') });
    const runBtn = el('button', { type: 'button', class: 'nrl-btn primary', id: id('run'), text: 'Replay' });
    const top = el('div', { class: 'nrl-top' }, seg, el('label', { class: 'nrl-cap', for: id('capacity') }, 'Server capacity', capInput, capOut), runBtn);

    const chart = el('div', { class: 'nrl-chart', id: id('chart'), role: 'img' });
    const explain = el('p', { class: 'nrl-explain', id: id('explain') });
    const stat = (key, label) => { const b = el('b', { id: id(`stat-${key}`) }); return { box: el('div', { class: 'nrl-stat' }, b, el('small', { text: label })), b }; };
    const sOk = stat('ok', 'users succeeded');
    const sGave = stat('gaveup', 'gave up');
    const sSent = stat('sent', 'requests sent');
    const sMed = stat('median', 'median wait');
    const tbody = el('tbody');
    const table = el('table', { 'aria-label': 'All policies compared' },
      el('thead', {}, el('tr', {}, el('th', { text: 'Policy' }), el('th', { text: 'Succeeded' }), el('th', { text: 'Requests' }), el('th', { text: 'Peak after restart', title: 'Most requests in one 50 ms slice once the server is back' }))), tbody);
    const side = el('div', { class: 'nrl-side' }, explain, el('div', { class: 'nrl-stats' }, sOk.box, sGave.box, sSent.box, sMed.box), table);

    const timeoutBtn = el('button', { type: 'button', class: 'nrl-btn', id: id('real-timeout'), text: 'Real timeout' });
    const s503Btn = el('button', { type: 'button', class: 'nrl-btn', id: id('real-503'), text: 'Real 503' });
    const loopBtn = el('button', { type: 'button', class: 'nrl-btn', id: id('real-loop'), text: 'Real retry loop' });
    const log = el('pre', { class: 'nrl-log', id: id('log'), 'aria-live': 'polite', tabindex: '0' });
    log.textContent = 'Send real requests from this page. The retry loop hits a test server that answers 503 or 200 at random.';
    const real = el('div', { class: 'nrl-real' }, el('div', { class: 'nrl-real-btns' }, el('span', { class: 'nrl-real-label', text: 'Real failures' }), timeoutBtn, s503Btn, loopBtn), log);

    root.append(el('div', { class: 'nrl' }, top, chart, side, real));

    function compute() {
      results = Object.fromEntries(POLICIES.map((p) => [p.key, simulate(p.key, state.capacity)]));
    }

    function drawChart() {
      const r = results[state.policy];
      const w = Math.max(240, chart.clientWidth || 500);
      const h = Math.max(120, chart.clientHeight || 300);
      const padL = 34; const padB = 22; const padT = 10; const padR = 8;
      const ticks = r.load.length;
      const maxY = Math.max(N, ...r.load.map((l) => l.sent));
      const x = (t) => padL + (t / ticks) * (w - padL - padR);
      const y = (v) => h - padB - (v / maxY) * (h - padB - padT);
      const bw = Math.max(1, (w - padL - padR) / ticks - 0.6);
      const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
      svg.append(svgEl('rect', { x: x(0), y: padT, width: x(OUTAGE / TICK) - x(0), height: h - padB - padT, fill: 'var(--bad-soft)' }));
      const outLabel = svgEl('text', { x: x(0) + 4, y: padT + 12, 'font-size': '10.5', fill: 'var(--bad)', 'font-family': 'var(--font-ui)', 'font-weight': '700' });
      outLabel.textContent = 'down';
      svg.append(outLabel);
      for (const v of [0, Math.round(maxY / 2), maxY]) {
        svg.append(svgEl('line', { x1: padL, x2: w - padR, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': '1' }));
        const t = svgEl('text', { x: padL - 4, y: y(v) + 3.5, 'text-anchor': 'end', 'font-size': '10', fill: 'var(--ink-3)', 'font-family': 'var(--font-code)' });
        t.textContent = String(v);
        svg.append(t);
      }
      for (let s = 0; s <= HORIZON / 1000; s += 2) {
        const t = svgEl('text', { x: x((s * 1000) / TICK), y: h - 6, 'text-anchor': 'middle', 'font-size': '10', fill: 'var(--ink-3)', 'font-family': 'var(--font-code)' });
        t.textContent = `${s}s`;
        svg.append(t);
      }
      const limit = Math.min(ticks, state.shown);
      for (let t = 0; t < limit; t++) {
        const l = r.load[t];
        if (!l.sent) continue;
        svg.append(svgEl('rect', { x: x(t), y: y(l.sent), width: bw, height: y(l.served) - y(l.sent), fill: 'var(--bad)' }));
        if (l.served) svg.append(svgEl('rect', { x: x(t), y: y(l.served), width: bw, height: y(0) - y(l.served), fill: 'var(--ok)' }));
      }
      svg.append(svgEl('line', { x1: x(OUTAGE / TICK), x2: w - padR, y1: y(state.capacity), y2: y(state.capacity), stroke: 'var(--ink)', 'stroke-width': '1.5', 'stroke-dasharray': '5 4' }));
      const capLabel = svgEl('text', { x: w - padR - 2, y: y(state.capacity) - 4, 'text-anchor': 'end', 'font-size': '10.5', fill: 'var(--ink)', 'font-family': 'var(--font-ui)' });
      capLabel.textContent = `capacity ${state.capacity} per 50 ms`;
      svg.append(capLabel);
      const legend = [['var(--ok)', 'served'], ['var(--bad)', 'rejected (503)']];
      legend.forEach(([c, label], i) => {
        const lx = w - padR - 160 + i * 64;
        svg.append(svgEl('rect', { x: lx, y: padT + 20, width: 9, height: 9, fill: c, rx: 2 }));
        const t = svgEl('text', { x: lx + 13, y: padT + 28, 'font-size': '10.5', fill: 'var(--ink-2)', 'font-family': 'var(--font-ui)' });
        t.textContent = label;
        svg.append(t);
      });
      chart.replaceChildren(svg);
      chart.setAttribute('aria-label', `Requests per 50 milliseconds for ${POLICIES.find((p) => p.key === state.policy).label}: ${r.ok} of ${N} users succeeded, ${r.sent} requests sent.`);
    }

    function render() {
      const r = results[state.policy];
      segBtns.forEach((b, i) => b.setAttribute('aria-checked', String(POLICIES[i].key === state.policy)));
      capOut.textContent = `${state.capacity} / 50 ms`;
      explain.textContent = EXPLAIN[state.policy];
      sOk.b.textContent = `${r.ok}/${N}`;
      sOk.box.className = 'nrl-stat ' + (r.ok === N ? 'good' : r.ok < N / 2 ? 'bad' : '');
      sGave.b.textContent = String(r.gaveUp + r.waiting);
      sGave.box.className = 'nrl-stat ' + (r.gaveUp + r.waiting ? 'bad' : 'good');
      sSent.b.textContent = String(r.sent);
      sMed.b.textContent = fmtS(r.median);
      tbody.replaceChildren(...POLICIES.map((p) => {
        const x = results[p.key];
        return el('tr', { class: p.key === state.policy ? 'sel' : '' }, el('td', { text: p.short }), el('td', { text: `${x.ok}` }), el('td', { text: `${x.sent}` }), el('td', { text: `${x.peak}` }));
      }));
      drawChart();
    }

    function replay() {
      cancelAnimationFrame(state.raf);
      if (ctx?.reducedMotion) { state.shown = Infinity; render(); return; }
      const total = results[state.policy].load.length;
      const started = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - started) / 1600);
        state.shown = Math.ceil(p * total);
        drawChart();
        if (p < 1) state.raf = requestAnimationFrame(step);
      };
      state.shown = 0;
      render();
      state.raf = requestAnimationFrame(step);
    }

    function setBusy(b) {
      state.busy = b;
      [timeoutBtn, s503Btn, loopBtn].forEach((x) => { x.disabled = b; });
    }
    const write = (...lines) => { log.replaceChildren(...lines.flatMap((l, i) => [...(i ? ['\n'] : []), ...(Array.isArray(l) ? l : [l])])); };
    const sample = (text) => [el('span', { class: 'nrl-tag', text: 'Offline sample' }), ` ${text}`];

    const destroyedFlag = { v: false };
    async function realTimeout() {
      setBusy(true);
      write('GET https://httpbin.org/delay/3 with a 1.5 s timeout...');
      const t0 = performance.now();
      try {
        const res = await ctx.fetchJSON('https://httpbin.org/delay/3', { timeoutMs: 1500 });
        if (destroyedFlag.v) return;
        write(`Answered ${res.status} after ${res.ms} ms (the server was faster than usual).`);
      } catch (e) {
        if (destroyedFlag.v) return;
        const ms = Math.round(performance.now() - t0);
        if (e && e.name === 'AbortError') write(`No reply within ${ms} ms, so the request was cancelled: a real timeout.`, 'In Swift this arrives as URLError(.timedOut). A GET is idempotent, so retrying is safe.');
        else write(sample('Network unavailable. With a connection, this request gives up after 1.5 s and Swift throws URLError(.timedOut).'));
      } finally { if (!destroyedFlag.v) setBusy(false); }
    }

    async function real503() {
      setBusy(true);
      write('GET https://httpbin.org/status/503 ...');
      try {
        const res = await ctx.fetchJSON('https://httpbin.org/status/503', { timeoutMs: 8000 });
        if (destroyedFlag.v) return;
        write(`A reply arrived: ${res.status} Service Unavailable in ${res.ms} ms.`, 'URLSession returns normally here; your status check must throw. 503 is temporary, so it is worth retrying with backoff.');
      } catch {
        if (destroyedFlag.v) return;
        write(sample('Network unavailable. With a connection, the server answers 503 and URLSession does not throw.'));
      } finally { if (!destroyedFlag.v) setBusy(false); }
    }

    async function realLoop() {
      setBusy(true);
      const lines = [];
      const show = () => write(...lines);
      let delay = 300;
      try {
        for (let attempt = 1; attempt <= 4; attempt++) {
          if (destroyedFlag.v) return;
          const res = await ctx.fetchJSON('https://httpbin.org/status/503,200', { timeoutMs: 8000 });
          if (destroyedFlag.v) return;
          if (res.status === 200) { lines.push(`Attempt ${attempt}: 200 in ${res.ms} ms. Success.`); show(); return; }
          if (attempt === 4) { lines.push(`Attempt ${attempt}: ${res.status} in ${res.ms} ms. Giving up after 4 attempts.`); show(); return; }
          const wait = Math.round(Math.random() * delay);
          lines.push(`Attempt ${attempt}: ${res.status} in ${res.ms} ms. Waiting ${wait} ms (random, up to ${delay}).`);
          show();
          await new Promise((r) => setTimeout(r, wait));
          if (destroyedFlag.v) return;
          delay *= 2;
        }
      } catch {
        if (destroyedFlag.v) return;
        write(...lines, sample('Network unavailable. A typical run: 503, wait 141 ms; 503, wait 502 ms; 200, success.'));
      } finally { if (!destroyedFlag.v) setBusy(false); }
    }

    const on = (node, ev, fn) => { node.addEventListener(ev, fn); return () => node.removeEventListener(ev, fn); };
    const offs = [
      ...segBtns.map((b, i) => on(b, 'click', () => { state.policy = POLICIES[i].key; replay(); })),
      on(seg, 'keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const i = POLICIES.findIndex((p) => p.key === state.policy);
        const n = (i + (e.key === 'ArrowRight' ? 1 : POLICIES.length - 1)) % POLICIES.length;
        state.policy = POLICIES[n].key;
        replay();
        segBtns[n].focus();
      }),
      on(capInput, 'input', () => { state.capacity = Number(capInput.value); compute(); state.shown = Infinity; render(); }),
      on(runBtn, 'click', replay),
      on(timeoutBtn, 'click', realTimeout),
      on(s503Btn, 'click', real503),
      on(loopBtn, 'click', realLoop),
    ];
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => drawChart()) : null;
    ro?.observe(chart);
    compute();
    render();
    return { destroy() { destroyedFlag.v = true; cancelAnimationFrame(state.raf); ro?.disconnect(); offs.forEach((off) => off()); root.replaceChildren(); root.classList.remove(`w-${NAME}`); } };
  },
};
