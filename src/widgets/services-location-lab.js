// Location lab: drag a "You" pin around Manhattan or the world and watch the
// distance and compass bearing to real landmarks update. The math is the REAL
// Swift functions distanceMeters / bearingDegrees from src/wasm/SwiftCore.swift,
// compiled to WebAssembly and called through ctx.wasm. The browser's own
// Geolocation API stands in for Core Location, and a simulated stream stands
// in for CLLocationUpdate.liveUpdates().
import { esc, codeHtml, codeCss, panelCss, idFor } from './services-kit.js';

const NAME = 'services-location-lab';
const S = `.w-${NAME}`;
const id = (role) => idFor(NAME, role);

const RAD = Math.PI / 180;
const CITY_LAT0 = 40.74;
const CITY_LON0 = -73.985;
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos(CITY_LAT0 * RAD);

// --- Projections -----------------------------------------------------------
const city = {
  label: 'City',
  project: (lat, lon) => [(lon - CITY_LON0) * M_PER_DEG_LON, -(lat - CITY_LAT0) * M_PER_DEG_LAT],
  unproject: (x, y) => [CITY_LAT0 - y / M_PER_DEG_LAT, CITY_LON0 + x / M_PER_DEG_LON],
  clamp: { latMin: 40.69, latMax: 40.79, lonMin: -74.03, lonMax: -73.93 },
  step: 0.0006,
  unitsPerMeter: 1,
  pinDefault: { lat: 40.7359, lon: -73.9911, name: 'Union Square' },
  landmarks: [
    { name: 'Empire State Building', short: 'Empire State', lat: 40.7484, lon: -73.9857, side: 'right' },
    { name: 'Times Square', lat: 40.7580, lon: -73.9855, side: 'left' },
    { name: 'Grand Central', lat: 40.7527, lon: -73.9772, side: 'right' },
    { name: 'Central Park Zoo', lat: 40.7678, lon: -73.9718, side: 'left' },
    { name: 'Brooklyn Bridge', lat: 40.7061, lon: -73.9969, side: 'right' },
  ],
};
city.bounds = (() => {
  const [x1, y1] = city.project(40.7715, -74.0040);
  const [x2, y2] = city.project(40.7030, -73.9660);
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
})();

const world = {
  label: 'World',
  project: (lat, lon) => [lon, -lat],
  unproject: (x, y) => [-y, x],
  clamp: { latMin: -80, latMax: 80, lonMin: -180, lonMax: 180 },
  step: 1,
  unitsPerMeter: 1 / 111195,
  pinDefault: { lat: 51.5072, lon: -0.1276, name: 'London' },
  landmarks: [
    { name: 'Golden Gate Bridge', short: 'Golden Gate', lat: 37.8199, lon: -122.4783, side: 'above' },
    { name: 'Statue of Liberty', short: 'Liberty', lat: 40.6892, lon: -74.0445, side: 'below' },
    { name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, side: 'right' },
    { name: 'Sydney Opera House', short: 'Sydney', lat: -33.8568, lon: 151.2153, side: 'left' },
    { name: 'Machu Picchu', lat: -13.1631, lon: -72.5450, side: 'right' },
    { name: 'Tokyo Tower', lat: 35.6586, lon: 139.7454, side: 'left' },
  ],
  bounds: [-180, -78, 180, 60],
};
const SCENES = { city, world };

// --- Backdrops (static geometry) ---------------------------------------------
const pts = (scene, list) => list.map(([lat, lon]) => scene.project(lat, lon).map((v) => v.toFixed(1)).join(',')).join(' ');

const MANHATTAN = [
  [40.7003, -74.0150], [40.7090, -74.0185], [40.7200, -74.0130], [40.7350, -74.0110], [40.7480, -74.0090],
  [40.7600, -74.0030], [40.7720, -73.9940], [40.7850, -73.9850], [40.8000, -73.9720], [40.8000, -73.9300],
  [40.7850, -73.9400], [40.7750, -73.9420], [40.7650, -73.9530], [40.7550, -73.9620], [40.7450, -73.9700],
  [40.7350, -73.9740], [40.7250, -73.9720], [40.7120, -73.9770], [40.7080, -73.9960], [40.7040, -74.0080],
];
const BROOKLYN = [
  [40.6500, -74.0300], [40.6950, -74.0000], [40.7000, -73.9930], [40.7030, -73.9860], [40.7090, -73.9720],
  [40.7300, -73.9610], [40.7450, -73.9560], [40.7600, -73.9410], [40.7800, -73.9200], [40.8200, -73.9050],
  [40.8200, -73.8000], [40.6500, -73.8000],
];
const JERSEY = [
  [40.6500, -74.2000], [40.6500, -74.0600], [40.6900, -74.0450], [40.7100, -74.0330], [40.7400, -74.0280],
  [40.7700, -74.0150], [40.8000, -74.0000], [40.8300, -73.9800], [40.8300, -74.2000],
];
const CENTRAL_PARK = [[40.7644, -73.9730], [40.7681, -73.9819], [40.8003, -73.9582], [40.7968, -73.9493]];
const BROADWAY = [[40.7041, -74.0131], [40.7128, -74.0076], [40.7230, -74.0021], [40.7359, -73.9906], [40.7411, -73.9897],
  [40.7505, -73.9878], [40.7580, -73.9855], [40.7681, -73.9819], [40.7800, -73.9810]];

