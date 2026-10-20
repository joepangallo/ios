// Live score lab: one simulated 10-minute match, delivered to a phone by
// polling, a WebSocket or push notifications. Compares update delay, wasted
// requests, radio-awake time and server work, with an optional stretch in
// the background where iOS suspends the app.

const NAME = 'networking-realtime-lab';
const MATCH = 600;
const TAIL = 8;
const PING = 30;
const RTT = 0.15;
const BG = [240, 420];
const APPROACHES = [
  { key: 'poll', label: 'Polling' },
  { key: 'socket', label: 'WebSocket' },
  { key: 'push', label: 'Push' },
];

function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMatch(seed) {
  const rng = mulberry32(seed);
  const count = 4 + Math.floor(rng() * 3);
  const goals = Array.from({ length: count }, () => Math.round(20 + rng() * 560)).sort((a, b) => a - b);
  return { goals, pushDelays: goals.map(() => 0.5 + rng() * 1.5) };
}

const inBg = (t, bg) => bg && t >= BG[0] && t < BG[1];

function run(approach, match, { interval, background }) {
  const transfers = [];
  const deliveries = [];
  let empty = 0;
  let requests = 0;
  let serverText = '';
  if (approach === 'poll') {
    let next = 0;
    for (let t = interval; t <= MATCH; t += interval) {
      if (inBg(t, background)) continue;
      requests++;
      const news = match.goals.filter((g, i) => g <= t && i >= next);
      transfers.push({ t, kind: news.length ? 'news' : 'empty' });
      if (!news.length) empty++;
      news.forEach((g) => deliveries.push({ goal: g, at: t + RTT }));
      next += news.length;
    }
    serverText = `${(requests * 1000).toLocaleString('en-US')} requests answered`;
  } else if (approach === 'socket') {
    transfers.push({ t: 0, kind: 'connect' });
    requests = 1;
    for (let t = PING; t < MATCH; t += PING) if (!inBg(t, background)) transfers.push({ t, kind: 'ping' });
    if (background) { transfers.push({ t: BG[1], kind: 'connect' }); requests++; }
    match.goals.forEach((g) => {
      if (inBg(g, background)) deliveries.push({ goal: g, at: BG[1] + 2 * RTT });
      else { deliveries.push({ goal: g, at: g + RTT }); transfers.push({ t: g, kind: 'news' }); }
    });
    const pings = transfers.filter((x) => x.kind === 'ping').length;
    serverText = `1,000 open connections + ${((match.goals.length + pings) * 1000).toLocaleString('en-US')} messages`;
  } else {
    match.goals.forEach((g, i) => {
      const at = g + match.pushDelays[i];
      deliveries.push({ goal: g, at, push: true });
      transfers.push({ t: at, kind: 'push' });
    });
    serverText = `${(match.goals.length * 1000).toLocaleString('en-US')} pushes sent through APNs`;
  }
  transfers.sort((a, b) => a.t - b.t);
  // Radio awake time: union of [t, t + TAIL] around every transfer.
  let awake = 0;
  let end = -Infinity;
  for (const x of transfers) {
    const s = Math.max(x.t, end);
    const e = x.t + TAIL;
    if (e > s) awake += e - s;
    end = Math.max(end, e);
  }
  awake = Math.min(awake, MATCH);
  const delays = deliveries.map((d) => d.at - d.goal);
  const avg = delays.reduce((s, d) => s + d, 0) / Math.max(1, delays.length);
  return { transfers, deliveries, empty, requests, awake, avg, worst: Math.max(0, ...delays), serverText };
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
const secs = (s) => (s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`);

export default {
  name: 'networking-realtime-lab',
  css: `
.w-${NAME} { container-type: size; container-name: nrt; height: 100%; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .nrt { box-sizing: border-box; height: 100%; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.w-${NAME} .nrt-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.w-${NAME} .nrt-seg { display: inline-flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .nrt-seg button { border: 0; background: transparent; color: var(--ink-2); font: 600 12.5px/1 var(--font-ui); padding: 7px 12px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .nrt-seg button[aria-checked="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} .nrt-field { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
.w-${NAME} select { font: 12.5px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 6px; }
.w-${NAME} select:disabled { opacity: .5; }
.w-${NAME} .nrt-field input { width: 15px; height: 15px; margin: 0; accent-color: var(--accent); }
.w-${NAME} .nrt-btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 600 12.5px var(--font-ui); padding: 6px 11px; border-radius: var(--r-sm); cursor: pointer; }
.w-${NAME} button:focus-visible, .w-${NAME} select:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .nrt-chart { position: relative; flex: 1; min-height: 150px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.w-${NAME} .nrt-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.w-${NAME} .nrt-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--ink-3); margin-top: -4px; }
.w-${NAME} .nrt-key { display: inline-flex; align-items: center; gap: 5px; }
.w-${NAME} .nrt-key i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.w-${NAME} .nrt-bottom { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 12px; }
.w-${NAME} .nrt-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; align-content: start; }
.w-${NAME} .nrt-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 7px; min-width: 0; }
.w-${NAME} .nrt-card b { display: block; font: 700 15px/1.2 var(--font-code); }
.w-${NAME} .nrt-card small { font-size: 10.5px; color: var(--ink-3); line-height: 1.2; display: block; }
.w-${NAME} .nrt-explain { grid-column: 1 / -1; margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--ink-2); }
.w-${NAME} .nrt-server { grid-column: 1 / -1; font-size: 12px; color: var(--ink-2); margin: 0; }
.w-${NAME} .nrt-server b { color: var(--ink); }
.w-${NAME} table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.w-${NAME} th, .w-${NAME} td { padding: 3px 5px; border-bottom: 1px solid var(--line); text-align: right; }
.w-${NAME} th:first-child, .w-${NAME} td:first-child { text-align: left; }
.w-${NAME} th { font: 700 10px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
.w-${NAME} td { font-family: var(--font-code); }
.w-${NAME} tr.sel td { background: var(--accent-soft); font-weight: 700; }
.w-${NAME} .nrt-assume { margin: 2px 0 0; font-size: 10.5px; color: var(--ink-3); }
@container nrt (max-width: 620px) {
  .w-${NAME} .nrt { padding: 10px; gap: 8px; }
  .w-${NAME} .nrt-chart { flex: none; height: 190px; }
  .w-${NAME} .nrt-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--ink-3); margin-top: -4px; }
.w-${NAME} .nrt-key { display: inline-flex; align-items: center; gap: 5px; }
.w-${NAME} .nrt-key i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.w-${NAME} .nrt-bottom { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .w-${NAME} .nrt-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .w-${NAME} .nrt-assume { display: none; }
}
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    const id = (s) => `${NAME}-${s}`;
    const state = { approach: 'poll', interval: 15, background: false, seed: 4 };
    let match = makeMatch(state.seed);

    const segBtns = APPROACHES.map((a) => el('button', { type: 'button', role: 'radio', id: id(`approach-${a.key}`), 'aria-checked': 'false', text: a.label }));
    const seg = el('div', { class: 'nrt-seg', role: 'radiogroup', 'aria-label': 'Delivery approach' }, ...segBtns);
    const intervalSel = el('select', { id: id('interval') }, ...[5, 15, 30, 60].map((s) => el('option', { value: String(s), text: `every ${s} s` })));
    const bgBox = el('input', { type: 'checkbox', id: id('background') });
    const newBtn = el('button', { type: 'button', class: 'nrt-btn', id: id('new'), text: 'New match' });
    const top = el('div', { class: 'nrt-top' }, seg,
      el('label', { class: 'nrt-field', for: id('interval') }, 'Poll', intervalSel),
      el('label', { class: 'nrt-field', for: id('background') }, bgBox, 'App in background, minutes 4 to 7'),
      newBtn);
    const chart = el('div', { class: 'nrt-chart', id: id('chart'), role: 'img' });
    const card = (key, label) => { const b = el('b', { id: id(`m-${key}`) }); return { node: el('div', { class: 'nrt-card' }, b, el('small', { text: label })), b }; };
    const cDelay = card('delay', 'average delay');
    const cReq = card('requests', 'requests from phone');
    const cEmpty = card('empty', 'empty replies');
    const cRadio = card('radio', 'radio awake');
    const explain = el('p', { class: 'nrt-explain', id: id('explain') });
    const server = el('p', { class: 'nrt-server', id: id('server') });
    const tbody = el('tbody');
    const table = el('table', { 'aria-label': 'All approaches for this match' },
      el('thead', {}, el('tr', {}, el('th', { text: 'Approach' }), el('th', { text: 'Delay' }), el('th', { text: 'Requests' }), el('th', { text: 'Radio' }))), tbody);
    const assume = el('p', { class: 'nrt-assume', text: `Model: each transfer keeps the radio awake ${TAIL} s; WebSocket pings every ${PING} s; push arrives 0.5 to 2 s after the event.` });
    const bottom = el('div', { class: 'nrt-bottom' },
      el('div', { class: 'nrt-cards' }, cDelay.node, cReq.node, cEmpty.node, cRadio.node, explain, server),
      el('div', {}, table, assume));
    const sw = (color, label) => el('span', { class: 'nrt-key' }, el('i', { style: `background:${color}` }), label);
    const legend = el('div', { class: 'nrt-legend', 'aria-hidden': 'true' },
      sw('var(--accent)', 'goal'), sw('var(--ink-3)', 'empty poll'), sw('var(--ok)', 'reply with news'),
      sw('var(--type)', 'keep-alive ping'), sw('var(--kw)', 'connect or push'), sw('var(--warn)', 'radio awake'));
    root.append(el('div', { class: 'nrt' }, top, chart, legend, bottom));

    function drawChart(r) {
      const w = Math.max(280, chart.clientWidth || 600);
      const h = Math.max(140, chart.clientHeight || 220);
      const padL = 84; const padR = 12; const padT = 8; const padB = 20;
      const x = (t) => padL + (t / MATCH) * (w - padL - padR);
      const lanes = ['Goals', 'Phone traffic', 'Score shown', 'Radio awake'];
      const laneH = (h - padT - padB) / lanes.length;
      const ly = (i) => padT + i * laneH;
      const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
      if (state.background) {
        svg.append(svgEl('rect', { x: x(BG[0]), y: padT, width: x(BG[1]) - x(BG[0]), height: h - padT - padB, fill: 'var(--warn-soft)' }));
        const t = svgEl('text', { x: (x(BG[0]) + x(BG[1])) / 2, y: h - padB - 4, 'text-anchor': 'middle', 'font-size': '10', fill: 'var(--warn)', 'font-family': 'var(--font-ui)', 'font-weight': '700' });
        t.textContent = 'in background';
        svg.append(t);
      }
      lanes.forEach((name, i) => {
        svg.append(svgEl('line', { x1: padL, x2: w - padR, y1: ly(i) + laneH, y2: ly(i) + laneH, stroke: 'var(--line)' }));
        const t = svgEl('text', { x: 8, y: ly(i) + laneH / 2 + 4, 'font-size': '11', fill: 'var(--ink-2)', 'font-family': 'var(--font-ui)', 'font-weight': '600' });
        t.textContent = name;
        svg.append(t);
      });
      for (let m = 0; m <= 10; m += 2) {
        const t = svgEl('text', { x: x(m * 60), y: h - 5, 'text-anchor': 'middle', 'font-size': '10', fill: 'var(--ink-3)', 'font-family': 'var(--font-code)' });
        t.textContent = `${m}m`;
        svg.append(t);
      }
      const mid = (i) => ly(i) + laneH / 2;
      match.goals.forEach((g) => {
        svg.append(svgEl('circle', { cx: x(g), cy: mid(0), r: 5, fill: 'var(--accent)' }));
      });
      r.transfers.forEach((tr) => {
        const color = tr.kind === 'empty' ? 'var(--ink-3)' : tr.kind === 'ping' ? 'var(--type)' : tr.kind === 'connect' ? 'var(--kw)' : 'var(--ok)';
        const hgt = tr.kind === 'empty' || tr.kind === 'ping' ? laneH * 0.35 : laneH * 0.6;
        svg.append(svgEl('rect', { x: x(tr.t) - 1, y: mid(1) - hgt / 2, width: 2.2, height: hgt, fill: color }));
      });
      r.deliveries.forEach((d) => {
        svg.append(svgEl('line', { x1: x(d.goal), y1: mid(0) + 5, x2: x(d.at), y2: mid(2), stroke: 'var(--accent)', 'stroke-width': '1.4', opacity: '0.7' }));
        svg.append(svgEl('circle', { cx: x(d.at), cy: mid(2), r: 4, fill: d.push ? 'var(--kw)' : 'var(--ok)' }));
      });
      // Radio awake segments.
      let segStart = null; let segEnd = null;
      const segs = [];
      r.transfers.forEach((tr) => {
        if (segEnd !== null && tr.t <= segEnd) segEnd = Math.max(segEnd, tr.t + TAIL);
        else { if (segStart !== null) segs.push([segStart, segEnd]); segStart = tr.t; segEnd = tr.t + TAIL; }
      });
      if (segStart !== null) segs.push([segStart, segEnd]);
      segs.forEach(([a, b]) => svg.append(svgEl('rect', { x: x(a), y: mid(3) - laneH * 0.25, width: Math.max(1.5, x(Math.min(b, MATCH)) - x(a)), height: laneH * 0.5, fill: 'var(--warn)', rx: 2 })));
      chart.replaceChildren(svg);
      chart.setAttribute('aria-label', `Timeline of a ten-minute match with ${match.goals.length} goals delivered by ${APPROACHES.find((a) => a.key === state.approach).label}.`);
    }

    function render() {
      segBtns.forEach((b, i) => b.setAttribute('aria-checked', String(APPROACHES[i].key === state.approach)));
      intervalSel.value = String(state.interval);
      intervalSel.disabled = state.approach !== 'poll';
      bgBox.checked = state.background;
      const opts = { interval: state.interval, background: state.background };
      const all = {
        poll: run('poll', match, opts), socket: run('socket', match, opts), push: run('push', match, opts),
      };
      const r = all[state.approach];
      cDelay.b.textContent = secs(r.avg);
      cReq.b.textContent = String(r.requests);
      cEmpty.b.textContent = state.approach === 'poll' ? `${r.empty}/${r.requests}` : '0';
      cRadio.b.textContent = `${Math.round((r.awake / MATCH) * 100)}%`;
      const missed = state.background ? match.goals.filter((g) => inBg(g, true)).length : 0;
      const text = {
        poll: `Updates wait for the next poll: ${secs(r.avg)} late on average, ${secs(r.worst)} at worst. ${r.empty} of ${r.requests} requests came back with no news.${missed ? ` ${missed} goal${missed > 1 ? 's' : ''} scored in the background waited until the app returned.` : ''}`,
        socket: `Each goal arrives about ${Math.round(RTT * 1000)} ms after it happens over the open connection. The price: every fan holds a connection, and pings keep the radio busy.${missed ? ` iOS suspended the app, so the socket closed and ${missed} goal${missed > 1 ? 's' : ''} waited for the reconnect.` : ''}`,
        push: `APNs delivers each goal within a couple of seconds, even with the app in the background, and the phone sends no requests at all. Delivery is best effort, so open the app to fetch the full, fresh score.`,
      }[state.approach];
      explain.textContent = text;
      server.replaceChildren('Server work for 1,000 fans: ', el('b', { text: r.serverText }));
      const rows = [['poll', `Poll ${state.interval} s`], ['socket', 'WebSocket'], ['push', 'Push']];
      tbody.replaceChildren(...rows.map(([k, label]) => {
        const x = all[k];
        return el('tr', { class: k === state.approach ? 'sel' : '' }, el('td', { text: label }), el('td', { text: secs(x.avg) }), el('td', { text: String(x.requests) }), el('td', { text: `${Math.round((x.awake / MATCH) * 100)}%` }));
      }));
      drawChart(r);
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
      on(intervalSel, 'change', () => { state.interval = Number(intervalSel.value); render(); }),
      on(bgBox, 'change', () => { state.background = bgBox.checked; render(); }),
      on(newBtn, 'click', () => { state.seed += 1; match = makeMatch(state.seed); render(); }),
    ];
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => render()) : null;
    ro?.observe(chart);
    render();
    return { destroy() { ro?.disconnect(); offs.forEach((off) => off()); root.replaceChildren(); root.classList.remove(`w-${NAME}`); } };
  },
};
