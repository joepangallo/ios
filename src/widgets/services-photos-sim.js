// services-photos-sim: the PhotosPicker privacy model, made visible.
// A "Postcard" app opens the system photo picker, which runs in a separate
// process, so the app sees nothing until the user picks. The picked items
// arrive as PhotosPickerItem values, load through Transferable as Data, and
// can be handed to the system share sheet with ShareLink. A contrast mode
// asks for full library access instead, to show what that costs.
import { esc, codeHtml, codeCss, phoneHtml, phoneCss, panelCss, idScope } from './services-kit.js';

const NAME = 'services-photos-sim';
const S = `.w-${NAME}`;
const id = idScope(NAME);

// Generated "photos": a CSS gradient plus a few SVG shapes (viewBox 100x100).
const PHOTOS = [
  { pid: 'sunset', label: 'Sunset over the sea', shot: false, bytes: 2384112,
    bg: 'linear-gradient(180deg,#ffb25e 0%,#ff6f7d 55%,#7a4b9c 100%)',
    svg: '<circle cx="50" cy="58" r="15" fill="#ffd977"/><rect x="0" y="62" width="100" height="38" fill="#2c4c80"/><rect x="36" y="67" width="28" height="2.4" rx="1.2" fill="#ffd977" opacity=".7"/><rect x="41" y="73" width="18" height="2" rx="1" fill="#ffd977" opacity=".5"/><rect x="45" y="79" width="10" height="1.6" rx=".8" fill="#ffd977" opacity=".35"/>' },
  { pid: 'chat', label: 'Screenshot of a chat', shot: true, bytes: 356212,
    bg: '#ffffff',
    svg: '<rect x="0" y="0" width="100" height="10" fill="#f2f2f7"/><rect x="8" y="16" width="48" height="12" rx="6" fill="#e9e9eb"/><rect x="44" y="32" width="48" height="12" rx="6" fill="#0a84ff"/><rect x="8" y="48" width="38" height="12" rx="6" fill="#e9e9eb"/><rect x="36" y="64" width="56" height="12" rx="6" fill="#0a84ff"/><rect x="8" y="86" width="84" height="8" rx="4" fill="none" stroke="#d1d1d6" stroke-width="1.2"/>' },
  { pid: 'peaks', label: 'Snowy mountain peaks', shot: false, bytes: 3105880,
    bg: 'linear-gradient(180deg,#6fb1ec,#d4ebfb)',
    svg: '<polygon points="-5,100 28,38 60,100" fill="#55657a"/><polygon points="28,38 20,53 26,50 31,55 36,50" fill="#fff"/><polygon points="25,100 66,26 108,100" fill="#6d7e96"/><polygon points="66,26 56,44 62,41 67,46 72,41 76,44" fill="#fff"/><rect x="0" y="88" width="100" height="12" fill="#3f6d4e"/>' },
  { pid: 'forest', label: 'Pine forest on green hills', shot: false, bytes: 2742516,
    bg: 'linear-gradient(180deg,#cdeccd,#f2f8e8)',
    svg: '<ellipse cx="25" cy="100" rx="60" ry="30" fill="#8cc47f"/><ellipse cx="85" cy="104" rx="55" ry="32" fill="#6fae66"/><polygon points="20,48 11,72 29,72" fill="#2f6b3a"/><polygon points="38,40 27,70 49,70" fill="#255a31"/><polygon points="62,46 52,74 72,74" fill="#2f6b3a"/><polygon points="80,38 69,68 91,68" fill="#255a31"/>' },
  { pid: 'night', label: 'Moon and stars', shot: false, bytes: 1906344,
    bg: 'linear-gradient(180deg,#0a1430,#2a3a66)',
    svg: '<circle cx="70" cy="30" r="12" fill="#f3efcf"/><circle cx="75" cy="26" r="10.5" fill="#132049"/><circle cx="18" cy="20" r="1.1" fill="#fff"/><circle cx="34" cy="34" r=".9" fill="#fff"/><circle cx="48" cy="14" r="1.2" fill="#fff"/><circle cx="26" cy="52" r=".8" fill="#fff"/><circle cx="88" cy="56" r="1" fill="#fff"/><circle cx="56" cy="44" r=".7" fill="#fff"/><path d="M0 85 Q25 75 50 84 T100 80 V100 H0Z" fill="#0b1124"/>' },
  { pid: 'settings', label: 'Screenshot of a settings screen', shot: true, bytes: 412880,
    bg: '#f2f2f7',
    svg: '<rect x="8" y="5" width="12" height="3" rx="1.5" fill="#1c1c1e"/><rect x="80" y="5" width="12" height="3" rx="1.5" fill="#1c1c1e"/><rect x="8" y="14" width="40" height="6" rx="2" fill="#1c1c1e"/><rect x="6" y="26" width="88" height="30" rx="4" fill="#fff"/><rect x="10" y="30" width="6" height="6" rx="1.5" fill="#0a84ff"/><rect x="20" y="32" width="34" height="2.4" rx="1.2" fill="#c7c7cc"/><rect x="10" y="44" width="6" height="6" rx="1.5" fill="#34c759"/><rect x="20" y="46" width="28" height="2.4" rx="1.2" fill="#c7c7cc"/><rect x="6" y="62" width="88" height="30" rx="4" fill="#fff"/><rect x="10" y="66" width="6" height="6" rx="1.5" fill="#ff9500"/><rect x="20" y="68" width="38" height="2.4" rx="1.2" fill="#c7c7cc"/><rect x="10" y="80" width="6" height="6" rx="1.5" fill="#ff3b30"/><rect x="20" y="82" width="24" height="2.4" rx="1.2" fill="#c7c7cc"/>' },
  { pid: 'dunes', label: 'Desert dunes', shot: false, bytes: 2215408,
    bg: 'linear-gradient(180deg,#ffd9a0,#ffefd2)',
    svg: '<circle cx="72" cy="28" r="10" fill="#fff4c9"/><path d="M0 70 Q30 50 60 68 T100 62 V100 H0Z" fill="#e8b062"/><path d="M0 84 Q40 66 75 82 T100 80 V100 H0Z" fill="#cf8f45"/>' },
  { pid: 'lake', label: 'Trees reflected in a lake', shot: false, bytes: 2958032,
    bg: 'linear-gradient(180deg,#9fd3f7 0%,#cfe9fb 50%,#5d9ccb 50%,#3c78aa 100%)',
    svg: '<polygon points="15,30 8,50 22,50" fill="#2f6b3a"/><polygon points="30,24 21,50 39,50" fill="#285e33"/><polygon points="62,34 55,50 69,50" fill="#2f6b3a"/><polygon points="78,28 70,50 86,50" fill="#285e33"/><polygon points="15,70 8,50 22,50" fill="#2f6b3a" opacity=".4"/><polygon points="30,76 21,50 39,50" fill="#285e33" opacity=".4"/><polygon points="62,66 55,50 69,50" fill="#2f6b3a" opacity=".4"/><polygon points="78,72 70,50 86,50" fill="#285e33" opacity=".4"/>' },
  { pid: 'city', label: 'City skyline at dusk', shot: false, bytes: 2461970,
    bg: 'linear-gradient(180deg,#352a63 0%,#b45d7a 62%,#f39a5d 100%)',
    svg: '<rect x="5" y="50" width="14" height="50" fill="#1d1838"/><rect x="21" y="35" width="12" height="65" fill="#231d44"/><rect x="35" y="58" width="16" height="42" fill="#1d1838"/><rect x="53" y="28" width="13" height="72" fill="#231d44"/><rect x="68" y="46" width="15" height="54" fill="#1d1838"/><rect x="85" y="55" width="12" height="45" fill="#231d44"/><rect x="24" y="42" width="2.5" height="3" fill="#ffd56e"/><rect x="28" y="50" width="2.5" height="3" fill="#ffd56e"/><rect x="56" y="36" width="2.5" height="3" fill="#ffd56e"/><rect x="60" y="48" width="2.5" height="3" fill="#ffd56e"/><rect x="72" y="54" width="2.5" height="3" fill="#ffd56e"/><rect x="9" y="58" width="2.5" height="3" fill="#ffd56e"/>' },
  { pid: 'map', label: 'Screenshot of a map', shot: true, bytes: 598406,
    bg: '#eef0e6',
    svg: '<rect x="34" y="36" width="30" height="26" fill="#c9e5bd"/><path d="M76 74 Q90 70 100 76 V100 H76Z" fill="#a9d3f5"/><path d="M0 30 H100 M0 68 H100 M28 0 V100 M70 0 V100" stroke="#fff" stroke-width="6"/><path d="M14 90 V68 H70 V30" stroke="#0a84ff" stroke-width="3" fill="none"/><circle cx="70" cy="28" r="4.5" fill="#ff3b30"/>' },
  { pid: 'circles', label: 'Abstract overlapping circles', shot: false, bytes: 1288640,
    bg: '#f4efe6',
    svg: '<circle cx="35" cy="40" r="24" fill="#ff7a59" opacity=".85"/><circle cx="62" cy="55" r="26" fill="#3d8bfd" opacity=".75"/><circle cx="45" cy="70" r="18" fill="#ffc83d" opacity=".8"/>' },
  { pid: 'flowers', label: 'Flower field under a blue sky', shot: false, bytes: 3020774,
    bg: 'linear-gradient(180deg,#a9dbff 0%,#d8f0ff 42%,#86c96f 42%,#4e9945 100%)',
    svg: '<circle cx="12" cy="56" r="2.4" fill="#ff6b9a"/><circle cx="26" cy="62" r="2.6" fill="#ffd23f"/><circle cx="40" cy="54" r="2.2" fill="#fff"/><circle cx="55" cy="66" r="2.8" fill="#b388ff"/><circle cx="70" cy="58" r="2.4" fill="#ff6b9a"/><circle cx="86" cy="64" r="2.6" fill="#ffd23f"/><circle cx="18" cy="76" r="3" fill="#ffd23f"/><circle cx="34" cy="84" r="3.2" fill="#ff6b9a"/><circle cx="50" cy="78" r="3" fill="#fff"/><circle cx="66" cy="88" r="3.4" fill="#b388ff"/><circle cx="82" cy="80" r="3" fill="#ff6b9a"/><circle cx="92" cy="92" r="3.2" fill="#fff"/>' },
];
const BY_ID = Object.fromEntries(PHOTOS.map((p) => [p.pid, p]));