function cityBackdrop() {
  // Manhattan's street grid is tilted about 29 degrees east of true north.
  const a = 29 * RAD;
  const along = [Math.sin(a), -Math.cos(a)];
  const across = [Math.cos(a), Math.sin(a)];
  const [cx, cy] = city.project(40.75, -73.985);
  let grid = '';
  for (let k = -12; k <= 12; k += 1) {
    const ox = cx + across[0] * k * 300;
    const oy = cy + across[1] * k * 300;
    grid += `M${(ox - along[0] * 9000).toFixed(0)},${(oy - along[1] * 9000).toFixed(0)}L${(ox + along[0] * 9000).toFixed(0)},${(oy + along[1] * 9000).toFixed(0)}`;
  }
  let streets = '';
  for (let k = -24; k <= 24; k += 1) {
    const ox = cx + along[0] * k * 380;
    const oy = cy + along[1] * k * 380;
    streets += `M${(ox - across[0] * 5000).toFixed(0)},${(oy - across[1] * 5000).toFixed(0)}L${(ox + across[0] * 5000).toFixed(0)},${(oy + across[1] * 5000).toFixed(0)}`;
  }
  const broadway = BROADWAY.map(([lat, lon], i) => `${i ? 'L' : 'M'}${city.project(lat, lon).map((v) => v.toFixed(0)).join(',')}`).join('');
  return `
    <defs><clipPath id="${id('clip-island')}"><polygon points="${pts(city, MANHATTAN)}"/></clipPath></defs>
    <rect class="ll-water" x="-40000" y="-40000" width="80000" height="80000"/>
    <polygon class="ll-land" points="${pts(city, JERSEY)}"/>
    <polygon class="ll-land" points="${pts(city, BROOKLYN)}"/>
    <polygon class="ll-land" points="${pts(city, MANHATTAN)}"/>
    <g clip-path="url(#${id('clip-island')})">
      <path class="ll-street" d="${streets}" vector-effect="non-scaling-stroke"/>
      <path class="ll-avenue" d="${grid}" vector-effect="non-scaling-stroke"/>
      <polygon class="ll-park" points="${pts(city, CENTRAL_PARK)}"/>
      <path class="ll-broadway" d="${broadway}" vector-effect="non-scaling-stroke"/>
    </g>`;
}

const CONTINENTS = [
  [[66, -168], [70, -140], [72, -95], [63, -80], [55, -60], [47, -52], [44, -66], [35, -75], [25, -81], [26, -97], [20, -97], [21, -87], [10, -83], [8, -78], [14, -90], [20, -105], [30, -112], [34, -118], [40, -124], [48, -124], [58, -135], [60, -150], [62, -165]],
  [[60, -55], [60, -42], [70, -20], [80, -20], [82, -60], [77, -72], [70, -55]],
  [[8, -78], [10, -60], [0, -50], [-6, -35], [-22, -40], [-28, -48], [-38, -58], [-55, -65], [-50, -74], [-30, -72], [-18, -70], [-5, -81], [2, -80]],
  [[36, -10], [43, -9], [44, -2], [48, -5], [51, 2], [54, 8], [58, 10], [62, 5], [69, 15], [71, 28], [67, 40], [55, 45], [45, 40], [41, 28], [38, 26], [37, 22], [38, 15], [44, 12], [44, 8], [42, 3], [36, -5]],
  [[21, -17], [31, -10], [37, 10], [31, 32], [28, 35], [12, 43], [12, 51], [-15, 40], [-25, 35], [-35, 20], [-29, 17], [-17, 12], [-1, 9], [4, 8], [4, -8], [14, -17]],
  [[41, 28], [45, 40], [55, 45], [67, 40], [70, 60], [73, 80], [78, 105], [73, 140], [70, 170], [67, 180], [60, 170], [55, 160], [52, 140], [43, 135], [35, 126], [30, 122], [22, 120], [20, 108], [10, 105], [13, 100], [8, 98], [18, 93], [22, 88], [15, 80], [8, 77], [20, 72], [25, 66], [25, 57], [30, 52], [30, 48], [22, 55], [20, 58], [15, 52], [13, 43], [28, 35], [35, 36], [37, 28]],
  [[-22, 114], [-18, 122], [-12, 130], [-12, 137], [-11, 142], [-19, 146], [-25, 153], [-34, 151], [-39, 146], [-35, 138], [-31, 130], [-34, 115]],
  [[31, 130], [34, 135], [36, 140], [40, 142], [45, 141], [40, 139], [35, 135]],
  [[50, -5], [51, 1], [53, 2], [57, -2], [58, -5], [55, -6], [54, -3], [52, -4]],
];

function worldBackdrop() {
  let grat = '';
  for (let lon = -180; lon <= 180; lon += 30) grat += `M${lon},-90L${lon},90`;
  for (let lat = -60; lat <= 60; lat += 30) if (lat !== 0) grat += `M-200,${-lat}L200,${-lat}`;
  const land = CONTINENTS.map((c) => `<polygon class="ll-land" points="${pts(world, c)}"/>`).join('');
  return `
    <rect class="ll-water" x="-400" y="-200" width="800" height="400"/>
    <path class="ll-grat" d="${grat}" vector-effect="non-scaling-stroke"/>
    ${land}
    <path class="ll-equator" d="M-200,0L200,0" vector-effect="non-scaling-stroke"/>`;
}

