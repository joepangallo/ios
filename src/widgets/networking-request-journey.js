// Request journey: steps through every message of one HTTPS request
// (DNS, TCP, TLS or QUIC, HTTP) on a sequence diagram, counting round
// trips and elapsed time for a chosen round-trip time.

import { el, svgEl, on, idScope } from './services-kit.js';

const NAME = 'networking-request-journey';
const SERVER_MS = 30;

const DNS_STEPS = [
  { from: 'phone', to: 'dns', layer: 'DNS', label: 'Query: api.open-meteo.com?', title: 'DNS lookup',
    desc: 'iOS asks a DNS resolver for the server\'s IP address. Nothing can be sent to the server until the phone knows where it is.' },
  { from: 'dns', to: 'phone', layer: 'DNS', label: 'Answer: 203.0.113.7', title: 'DNS answer', rt: true,
    desc: 'The resolver replies with an IP address. iOS caches the answer, so later requests to this host skip the lookup.' },
];

const SCENARIOS = {
  h2: [
    ...DNS_STEPS,
    { from: 'phone', to: 'server', layer: 'TCP', label: 'SYN', title: 'TCP handshake: SYN',
      desc: 'The phone asks the server to open a TCP connection and picks a starting number for counting its bytes.' },
    { from: 'server', to: 'phone', layer: 'TCP', label: 'SYN-ACK', title: 'TCP handshake: SYN-ACK', rt: true,
      desc: 'The server agrees and sends its own starting number. The reliable byte stream now exists, but nothing is encrypted yet.' },
    { from: 'phone', to: 'server', layer: 'TLS', label: 'ACK + ClientHello', title: 'TLS 1.3: ClientHello',
      desc: 'The last TCP acknowledgment travels with the TLS ClientHello: supported ciphers, a key share, and ALPN offering h2 and http/1.1.' },
    { from: 'server', to: 'phone', layer: 'TLS', label: 'ServerHello, certificate, Finished', title: 'TLS 1.3: server reply', rt: true,
      desc: 'The server chooses a cipher and h2, sends its certificate and proves it holds the private key. iOS checks the certificate against the authorities it trusts.' },
    { from: 'phone', to: 'server', layer: 'HTTP', label: 'Finished + GET /v1/forecast', title: 'HTTP/2 request',
      desc: 'The phone completes TLS and, in the same flight, sends the encrypted request: method, path and headers. Only now does your request leave the phone.' },
    { at: 'server', layer: 'Server', label: 'Builds the JSON reply', title: 'Server work',
      desc: 'The server runs its code, perhaps queries a database, and builds the response. The network cannot speed this part up.' },
    { from: 'server', to: 'phone', layer: 'HTTP', label: '200 OK + JSON body', title: 'HTTP response', rt: true,
      desc: 'Status, headers and body arrive. URLSession resumes your await with the Data and the HTTPURLResponse.' },
  ],
  h3: [
    ...DNS_STEPS,
    { from: 'phone', to: 'server', layer: 'QUIC', label: 'Initial: ClientHello', title: 'QUIC Initial packet',
      desc: 'QUIC runs over UDP, so there is no TCP handshake. The very first packet already carries the TLS 1.3 ClientHello.' },
    { from: 'server', to: 'phone', layer: 'QUIC', label: 'ServerHello, certificate, Finished', title: 'QUIC handshake reply', rt: true,
      desc: 'One reply sets up the transport and the encryption together. iOS verifies the certificate exactly as it does for TLS over TCP.' },
    { from: 'phone', to: 'server', layer: 'HTTP', label: 'Finished + GET /v1/forecast', title: 'HTTP/3 request',
      desc: 'The request travels on its own QUIC stream, so a lost packet on another stream would not hold it up.' },
    { at: 'server', layer: 'Server', label: 'Builds the JSON reply', title: 'Server work',
      desc: 'Server time is identical for every protocol; only the setup before it changes.' },
    { from: 'server', to: 'phone', layer: 'HTTP', label: '200 OK + JSON body', title: 'HTTP response', rt: true,
      desc: 'The response arrives one round trip sooner than over TCP and TLS, because QUIC merged two handshakes into one.' },
  ],
  reuse: [
    { from: 'phone', to: 'server', layer: 'HTTP', label: 'GET /v1/forecast', title: 'Request on an open connection',
      desc: 'An earlier request left the connection open and the DNS answer cached. No handshakes at all: the request leaves immediately.' },
    { at: 'server', layer: 'Server', label: 'Builds the JSON reply', title: 'Server work',
      desc: 'The server does the same work as before.' },
    { from: 'server', to: 'phone', layer: 'HTTP', label: '200 OK + JSON body', title: 'HTTP response', rt: true,
      desc: 'One round trip in total. This is why URLSession keeps connections alive and why one shared session beats a new session per request.' },
  ],
};