const FILTERS = {
  images: { code: '.images', test: () => true, text: 'all images, screenshots included' },
  screenshots: { code: '.screenshots', test: (p) => p.shot, text: 'only screenshots' },
  not: { code: '.not(.screenshots)', test: (p) => !p.shot, text: 'everything except screenshots' },
};

const PHASES = [
  ['picker', 'Picker'],
  ['selected', 'Selection'],
  ['loading', 'Load'],
  ['shown', 'Show'],
  ['share', 'Share'],
];

function singleCode(filter) {
  return [
    '@State private var item: PhotosPickerItem?',
    '@State private var photo: Image?',
    '',
    'PhotosPicker("Choose Photo",',
    '             selection: $item,',
    `             matching: ${FILTERS[filter].code})`,
    '.task(id: item) {',
    '    guard let item else { return }',
    '    if let data = try? await item',
    '           .loadTransferable(type: Data.self),',
    '       let uiImage = UIImage(data: data) {',
    '        photo = Image(uiImage: uiImage)',
    '    }',
    '}',
    'if let photo {',
    '    photo.resizable().scaledToFit()',
    '    ShareLink(item: photo, preview:',
    '        SharePreview("Postcard", image: photo))',
    '}',
  ];
}
const SINGLE_MARKS = { idle: [3, 4, 5], picker: [3, 4, 5], selected: [0, 4, 6, 7], loading: [8, 9, 10], shown: [1, 11, 14, 15], share: [16, 17] };

function multiCode(filter) {
  return [
    '@State private var items: [PhotosPickerItem] = []',
    '@State private var photos: [Image] = []',
    '',
    'PhotosPicker("Choose Photos",',
    '             selection: $items,',
    '             maxSelectionCount: 3,',
    `             matching: ${FILTERS[filter].code})`,
    '.task(id: items) {',
    '    photos = []',
    '    for item in items {',
    '        if let data = try? await item',
    '               .loadTransferable(type: Data.self),',
    '           let uiImage = UIImage(data: data) {',
    '            photos.append(Image(uiImage: uiImage))',
    '        }',
    '    }',
    '}',
    'ForEach(photos.indices, id: \\.self) { index in',
    '    photos[index].resizable().scaledToFit()',
    '}',
    'ShareLink(items: photos) { photo in',
    '    SharePreview("Postcard", image: photo)',
    '}',
  ];
}
const MULTI_MARKS = { idle: [3, 4, 5, 6], picker: [3, 4, 5, 6], selected: [0, 4, 7], loading: [9, 10, 11, 12], shown: [1, 13, 17, 18], share: [20, 21] };

const FULL_CODE = [
  '// Info.plist: NSPhotoLibraryUsageDescription',
  'let status = await PHPhotoLibrary',
  '    .requestAuthorization(for: .readWrite)',
  'switch status {',
  'case .authorized:',
  '    showWholeLibrary()      // every photo',
  'case .limited:',
  '    showSelectedPhotos()    // the user\'s subset',
  'case .denied, .restricted:',
  '    offerPhotosPicker()',
  'default:',
  '    break',
  '}',
];
const FULL_MARKS = { notDetermined: [1, 2], asking: [0, 1, 2], authorized: [4, 5], limited: [6, 7], denied: [8, 9] };

const PURPOSE = 'Postcard turns your photos into postcards.';
const fmtBytes = (n) => `${n.toLocaleString('en-US')} bytes (${(n / 1e6).toFixed(1)} MB)`;
const utType = (p) => (p.shot ? 'public.png' : 'public.heic');

function art(p, extra = '') {
  return `<span class="ph-art${extra}" style="background:${p.bg}"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${p.svg}</svg></span>`;
}