// --- Math --------------------------------------------------------------------
function jsDistance(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function jsBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * RAD) * Math.cos(lat2 * RAD);
  const x = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) - Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
  const d = Math.atan2(y, x) / RAD;
  return d < 0 ? d + 360 : d;
}
const POINTS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (deg) => POINTS16[Math.round(deg / 22.5) % 16];
function fmtDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  if (km < 100) return `${km.toFixed(2)} km`;
  return `${km.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

// Samples a great-circle path; splits it where it crosses the 180th meridian.
function greatCircle(a, b, n = 64) {
  const toV = (p) => [Math.cos(p.lat * RAD) * Math.cos(p.lon * RAD), Math.cos(p.lat * RAD) * Math.sin(p.lon * RAD), Math.sin(p.lat * RAD)];
  const va = toV(a);
  const vb = toV(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const om = Math.acos(dot);
  if (om < 1e-9) return `M${a.lon},${-a.lat}`;
  let d = '';
  let prevLon = null;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const s1 = Math.sin((1 - t) * om) / Math.sin(om);
    const s2 = Math.sin(t * om) / Math.sin(om);
    const v = [s1 * va[0] + s2 * vb[0], s1 * va[1] + s2 * vb[1], s1 * va[2] + s2 * vb[2]];
    const lat = Math.atan2(v[2], Math.hypot(v[0], v[1])) / RAD;
    const lon = Math.atan2(v[1], v[0]) / RAD;
    const jump = prevLon !== null && Math.abs(lon - prevLon) > 180;
    d += `${i === 0 || jump ? 'M' : 'L'}${lon.toFixed(2)},${(-lat).toFixed(2)}`;
    prevLon = lon;
  }
  return d;
}

// Small deterministic pseudo-random source so the simulated GPS is repeatable.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SOURCE_LINES = [
  '// SwiftCore.swift (line breaks adjusted to fit).',
  '// cSin, cCos, cAtan2, cSqrt come from the C math library.',
  'let earthRadiusMeters = 6_371_000.0',
  '',
  'func radians(_ degrees: Double) -> Double {',
  '    degrees * Double.pi / 180.0',
  '}',
  '',
  '@_expose(wasm, "distanceMeters")',
  '@_cdecl("distanceMeters")',
  'public func distanceMeters(_ lat1: Double, _ lon1: Double,',
  '        _ lat2: Double, _ lon2: Double) -> Double {',
  '    let dLat = radians(lat2 - lat1)',
  '    let dLon = radians(lon2 - lon1)',
  '    let a = cSin(dLat / 2) * cSin(dLat / 2)',
  '        + cCos(radians(lat1)) * cCos(radians(lat2))',
  '        * cSin(dLon / 2) * cSin(dLon / 2)',
  '    return earthRadiusMeters * 2',
  '        * cAtan2(cSqrt(a), cSqrt(1 - a))',
  '}',
];

export default {
  name: 'services-location-lab',
  css: `
${S} { container-type: size; height: 100%; width: 100%; box-sizing: border-box; color: var(--ink); font: 14px/1.45 var(--font-ui); }
${S} .ll { height: 100%; box-sizing: border-box; padding: 12px; display: grid; gap: 10px;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "bar bar" "map side"; }
${S} .ll-bar { grid-area: bar; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; }
${S} .ll-seg { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; }
${S} .ll-seg .svk-ctl { border: 0; border-radius: 0; }
${S} .ll-seg .svk-ctl + .svk-ctl { border-left: 1px solid var(--line); }
${S} .ll-bar .svk-ctl { display: inline-flex; align-items: center; gap: 6px; }
${S} .ll-badge { position: absolute; top: 8px; right: 8px; z-index: 2; display: inline-flex; align-items: center; gap: 6px;
  font: 600 11.5px/1.25 var(--font-ui); color: var(--ok); background: var(--ok-soft); border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent);
  border-radius: 99px; padding: 4px 10px; pointer-events: none; max-width: calc(100% - 16px); }
${S} .ll-badge.ll-js { color: var(--warn); background: var(--warn-soft); }
${S} .ll-badge.ll-wait { color: var(--ink-3); background: var(--panel-2); }
${S} .ll-map { grid-area: map; position: relative; min-height: 0; min-width: 0; border: 1px solid var(--line);
  border-radius: var(--r-md); overflow: hidden; background: color-mix(in srgb, var(--link) 16%, var(--panel)); }