const LAYER_COLOR = { DNS: 'var(--type)', TCP: 'var(--fn)', TLS: 'var(--kw)', QUIC: 'var(--kw)', HTTP: 'var(--accent-ink)', Server: 'var(--attr)' };
const LAYER_NOTE = {
  DNS: 'Name lookup', TCP: 'Reliable byte stream', TLS: 'Encryption and identity',
  QUIC: 'Transport and encryption in one', HTTP: 'Your request and response', Server: 'Backend work',
};

// What wraps the current message, innermost first.
function stackFor(step, proto) {
  const h3 = proto === 'h3';
  switch (step.layer) {
    case 'DNS': return ['DNS question', 'UDP datagram', 'IP packet'];
    case 'TCP': return ['TCP control segment', 'IP packet'];
    case 'TLS': return ['TLS handshake message', 'TCP segment', 'IP packet'];
    case 'QUIC': return ['TLS 1.3 handshake', 'QUIC packet', 'UDP datagram', 'IP packet'];
    case 'HTTP': return h3
      ? ['HTTP/3 request or response', 'QUIC stream, encrypted', 'UDP datagram', 'IP packet']
      : ['HTTP/2 request or response', 'TLS record, encrypted', 'TCP segment', 'IP packet'];
    default: return null;
  }
}

function totals(key, rtt) {
  const steps = SCENARIOS[key];
  const trips = steps.filter((s) => s.rt).length;
  return { trips, ms: trips * rtt + SERVER_MS };
}

