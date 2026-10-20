// MapKit for SwiftUI simulator: a stylized San Francisco waterfront drawn as
// SVG inside a simulated iPhone. The student changes the map style, elevation
// and camera, adds Markers and Annotations by tapping, shows the user's
// location, and runs a simulated MKLocalSearch. The SwiftUI code beside the
// phone is regenerated from that state and the lines that changed light up.
import { esc, codeHtml, codeCss, phoneHtml, phoneCss, panelCss, idFor } from './services-kit.js';

const NAME = 'services-map-sim';
const S = `.w-${NAME}`;
const id = (role) => idFor(NAME, role);

const RAD = Math.PI / 180;
const LAT0 = 37.8080;
const LON0 = -122.4177;
const KX = 111320 * Math.cos(LAT0 * RAD);
const KY = 110574;
const proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KY];
const unproj = (x, y) => [LAT0 - y / KY, LON0 + x / KX];
const P = (lat, lon) => proj(lat, lon).map((v) => v.toFixed(1)).join(',');

const MIN_DELTA = 0.004;
const MAX_DELTA = 0.06;
const TILT = 52;
const PERSPECTIVE = 520;
const ORIGIN_Y = 0.2;
const STAGE_STRETCH = 1.7;
const MAX_ITEMS = 8;

// --- Geometry (lat, lon) -------------------------------------------------------
const LAND = [
  [37.7700, -122.4600], [37.8030, -122.4600], [37.8045, -122.4480], [37.8060, -122.4400], [37.8075, -122.4330],
  [37.8070, -122.4300], [37.8085, -122.4290], [37.8080, -122.4255], [37.8065, -122.4245], [37.8075, -122.4228],
  [37.8072, -122.4210], [37.8082, -122.4195], [37.8085, -122.4170], [37.8088, -122.4140], [37.8085, -122.4110],
  [37.8080, -122.4080], [37.8070, -122.4050], [37.8050, -122.4020], [37.8030, -122.4000], [37.8000, -122.3980],
  [37.7970, -122.3955], [37.7950, -122.3930], [37.7920, -122.3900], [37.7880, -122.3870], [37.7700, -122.3870],
];
const PARKS = [
  [[37.8050, -122.4310], [37.8044, -122.4268], [37.8027, -122.4272], [37.8031, -122.4313]],
  [[37.8064, -122.4240], [37.8060, -122.4214], [37.8051, -122.4217], [37.8054, -122.4241]],
  [[37.8013, -122.4106], [37.8013, -122.4094], [37.8003, -122.4094], [37.8003, -122.4106]],
  [[37.8062, -122.4425], [37.8058, -122.4360], [37.8049, -122.4362], [37.8052, -122.4425]],
  [[37.8034, -122.4070], [37.8034, -122.4046], [37.8014, -122.4046], [37.8014, -122.4070]],
];
const PIERS = [
  [[37.8080, -122.4098], [37.8106, -122.4106], 70],
  [[37.8085, -122.4122], [37.8101, -122.4124], 45],
  [[37.8088, -122.4168], [37.8108, -122.4173], 55],
  [[37.8083, -122.4205], [37.8104, -122.4209], 30],
  [[37.8066, -122.4045], [37.8081, -122.4022], 60],
  [[37.8053, -122.4028], [37.8072, -122.3999], 70],
  [[37.8021, -122.3994], [37.8036, -122.3968], 55],
  [[37.7966, -122.3950], [37.7979, -122.3926], 50],
];
const ROADS = [
  [[37.7700, -122.4241], [37.8063, -122.4241]],
  [[37.7955, -122.4040], [37.8000, -122.4090], [37.8065, -122.4185]],
  [[37.8045, -122.4480], [37.8045, -122.4050]],
  [[37.8078, -122.4180], [37.8077, -122.4090], [37.8066, -122.4052], [37.8046, -122.4024], [37.8026, -122.4004],
    [37.7996, -122.3984], [37.7966, -122.3959], [37.7946, -122.3936], [37.7915, -122.3906]],
];
const POIS = [
  { name: 'Ghirardelli Square', lat: 37.8059, lon: -122.4229 },
  { name: 'Coit Tower', lat: 37.8024, lon: -122.4058 },
  { name: 'Ferry Building', lat: 37.7955, lon: -122.3937 },
  { name: 'Fort Mason', lat: 37.8040, lon: -122.4300 },
  { name: 'Alcatraz Island', lat: 37.8270, lon: -122.4230 },
  { name: 'Aquatic Park', lat: 37.8078, lon: -122.4232 },
];
const USER = { lat: 37.8063, lon: -122.4166 };
const CAFES = [
  { name: 'Harbor Roasters', lat: 37.8062, lon: -122.4142 },
  { name: 'Wharfside Coffee', lat: 37.8051, lon: -122.4108 },
  { name: 'Telegraph Espresso', lat: 37.8016, lon: -122.4075 },
];

function inPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < ((xj - xi) * (pt[0] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function buildMap() {
  const land = `<polygon class="ms-land" points="${LAND.map(([a, b]) => P(a, b)).join(' ')}"/>`;
  const alcatraz = (() => {
    const [cx, cy] = proj(37.8267, -122.4230);
    return `<ellipse class="ms-land" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="270" ry="110" transform="rotate(-18 ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
  })();
  const piers = PIERS.map(([a, b, w]) => `<path class="ms-pier" d="M${P(...a)}L${P(...b)}" stroke-width="${w}"/>`).join('');
  const parks = PARKS.map((poly) => `<polygon class="ms-park" points="${poly.map(([a, b]) => P(a, b)).join(' ')}"/>`).join('');
  let grid = '';
  for (let lat = 37.7710; lat <= 37.8090; lat += 0.0011) {
    const [x1, y] = proj(lat, -122.4600);
    const [x2] = proj(lat, -122.3880);
    grid += `M${x1.toFixed(0)},${y.toFixed(0)}H${x2.toFixed(0)}`;
  }
  for (let lon = -122.4590; lon <= -122.3880; lon += 0.0014) {
    const [x, y1] = proj(37.7700, lon);
    const [, y2] = proj(37.8090, lon);
    grid += `M${x.toFixed(0)},${y1.toFixed(0)}V${y2.toFixed(0)}`;
  }
  const roads = ROADS.map((r) => `<path class="ms-major" d="${r.map(([a, b], i) => `${i ? 'L' : 'M'}${P(a, b)}`).join('')}"/>`).join('');
  // Buildings: one small block per street cell that lies on land and outside parks.
  let bases = '';
  let roofs = '';
  let n = 0;
  for (let lat = 37.7720; lat < 37.8085; lat += 0.0011) {
    for (let lon = -122.4583; lon < -122.3890; lon += 0.0014) {
      n += 1;
      const c = [lat + 0.00055, lon + 0.0007];
      if (!inPolygon(c, LAND) || PARKS.some((p) => inPolygon(c, p))) continue;
      const [x, y] = proj(lat + 0.00098, lon + 0.00016);
      const w = 70 + ((n * 37) % 40);
      const h = 60 + ((n * 53) % 40);
      bases += `M${x.toFixed(0)},${y.toFixed(0)}h${w}v${h}h-${w}Z`;
      roofs += `M${x.toFixed(0)},${(y - 14).toFixed(0)}h${w}v${h}h-${w}Z`;
    }
  }
  return `
    <defs>
      <clipPath id="${id('clip-land')}"><polygon points="${LAND.map(([a, b]) => P(a, b)).join(' ')}"/></clipPath>
      <filter id="${id('grain')}" x="0" y="0" width="1" height="1">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="7"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0.05 0.42"/></feComponentTransfer>
      </filter>
    </defs>
    <rect class="ms-water" x="-30000" y="-30000" width="60000" height="60000"/>
    ${land}${alcatraz}${piers}
    <g clip-path="url(#${id('clip-land')})">
      ${parks}
      <path class="ms-street" d="${grid}"/>
      <path class="ms-bldg" d="${bases}"/>
      <path class="ms-roof" d="${roofs}"/>
      ${roads}
    </g>
    <rect class="ms-grain" id="${id('grain-rect')}" filter="url(#${id('grain')})" x="0" y="0" width="1" height="1"/>`;
}

const STYLE_TEXT = {
  standard: 'standard: the familiar road map with labels and points of interest.',
  imagery: 'imagery: satellite and aerial photos, no labels.',
  hybrid: 'hybrid: photos with roads and labels drawn on top.',
};
const f4 = (v) => v.toFixed(4);
const f3 = (v) => v.toFixed(3);

// Tabbed layout (Map | Code) used on short, narrow panels and with compact: true.
function layoutCss(sel) {
  return `
  ${sel} .ms { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "tabs" "main"; padding: 8px; gap: 8px; }
  ${sel} .ms-seg.ms-tabs { display: inline-flex; grid-area: tabs; justify-self: start; }
  ${sel} .ms-main { display: grid; grid-area: main; grid-template-columns: auto minmax(0, 1fr); gap: 8px; min-height: 0; }
  ${sel} .ms-tabs .svk-ctl { flex: 0 0 auto; font: 500 12px/1.2 var(--font-ui); padding: 5px 14px; }
  ${sel} .ms-phonecol { grid-area: auto; height: min(100%, calc(47cqw * 19.5 / 9)); align-self: start; }
  ${sel} .ms-right { grid-area: auto; }
  ${sel} .ms-codecol { grid-area: main; }
  ${sel} .ms-seg.ms-pick { display: none; }
  ${sel} .ms-sel { display: block; }
  ${sel} .ms-ctl { display: flex; }
  ${sel} .ms[data-tab="map"] .ms-codecol { display: none; }
  ${sel} .ms[data-tab="code"] .ms-main { display: none; }`;
}

export default {
  name: 'services-map-sim',
  css: `
${S} { container-type: size; height: 100%; width: 100%; box-sizing: border-box; color: var(--ink); font: 13px/1.4 var(--font-ui); }
${S} .ms { height: 100%; box-sizing: border-box; padding: 12px; display: grid; gap: 12px;
  grid-template-columns: auto 214px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); grid-template-areas: "phone ctl code"; }
${S} .ms-seg.ms-tabs { display: none; }
${S} .ms-main { display: contents; }
${S} .ms-phonecol { grid-area: phone; height: 100%; min-height: 0; display: flex; }
${S} .ms-right { grid-area: ctl; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
${S} .ms-codecol { grid-area: code; min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
${S} .ms-ctl { min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; overflow: auto; padding: 1px 2px 2px 1px; }
${S} .ms-field .svk-kicker { margin-bottom: 4px; }
${S} .ms-seg { display: flex; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; }
${S} .ms-seg .svk-ctl { flex: 1 1 0; min-width: 0; border: 0; border-radius: 0; font: 500 11px/1.2 var(--font-code); padding: 6px 2px; white-space: nowrap; }
${S} .ms-seg .svk-ctl + .svk-ctl { border-left: 1px solid var(--line); }
${S} .ms-sel { display: none; width: 100%; font: 500 12px var(--font-code); padding: 5px 6px; border-radius: var(--r-sm);
  border: 1px solid var(--line); background: var(--panel); color: var(--ink); }
${S} .ms-cam { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
${S} .ms-cam .svk-ctl { padding: 5px 0; display: inline-flex; align-items: center; justify-content: center; }
${S} .ms-cam .ms-reset { grid-column: 1 / -1; font: 500 12px/1.2 var(--font-code); padding: 6px 4px; }
${S} .ms-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
${S} .ms-row2 .svk-ctl { font-size: 12px; padding: 6px 4px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
${S} .ms-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel); }
${S} .ms-list li { display: flex; align-items: center; gap: 6px; padding: 3px 4px 3px 8px; border-bottom: 1px solid var(--line); font-size: 12px; min-width: 0; }
${S} .ms-list li:last-child { border-bottom: 0; }
${S} .ms-list .ms-kind { color: var(--ink-3); font: 11px var(--font-code); margin-left: auto; white-space: nowrap; }
${S} .ms-list .ms-nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
${S} .ms-list button { appearance: none; border: 0; background: none; color: var(--bad); border-radius: 4px; padding: 3px; cursor: pointer; display: inline-flex; }
${S} .ms-list button:focus-visible { outline: 2px solid var(--focus); }
${S} .ms-hint { font-size: 12px; color: var(--ink-2); background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; }
${S} .ms-codehead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
${S} .ms-codehead .ms-seg { flex: 0 0 auto; }
${S} .ms-codehead .ms-seg .svk-ctl { flex: 0 0 auto; font: 500 12px/1.2 var(--font-ui); padding: 5px 10px; }
${S} .ms-note { font-size: 11.5px; color: var(--ink-3); }
${S} .ms-codecol .svk-code { flex: 1 1 auto; min-height: 0; font-size: 11px; line-height: 1.5; }
${S} .ms-codecol .svk-line.svk-on { transition: background-color 0.4s; }
${S}.ms-reduced .ms-codecol .svk-line.svk-on { transition: none; }

/* The map inside the phone */
${S} .svk-screen { padding-top: 0; }
${S} .svk-status { color: var(--ios-label); text-shadow: 0 0 6px var(--ios-bg); }
${S} .ms-view { position: absolute; inset: 0; overflow: hidden; perspective: ${PERSPECTIVE}px; perspective-origin: 50% ${ORIGIN_Y * 100}%;
  background: linear-gradient(#b9d3ea, #dfe9f2); touch-action: none; cursor: grab; outline: none; }
${S} .ms-view:focus-visible { box-shadow: inset 0 0 0 3px var(--focus); }
${S} .ms-view.ms-dragging { cursor: grabbing; }
${S} .ms-stage { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: 50% 100%; }
${S} .ms-tilt .ms-stage { transform: rotateX(${TILT}deg); }
${S} .ms-stage > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
${S} .ms-hit { position: absolute; inset: 0; }
${S} .ms-over { position: absolute; inset: 0; pointer-events: none; }
${S} .ms-water { fill: var(--ios-map-water); }
${S} .ms-land { fill: var(--ios-map-land); }
${S} .ms-pier { stroke: var(--ios-map-land); fill: none; stroke-linecap: butt; }
${S} .ms-park { fill: var(--ios-map-park); }
${S} .ms-street { stroke: var(--ios-map-road); stroke-width: 1.2px; fill: none; vector-effect: non-scaling-stroke; }
${S} .ms-major { stroke: var(--ios-orange); stroke-opacity: 0.55; stroke-width: 3px; fill: none; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
${S} .ms-bldg { fill: rgba(120, 120, 128, 0.16); }
${S} .ms-roof { display: none; fill: rgba(120, 120, 128, 0.12); stroke: rgba(120, 120, 128, 0.3); stroke-width: 0.6px; vector-effect: non-scaling-stroke; }
${S} .ms-tilt .ms-bldg { fill: rgba(60, 60, 67, 0.28); }
${S} .ms-tilt .ms-roof { display: block; }
${S} .ms-grain { display: none; mix-blend-mode: multiply; pointer-events: none; }
${S} .ms-imagery .ms-water, ${S} .ms-hybrid .ms-water { fill: #173a4f; }
${S} .ms-imagery .ms-land, ${S} .ms-hybrid .ms-land { fill: #5d6650; }
${S} .ms-imagery .ms-pier, ${S} .ms-hybrid .ms-pier { stroke: #7b7a70; }
${S} .ms-imagery .ms-park, ${S} .ms-hybrid .ms-park { fill: #3f5a34; }
${S} .ms-imagery .ms-street { stroke: #85857a; stroke-width: 1px; }
${S} .ms-imagery .ms-major { stroke: #9a998c; stroke-opacity: 1; stroke-width: 2px; }
${S} .ms-hybrid .ms-street { stroke: rgba(255, 255, 255, 0.55); }
${S} .ms-hybrid .ms-major { stroke: #f3d36b; stroke-opacity: 1; }
${S} .ms-imagery .ms-bldg, ${S} .ms-hybrid .ms-bldg { fill: #8e8d80; }
${S} .ms-imagery .ms-roof, ${S} .ms-hybrid .ms-roof { fill: #a9a796; stroke: #6c6b60; }
${S} .ms-imagery .ms-grain, ${S} .ms-hybrid .ms-grain { display: block; }
${S} .ms-imagery .ms-view, ${S} .ms-hybrid .ms-view { background: linear-gradient(#7d97ab, #b4c3cf); }
${S} .ms-poi { position: absolute; width: 0; height: 0; transform-origin: 0 0; }
${S} .ms-poi span { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); white-space: nowrap; font-size: 3.4cqw;
  font-weight: 600; color: var(--ios-label-2); text-shadow: 0 0 3px var(--ios-map-land), 0 0 3px var(--ios-map-land); }
${S} .ms-imagery .ms-poi { display: none; }
${S} .ms-hybrid .ms-poi span { color: #fff; text-shadow: 0 0 3px #000, 0 0 2px #000; }
${S} .ms-mk { position: absolute; width: 0; height: 0; transform-origin: 0 0; pointer-events: none; }
${S} .ms-mk button { pointer-events: auto; position: absolute; left: 0; bottom: 0; transform: translateX(-50%); appearance: none; border: 0;
  padding: 0; background: none; cursor: pointer; display: block; }
${S} .ms-mk button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 50%; }
${S} .ms-ball { width: 8.6cqw; height: 8.6cqw; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center;
  justify-content: center; background: #ff3b30; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); margin-bottom: 0.6cqw; }
${S} .ms-ball svg { transform: rotate(45deg); width: 4.8cqw; height: 4.8cqw; color: #fff; }
${S} .ms-mk.ms-result .ms-ball { background: #b9772d; }
${S} .ms-mk.ms-ann button { transform: translate(-50%, 50%); }
${S} .ms-annv { width: 8.6cqw; height: 8.6cqw; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4); color: #ff9500; }
${S} .ms-annv svg { width: 5cqw; height: 5cqw; }
${S} .ms-lab { position: absolute; left: 0; top: 1.4cqw; transform: translateX(-50%); white-space: nowrap; font-size: 3.4cqw; font-weight: 700;
  color: var(--ios-label); text-shadow: 0 0 3px var(--ios-map-land), 0 0 3px var(--ios-map-land), 0 0 2px var(--ios-map-land); pointer-events: none; }
${S} .ms-ann .ms-lab { top: 5.6cqw; }
${S} .ms-imagery .ms-lab, ${S} .ms-hybrid .ms-lab { color: #fff; text-shadow: 0 0 3px #000, 0 0 2px #000; }
${S} .ms-mk.ms-hot .ms-ball, ${S} .ms-mk.ms-hot .ms-annv { outline: 2px solid var(--ios-blue); outline-offset: 1px; }
${S} .ms-user { position: absolute; width: 0; height: 0; pointer-events: none; }
${S} .ms-user i { position: absolute; left: 0; top: 0; width: 4.8cqw; height: 4.8cqw; transform: translate(-50%, -50%); border-radius: 50%;
  background: var(--ios-blue); border: 0.9cqw solid #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35); }
${S} .ms-user b { position: absolute; left: 0; top: 0; width: 15cqw; height: 15cqw; transform: translate(-50%, -50%); border-radius: 50%;
  background: color-mix(in srgb, var(--ios-blue) 18%, transparent); }
${S} .ms-legal { position: absolute; left: 3cqw; bottom: 3.2cqh; font-size: 2.9cqw; font-weight: 600; color: var(--ios-label-2);
  background: color-mix(in srgb, var(--ios-bg) 70%, transparent); padding: 0.6cqw 1.6cqw; border-radius: 99px; pointer-events: none; }
${S} .ms-chip { position: absolute; right: 3cqw; top: 8cqh; font: 600 2.9cqw/1.2 var(--font-code); color: var(--ios-label);
  background: color-mix(in srgb, var(--ios-bg) 78%, transparent); padding: 0.8cqw 1.8cqw; border-radius: 99px; pointer-events: none; }
${codeCss(S)}
${phoneCss(S)}
${panelCss(S)}
@container (max-width: 819px) {
  ${S} .ms-seg.ms-pick { display: none; }
  ${S} .ms-sel { display: block; }
}
@container (min-width: 560px) and (max-width: 819px) {
  ${S} .ms { grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "phone ctl" "phone code"; }
  ${S} .ms-ctl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 8px; overflow: visible; }
  ${S} .ms-ctl .ms-list { grid-column: 1 / span 2; max-height: 64px; overflow: auto; }
  ${S} .ms-ctl .ms-hint { grid-column: 1 / -1; }
}
@container (max-width: 559px) and (min-height: 600px) {
  ${S} .ms { grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "phone ctl" "code code"; padding: 8px; gap: 8px; }
  ${S} .ms-phonecol { height: min(52cqh, calc(46cqw * 19.5 / 9)); }
  ${S} .ms-right { height: min(52cqh, calc(46cqw * 19.5 / 9)); }
}
@container (max-width: 559px) and (max-height: 599px) { ${layoutCss(S)} }
${layoutCss(`${S}.ms-compact`)}
@container (max-width: 559px) {
  ${S} .ms-codecol .svk-code { font-size: 10.5px; }
  ${S} .ms-ctl { gap: 6px; }
  ${S} .ms-hint { font-size: 11px; padding: 4px 6px; }
  ${S} .ms-list li { font-size: 11px; }
}
`,
  mount(el, props = {}, ctx) {
    el.classList.add(`w-${NAME}`);
    if (props.compact) el.classList.add('ms-compact');
    if (ctx.reducedMotion) el.classList.add('ms-reduced');
    const state = {
      style: 'standard',
      elevation: 'flat',
      tool: 'marker',
      showUser: false,
      results: [],
      items: [{ kind: 'marker', name: 'Pier 39', lat: 37.8087, lon: -122.4098 }],
      position: 'automatic',
      center: { lat: 37.8060, lon: -122.4150 },
      delta: 0.02,
      codeTab: 'map',
      counter: 1,
      hot: -1,
    };
    let prevLines = null;
    let hiTimer = null;
    let destroyed = false;
    let W = 1;
    let viewOrigin = { vx: 0, vy: 0 };
    let H = 1;

    const seg = (field, options) => options.map(([v, label]) => `<button type="button" class="svk-ctl" id="${id(`${field}-${v}`)}" data-${field}="${v}">${label}</button>`).join('');
    const sel = (field, options, label) => `<select class="ms-sel" id="${id(`${field}-select`)}" aria-label="${label}" data-select="${field}">${options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
    const STYLE_OPTS = [['standard', '.standard'], ['imagery', '.imagery'], ['hybrid', '.hybrid']];
    const ELEV_OPTS = [['flat', '.flat'], ['realistic', '.realistic']];
    const TOOL_OPTS = [['marker', 'Marker'], ['annotation', 'Annotation']];

    el.innerHTML = `
<div class="ms" data-tab="map">
  <div class="ms-seg ms-tabs" role="tablist" aria-label="View">
    <button type="button" class="svk-ctl" role="tab" id="${id('tab-map')}" data-tab="map">Map</button>
    <button type="button" class="svk-ctl" role="tab" id="${id('tab-code')}" data-tab="code">Code</button>
  </div>
  <div class="ms-main">
    <div class="ms-phonecol">${phoneHtml(`
      <div class="ms-view" id="${id('view')}" tabindex="0" role="application"
        aria-label="Map. Drag or use arrow keys to pan, plus and minus to zoom, Enter adds an item at the center. Click to add an item there.">
        <div class="ms-stage" id="${id('stage')}">
          <svg id="${id('svg')}" aria-hidden="true">${buildMap()}</svg>
          <div class="ms-hit" id="${id('hit')}"></div>
        </div>
        <div class="ms-over" id="${id('over')}"></div>
      </div>
      <div class="ms-chip" id="${id('chip')}" aria-hidden="true"></div>
      <div class="ms-legal" aria-hidden="true">Stylized map, not real map data</div>`, { label: 'Simulated iPhone running a SwiftUI Map' })}</div>
    <div class="ms-right">
      <div class="ms-ctl">
        <div class="ms-field"><p class="svk-kicker">Map style</p>
          <div class="ms-seg ms-pick" role="group" aria-label="Map style">${seg('style', STYLE_OPTS)}</div>${sel('style', STYLE_OPTS, 'Map style')}</div>
        <div class="ms-field"><p class="svk-kicker">Elevation</p>
          <div class="ms-seg ms-pick" role="group" aria-label="Elevation">${seg('elev', ELEV_OPTS)}</div>${sel('elev', ELEV_OPTS, 'Elevation')}</div>
        <div class="ms-field"><p class="svk-kicker">A tap on the map adds</p>
          <div class="ms-seg ms-pick" role="group" aria-label="A tap adds">${seg('tool', TOOL_OPTS)}</div>${sel('tool', TOOL_OPTS, 'A tap on the map adds')}</div>
        <div class="ms-field"><p class="svk-kicker">Camera</p>
          <div class="ms-cam">
            <button type="button" class="svk-ctl" id="${id('zoom-in')}" aria-label="Zoom in">${ctx.icon('plus', 15)}</button>
            <button type="button" class="svk-ctl" id="${id('zoom-out')}" aria-label="Zoom out">${ctx.icon('minus', 15)}</button>
            <button type="button" class="svk-ctl" id="${id('pan-w')}" aria-label="Pan west">${ctx.icon('arrow.left', 15)}</button>
            <button type="button" class="svk-ctl" id="${id('pan-n')}" aria-label="Pan north">${ctx.icon('arrow.up', 15)}</button>
            <button type="button" class="svk-ctl" id="${id('pan-s')}" aria-label="Pan south">${ctx.icon('arrow.down', 15)}</button>
            <button type="button" class="svk-ctl" id="${id('pan-e')}" aria-label="Pan east">${ctx.icon('arrow.right', 15)}</button>
            <button type="button" class="svk-ctl ms-reset" id="${id('reset')}">Reset to .automatic</button>
          </div></div>
        <div class="ms-field"><p class="svk-kicker">Content</p>
          <div class="ms-row2">
            <button type="button" class="svk-ctl" id="${id('user')}" aria-pressed="false">${ctx.icon('location.fill', 13)}You</button>
            <button type="button" class="svk-ctl" id="${id('search')}">${ctx.icon('magnifyingglass', 13)}Coffee</button>
          </div></div>
        <ul class="ms-list" id="${id('list')}" aria-label="Map content"></ul>
        <div class="ms-hint" id="${id('hint')}" role="status" aria-live="polite">Tap the map to add a Marker. Drag to move the camera.</div>
      </div>
    </div>
  </div>
  <div class="ms-codecol">
    <div class="ms-codehead">
      <div class="ms-seg" role="group" aria-label="Code view">
        <button type="button" class="svk-ctl" id="${id('code-map')}" data-code="map">Map view</button>
        <button type="button" class="svk-ctl" id="${id('code-search')}" data-code="search">Search</button>
      </div>
      <span class="ms-note">Highlighted lines just changed.</span>
    </div>
    <div class="svk-code" id="${id('code')}" tabindex="0" aria-label="SwiftUI code for this map"></div>
  </div>
</div>`;

    const $ = (role) => el.querySelector(`#${id(role)}`);
    const root = el.querySelector('.ms');
    const phone = el.querySelector('.svk-phone');
    const view = $('view');
    const svg = $('svg');
    const over = $('over');
    const hit = $('hit');
    const hint = $('hint');
    const code = $('code');
    const grainRect = $('grain-rect');

    const setHint = (text) => { hint.textContent = text; };
    const mpp = () => (state.delta * KY) / H;

    function contentPoints() {
      const list = state.items.map((it) => [it.lat, it.lon]);
      state.results.forEach((r) => list.push([r.lat, r.lon]));
      if (state.showUser) list.push([USER.lat, USER.lon]);
      return list;
    }

    // .automatic frames everything on the map, like MapKit does.
    function frameAutomatic() {
      const pts = contentPoints();
      if (pts.length === 0) { state.center = { lat: 37.8060, lon: -122.4150 }; state.delta = 0.02; return; }
      const lats = pts.map((p) => p[0]);
      const lons = pts.map((p) => p[1]);
      const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons); const maxLon = Math.max(...lons);
      state.center = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
      const latSpan = (maxLat - minLat) * 1.6;
      const lonSpanAsLat = ((maxLon - minLon) * KX / KY) * 1.6 * (H / W);
      state.delta = Math.min(MAX_DELTA, Math.max(0.018, latSpan, lonSpanAsLat));
    }

    // Stage geometry: when pitched, the stage is taller than the view and
    // tilts back around its bottom edge, so the map reaches toward the horizon.
    const tilted = () => state.elevation === 'realistic';
    const stageH = () => (tilted() ? H * STAGE_STRETCH : H);

    // Projects a stage-local point to view pixels, mirroring the CSS
    // rotateX + perspective so flat overlays sit exactly on the tilted map.
    function project(xs, ys) {
      if (!tilted()) return [xs, ys];
      const t = TILT * RAD;
      const yRel = ys - stageH();
      const Y = H + yRel * Math.cos(t);
      const Z = yRel * Math.sin(t);
      const k = PERSPECTIVE / (PERSPECTIVE - Z);
      const ox = W / 2;
      const oy = H * ORIGIN_Y;
      return [ox + (xs - ox) * k, oy + (Y - oy) * k];
    }

    function drawCamera() {
      const m = mpp();
      const sh = stageH();
      const stage = $('stage');
      stage.style.top = `${(H - sh).toFixed(1)}px`;
      stage.style.height = `${sh.toFixed(1)}px`;
      const [cx, cy] = proj(state.center.lat, state.center.lon);
      const vx = cx - (W * m) / 2;
      const vy = cy - (sh * m) / 2;
      viewOrigin = { vx, vy };
      svg.setAttribute('viewBox', `${vx.toFixed(1)} ${vy.toFixed(1)} ${(W * m).toFixed(1)} ${(sh * m).toFixed(1)}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      grainRect.setAttribute('x', vx.toFixed(1));
      grainRect.setAttribute('y', vy.toFixed(1));
      grainRect.setAttribute('width', (W * m).toFixed(1));
      grainRect.setAttribute('height', (sh * m).toFixed(1));
      const toPx = (lat, lon) => {
        const [x, y] = proj(lat, lon);
        const xs = (x - vx) / m;
        const ys = (y - vy) / m;
        if (xs < -60 || xs > W + 60 || ys < -60 || ys > sh + 60) return null;
        return project(xs, ys);
      };
      const inView = (pt) => pt && pt[0] > -60 && pt[0] < W + 60 && pt[1] > -60 && pt[1] < H + 60;
      let html = '';
      POIS.forEach((p) => {
        const pt = toPx(p.lat, p.lon);
        if (inView(pt)) html += `<div class="ms-poi" style="left:${pt[0].toFixed(1)}px;top:${pt[1].toFixed(1)}px"><span>${esc(p.name)}</span></div>`;
      });
      if (state.showUser && inView(toPx(USER.lat, USER.lon))) {
        const pt = toPx(USER.lat, USER.lon);
        html += `<div class="ms-user" style="left:${pt[0].toFixed(1)}px;top:${pt[1].toFixed(1)}px"><b></b><i></i></div>`;
      }
      const marker = (kind, name, pt, idx, cls) => {
        if (!inView(pt)) return '';
        const glyph = kind === 'annotation'
          ? `<span class="ms-annv">${ctx.icon('star.fill', 14)}</span>`
          : `<span class="ms-ball">${ctx.icon(cls === 'ms-result' ? 'cup.and.saucer' : 'mappin', 14)}</span>`;
        const kindText = kind === 'annotation' ? 'Annotation' : cls === 'ms-result' ? 'Search result' : 'Marker';
        return `<div class="ms-mk ${kind === 'annotation' ? 'ms-ann' : ''} ${cls}${idx === state.hot ? ' ms-hot' : ''}" style="left:${pt[0].toFixed(1)}px;top:${pt[1].toFixed(1)}px">
          <button type="button" data-item="${idx}" aria-label="${kindText} ${esc(name)}">${glyph}</button><span class="ms-lab">${esc(name)}</span></div>`;
      };
      state.results.forEach((r, i) => { html += marker('marker', r.name, toPx(r.lat, r.lon), 100 + i, 'ms-result'); });
      state.items.forEach((it, i) => { html += marker(it.kind, it.name, toPx(it.lat, it.lon), i, ''); });
      over.innerHTML = html;
      $('chip').textContent = state.position === 'automatic' ? '.automatic' : state.elevation === 'realistic' ? '.camera(pitch: 60)' : '.region';
    }

    function codeLines() {
      if (state.codeTab === 'search') {
        return [
          '// Inside HarborMap: runs when the user taps Search.',
          'func searchCoffee() async throws {',
          '    let request = MKLocalSearch.Request()',
          '    request.naturalLanguageQuery = "coffee"',
          '    request.region = MKCoordinateRegion(',
          `        center: .init(latitude: ${f4(state.center.lat)}, longitude: ${f4(state.center.lon)}),`,
          '        latitudinalMeters: 1500, longitudinalMeters: 1500)',
          '    let search = MKLocalSearch(request: request)',
          '    let response = try await search.start()',
          `    results = response.mapItems${state.results.length ? `  // ${state.results.length} items` : ''}`,
          '}',
        ];
      }
      const lines = ['import SwiftUI', 'import MapKit', '', 'struct HarborMap: View {'];
      if (state.position === 'automatic') {
        lines.push('    @State private var position: MapCameraPosition =', '        .automatic');
      } else if (state.elevation === 'realistic') {
        lines.push(
          '    @State private var position: MapCameraPosition =',
          '        .camera(MapCamera(',
          `            centerCoordinate: .init(latitude: ${f4(state.center.lat)},`,
          `                                    longitude: ${f4(state.center.lon)}),`,
          `            distance: ${Math.round(state.delta * KY * 1.1)}, heading: 0, pitch: 60))`,
        );
      } else {
        lines.push(
          '    @State private var position: MapCameraPosition =',
          '        .region(MKCoordinateRegion(',
          `            center: .init(latitude: ${f4(state.center.lat)},`,
          `                          longitude: ${f4(state.center.lon)}),`,
          `            span: .init(latitudeDelta: ${f3(state.delta)},`,
          `                        longitudeDelta: ${f3((state.delta * KY * (W / H)) / KX)})))`,
        );
      }
      lines.push('    @State private var results: [MKMapItem] = []', '', '    var body: some View {', '        Map(position: $position) {');
      state.items.forEach((it) => {
        if (it.kind === 'annotation') {
          lines.push(
            `            Annotation("${it.name}", coordinate: .init(`,
            `                latitude: ${f4(it.lat)}, longitude: ${f4(it.lon)})) {`,
            '                Image(systemName: "star.fill")',
            '            }',
          );
        } else {
          lines.push(
            `            Marker("${it.name}", coordinate: .init(`,
            `                latitude: ${f4(it.lat)}, longitude: ${f4(it.lon)}))`,
          );
        }
      });
      if (state.results.length) {
        lines.push('            ForEach(results, id: \\.self) { item in', '                Marker(item: item)', '            }');
      }
      if (state.showUser) lines.push('            UserAnnotation()');
      lines.push('        }', `        .mapStyle(.${state.style}(elevation: .${state.elevation}))`, '    }', '}');
      return lines;
    }

    function drawCode() {
      const lines = codeLines();
      const active = new Set();
      if (prevLines) {
        const bag = new Map();
        prevLines.forEach((l) => bag.set(l, (bag.get(l) || 0) + 1));
        lines.forEach((l, i) => {
          const n = bag.get(l) || 0;
          if (n > 0) bag.set(l, n - 1);
          else if (l.trim()) active.add(i);
        });
      }
      prevLines = lines;
      code.innerHTML = codeHtml(lines, active);
      const first = code.querySelector('.svk-on');
      if (first) {
        const top = first.offsetTop - code.clientHeight / 3;
        code.scrollTop = Math.max(0, top);
      }
      clearTimeout(hiTimer);
      if (active.size) {
        hiTimer = setTimeout(() => {
          if (destroyed) return;
          code.querySelectorAll('.svk-on').forEach((n) => n.classList.remove('svk-on'));
        }, 2200);
      }
    }

    function drawList() {
      const rows = state.items.map((it, i) => `<li><span class="ms-nm">${esc(it.name)}</span><span class="ms-kind">${it.kind === 'annotation' ? 'Annotation' : 'Marker'}</span>
        <button type="button" id="${id(`del-${i}`)}" data-del="${i}" aria-label="Remove ${esc(it.name)}">${ctx.icon('xmark', 13)}</button></li>`);
      if (state.results.length) {
        rows.push(`<li><span class="ms-nm">${state.results.length} coffee results</span><span class="ms-kind">ForEach</span>
          <button type="button" id="${id('del-results')}" data-del="results" aria-label="Clear search results">${ctx.icon('xmark', 13)}</button></li>`);
      }
      if (!rows.length) rows.push('<li><span class="ms-nm">Nothing yet. Tap the map.</span></li>');
      $('list').innerHTML = rows.join('');
    }

    function drawChrome() {
      phone.classList.toggle('ms-standard', state.style === 'standard');
      phone.classList.toggle('ms-imagery', state.style === 'imagery');
      phone.classList.toggle('ms-hybrid', state.style === 'hybrid');
      phone.classList.toggle('ms-tilt', state.elevation === 'realistic');
      el.querySelectorAll('[data-style]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.style === state.style)));
      el.querySelectorAll('[data-elev]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.elev === state.elevation)));
      el.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === state.tool)));
      el.querySelectorAll('[data-code]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.code === state.codeTab)));
      el.querySelectorAll('[data-tab]').forEach((b) => {
        if (b.getAttribute('role') !== 'tab') return;
        const on = b.dataset.tab === root.dataset.tab;
        b.setAttribute('aria-selected', String(on));
        b.setAttribute('aria-pressed', String(on));
      });
      $('style-select').value = state.style;
      $('elev-select').value = state.elevation;
      $('tool-select').value = state.tool;
      $('user').setAttribute('aria-pressed', String(state.showUser));
    }

    function render() {
      if (destroyed) return;
      if (state.position === 'automatic') frameAutomatic();
      drawCamera();
      drawCode();
      drawList();
      drawChrome();
    }

    function measure() {
      W = Math.max(1, view.clientWidth);
      H = Math.max(1, view.clientHeight);
    }

    function leaveAutomatic() {
      if (state.position === 'automatic') state.position = state.elevation === 'realistic' ? 'camera' : 'region';
    }
    function zoom(factor) {
      leaveAutomatic();
      state.delta = Math.min(MAX_DELTA, Math.max(MIN_DELTA, state.delta * factor));
      render();
      setHint(`Zoomed: latitudeDelta is now ${f3(state.delta)} degrees. A smaller span shows a smaller area.`);
    }
    function pan(dxFrac, dyFrac) {
      leaveAutomatic();
      const m = mpp();
      const [cx, cy] = proj(state.center.lat, state.center.lon);
      const [lat, lon] = unproj(cx + dxFrac * W * m, cy + dyFrac * H * m);
      state.center = { lat, lon };
      render();
    }

    function addAt(lat, lon) {
      if (state.items.length >= MAX_ITEMS) {
        setHint(`This demo keeps up to ${MAX_ITEMS} items. Remove one from the list first.`);
        return;
      }
      state.counter += 1;
      const kind = state.tool;
      const name = kind === 'annotation' ? `Spot ${state.counter}` : `Pin ${state.counter}`;
      state.items.push({ kind, name, lat, lon });
      render();
      setHint(`Added ${kind === 'annotation' ? 'an Annotation' : 'a Marker'} "${name}" at ${f4(lat)}, ${f4(lon)}.${state.position === 'automatic' ? ' The position is .automatic, so the camera re-frames to fit all content.' : ''}`);
    }

    // --- Pointer: drag pans, a tap adds an item --------------------------------
    let down = null;
    let suppressClick = false;
    function onPointerDown(evt) {
      if (evt.button !== undefined && evt.button !== 0) return;
      down = { x: evt.clientX, y: evt.clientY, ox: evt.offsetX, oy: evt.offsetY, onHit: evt.target === hit, moved: false, center: { ...state.center } };
    }
    function onPointerMove(evt) {
      if (!down) return;
      const dx = evt.clientX - down.x;
      const dy = evt.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) < 5) return;
      if (!down.moved) {
        // Capture only once a drag starts, so a plain click on a marker still reaches it.
        down.moved = true;
        leaveAutomatic();
        view.classList.add('ms-dragging');
        view.setPointerCapture?.(evt.pointerId);
      }
      const m = mpp();
      const tiltFactor = state.elevation === 'realistic' ? 1.8 : 1;
      const [cx, cy] = proj(down.center.lat, down.center.lon);
      const [lat, lon] = unproj(cx - dx * m, cy - dy * m * tiltFactor);
      state.center = { lat, lon };
      drawCamera();
      $('chip').textContent = state.elevation === 'realistic' ? '.camera(pitch: 60)' : '.region';
    }
    function onPointerUp(evt) {
      if (!down) return;
      const d = down;
      down = null;
      view.releasePointerCapture?.(evt.pointerId);
      view.classList.remove('ms-dragging');
      if (d.moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
        render();
        setHint('You moved the camera. In code, the position is now a region you could set to show this exact view.');
        return;
      }
      if (!d.onHit) return;
      // offsetX/offsetY are in the stage's own (untilted) coordinates.
      const m = mpp();
      const [lat, lon] = unproj(viewOrigin.vx + d.ox * m, viewOrigin.vy + d.oy * m);
      addAt(lat, lon);
    }

    function onKey(evt) {
      if (evt.target !== view) return;
      const k = evt.key;
      if (k === 'ArrowLeft') pan(-0.15, 0);
      else if (k === 'ArrowRight') pan(0.15, 0);
      else if (k === 'ArrowUp') pan(0, -0.15);
      else if (k === 'ArrowDown') pan(0, 0.15);
      else if (k === '+' || k === '=') zoom(0.7);
      else if (k === '-' || k === '_') zoom(1 / 0.7);
      else if (k === 'Enter' || k === ' ') addAt(state.center.lat, state.center.lon);
      else return;
      evt.preventDefault();
    }

    function onClick(evt) {
      if (suppressClick) return;
      const b = evt.target.closest('button');
      if (!b || !el.contains(b)) return;
      const ds = b.dataset;
      if (ds.style) {
        state.style = ds.style;
        render();
        setHint(`.mapStyle(.${STYLE_TEXT[state.style]}`);
      } else if (ds.elev) setElevation(ds.elev);
      else if (ds.tool) { state.tool = ds.tool; drawChrome(); setHint(`A tap now adds ${ds.tool === 'marker' ? 'a Marker: the standard balloon, drawn by MapKit.' : 'an Annotation: any SwiftUI view you supply, pinned to a coordinate.'}`); }
      else if (ds.code) { state.codeTab = ds.code; prevLines = null; drawCode(); drawChrome(); }
      else if (ds.tab) { root.dataset.tab = ds.tab; drawChrome(); measure(); render(); }
      else if (ds.del !== undefined) {
        if (ds.del === 'results') { state.results = []; setHint('Cleared the search results: results is an empty array again.'); }
        else {
          const [gone] = state.items.splice(Number(ds.del), 1);
          setHint(`Removed "${gone.name}". Its lines left the Map content builder.`);
        }
        state.hot = -1;
        render();
        $('list').querySelector('button')?.focus({ preventScroll: true });
      } else if (ds.item !== undefined) {
        const i = Number(ds.item);
        state.hot = i;
        const name = i >= 100 ? state.results[i - 100].name : state.items[i].name;
        drawCamera();
        setHint(i >= 100 ? `"${name}" came from MKLocalSearch; Marker(item:) draws it.` : `Selected "${name}". Find its lines in the Map content builder.`);
      } else if (b.id === id('zoom-in')) zoom(0.7);
      else if (b.id === id('zoom-out')) zoom(1 / 0.7);
      else if (b.id === id('pan-w')) pan(-0.25, 0);
      else if (b.id === id('pan-e')) pan(0.25, 0);
      else if (b.id === id('pan-n')) pan(0, -0.25);
      else if (b.id === id('pan-s')) pan(0, 0.25);
      else if (b.id === id('reset')) {
        state.position = 'automatic';
        render();
        setHint('.automatic asks MapKit to choose a camera that fits all of the map content.');
      } else if (b.id === id('user')) {
        state.showUser = !state.showUser;
        render();
        setHint(state.showUser
          ? 'UserAnnotation() draws the blue dot. A real app needs location permission first.'
          : 'Removed UserAnnotation(): the blue dot is gone.');
      } else if (b.id === id('search')) {
        state.results = CAFES.map((c) => ({ ...c }));
        state.codeTab = state.codeTab === 'search' ? 'search' : 'map';
        render();
        setHint('Simulated MKLocalSearch for "coffee" returned 3 MKMapItem values. See the Search tab for the code.');
      }
    }

    function setElevation(v) {
      state.elevation = v;
      if (state.position !== 'automatic') state.position = v === 'realistic' ? 'camera' : 'region';
      render();
      setHint(v === 'realistic'
        ? 'Realistic elevation shows terrain and 3D buildings once the camera is pitched, so the position is a MapCamera with pitch 60.'
        : 'Flat elevation: a straight-down 2D map.');
    }

    function onChange(evt) {
      const s = evt.target.closest('select[data-select]');
      if (!s) return;
      if (s.dataset.select === 'style') { state.style = s.value; render(); setHint(`.mapStyle(.${STYLE_TEXT[state.style]}`); }
      if (s.dataset.select === 'elev') setElevation(s.value);
      if (s.dataset.select === 'tool') { state.tool = s.value; drawChrome(); }
    }

    view.addEventListener('pointerdown', onPointerDown);
    view.addEventListener('pointermove', onPointerMove);
    view.addEventListener('pointerup', onPointerUp);
    view.addEventListener('pointercancel', onPointerUp);
    view.addEventListener('keydown', onKey);
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (destroyed) return;
        const w = view.clientWidth;
        const h = view.clientHeight;
        if (w && h && (Math.abs(w - W) > 1 || Math.abs(h - H) > 1)) { measure(); if (state.position === 'automatic') frameAutomatic(); drawCamera(); }
      });
      ro.observe(view);
    }

    measure();
    render();
    return {
      destroy() {
        destroyed = true;
        clearTimeout(hiTimer);
        ro?.disconnect();
        view.removeEventListener('pointerdown', onPointerDown);
        view.removeEventListener('pointermove', onPointerMove);
        view.removeEventListener('pointerup', onPointerUp);
        view.removeEventListener('pointercancel', onPointerUp);
        view.removeEventListener('keydown', onKey);
        el.removeEventListener('click', onClick);
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
      },
    };
  },
};