${S} .ll-map > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
${S} .ll-water { fill: color-mix(in srgb, var(--link) 16%, var(--panel)); }
${S} .ll-land { fill: var(--panel); stroke: color-mix(in srgb, var(--link) 30%, var(--line)); stroke-width: 0.6; vector-effect: non-scaling-stroke; }
${S} .ll-park { fill: color-mix(in srgb, var(--ok) 22%, var(--panel)); }
${S} .ll-street { stroke: var(--line); stroke-width: 0.7; fill: none; }
${S} .ll-avenue { stroke: color-mix(in srgb, var(--ink-3) 45%, var(--line)); stroke-width: 1.1; fill: none; }
${S} .ll-broadway { stroke: color-mix(in srgb, var(--warn) 55%, var(--line)); stroke-width: 2; fill: none; }
${S} .ll-grat { stroke: color-mix(in srgb, var(--link) 28%, var(--panel)); stroke-width: 0.8; fill: none; }
${S} .ll-equator { stroke: color-mix(in srgb, var(--link) 45%, var(--panel)); stroke-width: 1.2; stroke-dasharray: 4 4; fill: none; }
${S} .ll-lm circle { fill: var(--ink-2); stroke: var(--panel); stroke-width: 1.5; vector-effect: non-scaling-stroke; cursor: pointer; }
${S} .ll-lm text { fill: var(--ink-2); font: 600 11px var(--font-ui); paint-order: stroke; stroke: var(--panel); stroke-width: 3px;
  stroke-linejoin: round; pointer-events: none; }
${S} .ll-lm.ll-sel circle { fill: var(--link); }
${S} .ll-lm.ll-sel text { fill: var(--link); }
${S} .ll-route { stroke: var(--link); stroke-width: 2.2; fill: none; stroke-dasharray: 6 5; stroke-linecap: round; vector-effect: non-scaling-stroke; }
${S} .ll-acc { fill: color-mix(in srgb, var(--accent) 16%, transparent); stroke: var(--accent); stroke-width: 1; vector-effect: non-scaling-stroke; }
${S} .ll-pin { cursor: grab; outline: none; }
${S} .ll-pin .ll-dot { fill: var(--accent); stroke: #fff; stroke-width: 2.5; vector-effect: non-scaling-stroke; }
${S} .ll-pin .ll-ring { fill: none; stroke: transparent; stroke-width: 2.5; vector-effect: non-scaling-stroke; }
${S} .ll-pin:focus-visible .ll-ring, ${S} .ll-pin.ll-dragging .ll-ring { stroke: var(--focus); }
${S} .ll-pin text { fill: var(--accent-ink); font: 700 11px var(--font-ui); paint-order: stroke; stroke: var(--panel); stroke-width: 3px; stroke-linejoin: round; }
${S} .ll-strip { position: absolute; left: 8px; right: 8px; bottom: 8px; padding: 6px 10px; border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--panel) 92%, transparent); border: 1px solid var(--line); font-size: 12px; color: var(--ink-2);
  pointer-events: none; }
${S} .ll-strip.ll-bad { color: var(--bad); border-color: var(--bad); }
${S} .ll-strip.ll-good { color: var(--ok); border-color: var(--ok); }
${S} .ll-card { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 14px;
  background: color-mix(in srgb, var(--bg) 55%, transparent); }
${S} .ll-card[hidden] { display: none; }
${S} .ll-card > div { max-width: 340px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-lg);
  box-shadow: var(--shadow); padding: 14px 16px; }
${S} .ll-card h3 { margin: 0 0 6px; font: 700 15px/1.3 var(--font-display); }
${S} .ll-card p { margin: 0 0 10px; font-size: 13px; color: var(--ink-2); }
${S} .ll-card .ll-row { display: flex; gap: 8px; justify-content: flex-end; }
${S} .ll-side { grid-area: side; min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
${S} .ll-tabs { display: none; }
${S} .ll-tablewrap { flex: 0 0 auto; max-height: 62%; min-height: 0; overflow: auto; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel); }
${S} table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
${S} th { text-align: left; font: 600 11px/1.2 var(--font-ui); letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-3);
  padding: 7px 8px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--panel); }
${S} td { padding: 4px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; font-variant-numeric: tabular-nums; }
${S} tr:last-child td { border-bottom: 0; }
${S} tr.ll-sel td { background: var(--accent-soft); }
${S} td .ll-name { appearance: none; border: 0; background: none; color: var(--ink); font: 600 12.5px/1.3 var(--font-ui); padding: 2px 0;
  cursor: pointer; text-align: left; white-space: normal; }
${S} td .ll-name:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 3px; }
${S} td.ll-num { text-align: right; }
${S} .ll-arrow { display: inline-block; width: 16px; height: 16px; vertical-align: -3px; color: var(--link); }
${S} .ll-codewrap { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
${S} .ll-codewrap .ll-seg { align-self: flex-start; }
${S} .ll-codewrap .ll-seg .svk-ctl { font-size: 12px; padding: 5px 9px; }
${S} .ll-codewrap .svk-code { flex: 1 1 auto; min-height: 0; font-size: 11.5px; }
${S} .ll-count { font: 600 11px var(--font-code); color: var(--accent-ink); }
${S} .ll-flash .svk-line.svk-on { background: var(--accent-soft); }
${codeCss(S)}
${panelCss(S)}
@container (max-width: 559px) {
  ${S} .ll { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1.25fr) minmax(0, 1fr);
    grid-template-areas: "bar" "map" "side"; padding: 8px; gap: 7px; }
  ${S} .ll-bar { gap: 6px; }
  ${S} .ll-bar .svk-ctl { font-size: 12px; padding: 5px 7px; gap: 4px; }
  ${S} .ll-bar .svk-ctl svg { width: 13px; height: 13px; }
  ${S} .ll-badge { top: 6px; right: 6px; font-size: 10.5px; padding: 3px 8px; }
  ${S} .ll-tabs { display: inline-flex; align-self: flex-start; }
  ${S} .ll-tabs .svk-ctl { font-size: 12px; padding: 5px 10px; }
  ${S} .ll-side[data-tab="table"] .ll-codewrap { display: none; }
  ${S} .ll-side[data-tab="code"] .ll-tablewrap { display: none; }
  ${S} .ll-tablewrap { flex: 1 1 auto; max-height: none; }
  ${S} .ll-codewrap .svk-code { font-size: 10.5px; }
  ${S} .ll-strip { font-size: 11px; padding: 4px 8px; left: 6px; right: 6px; bottom: 6px; }
}
@container (max-width: 559px) and (max-height: 599px) {
  ${S} .ll { grid-template-rows: auto minmax(0, 1.2fr) minmax(0, 1fr); }
  ${S} .ll-strip { font-size: 10.5px; }
  ${S} td { padding: 3px 6px; }
  ${S} th { padding: 5px 6px; }
}
`,
  mount(el, props = {}, ctx) {
    el.classList.add(`w-${NAME}`);
    const state = {
      scene: props.scene === 'world' ? 'world' : 'city',
      pins: { city: { ...city.pinDefault }, world: { ...world.pinDefault } },
      selected: { city: 0, world: 2 },
      wasm: undefined,
      codeTab: 'distance',
      live: false,
      liveCount: 0,
      liveAcc: 0,
      anchor: null,
      flashOn: false,
      dragging: false,
    };
    const timers = new Set();
    const random = rng(41);
    let liveTimer = null;
    let destroyed = false;

    el.innerHTML = `