export default {
  name: 'networking-request-journey',
  css: `
.w-${NAME} { container-type: size; container-name: nrj; height: 100%; min-height: 0; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .nrj { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px; min-height: 0; }
.w-${NAME} .nrj-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.w-${NAME} .nrj-seg { display: inline-flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .nrj-seg button { border: 0; background: transparent; color: var(--ink-2); font: 600 12.5px/1 var(--font-ui); padding: 7px 12px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .nrj-seg button[aria-checked="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} button:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .nrj-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.w-${NAME} .nrj-check input { accent-color: var(--accent); width: 16px; height: 16px; margin: 0; }
.w-${NAME} .nrj-rtt { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); }
.w-${NAME} .nrj-rtt input { width: 120px; accent-color: var(--accent); }
.w-${NAME} .nrj-rtt output { font: 600 12.5px var(--font-code); color: var(--ink); min-width: 52px; }
.w-${NAME} .nrj-main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 14px; }
.w-${NAME} .nrj-diagram { min-height: 0; min-width: 0; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); position: relative; overflow: hidden; }
.w-${NAME} .nrj-diagram svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.w-${NAME} .nrj-panel { min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.w-${NAME} .nrj-badge { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font: 700 11px/1 var(--font-ui); letter-spacing: .04em; text-transform: uppercase; padding: 5px 8px; border-radius: 999px; border: 1px solid currentColor; }
.w-${NAME} .nrj-badge span { font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--ink-2); }
.w-${NAME} .nrj-head { display: flex; flex-direction: column; gap: 8px; }
.w-${NAME} .nrj-title { margin: 0; font: 700 17px/1.25 var(--font-display); }
.w-${NAME} .short { display: none; }
.w-${NAME} .nrj-desc { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-2); flex: 1; min-height: 0; overflow: auto; }
.w-${NAME} .nrj-stack { display: flex; flex-direction: column; gap: 4px; }
.w-${NAME} .nrj-stack > small { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
.w-${NAME} .nrj-pkt { border: 1.5px solid var(--line); border-radius: 7px; padding: 3px 6px 5px; background: var(--panel); }
.w-${NAME} .nrj-pkt > span { display: block; font: 600 11.5px/1.3 var(--font-code); color: var(--ink-3); }
.w-${NAME} .nrj-pkt.inner { border-color: var(--accent); background: var(--accent-soft); }
.w-${NAME} .nrj-pkt.inner > span { color: var(--accent-ink); }
.w-${NAME} .nrj-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
.w-${NAME} .nrj-stat { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; }
.w-${NAME} .nrj-stat b { display: block; font: 700 16px/1.2 var(--font-code); color: var(--ink); }
.w-${NAME} .nrj-stat small { font-size: 11px; color: var(--ink-3); }
.w-${NAME} .nrj-buttons { display: flex; gap: 6px; }
.w-${NAME} .nrj-btn { flex: 1; border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 600 13px/1 var(--font-ui); padding: 9px 8px; border-radius: var(--r-sm); cursor: pointer; }
.w-${NAME} .nrj-btn:hover { background: var(--panel-2); }
.w-${NAME} .nrj-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${NAME} .nrj-btn:disabled { opacity: .45; cursor: default; }
.w-${NAME} .nrj-compare { display: grid; gap: 4px; }
.w-${NAME} .nrj-row { display: grid; grid-template-columns: 200px minmax(0, 1fr) 118px; align-items: center; gap: 10px; border: 1px solid transparent; background: transparent; color: var(--ink-2); text-align: left; font: 13px/1.2 var(--font-ui); padding: 4px 6px; border-radius: var(--r-sm); cursor: pointer; }
.w-${NAME} .nrj-row[aria-pressed="true"] { border-color: var(--line); background: var(--panel-2); color: var(--ink); font-weight: 600; }
.w-${NAME} .nrj-track { height: 10px; background: var(--panel-3); border-radius: 999px; overflow: hidden; }
.w-${NAME} .nrj-fill { height: 100%; background: var(--ink-3); border-radius: 999px; transition: width .3s ease; }
.w-${NAME} .nrj-row[aria-pressed="true"] .nrj-fill { background: var(--accent); }
.w-${NAME} .nrj-row .nrj-ms { font: 600 12px var(--font-code); text-align: right; }
.w-${NAME}.reduced .nrj-fill { transition: none; }
.w-${NAME} .nrj-arrow { transition: stroke-dashoffset .45s ease; }
.w-${NAME}.reduced .nrj-arrow { transition: none; }
@container nrj (max-width: 620px) {
  .w-${NAME} .nrj { padding: 10px; gap: 8px; }
  .w-${NAME} .nrj-controls { gap: 6px 12px; }
  .w-${NAME} .nrj-seg button { padding: 6px 10px; font-size: 12px; }
  .w-${NAME} .long { display: none; }
  .w-${NAME} .short { display: inline; }
  .w-${NAME} .nrj-main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(110px, 1fr) auto; gap: 8px; }
  .w-${NAME} .nrj-head { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 4px 8px; }
  .w-${NAME} .nrj-badge span { display: none; }
  .w-${NAME} .nrj-title { font-size: 15px; }
  .w-${NAME} .nrj-desc { font-size: 13px; flex: none; max-height: 4.6em; }
  .w-${NAME} .nrj-stack { display: none; }
  .w-${NAME} .nrj-stat { padding: 3px 6px; display: flex; align-items: baseline; gap: 6px; }
  .w-${NAME} .nrj-stat b { display: inline; font-size: 13px; }
  .w-${NAME} .nrj-btn { padding: 7px 6px; }
  .w-${NAME} .nrj-compare { gap: 2px; }
  .w-${NAME} .nrj-row { grid-template-columns: 112px minmax(0, 1fr) 88px; font-size: 11.5px; gap: 6px; padding: 2px 4px; }
  .w-${NAME} .nrj-row .nrj-ms { font-size: 11px; }
  .w-${NAME} .nrj-rtt input { width: 96px; }
}
@container nrj (min-height: 640px) and (max-width: 620px) {
  .w-${NAME} .nrj-desc { max-height: none; }
  .w-${NAME} .nrj-stack { display: flex; }
  .w-${NAME} .nrj-badge span { display: inline; }
}
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    if (ctx?.reducedMotion) root.classList.add('reduced');
    const id = idScope(NAME);
    const state = { proto: 'h2', reuse: false, rtt: 60, index: 0, playing: false };
    let timer = null;

    const segH2 = el('button', { type: 'button', role: 'radio', id: id('h2'), 'aria-checked': 'true', text: 'HTTP/2 over TCP + TLS' });
    const segH3 = el('button', { type: 'button', role: 'radio', id: id('h3'), 'aria-checked': 'false', text: 'HTTP/3 over QUIC' });
    const seg = el('div', { class: 'nrj-seg', role: 'radiogroup', 'aria-label': 'Protocol' }, segH2, segH3);
    const reuseBox = el('input', { type: 'checkbox', id: id('reuse') });
    const reuseLabel = el('label', { class: 'nrj-check', for: id('reuse') }, reuseBox,
      el('span', { class: 'long', text: 'Reuse an open connection' }), el('span', { class: 'short', text: 'Reuse connection' }));
    const rttInput = el('input', { type: 'range', id: id('rtt'), min: '10', max: '300', step: '10', value: String(state.rtt) });
    const rttOut = el('output', { for: id('rtt'), id: id('rtt-out') });
    const rttLabel = el('label', { class: 'nrj-rtt', for: id('rtt') },
      el('span', { class: 'long', text: 'Round-trip time' }), el('span', { class: 'short', text: 'RTT' }), rttInput, rttOut);
    const controls = el('div', { class: 'nrj-controls' }, seg, reuseLabel, rttLabel);

    const diagram = el('div', { class: 'nrj-diagram', role: 'img', id: id('diagram') });
    const badge = el('div', { class: 'nrj-badge' });
    const title = el('h3', { class: 'nrj-title', id: id('title') });
    const desc = el('p', { class: 'nrj-desc', id: id('desc'), 'aria-live': 'polite' });
    const statTrips = el('b');
    const statMs = el('b');
    const statStep = el('b');
    const stats = el('div', { class: 'nrj-stats' },
      el('div', { class: 'nrj-stat' }, statStep, el('small', { text: 'Message' })),
      el('div', { class: 'nrj-stat' }, statTrips, el('small', { text: 'Round trips' })),
      el('div', { class: 'nrj-stat' }, statMs, el('small', { text: 'Elapsed' })));
    const backBtn = el('button', { type: 'button', class: 'nrj-btn', id: id('back'), text: 'Back' });
    const nextBtn = el('button', { type: 'button', class: 'nrj-btn primary', id: id('next'), text: 'Next' });
    const playBtn = el('button', { type: 'button', class: 'nrj-btn', id: id('play'), text: 'Play' });
    const resetBtn = el('button', { type: 'button', class: 'nrj-btn', id: id('reset'), text: 'Reset' });
    const buttons = el('div', { class: 'nrj-buttons' }, backBtn, nextBtn, playBtn, resetBtn);
    const stack = el('div', { class: 'nrj-stack', id: id('stack') });
    const head = el('div', { class: 'nrj-head' }, badge, title);
    const panel = el('div', { class: 'nrj-panel' }, head, desc, stack, stats, buttons);
    const main = el('div', { class: 'nrj-main' }, diagram, panel);

    const rowDefs = [
      { key: 'h2', text: 'HTTP/2, new connection' },
      { key: 'h3', text: 'HTTP/3, new connection' },
      { key: 'reuse', text: 'Reused connection' },
    ];
    const rows = rowDefs.map((d) => {
      const fill = el('div', { class: 'nrj-fill' });
      const ms = el('span', { class: 'nrj-ms' });
      const btn = el('button', { type: 'button', class: 'nrj-row', id: id(`row-${d.key}`), 'aria-pressed': 'false' },
        el('span', { text: d.text }), el('div', { class: 'nrj-track' }, fill), ms);
      return { ...d, btn, fill, ms };
    });
    const compare = el('div', { class: 'nrj-compare', role: 'group', 'aria-label': 'Total time comparison' }, ...rows.map((r) => r.btn));

    const wrap = el('div', { class: 'nrj' }, controls, main, compare);
    root.append(wrap);

    const scenarioKey = () => (state.reuse ? 'reuse' : state.proto);
    const steps = () => SCENARIOS[scenarioKey()];

    function elapsedAfter(i) {
      let ms = 0;
      steps().slice(0, i + 1).forEach((s) => { ms += s.at ? SERVER_MS : state.rtt / 2; });
      return Math.round(ms);
    }

    function drawDiagram() {
      const list = steps();
      const cw = diagram.clientWidth || 520;
      const ch = diagram.clientHeight || 300;
      const w = Math.max(300, Math.min(640, cw));
      const h = Math.max(120, ch);
      const rowH = h < 260 ? 28 : 34;
      const top = 40;
      const capacity = Math.max(2, Math.floor((h - top - 18) / rowH));
      const first = Math.max(0, state.index - capacity + 1);
      const showDns = !state.reuse;
      const x = { phone: 50, dns: w / 2, server: w - 50 };
      const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMin meet', 'aria-hidden': 'true' });
      const defs = svgEl('defs');
      const mk = (mid, color) => {
        const m = svgEl('marker', { id: mid, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
        m.append(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }));
        return m;
      };
      defs.append(mk(id('m-done'), 'var(--ink-3)'), mk(id('m-now'), 'var(--accent)'));
      svg.append(defs);
      const lanes = [['phone', 'iPhone'], ['dns', 'DNS resolver'], ['server', 'Server']];
      for (const [key, label] of lanes) {
        const dim = key === 'dns' && !showDns;
        svg.append(svgEl('line', { x1: x[key], x2: x[key], y1: 28, y2: h - 4, stroke: 'var(--line)', 'stroke-width': '2', 'stroke-dasharray': dim ? '2 6' : '0' }));
        const t = svgEl('text', { x: x[key], y: 18, 'text-anchor': 'middle', fill: dim ? 'var(--ink-3)' : 'var(--ink)', 'font-size': '12.5', 'font-weight': '700', 'font-family': 'var(--font-ui)' });
        t.textContent = dim ? 'DNS (cached)' : label;
        svg.append(t);
      }
      if (first > 0) {
        const t = svgEl('text', { x: w / 2, y: top, 'text-anchor': 'middle', fill: 'var(--ink-3)', 'font-size': '11', 'font-style': 'italic', 'font-family': 'var(--font-ui)' });
        t.textContent = `${first} earlier message${first === 1 ? '' : 's'} above`;
        svg.append(t);
      }
      list.forEach((s, i) => {
        if (i > state.index || i < first) return;
        const y = top + (first > 0 ? 18 : 6) + (i - first) * rowH;
        const current = i === state.index;
        const color = current ? 'var(--accent)' : 'var(--ink-3)';
        if (s.at) {
          const bx = x.server;
          svg.append(svgEl('rect', { x: bx - 9, y: y - 2, width: 18, height: rowH - 6, rx: 4, fill: current ? 'var(--accent-soft)' : 'var(--panel-3)', stroke: color, 'stroke-width': '1.5' }));
          const t = svgEl('text', { x: bx - 16, y: y + rowH / 2 - 2, 'text-anchor': 'end', fill: current ? 'var(--accent-ink)' : 'var(--ink-3)', 'font-size': '12', 'font-family': 'var(--font-ui)' });
          t.textContent = `${s.label} (${SERVER_MS} ms)`;
          svg.append(t);
          return;
        }
        const x1 = x[s.from];
        const x2 = x[s.to];
        const y2 = y + rowH - 8;
        const len = Math.hypot(x2 - x1, y2 - y);
        const line = svgEl('line', { x1, y1: y, x2: x1 < x2 ? x2 - 3 : x2 + 3, y2, stroke: color, 'stroke-width': current ? '2.5' : '1.6', 'marker-end': `url(#${id(current ? 'm-now' : 'm-done')})`, class: 'nrj-arrow' });
        if (current && !ctx?.reducedMotion) {
          line.setAttribute('stroke-dasharray', `${len}`);
          line.setAttribute('stroke-dashoffset', `${len}`);
          requestAnimationFrame(() => requestAnimationFrame(() => { if (line.isConnected) line.setAttribute('stroke-dashoffset', '0'); }));
        }
        svg.append(line);
        const t = svgEl('text', { x: (x1 + x2) / 2, y: (y + y2) / 2 - 5, 'text-anchor': 'middle', fill: current ? 'var(--ink)' : 'var(--ink-3)', 'font-size': '12', 'font-weight': current ? '700' : '500', 'font-family': 'var(--font-code)' });
        t.textContent = s.label;
        const bg = svgEl('rect', { fill: 'var(--panel-2)', opacity: '0.85' });
        svg.append(bg, t);
      });
      diagram.replaceChildren(svg);
      // Label backgrounds can only be measured once the SVG is in the document.
      svg.querySelectorAll('text').forEach((t) => {
        const bg = t.previousSibling;
        if (!bg || bg.tagName !== 'rect' || bg.getAttribute('width')) return;
        try {
          const bb = t.getBBox();
          bg.setAttribute('x', bb.x - 3); bg.setAttribute('y', bb.y - 1);
          bg.setAttribute('width', bb.width + 6); bg.setAttribute('height', bb.height + 2);
        } catch { /* not rendered */ }
      });
      const s = list[state.index];
      diagram.setAttribute('aria-label', `Sequence diagram, message ${state.index + 1} of ${list.length}: ${s.title}`);
    }

    function render() {
      const list = steps();
      const s = list[state.index];
      const tripsDone = list.slice(0, state.index + 1).filter((x) => x.rt).length;
      const tot = totals(scenarioKey(), state.rtt);
      badge.style.color = LAYER_COLOR[s.layer];
      badge.replaceChildren(document.createTextNode(s.layer), el('span', { text: LAYER_NOTE[s.layer] }));
      title.textContent = s.title;
      desc.textContent = s.desc;
      const layers = stackFor(s, state.proto);
      if (layers) {
        let inner = null;
        layers.forEach((label, i) => {
          const box = el('div', { class: i === 0 ? 'nrj-pkt inner' : 'nrj-pkt' }, el('span', { text: label }));
          if (inner) box.append(inner);
          inner = box;
        });
        stack.replaceChildren(el('small', { text: 'What travels, outermost wrapper first' }), inner);
      } else {
        stack.replaceChildren(el('small', { text: 'Nothing on the wire: the server is computing' }));
      }
      statStep.textContent = `${state.index + 1}/${list.length}`;
      statTrips.textContent = `${tripsDone}/${tot.trips}`;
      statMs.textContent = `${elapsedAfter(state.index)} ms`;
      backBtn.disabled = state.index === 0;
      nextBtn.disabled = state.index >= list.length - 1;
      playBtn.textContent = state.playing ? 'Pause' : 'Play';
      segH2.setAttribute('aria-checked', String(state.proto === 'h2'));
      segH3.setAttribute('aria-checked', String(state.proto === 'h3'));
      reuseBox.checked = state.reuse;
      rttOut.textContent = `${state.rtt} ms`;
      const max = Math.max(...rows.map((r) => totals(r.key, state.rtt).ms));
      rows.forEach((r) => {
        const t = totals(r.key, state.rtt);
        r.fill.style.width = `${(t.ms / max) * 100}%`;
        r.ms.textContent = `${t.trips} RT, ${t.ms} ms`;
        r.btn.setAttribute('aria-pressed', String(r.key === scenarioKey()));
        r.btn.setAttribute('aria-label', `${r.text}: ${t.trips} round trips, ${t.ms} milliseconds. Show this scenario.`);
      });
      drawDiagram();
    }

    function stop() {
      state.playing = false;
      clearInterval(timer);
      timer = null;
    }
    function go(i) {
      state.index = Math.max(0, Math.min(steps().length - 1, i));
      if (state.index >= steps().length - 1) stop();
      render();
    }
    function setScenario(proto, reuse) {
      stop();
      state.proto = proto;
      state.reuse = reuse;
      state.index = 0;
      render();
    }

    const offs = [
      on(segH2, 'click', () => setScenario('h2', state.reuse)),
      on(segH3, 'click', () => setScenario('h3', state.reuse)),
      on(seg, 'keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const next = state.proto === 'h2' ? 'h3' : 'h2';
        setScenario(next, state.reuse);
        (next === 'h2' ? segH2 : segH3).focus();
      }),
      on(reuseBox, 'change', () => setScenario(state.proto, reuseBox.checked)),
      on(rttInput, 'input', () => { state.rtt = Number(rttInput.value); render(); }),
      on(backBtn, 'click', () => { stop(); go(state.index - 1); }),
      on(nextBtn, 'click', () => { stop(); go(state.index + 1); }),
      on(resetBtn, 'click', () => { stop(); go(0); }),
      on(playBtn, 'click', () => {
        if (state.playing) { stop(); render(); return; }
        if (state.index >= steps().length - 1) state.index = 0;
        state.playing = true;
        render();
        timer = setInterval(() => go(state.index + 1), ctx?.reducedMotion ? 1600 : 1200);
      }),
      ...rows.map((r) => on(r.btn, 'click', () => setScenario(r.key === 'reuse' ? state.proto : r.key, r.key === 'reuse'))),
    ];
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => drawDiagram()) : null;
    ro?.observe(diagram);
    render();

    return {
      destroy() {
        stop();
        ro?.disconnect();
        offs.forEach((off) => off());
        root.replaceChildren();
        root.classList.remove(`w-${NAME}`, 'reduced');
      },
    };
  },
};