export default {
  name: 'services-photos-sim',
  css: `${codeCss(S)}${phoneCss(S)}${panelCss(S)}
${S} { container-name: ph-root; container-type: size; box-sizing: border-box; height: 100%; color: var(--ink);
  font: 13px/1.4 var(--font-ui); }
${S} *, ${S} *::before, ${S} *::after { box-sizing: border-box; }
${S} .ph-layout { --phone-w: calc((100cqh - 24px) * 0.4615); height: 100%; padding: 12px; display: grid; gap: 10px;
  grid-template-columns: var(--phone-w) minmax(0, 1.55fr) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "phone controls controls" "phone code side"; }
${S} .ph-phonecol { grid-area: phone; min-height: 0; height: 100%; display: flex; justify-content: center; }
${S} .ph-controls { grid-area: controls; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
${S} .ph-group { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
${S} .ph-group .svk-kicker { margin: 0 4px 0 0; text-transform: none; letter-spacing: 0; font: 600 12px/1.3 var(--font-code); }
${S} .ph-ctl-sm { padding: 5px 9px; font-size: 12px; }
${S} .ph-ctl-sm code { font: 12px/1.2 var(--font-code); }
${S} .ph-short { display: none; }
${S} .ph-tabs { grid-area: tabs; display: none; gap: 4px; }
${S} .ph-tab { flex: 1; appearance: none; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
  border-radius: var(--r-sm); font: 600 12px/1.2 var(--font-ui); padding: 6px 4px; cursor: pointer; }
${S} .ph-tab[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
${S} .ph-tab:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
${S} .ph-pane { display: flex; flex-direction: column; min-height: 0; min-width: 0; gap: 6px; }
${S} .ph-pane > .svk-kicker { margin: 0; }
${S} .ph-codepane { grid-area: code; }
${S} .ph-codepane .svk-code { flex: 1; min-height: 0; font-size: 11px; }
${S} .ph-codepane .svk-line { white-space: pre-wrap; }
${S} .ph-codepane .svk-src { overflow-wrap: anywhere; }
${S} .ph-side { grid-area: side; display: flex; flex-direction: column; gap: 10px; min-height: 0; min-width: 0; }
${S} .ph-seepane { flex: 0 1 auto; }
${S} .ph-logpane { flex: 1 1 0; }
${S} .ph-phases { display: flex; flex-wrap: wrap; gap: 4px; }
${S} .ph-phase { font: 600 11px/1.3 var(--font-ui); padding: 2px 8px; border-radius: 99px; border: 1px solid var(--line);
  color: var(--ink-3); background: var(--panel); }
${S} .ph-phase.ph-done { color: var(--ok); border-color: var(--ok); background: var(--ok-soft); }
${S} .ph-phase.ph-now { color: var(--on-accent); border-color: var(--accent); background: var(--accent); }
${S} .ph-see { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px;
  overflow: auto; min-height: 0; }
${S} .ph-see .svk-kicker { margin: 0 0 4px; }
${S} .ph-see-big { font: 700 17px/1.25 var(--font-display); color: var(--ink); }
${S} .ph-see-big.ph-good { color: var(--ok); }
${S} .ph-see-big.ph-bad { color: var(--bad); }
${S} .ph-see p { margin: 4px 0 0; color: var(--ink-2); font-size: 12.5px; }
${S} .ph-see code { font: 11.5px var(--font-code); color: var(--ink); }
${S} .ph-see ul { margin: 6px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
${S} .ph-see li { font: 11px/1.45 var(--font-code); background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--r-sm); padding: 4px 8px; color: var(--ink-2); overflow-wrap: anywhere; }
${S} .ph-see li b { color: var(--ink); font-weight: 600; }
${S} .ph-meter { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
${S} .ph-meter .svk-chip { font-size: 11.5px; padding: 2px 8px; }
${S} .ph-meter .svk-chip.ph-chip-bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
${S} .ph-meter .svk-chip.ph-chip-ok { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
${S} .ph-logpane .svk-log { flex: 1; min-height: 0; background: var(--panel-2); border: 1px solid var(--line);
  border-radius: var(--r-md); padding: 4px 8px; font-size: 11.5px; }
${S} .ph-logpane .svk-log code { font: inherit; color: var(--ink); }

@container ph-root (max-width: 759px) {
  ${S} .ph-layout { grid-template-columns: var(--phone-w) minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "phone controls" "phone tabs" "phone pane"; gap: 8px; }
  ${S} .ph-tabs { display: flex; }
  ${S} .ph-side { display: contents; }
  ${S} .ph-pane { grid-area: pane; display: none; }
  ${S} .ph-pane.ph-active { display: flex; }
  ${S} .ph-seepane .ph-see { flex: 1; }
  ${S} .ph-controls { gap: 5px 8px; padding: 8px; }
  ${S} .ph-group .svk-kicker, ${S} .ph-long { display: none; }
  ${S} .ph-short { display: inline; }
  ${S} .ph-ctl-sm { padding: 4px 7px; font-size: 11.5px; }
  ${S} .ph-ctl-sm code { font-size: 11px; }
  ${S} .ph-codepane .svk-code { font-size: 10px; }
  ${S} .ph-see-big { font-size: 15px; }
}
@container ph-root (max-width: 559px) and (min-height: 600px) {
  ${S} .ph-layout { --phone-h: 55cqh; --phone-w: calc(var(--phone-h) * 0.4615);
    grid-template-rows: var(--phone-h) auto minmax(0, 1fr); grid-template-areas: "phone controls" "tabs tabs" "pane pane"; }
  ${S} .ph-controls { align-content: flex-start; }
}
@container ph-root ((max-width: 759px) and (max-height: 599px)) or ((min-width: 560px) and (max-width: 759px)) {
  ${S} .ph-layout.ph-codeonly { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "controls" "tabs" "pane"; }
  ${S} .ph-layout.ph-codeonly .ph-phonecol { display: none; }
  ${S} .ph-layout.ph-codeonly .ph-codepane .svk-line { white-space: pre; }
}

${S} .ph-app { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; }
${S} .ph-app .svk-large-title { padding-bottom: 0.4cqh; }
${S} .ph-card { margin: 0.8cqh 4cqw 0; background: var(--ios-card); border-radius: 4cqw; flex: 1 1 auto; min-height: 0;
  display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
${S} .ph-empty { flex-direction: column; gap: 1.2cqh; color: var(--ios-label-2); text-align: center; padding: 5cqw; font-size: 3.6cqw; }
${S} .ph-empty svg { width: 13cqw; height: 13cqw; }
${S} .ph-empty b { color: var(--ios-label); font-size: 4.6cqw; font-weight: 600; }
${S} .ph-shown { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 1.4cqw; width: 100%; height: 100%; padding: 2.4cqw; }
${S} .ph-shown.ph-lib { grid-auto-flow: row; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 1fr; grid-auto-columns: auto; align-content: start; }
${S} .ph-art { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; border-radius: 2.4cqw; }
${S} .ph-art svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
${S} .ph-lib .ph-art { aspect-ratio: 1; height: auto; border-radius: 1.4cqw; }
${S} .ph-loading { flex-direction: column; gap: 1.6cqh; padding: 5cqw; width: 100%; color: var(--ios-label-2); font-size: 3.4cqw; text-align: center; }
${S} .ph-bar { width: 100%; height: 1.2cqw; min-height: 4px; border-radius: 99px; background: var(--ios-fill); overflow: hidden; }
${S} .ph-bar i { display: block; height: 100%; background: var(--ios-blue); border-radius: 99px; }
${S} .ph-caption { margin: 0.8cqh 4cqw 0; font-size: 3.2cqw; color: var(--ios-label-2); text-align: center; min-height: 2.6cqh; }
${S} .ph-actions { display: flex; gap: 2cqw; padding: 1.2cqh 4cqw 4.4cqh; }
${S} .ph-actions .svk-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 1.4cqw;
  font-family: inherit; font-weight: 600; font-size: 3.9cqw; line-height: 1.2; padding: 2.6cqw 3cqw; }
${S} .ph-actions .svk-btn svg { width: 4.4cqw; height: 4.4cqw; }

${S} .ph-scrim { position: absolute; inset: 0; background: var(--ios-scrim); z-index: 7; }
${S} .ph-sheet { position: absolute; left: 0; right: 0; bottom: 0; top: 8cqh; background: var(--ios-bg); z-index: 8;
  border-radius: 5cqw 5cqw 0 0; display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 -6px 26px rgba(0, 0, 0, 0.28); outline: 2px dashed var(--ios-orange); outline-offset: -3px; }
${S} .ph-slide { animation: ${NAME}-up 0.28s ease-out; }
@keyframes ${NAME}-up { from { transform: translateY(35%); opacity: 0.5; } to { transform: none; opacity: 1; } }
${S} .ph-proc { display: flex; flex-direction: column; align-items: center; gap: 0.3cqh; padding: 1.4cqh 4cqw 0.4cqh; text-align: center; }
${S} .ph-proc-tag { display: inline-flex; align-items: center; gap: 1.2cqw; font-size: 3cqw; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--ios-orange); }
${S} .ph-proc-tag svg { width: 3.4cqw; height: 3.4cqw; }
${S} .ph-proc-note { font-size: 3cqw; color: var(--ios-label-2); line-height: 1.25; }
${S} .ph-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0.6cqh 3cqw; }
${S} .ph-navbtn { appearance: none; border: 0; background: none; color: var(--ios-blue); font-family: inherit; font-size: 4cqw;
  line-height: 1.2; padding: 1.2cqw 1.6cqw; cursor: pointer; justify-self: start; border-radius: 2cqw; }
${S} .ph-navbtn.ph-right { justify-self: end; font-weight: 600; }
${S} .ph-navbtn:disabled { color: var(--ios-label-3); cursor: default; }
${S} .ph-navbtn:focus-visible, ${S} .ph-target:focus-visible, ${S} .ph-close:focus-visible, ${S} .ph-rowbtn:focus-visible {
  outline: 2px solid var(--focus); outline-offset: 1px; }
${S} .ph-navtitle { font-weight: 600; font-size: 4.2cqw; }
${S} .ph-hint { font-size: 3.2cqw; color: var(--ios-label-2); text-align: center; padding: 0 4cqw 0.8cqh; }
${S} .ph-grid { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6cqw;
  align-content: start; padding: 0 0 4cqh; }
${S} .ph-thumb { position: relative; appearance: none; border: 0; padding: 0; margin: 0; aspect-ratio: 1; cursor: pointer;
  background: none; display: block; width: 100%; }
${S} .ph-thumb .ph-art { border-radius: 0; }
${S} .ph-thumb:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; z-index: 1; }
${S} .ph-thumb[aria-pressed="true"]::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 0 2.5px var(--ios-blue); }
${S} .ph-thumb.ph-dim { opacity: 0.4; }
${S} .ph-badge { position: absolute; right: 1.2cqw; bottom: 1.2cqw; width: 6cqw; height: 6cqw; border-radius: 50%;
  background: var(--ios-blue); color: #fff; font-size: 3.4cqw; font-weight: 700; display: flex; align-items: center;
  justify-content: center; box-shadow: 0 0 0 1.5px #fff; }
${S} .ph-badge svg { width: 4cqw; height: 4cqw; }
${S} .ph-tagshot { position: absolute; left: 1cqw; top: 1cqw; font-size: 2.4cqw; font-weight: 600; background: rgba(0, 0, 0, 0.6);
  color: #fff; padding: 0.2cqw 1.2cqw; border-radius: 1cqw; }
${S} .ph-none { grid-column: 1 / -1; padding: 6cqw; text-align: center; color: var(--ios-label-2); font-size: 3.4cqw; }

${S} .ph-share { top: auto; max-height: 72cqh; padding-bottom: 5cqh; }
${S} .ph-share-head { display: flex; align-items: center; gap: 3cqw; padding: 1cqh 4cqw; border-bottom: 0.5px solid var(--ios-sep); }
${S} .ph-share-thumb { width: 12cqw; height: 12cqw; flex: 0 0 auto; }
${S} .ph-share-thumb .ph-art { border-radius: 2cqw; }
${S} .ph-share-title { flex: 1; min-width: 0; font-weight: 600; font-size: 4cqw; line-height: 1.2; }
${S} .ph-share-title small { display: block; font-weight: 400; font-size: 3.2cqw; color: var(--ios-label-2); }
${S} .ph-close { appearance: none; width: 7.5cqw; height: 7.5cqw; border-radius: 50%; background: var(--ios-fill); color: var(--ios-label-2);
  border: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; flex: 0 0 auto; }
${S} .ph-close svg { width: 4cqw; height: 4cqw; }
${S} .ph-targets { display: flex; justify-content: space-around; padding: 1.6cqh 2cqw 0.6cqh; }
${S} .ph-target { appearance: none; border: 0; background: none; display: flex; flex-direction: column; align-items: center; gap: 0.7cqh;
  font-family: inherit; font-size: 2.9cqw; color: var(--ios-label); cursor: pointer; padding: 1cqw; border-radius: 2cqw; }
${S} .ph-ticon { width: 12.5cqw; height: 12.5cqw; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; }
${S} .ph-ticon svg { width: 6cqw; height: 6cqw; }
${S} .ph-share .svk-list { margin: 1cqh 4cqw; background: var(--ios-card-2); }
${S} .ph-rowbtn { appearance: none; border: 0; background: none; width: 100%; text-align: left; font-family: inherit; color: var(--ios-label);
  justify-content: space-between; cursor: pointer; }
${S} .ph-rowbtn svg { width: 4.6cqw; height: 4.6cqw; color: var(--ios-label-2); }
${S} .ph-alert-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1cqw; margin-top: 2.4cqw; }
${S} .ph-alert-strip .ph-art { aspect-ratio: 1; height: auto; border-radius: 1.2cqw; }
`,

  mount(el, props = {}, ctx = {}) {
    el.classList.add(`w-${NAME}`);
    const icon = (name, size = 16) => (ctx.icon ? ctx.icon(name, size) : '');
    const reduced = !!ctx.reducedMotion;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
      timers.add(t);
    };
    const clearTimers = () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.clear(); };

    const fresh = () => ({
      filter: 'images',
      max: 1,
      full: false,
      phase: 'idle',      // idle | picker | selected | loading | shown | share
      sheet: null,        // null | picker | limited | share | alert
      picking: [],        // pids selected inside the open picker
      received: [],       // pids handed to the app as PhotosPickerItem values
      progress: [],       // 0..1 per received item
      shown: [],          // pids whose image the app is showing
      lib: 'notDetermined', // full-access mode: notDetermined | authorized | limited | denied
      libSet: [],
      alerts: 0,
      tab: 'see',
      log: [],
      slide: true,
    });
    let st = fresh();

    const log = (html, tone = '') => { st.log.unshift({ html, tone }); if (st.log.length > 40) st.log.pop(); };
    const tt = (s) => `<code>${esc(s)}</code>`;
    const visible = () => PHOTOS.filter((p) => FILTERS[st.filter].test(p));

    el.innerHTML = `<div class="ph-layout">
  <div class="ph-phonecol">${phoneHtml(`<div class="ph-app" id="${id('app')}"></div><div id="${id('overlay')}"></div>`, { label: 'Simulated iPhone running the Postcard app' })}</div>
  <div class="ph-controls svk-panel">
    <div class="ph-group" role="group" aria-label="PhotosPicker matching filter">
      <span class="svk-kicker">matching:</span>
      <button type="button" class="svk-ctl ph-ctl-sm" id="${id('filter-images')}" data-act="filter" data-filter="images" aria-label="matching .images"><code>.images</code></button>
      <button type="button" class="svk-ctl ph-ctl-sm" id="${id('filter-screenshots')}" data-act="filter" data-filter="screenshots" aria-label="matching .screenshots"><code>.screenshots</code></button>
      <button type="button" class="svk-ctl ph-ctl-sm" id="${id('filter-not')}" data-act="filter" data-filter="not" aria-label="matching .not(.screenshots)"><code>.not(.screenshots)</code></button>
    </div>
    <div class="ph-group" role="group" aria-label="maxSelectionCount">
      <span class="svk-kicker">maxSelectionCount:</span>
      <button type="button" class="svk-ctl ph-ctl-sm" id="${id('max-1')}" data-act="max" data-max="1" aria-label="maxSelectionCount 1"><span class="ph-short">max </span>1</button>
      <button type="button" class="svk-ctl ph-ctl-sm" id="${id('max-3')}" data-act="max" data-max="3" aria-label="maxSelectionCount 3"><span class="ph-short">max </span>3</button>
    </div>
    <div class="ph-group">
      <button type="button" class="svk-ctl ph-ctl-sm" id="${id('full')}" data-act="full" aria-pressed="false" aria-label="Ask for full library access instead"><span class="ph-long">Ask for full library access instead</span><span class="ph-short">Full access</span></button>
      <button type="button" class="svk-ctl ph-ctl-sm" id="${id('reset')}" data-act="reset">Reset</button>
    </div>
  </div>
  <div class="ph-tabs" role="tablist" aria-label="Inspector views">
    <button type="button" class="ph-tab" role="tab" id="${id('tab-see')}" data-act="tab" data-tab="see" aria-controls="${id('see')}">Can see</button>
    <button type="button" class="ph-tab" role="tab" id="${id('tab-code')}" data-act="tab" data-tab="code" aria-controls="${id('code')}">Code</button>
    <button type="button" class="ph-tab" role="tab" id="${id('tab-log')}" data-act="tab" data-tab="log" aria-controls="${id('log')}">Log</button>
  </div>
  <section class="ph-pane ph-codepane" id="${id('code')}" role="tabpanel" aria-labelledby="${id('tab-code')}">
    <p class="svk-kicker" id="${id('code-title')}"></p>
    <div class="ph-phases" id="${id('phases')}" aria-hidden="true"></div>
    <div class="svk-code" id="${id('code-body')}" tabindex="0" aria-label="Swift code; the highlighted lines run in the current step"></div>
  </section>
  <div class="ph-side">
    <section class="ph-pane ph-seepane" id="${id('see')}" role="tabpanel" aria-labelledby="${id('tab-see')}">
      <div class="ph-see" id="${id('see-body')}" aria-live="polite"></div>
    </section>
    <section class="ph-pane ph-logpane" id="${id('log')}" role="tabpanel" aria-labelledby="${id('tab-log')}">
      <p class="svk-kicker">Event log (newest first)</p>
      <div class="svk-log" id="${id('log-body')}" tabindex="0" aria-label="Event log"></div>
    </section>
  </div>
</div>`;

    const $ = (role) => el.querySelector(`#${id(role)}`);

    // ----- phone app -----
    function appHtml() {
      let card;
      let caption = '';
      let actions;
      if (!st.full) {
        if (st.phase === 'loading' || st.phase === 'selected') {
          const n = st.received.length;
          const done = st.progress.reduce((a, b) => a + b, 0) / Math.max(1, n);
          card = `<div class="ph-card ph-loading" role="status">
            <span>${st.phase === 'selected' ? 'Received' : 'Loading'} ${n} ${n === 1 ? 'photo' : 'photos'}…</span>
            <span class="ph-bar" aria-hidden="true"><i style="width:${Math.round(done * 100)}%"></i></span></div>`;
          caption = st.phase === 'selected' ? 'The selection arrived as PhotosPickerItem values.' : 'Loading the data through Transferable.';
        } else if (st.shown.length) {
          card = `<div class="ph-card"><div class="ph-shown" role="img" aria-label="Postcard showing ${st.shown.length} picked ${st.shown.length === 1 ? 'photo' : 'photos'}">${st.shown.map((pid) => art(BY_ID[pid])).join('')}</div></div>`;
          caption = st.shown.length === 1 ? 'Your postcard' : `Your postcard, ${st.shown.length} photos`;
        } else {
          card = `<div class="ph-card ph-empty">${icon('photo', 40)}<b>No photo yet</b><span>Choose a photo to make a postcard.</span></div>`;
        }
        const label = st.max === 1 ? 'Choose Photo' : 'Choose Photos';
        actions = `<button type="button" class="svk-btn" id="${id('choose')}" data-act="choose">${icon('photo', 16)}${label}</button>`;
        if (st.shown.length && (st.phase === 'shown' || st.phase === 'share')) {
          actions += `<button type="button" class="svk-btn svk-plain" id="${id('share')}" data-act="share" aria-label="Share (ShareLink)">${icon('square.and.arrow.up', 16)}Share</button>`;
        }
      } else {
        if (st.lib === 'authorized' || st.lib === 'limited') {
          const ids = st.libSet;
          card = ids.length
            ? `<div class="ph-card"><div class="ph-shown ph-lib" role="img" aria-label="The app reading ${ids.length} photos from the library">${ids.map((pid) => art(BY_ID[pid])).join('')}</div></div>`
            : `<div class="ph-card ph-empty">${icon('photo', 40)}<b>No photos shared</b><span>The user selected none.</span></div>`;
          caption = st.lib === 'authorized'
            ? `Postcard can read all ${ids.length} photos, screenshots included.`
            : `Postcard can read only the ${ids.length} the user selected.`;
        } else if (st.lib === 'denied') {
          card = `<div class="ph-card ph-empty">${icon('lock', 40)}<b>Photo access is off</b><span>Choosing a photo with the picker still works, with no permission.</span></div>`;
        } else {
          card = `<div class="ph-card ph-empty">${icon('photo', 40)}<b>Load your library</b><span>This path asks to read the photo library itself.</span></div>`;
        }
        actions = `<button type="button" class="svk-btn" id="${id('library')}" data-act="library">${icon('photo', 16)}Load Library</button>`;
      }
      return `<div class="svk-large-title">Postcard</div>${card}<div class="ph-caption">${esc(caption)}</div><div class="ph-actions">${actions}</div>`;
    }

    function pickerHtml(limited) {
      const vis = limited ? PHOTOS : visible();
      const limit = limited ? PHOTOS.length : st.max;
      const full = !limited && st.max > 1 && st.picking.length >= limit;
      const grid = vis.length ? vis.map((p) => {
        const n = st.picking.indexOf(p.pid);
        const on = n >= 0;
        const badge = on ? `<span class="ph-badge" aria-hidden="true">${limited || st.max === 1 ? icon('checkmark', 12) : n + 1}</span>` : '';
        return `<button type="button" class="ph-thumb${full && !on ? ' ph-dim' : ''}" id="${id(`photo-${p.pid}`)}" data-act="pick" data-pid="${p.pid}"
          aria-pressed="${on}" aria-label="${esc(p.label)}">${art(p)}${p.shot ? '<span class="ph-tagshot" aria-hidden="true">Screenshot</span>' : ''}${badge}</button>`;
      }).join('') : '<div class="ph-none">No items match this filter.</div>';
      const right = limited
        ? `<button type="button" class="ph-navbtn ph-right" id="${id('sheet-done')}" data-act="limited-done">Done</button>`
        : st.max > 1
          ? `<button type="button" class="ph-navbtn ph-right" id="${id('sheet-add')}" data-act="add" ${st.picking.length ? '' : 'disabled'}>Add${st.picking.length ? ` (${st.picking.length})` : ''}</button>`
          : '<span></span>';
      const hint = limited
        ? 'Postcard will be able to read only what you select.'
        : st.max === 1 ? 'Tap a photo to choose it.' : `Select up to ${st.max} photos.`;
      return `<div class="ph-scrim" aria-hidden="true"></div>
<div class="ph-sheet${st.slide && !reduced ? ' ph-slide' : ''}" role="dialog" aria-modal="true" aria-label="System photo picker: runs outside your app, which cannot see this grid">
  <div class="ph-proc"><span class="ph-proc-tag">${icon('lock.fill', 12)}System photo picker</span>
    <span class="ph-proc-note">Runs outside your app, which cannot see this grid.</span></div>
  <div class="ph-nav"><button type="button" class="ph-navbtn" id="${id('sheet-cancel')}" data-act="cancel">Cancel</button>
    <span class="ph-navtitle">${limited ? 'Select Photos' : 'Photos'}</span>${right}</div>
  <div class="ph-hint">${esc(hint)}</div>
  <div class="ph-grid" role="group" aria-label="${limited ? 'All photos' : `Photos matching ${FILTERS[st.filter].code}`}">${grid}</div>
</div>`;
    }

    function shareHtml() {
      const first = BY_ID[st.shown[0]];
      const targets = [
        ['Messages', 'bubble.left', '#34C759'],
        ['Mail', 'envelope', '#0A84FF'],
        ['Notes', 'doc.text', '#FF9F0A'],
        ['AirDrop', 'antenna.radiowaves.left.and.right', '#5E5CE6'],
      ];
      return `<div class="ph-scrim" aria-hidden="true"></div>
<div class="ph-sheet ph-share${st.slide && !reduced ? ' ph-slide' : ''}" role="dialog" aria-modal="true" aria-label="System share sheet">
  <div class="ph-proc"><span class="ph-proc-tag">${icon('lock.fill', 12)}System share sheet</span>
    <span class="ph-proc-note">The system shows the share sheet; your app only hands over the item.</span></div>
  <div class="ph-share-head"><span class="ph-share-thumb">${art(first)}</span>
    <span class="ph-share-title">Postcard<small>${st.shown.length === 1 ? 'Image' : `${st.shown.length} Images`}</small></span>
    <button type="button" class="ph-close" id="${id('share-close')}" data-act="share-close" aria-label="Close share sheet">${icon('xmark', 14)}</button></div>
  <div class="ph-targets">${targets.map(([label, sym, color]) => `<button type="button" class="ph-target" id="${id(`target-${label.toLowerCase()}`)}" data-act="target" data-target="${label}"><span class="ph-ticon" style="background:${color}">${icon(sym, 22)}</span>${label}</button>`).join('')}</div>
  <div class="svk-list">
    <button type="button" class="svk-row ph-rowbtn" id="${id('target-copy')}" data-act="target" data-target="Copy">Copy${icon('doc', 18)}</button>
    <button type="button" class="svk-row ph-rowbtn" id="${id('target-files')}" data-act="target" data-target="Save to Files">Save to Files${icon('folder', 18)}</button>
  </div>
</div>`;
    }

    function alertHtml() {
      const strip = ['sunset', 'peaks', 'city', 'chat'].map((pid) => art(BY_ID[pid])).join('');
      return `<div class="svk-scrim"><div class="svk-alert" role="alertdialog" aria-modal="true" aria-labelledby="${id('alert-title')}">
  <div class="svk-alert-title" id="${id('alert-title')}">“Postcard” Would Like to Access Your Photos</div>
  <div class="svk-alert-msg">${esc(PURPOSE)}</div>
  <div class="ph-alert-strip" aria-hidden="true">${strip}</div>
  <div class="svk-alert-btns">
    <button type="button" class="svk-alert-btn" id="${id('alert-limit')}" data-act="alert-limit">Limit Access…</button>
    <button type="button" class="svk-alert-btn" id="${id('alert-full')}" data-act="alert-full">Allow Full Access</button>
    <button type="button" class="svk-alert-btn svk-strong" id="${id('alert-deny')}" data-act="alert-deny">Don’t Allow</button>
  </div></div></div>`;
    }

    function renderPhone() {
      $('app').innerHTML = appHtml();
      const o = $('overlay');
      if (st.sheet === 'picker') o.innerHTML = pickerHtml(false);
      else if (st.sheet === 'limited') o.innerHTML = pickerHtml(true);
      else if (st.sheet === 'share') o.innerHTML = shareHtml();
      else if (st.sheet === 'alert') o.innerHTML = alertHtml();
      else o.innerHTML = '';
      // Only animate a sheet the first time it appears, not on every re-render.
      st.slide = false;
    }

    // ----- inspector panels -----
    function renderControls() {
      for (const f of Object.keys(FILTERS)) $(`filter-${f}`).setAttribute('aria-pressed', String(st.filter === f));
      $('max-1').setAttribute('aria-pressed', String(st.max === 1));
      $('max-3').setAttribute('aria-pressed', String(st.max === 3));
      $('full').setAttribute('aria-pressed', String(st.full));
      el.querySelectorAll('.ph-tab').forEach((t) => {
        const on = t.dataset.tab === st.tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      for (const p of ['see', 'code', 'log']) $(p).classList.toggle('ph-active', st.tab === p);
      // In the narrow side-by-side layout the code needs the full width, so the
      // Code tab temporarily hides the phone (CSS decides when that applies).
      el.querySelector('.ph-layout').classList.toggle('ph-codeonly', st.tab === 'code');
    }

    function renderCode() {
      if (st.full) {
        const key = st.sheet === 'alert' ? 'asking' : st.sheet === 'limited' ? 'limited' : st.lib;
        $('code-title').textContent = 'Swift for full library access (not needed for picking)';
        $('phases').innerHTML = `<span class="ph-phase ph-now">PHPhotoLibrary: .${st.sheet === 'alert' ? 'notDetermined (asking)' : st.lib}</span>`;
        $('code-body').innerHTML = codeHtml(FULL_CODE, new Set(FULL_MARKS[key] || []));
        return;
      }
      const lines = st.max === 1 ? singleCode(st.filter) : multiCode(st.filter);
      const marks = st.max === 1 ? SINGLE_MARKS : MULTI_MARKS;
      const titles = {
        idle: 'Swift: the PhotosPicker button is on screen',
        picker: 'Step 1: the system picker is open',
        selected: 'Step 2: the selection binding changed',
        loading: 'Step 3: loadTransferable runs',
        shown: 'Step 4: the image is on screen',
        share: 'Step 5: ShareLink hands it to the system',
      };
      $('code-title').textContent = titles[st.phase];
      const order = PHASES.map(([k]) => k);
      const now = order.indexOf(st.phase);
      $('phases').innerHTML = PHASES.map(([k, label], i) => {
        const cls = i === now ? ' ph-now' : now > i ? ' ph-done' : '';
        return `<span class="ph-phase${cls}">${i + 1} ${label}</span>`;
      }).join('');
      $('code-body').innerHTML = codeHtml(lines, new Set(marks[st.phase] || []));
    }

    function renderSee() {
      const chips = [];
      let big;
      let tone = '';
      let body;
      if (!st.full) {
        const n = st.received.length;
        if (!n) {
          big = st.sheet === 'picker' ? 'Still nothing' : 'Nothing yet';
          body = st.sheet === 'picker'
            ? '<p>The grid belongs to the system picker, a separate process. Your app cannot read it, scroll it, or know what is in it.</p>'
            : '<p>No permission alert was shown, and none is needed: PhotosPicker runs outside your app and hands over only what the user picks.</p>';
        } else {
          big = `${n} ${n === 1 ? 'photo' : 'photos'}, only what the user picked`;
          tone = 'ph-good';
          const items = st.received.map((pid, i) => {
            const p = BY_ID[pid];
            const pct = Math.round((st.progress[i] || 0) * 100);
            const data = st.progress[i] >= 1 ? `<b>Data</b> ${fmtBytes(p.bytes)}` : `loading ${pct}%`;
            return `<li><b>PhotosPickerItem ${i + 1}</b> · ${utType(p)}<br>${data}</li>`;
          }).join('');
          body = `<ul>${items}</ul>`;
        }
        chips.push(`<span class="svk-chip ph-chip-ok">Permission alerts shown: 0</span>`);
        chips.push(`<span class="svk-chip">Items visible: ${n} of ${PHOTOS.length}</span>`);
      } else {
        const shots = st.libSet.filter((pid) => BY_ID[pid].shot).length;
        if (st.lib === 'authorized') {
          big = `All ${st.libSet.length} photos`;
          tone = 'ph-bad';
          body = `<p>Every photo in the library, including ${shots} screenshots the user never meant to share.</p>`;
        } else if (st.lib === 'limited') {
          big = `${st.libSet.length} selected ${st.libSet.length === 1 ? 'photo' : 'photos'}`;
          body = '<p>Limited access: only the photos the user chose in the system’s own picker.</p>';
        } else if (st.lib === 'denied') {
          big = 'Nothing';
          body = '<p>The user said no. The app should offer PhotosPicker, which needs no permission.</p>';
        } else {
          big = 'Nothing yet';
          body = '<p>Load Library will ask for permission first.</p>';
        }
        body += `<p>This path needs ${tt('NSPhotoLibraryUsageDescription')} in Info.plist: “${esc(PURPOSE)}” It is unnecessary for picking; PhotosPicker needs no key and no alert.</p>`;
        chips.push(`<span class="svk-chip${st.alerts ? ' ph-chip-bad' : ''}">Permission alerts shown: ${st.alerts}</span>`);
        chips.push(`<span class="svk-chip">Items visible: ${st.libSet.length} of ${PHOTOS.length}</span>`);
      }
      $('see-body').innerHTML = `<p class="svk-kicker">What your app can see</p>
        <div class="ph-see-big ${tone}">${esc(big)}</div>${body}<div class="ph-meter">${chips.join('')}</div>`;
    }

    function renderLog() {
      $('log-body').innerHTML = st.log.length
        ? st.log.map((e) => `<div class="${e.tone ? `svk-${e.tone}` : ''}">${e.html}</div>`).join('')
        : '<div>Tap Choose Photo on the phone to begin.</div>';
    }

    function render(focusRole) {
      const active = document.activeElement;
      const keep = active && el.contains(active) ? active.id : '';
      renderPhone();
      renderControls();
      renderCode();
      renderSee();
      renderLog();
      const target = focusRole ? $(focusRole) : keep ? el.querySelector(`#${keep}`) : null;
      if (target) target.focus({ preventScroll: true });
    }

    // ----- the PhotosPicker journey -----
    function finishPick() {
      const picked = st.picking.slice();
      st.sheet = null;
      st.picking = [];
      if (!picked.length) { st.phase = st.shown.length ? 'shown' : 'idle'; return; }
      st.received = picked;
      st.progress = picked.map(() => 0);
      st.phase = 'selected';
      log(`The picker closed and set ${tt(st.max === 1 ? 'item' : 'items')} to ${picked.length} ${tt('PhotosPickerItem')} ${picked.length === 1 ? 'value' : 'values'}. Changing the binding restarts ${tt(st.max === 1 ? '.task(id: item)' : '.task(id: items)')}.`, 'ok');
      if (reduced) {
        st.progress = picked.map(() => 1);
        picked.forEach((pid) => log(`${tt('loadTransferable(type: Data.self)')} returned ${fmtBytes(BY_ID[pid].bytes)}.`));
        showLoaded();
        return;
      }
      later(() => {
        st.phase = 'loading';
        render();
        loadNext(0);
      }, 700);
    }

    // Loads the received items one at a time, like the for-in loop in the code.
    function loadNext(i) {
      if (i >= st.received.length) { showLoaded(); render(); return; }
      const step = 0.2;
      const tick = () => {
        st.progress[i] = Math.min(1, (st.progress[i] || 0) + step);
        if (st.progress[i] >= 1) {
          log(`${tt('loadTransferable(type: Data.self)')} returned ${fmtBytes(BY_ID[st.received[i]].bytes)}.`);
          render();
          later(() => loadNext(i + 1), 120);
          return;
        }
        render();
        later(tick, 110);
      };
      later(tick, 110);
    }

    function showLoaded() {
      st.shown = st.received.slice();
      st.phase = 'shown';
      log(`The app built ${st.shown.length === 1 ? 'an Image' : `${st.shown.length} Images`} from the data and showed ${st.shown.length === 1 ? 'it' : 'them'}. It never learned the photo's name, album or location, only the bytes.`, 'ok');
    }

    function onClick(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn || !el.contains(btn) || btn.disabled) return;
      const act = btn.dataset.act;
      let focus = '';
      switch (act) {
        case 'choose':
          clearTimers();
          st.sheet = 'picker';
          st.slide = true;
          st.picking = [];
          st.phase = 'picker';
          log(`${tt('PhotosPicker')} opened the system picker with ${tt(`matching: ${FILTERS[st.filter].code}`)} (${FILTERS[st.filter].text}). No permission alert: the picker runs in its own process.`);
          focus = 'sheet-cancel';
          break;
        case 'pick': {
          const pid = btn.dataset.pid;
          if (st.sheet === 'limited') {
            const i = st.picking.indexOf(pid);
            if (i >= 0) st.picking.splice(i, 1); else st.picking.push(pid);
            focus = `photo-${pid}`;
            break;
          }
          if (st.max === 1) {
            st.picking = [pid];
            log('The user tapped a photo. With a single selection the picker closes at once.');
            finishPick();
            focus = 'choose';
            break;
          }
          const i = st.picking.indexOf(pid);
          if (i >= 0) st.picking.splice(i, 1);
          else if (st.picking.length < st.max) st.picking.push(pid);
          else log(`The picker allows at most ${st.max} (maxSelectionCount). Deselect one first.`, 'warn');
          focus = `photo-${pid}`;
          break;
        }
        case 'add':
          log(`The user tapped Add with ${st.picking.length} selected.`);
          finishPick();
          focus = 'choose';
          break;
        case 'cancel':
          if (st.sheet === 'limited') {
            st.sheet = null;
            st.picking = [];
            st.lib = 'limited';
            st.libSet = [];
            log(`The user canceled the selection. Status is ${tt('.limited')} with no photos shared.`);
            focus = 'library';
            break;
          }
          st.sheet = null;
          st.picking = [];
          st.phase = st.shown.length ? 'shown' : 'idle';
          log('The user tapped Cancel. The binding did not change, so your app learned nothing at all.');
          focus = 'choose';
          break;
        case 'share':
          st.sheet = 'share';
          st.slide = true;
          st.phase = 'share';
          log(`${tt('ShareLink')} handed ${st.shown.length === 1 ? 'the image' : `${st.shown.length} images`} to the system share sheet, with ${tt('SharePreview')} as the title and thumbnail.`);
          focus = 'share-close';
          break;
        case 'share-close':
          st.sheet = null;
          st.phase = 'shown';
          log('The share sheet closed without sharing.');
          focus = 'share';
          break;
        case 'target':
          st.sheet = null;
          st.phase = 'shown';
          log(`The user chose ${esc(btn.dataset.target)} (simulated). The system did the sending; SwiftUI's ${tt('ShareLink')} does not even tell your app where the item went.`, 'ok');
          focus = 'share';
          break;
        case 'filter':
          st.filter = btn.dataset.filter;
          if (st.sheet === 'picker') st.picking = st.picking.filter((pid) => FILTERS[st.filter].test(BY_ID[pid]));
          log(`${tt(`matching: ${FILTERS[st.filter].code}`)}: the picker now offers ${FILTERS[st.filter].text} (${visible().length} of ${PHOTOS.length} items).`);
          focus = `filter-${st.filter}`;
          break;
        case 'max': {
          const max = Number(btn.dataset.max);
          if (max !== st.max) {
            clearTimers();
            Object.assign(st, { max, sheet: null, picking: [], received: [], progress: [], shown: [], phase: 'idle' });
            log(max === 1
              ? `${tt('maxSelectionCount')} back to 1: the binding is a single optional ${tt('PhotosPickerItem?')}.`
              : `${tt('maxSelectionCount: 3')}: the binding becomes an array, ${tt('[PhotosPickerItem]')}, and the picker shows an Add button.`);
          }
          focus = `max-${max}`;
          break;
        }
        case 'full':
          clearTimers();
          Object.assign(st, { full: !st.full, sheet: null, picking: [], received: [], progress: [], shown: [], phase: 'idle' });
          log(st.full
            ? `Full library access mode: the app calls ${tt('PHPhotoLibrary.requestAuthorization(for: .readWrite)')} to read the library itself.`
            : 'Back to PhotosPicker: no permission needed.');
          focus = 'full';
          break;
        case 'library':
          if (st.lib === 'notDetermined') {
            st.sheet = 'alert';
            st.alerts += 1;
            log(`${tt('requestAuthorization(for: .readWrite)')} showed the system alert with your ${tt('NSPhotoLibraryUsageDescription')} text. iOS shows it only once.`, 'warn');
            focus = 'alert-limit';
          } else {
            log(`Status is already ${tt(`.${st.lib}`)}, so iOS does not ask again. The user can change it in Settings.`);
            focus = 'library';
          }
          break;
        case 'alert-full':
          st.sheet = null;
          st.lib = 'authorized';
          st.libSet = PHOTOS.map((p) => p.pid);
          log(`Allow Full Access: status ${tt('.authorized')}. Postcard can now read all ${PHOTOS.length} photos, screenshots included.`, 'bad');
          focus = 'library';
          break;
        case 'alert-limit':
          st.sheet = 'limited';
          st.slide = true;
          st.picking = [];
          log('Limit Access: the system shows its own picker so the user decides exactly what the app may read.');
          focus = 'sheet-cancel';
          break;
        case 'limited-done':
          st.lib = 'limited';
          st.libSet = st.picking.slice();
          st.sheet = null;
          st.picking = [];
          log(`Status ${tt('.limited')}: Postcard can read ${st.libSet.length} ${st.libSet.length === 1 ? 'photo' : 'photos'}.`, 'ok');
          focus = 'library';
          break;
        case 'alert-deny':
          st.sheet = null;
          st.lib = 'denied';
          st.libSet = [];
          log(`Don’t Allow: status ${tt('.denied')}. Postcard can read nothing, but PhotosPicker would still work.`);
          focus = 'library';
          break;
        case 'reset':
          clearTimers();
          st = fresh();
          log('Reset: fresh install, nothing picked, no permission decisions.');
          focus = 'reset';
          break;
        case 'tab':
          st.tab = btn.dataset.tab;
          focus = `tab-${st.tab}`;
          break;
        default:
          return;
      }
      render(focus);
    }

    function onKey(e) {
      const tab = e.target.closest('.ph-tab');
      if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const order = ['see', 'code', 'log'];
        const i = order.indexOf(tab.dataset.tab);
        st.tab = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
        e.preventDefault();
        render(`tab-${st.tab}`);
        return;
      }
      if (e.key === 'Escape' && st.sheet && st.sheet !== 'alert') {
        e.preventDefault();
        const closer = st.sheet === 'share' ? 'share-close' : 'sheet-cancel';
        $(closer)?.click();
      }
    }

    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    render();

    return {
      destroy() {
        clearTimers();
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