<div class="ll">
  <div class="ll-bar">
    <div class="ll-seg" role="group" aria-label="Scene">
      <button type="button" class="svk-ctl" id="${id('scene-city')}" data-scene="city">City</button>
      <button type="button" class="svk-ctl" id="${id('scene-world')}" data-scene="world">World</button>
    </div>
    <button type="button" class="svk-ctl" id="${id('locate')}">${ctx.icon('location', 15)}Use my location</button>
    <button type="button" class="svk-ctl" id="${id('live')}" aria-pressed="false">${ctx.icon('arrow.clockwise', 15)}Live updates</button>
  </div>
  <div class="ll-map" id="${id('map')}">
    <span class="ll-badge ll-wait" id="${id('badge')}" role="status">Loading Swift...</span>
    <svg id="${id('svg')}" role="application" aria-label="Map. Click to place your position, or focus the You pin and use arrow keys.">
      <g id="${id('backdrop')}"></g><g id="${id('dynamic')}"></g>
    </svg>
    <div class="ll-strip" id="${id('strip')}" aria-live="polite">Drag the pin or click the map. Keyboard: focus the pin, then use arrow keys.</div>
    <div class="ll-card" id="${id('explain')}" hidden role="dialog" aria-modal="false" aria-labelledby="${id('explain-title')}">
      <div>
        <h3 id="${id('explain-title')}">Before the browser asks</h3>
        <p>Your browser will now show its own permission prompt, just as iOS shows a system alert the first time an app asks for location. Your position stays on this page: the distances are computed right here and never sent anywhere.</p>
        <div class="ll-row">
          <button type="button" class="svk-ctl" id="${id('explain-cancel')}">Not now</button>
          <button type="button" class="svk-ctl svk-primary" id="${id('explain-go')}">Continue</button>
        </div>
      </div>
    </div>
  </div>
  <div class="ll-side" id="${id('side')}" data-tab="table">
    <div class="ll-seg ll-tabs" role="tablist" aria-label="Panel">
      <button type="button" class="svk-ctl" role="tab" id="${id('tab-table')}" data-tab="table">Distances</button>
      <button type="button" class="svk-ctl" role="tab" id="${id('tab-code')}" data-tab="code">Swift code</button>
    </div>
    <div class="ll-tablewrap" id="${id('tablewrap')}">
      <table aria-label="Distance and bearing from you to each landmark">
        <thead><tr><th scope="col">Landmark</th><th scope="col" class="ll-num">Distance</th><th scope="col" class="ll-num">Bearing</th></tr></thead>
        <tbody id="${id('rows')}"></tbody>
      </table>
    </div>
    <div class="ll-codewrap">
      <div class="ll-seg" role="group" aria-label="Code view">
        <button type="button" class="svk-ctl" id="${id('code-distance')}" data-code="distance">distance(from:)</button>
        <button type="button" class="svk-ctl" id="${id('code-live')}" data-code="live">Live loop</button>
        <button type="button" class="svk-ctl" id="${id('code-source')}" data-code="source">Inside the WASM</button>
      </div>
      <div class="svk-code" id="${id('code')}" tabindex="0" aria-label="Swift code"></div>
    </div>
  </div>
</div>`;

    const $ = (role) => el.querySelector(`#${id(role)}`);
    const svg = $('svg');
    const mapBox = $('map');
    const backdrop = $('backdrop');
    const dynamic = $('dynamic');
    const strip = $('strip');
    const badge = $('badge');
    const rows = $('rows');
    const code = $('code');
    const side = $('side');
    let unitsPerPx = 1;
    let view = { x: 0, y: 0, w: 1, h: 1 };

    const scene = () => SCENES[state.scene];
    const pin = () => state.pins[state.scene];
    const target = () => scene().landmarks[state.selected[state.scene]];

    function distance(a, b) {
      return state.wasm ? state.wasm.distanceMeters(a.lat, a.lon, b.lat, b.lon) : jsDistance(a.lat, a.lon, b.lat, b.lon);
    }
    function bearing(a, b) {
      return state.wasm ? state.wasm.bearingDegrees(a.lat, a.lon, b.lat, b.lon) : jsBearing(a.lat, a.lon, b.lat, b.lon);
    }

    function setStrip(text, tone = '') {
      strip.textContent = text;
      strip.className = `ll-strip${tone ? ` ll-${tone}` : ''}`;
    }

    // Fits the scene's interesting area into the map box, keeping aspect ratio.
    function fitView() {
      const w = Math.max(1, mapBox.clientWidth);
      const h = Math.max(1, mapBox.clientHeight);
      // Keep the landmarks clear of the status strip along the bottom edge.
      const reserve = Math.min(h * 0.3, strip.offsetHeight + 10);
      const top = Math.min(h * 0.15, badge.offsetHeight + 8);
      const usable = Math.max(1, h - reserve - top);
      const [x1, y1, x2, y2] = scene().bounds;
      const pad = 0.05;
      const bw = (x2 - x1) * (1 + pad * 2);
      const bh = (y2 - y1) * (1 + pad * 2);
      unitsPerPx = Math.max(bw / w, bh / usable);
      const vw = w * unitsPerPx;
      const vh = h * unitsPerPx;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2 + ((reserve - top) * unitsPerPx) / 2;
      view = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh };
      svg.setAttribute('viewBox', `${view.x.toFixed(2)} ${view.y.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`);
    }

    function drawBackdrop() {
      backdrop.innerHTML = state.scene === 'city' ? cityBackdrop() : worldBackdrop();
    }

    function drawDynamic() {
      const sc = scene();
      const u = unitsPerPx;
      const p = pin();
      const [px, py] = sc.project(p.lat, p.lon);
      const t = target();
      let route = '';
      if (state.scene === 'world') route = greatCircle(p, t);
      else {
        const [tx, ty] = sc.project(t.lat, t.lon);
        route = `M${px.toFixed(1)},${py.toFixed(1)}L${tx.toFixed(1)},${ty.toFixed(1)}`;
      }
      const lms = sc.landmarks.map((lm, i) => {
        const [x, y] = sc.project(lm.lat, lm.lon);
        const sel = i === state.selected[state.scene];
        // Short names on small maps; flip left/right labels that would run off the map.
        const label = mapBox.clientWidth < 420 && lm.short ? lm.short : lm.name;
        const textW = label.length * 6.4 * u;
        let side = lm.side || 'right';
        if (side === 'right' && x + 8 * u + textW > view.x + view.w) side = 'left';
        else if (side === 'left' && x - 8 * u - textW < view.x) side = 'right';
        const pos = {
          right: [x + 8 * u, y + 4 * u, 'start'],
          left: [x - 8 * u, y + 4 * u, 'end'],
          above: [x, y - 9 * u, 'middle'],
          below: [x, y + 16 * u, 'middle'],
        }[side];
        return `<g class="ll-lm${sel ? ' ll-sel' : ''}" data-index="${i}">
          <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${((sel ? 6 : 4.5) * u).toFixed(3)}"/>
          <text x="${pos[0].toFixed(2)}" y="${pos[1].toFixed(2)}" text-anchor="${pos[2]}" style="font-size:${(11 * u).toFixed(3)}px;stroke-width:${(3 * u).toFixed(3)}px">${esc(label)}</text>
        </g>`;
      }).join('');
      const accR = state.live ? Math.max(state.liveAcc * sc.unitsPerMeter, 10 * u) : 0;
      const hadFocus = document.activeElement && document.activeElement.id === id('pin');
      dynamic.innerHTML = `
        <path class="ll-route" d="${route}"/>
        ${lms}
        ${state.live ? `<circle class="ll-acc" cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${accR.toFixed(3)}"/>` : ''}
        <g class="ll-pin${state.dragging ? ' ll-dragging' : ''}" id="${id('pin')}" tabindex="0" role="button"
           aria-label="You: latitude ${p.lat.toFixed(4)}, longitude ${p.lon.toFixed(4)}. Arrow keys move the pin.">
          <circle class="ll-ring" cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(14 * u).toFixed(3)}"/>
          <circle class="ll-dot" cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(8 * u).toFixed(3)}"/>
          <text x="${px.toFixed(2)}" y="${(py - 13 * u).toFixed(2)}" text-anchor="middle" style="font-size:${(11 * u).toFixed(3)}px;stroke-width:${(3 * u).toFixed(3)}px">You</text>
        </g>`;
      if (hadFocus) $('pin')?.focus({ preventScroll: true });
    }

    function drawTable() {
      const sc = scene();
      const p = pin();
      rows.innerHTML = sc.landmarks.map((lm, i) => {
        const d = distance(p, lm);
        const b = bearing(p, lm);
        const sel = i === state.selected[state.scene];
        return `<tr class="${sel ? 'll-sel' : ''}">
          <td><button type="button" class="ll-name" id="${id(`row-${i}`)}" data-index="${i}" aria-pressed="${sel}">${esc(lm.name)}</button></td>
          <td class="ll-num" data-role="distance">${fmtDistance(d)}</td>
          <td class="ll-num"><svg class="ll-arrow" viewBox="0 0 16 16" aria-hidden="true"><g transform="rotate(${b.toFixed(1)} 8 8)"><path d="M8 14V2.5M4 6.5 8 2.5l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg> ${Math.round(b)}&deg; ${compass(b)}</td>
        </tr>`;
      }).join('');
    }

    function codeLines() {
      const p = pin();
      const t = target();
      if (state.codeTab === 'source') return { lines: SOURCE_LINES, active: new Set([10, 11]) };
      if (state.codeTab === 'live') {
        const lines = [
          'import CoreLocation',
          '',
          'let session = CLServiceSession(authorization: .whenInUse)',
          'for try await update in CLLocationUpdate.liveUpdates() {',
          '    guard let location = update.location else { continue }',
          '    here = location',
          state.live
            ? `    // update ${state.liveCount}: ±${state.liveAcc.toFixed(0)} m horizontalAccuracy`
            : '    // press Live updates to start the stream',
          '}',
          `// here: ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`,
        ];
        const active = state.live ? (state.flashOn ? new Set([4, 5, 6]) : new Set([3])) : new Set();
        return { lines, active };
      }
      const d = distance(p, t);
      const b = bearing(p, t);
      return {
        lines: [
          'import CoreLocation',
          '',
          `let here = CLLocation(latitude: ${p.lat.toFixed(4)},`,
          `                      longitude: ${p.lon.toFixed(4)})`,
          `// Target: ${t.name}`,
          `let target = CLLocation(latitude: ${t.lat.toFixed(4)},`,
          `                        longitude: ${t.lon.toFixed(4)})`,
          'let meters = here.distance(from: target)',
          `// meters is about ${d.toFixed(1)} (${fmtDistance(d)})`,
          `// bearing ${b.toFixed(1)}° (${compass(b)}), from bearingDegrees`,
        ],
        active: new Set([2, 3, 7]),
      };
    }

    function drawCode() {
      const { lines, active } = codeLines();
      code.innerHTML = codeHtml(lines, active);
      code.classList.toggle('ll-flash', state.flashOn);
      el.querySelectorAll('[data-code]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.code === state.codeTab)));
    }

    function drawChrome() {
      el.querySelectorAll('[data-scene]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scene === state.scene)));
      el.querySelectorAll('.ll-tabs [data-tab]').forEach((b) => {
        const on = b.dataset.tab === side.dataset.tab;
        b.setAttribute('aria-selected', String(on));
        b.setAttribute('aria-pressed', String(on));
      });
      $('live').setAttribute('aria-pressed', String(state.live));
      if (state.wasm === undefined) { badge.className = 'll-badge ll-wait'; badge.textContent = 'Loading Swift...'; }
      else if (state.wasm) { badge.className = 'll-badge'; badge.innerHTML = `${ctx.icon('swift', 14)}Computed by Swift running as WebAssembly`; }
      else { badge.className = 'll-badge ll-js'; badge.textContent = 'JavaScript fallback (WebAssembly unavailable)'; }
    }

    function render({ full = false } = {}) {
      if (destroyed) return;
      if (full) { fitView(); drawBackdrop(); }
      drawDynamic();
      drawTable();
      drawCode();
      drawChrome();
    }

    function clampPin(p) {
      const c = scene().clamp;
      p.lat = Math.min(c.latMax, Math.max(c.latMin, p.lat));
      p.lon = Math.min(c.lonMax, Math.max(c.lonMin, p.lon));
    }

    function svgPoint(evt) {
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const m = svg.getScreenCTM();
      return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }

    function movePinToEvent(evt) {
      const { x, y } = svgPoint(evt);
      const [lat, lon] = scene().unproject(x, y);
      const p = pin();
      p.lat = lat;
      p.lon = lon;
      clampPin(p);
      if (state.live) state.anchor = { ...p };
    }

    // --- Events -----------------------------------------------------------------
    function onPointerDown(evt) {
      const lm = evt.target.closest('.ll-lm');
      if (lm) { selectLandmark(Number(lm.dataset.index)); return; }
      state.dragging = true;
      svg.setPointerCapture?.(evt.pointerId);
      movePinToEvent(evt);
      render();
      setStrip(`You are at ${pin().lat.toFixed(4)}, ${pin().lon.toFixed(4)}.`);
    }
    function onPointerMove(evt) {
      if (!state.dragging) return;
      movePinToEvent(evt);
      render();
    }
    function onPointerUp(evt) {
      if (!state.dragging) return;
      state.dragging = false;
      svg.releasePointerCapture?.(evt.pointerId);
      render();
      const focusPin = $('pin');
      if (focusPin && evt.pointerType !== 'touch') focusPin.focus({ preventScroll: true });
    }
    function onKey(evt) {
      if (!evt.target.closest || !evt.target.closest('.ll-pin')) return;
      const step = scene().step * (evt.shiftKey ? 5 : 1);
      const p = pin();
      const moves = { ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step] };
      const mv = moves[evt.key];
      if (!mv) return;
      evt.preventDefault();
      p.lat += mv[0];
      p.lon += mv[1];
      clampPin(p);
      if (state.live) state.anchor = { ...p };
      render();
      setStrip(`You are at ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}.`);
    }

    function selectLandmark(i) {
      state.selected[state.scene] = i;
      render();
      setStrip(`Measuring to ${target().name}.`);
    }

    function setScene(name) {
      if (state.scene === name) return;
      state.scene = name;
      if (state.live) state.anchor = { ...pin() };
      render({ full: true });
      setStrip(name === 'city'
        ? 'City scale: distances in meters, a straight line is a fine approximation.'
        : 'World scale: the shortest route follows a great circle, so it curves on a flat map.');
    }

    function tick() {
      if (!state.live || destroyed) return;
      const sc = scene();
      const a = state.anchor || pin();
      state.liveCount += 1;
      state.liveAcc = 4 + random() * 22;
      const jitterM = state.liveAcc * 0.35;
      const ang = random() * Math.PI * 2;
      const dx = Math.cos(ang) * jitterM * random();
      const dy = Math.sin(ang) * jitterM * random();
      const p = pin();
      p.lat = a.lat + dy / M_PER_DEG_LAT;
      p.lon = a.lon + dx / (111320 * Math.cos(a.lat * RAD));
      clampPin(p);
      state.flashOn = true;
      render();
      setStrip(`Update ${state.liveCount}: ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}, ±${state.liveAcc.toFixed(0)} m${sc === world ? ' (too small to see at world scale)' : ''}.`);
      const t = setTimeout(() => { timers.delete(t); state.flashOn = false; if (!destroyed) drawCode(); }, 380);
      timers.add(t);
    }

    function setLive(on) {
      state.live = on;
      clearInterval(liveTimer);
      liveTimer = null;
      if (on) {
        state.anchor = { ...pin() };
        state.codeTab = 'live';
        liveTimer = setInterval(tick, 1000);
        tick();
        setStrip('Live updates started: the loop body runs once per new location.', 'good');
      } else {
        state.flashOn = false;
        render();
        setStrip(`Stopped after ${state.liveCount} updates. Breaking out of the loop ends the stream.`);
      }
    }

    function locate() {
      $('explain').hidden = false;
      $('explain-go').focus({ preventScroll: true });
    }
    function closeExplain() {
      $('explain').hidden = true;
      $('locate').focus({ preventScroll: true });
    }
    function startGeolocation() {
      $('explain').hidden = true;
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStrip('No location service here: the same situation as update.locationUnavailable on iOS. Drag the pin instead.', 'bad');
        return;
      }
      setStrip('Waiting for your answer to the browser prompt...');
      let settled = false;
      const guard = setTimeout(() => {
        timers.delete(guard);
        if (settled || destroyed) return;
        settled = true;
        setStrip('No answer in time: like update.locationUnavailable on iOS. Drag the pin instead.', 'bad');
      }, 12000);
      timers.add(guard);
      navigator.geolocation.getCurrentPosition((pos) => {
        if (settled || destroyed) return;
        settled = true;
        clearTimeout(guard);
        const { latitude, longitude, accuracy } = pos.coords;
        const nearCity = jsDistance(latitude, longitude, 40.75, -73.985) < 12000;
        state.scene = nearCity ? 'city' : 'world';
        state.pins[state.scene] = { lat: latitude, lon: longitude };
        clampPin(pin());
        if (state.live) state.anchor = { ...pin() };
        render({ full: true });
        setStrip(`Got a fix: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}, horizontalAccuracy ±${Math.round(accuracy)} m. On iOS this arrives as update.location.`, 'good');
      }, (err) => {
        if (settled || destroyed) return;
        settled = true;
        clearTimeout(guard);
        if (err && err.code === 1) setStrip('Permission denied — the same situation as update.authorizationDenied on iOS. Drag the pin instead.', 'bad');
        else setStrip('No location available — like update.locationUnavailable on iOS. Drag the pin instead.', 'bad');
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    }

    function onClick(evt) {
      const t = evt.target.closest('button');
      if (!t || !el.contains(t)) return;
      if (t.dataset.scene) setScene(t.dataset.scene);
      else if (t.dataset.code) { state.codeTab = t.dataset.code; drawCode(); }
      else if (t.dataset.tab) { side.dataset.tab = t.dataset.tab; drawChrome(); }
      else if (t.classList.contains('ll-name')) selectLandmark(Number(t.dataset.index));
      else if (t.id === id('live')) setLive(!state.live);
      else if (t.id === id('locate')) locate();
      else if (t.id === id('explain-cancel')) { closeExplain(); setStrip('Not now: nothing was asked. On iOS, a priming screen like this keeps the one-time system alert for later.'); }
      else if (t.id === id('explain-go')) startGeolocation();
    }

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    svg.addEventListener('keydown', onKey);
    el.addEventListener('click', onClick);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (!destroyed) { fitView(); drawDynamic(); } });
      ro.observe(mapBox);
    }

    render({ full: true });
    Promise.resolve(ctx.wasm).then((w) => {
      state.wasm = w || null;
      render();
    }).catch(() => { state.wasm = null; render(); });

    return {
      destroy() {
        destroyed = true;
        clearInterval(liveTimer);
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
        ro?.disconnect();
        svg.removeEventListener('pointerdown', onPointerDown);
        svg.removeEventListener('pointermove', onPointerMove);
        svg.removeEventListener('pointerup', onPointerUp);
        svg.removeEventListener('pointercancel', onPointerUp);
        svg.removeEventListener('keydown', onKey);
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
      },
    };
  },
};
