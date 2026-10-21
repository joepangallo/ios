// VoiceOver simulator: one product card in a "Before" and an "After (fixed)"
// version. Students move the VoiceOver cursor element by element and see (and
// optionally hear) exactly what VoiceOver announces: label, value, traits, then
// hint. The Before version reproduces real SwiftUI defaults: asset images are
// announced by their file names, every star is its own stop, and a colored
// Circle is skipped entirely because a shape has no accessibility element.

import { esc, idScope, snapshotHost, iosThemeCss, phoneFrameCss } from './services-kit.js';

const NAME = 'design-voiceover-sim';
let instances = 0;

// Which visible part of the card each stop outlines, per version.
function buildStops(version, st) {
  if (version === 'before') {
    const star = (i, full) => ({
      key: `star${i}`, part: `star${i}`, label: full ? 'star_full' : 'star_empty', traits: ['image'],
      tone: 'bad', title: 'Five stops for one fact',
      note: 'Each star is a separate image announced by its file name. Five swipes, and nobody hears “4 out of 5”.',
      code: '.accessibilityElement(children: .ignore)\n.accessibilityLabel("Rated 4 out of 5 stars")',
    });
    return [
      { key: 'photo', part: 'photo', label: 'IMG_2041', traits: ['image'], tone: 'bad', title: 'File name, not a description',
        note: 'An asset image with no label is announced by its file name. People hear “IMG 2041” instead of what the photo shows.',
        code: 'Image("IMG_2041", label: Text("Lemon pasta with basil"))' },
      { key: 'divider', part: 'divider', label: 'divider-leaves', traits: ['image'], tone: 'bad', title: 'Decoration costs a swipe',
        note: 'Pure ornament still gets its own stop, and it reads its file name too.',
        code: 'Image(decorative: "divider-leaves")' },
      { key: 'title', part: 'title', label: 'Lemon Pasta Kit', traits: [], tone: 'warn', title: 'Readable, but not a heading',
        note: 'The name is spoken correctly, but people who jump between headings with the rotor skip right past it.',
        code: '.accessibilityAddTraits(.isHeader)' },
      { key: 'price', part: 'price', label: '$14.50', traits: [], tone: 'warn', title: 'Correct, but scattered',
        note: 'The price is fine on its own, but it is one of six separate stops for a single line of facts.',
        code: 'HStack { … }\n    .accessibilityElement(children: .combine)' },
      star(1, true), star(2, true), star(3, true), star(4, true), star(5, false),
      { key: 'favorite', part: 'favorite', label: 'icon-heart-outline', traits: ['button'], tone: 'bad', title: 'Which button is this?',
        note: st.favorite
          ? 'You turned it on and the heart filled in, yet VoiceOver still reads the same file name. The state change is invisible without sight.'
          : 'An icon-only button built from a custom image reads its file name. It never says what it does or whether it is on.',
        code: '.accessibilityLabel("Favorite")\n.accessibilityValue(isFavorite ? "Saved" : "Not saved")' },
      { key: 'share', part: 'share', label: 'icn_share_2', traits: ['button'], tone: 'bad', title: 'Another file name',
        note: 'Voice Control users would have to say “Tap icn share 2” to press this.',
        code: '.accessibilityLabel("Share")' },
      { key: 'cart', part: 'cart', label: st.cart ? 'Added to Cart' : 'Add to Cart', traits: ['button'], tone: 'ok', title: 'Already accessible',
        note: 'A text button is accessible by default: its title becomes the label and Button adds the trait.',
        code: 'Button("Add to Cart") { … }' },
    ];
  }
  return [
    { key: 'photo', part: 'photo', label: 'Lemon pasta with basil in a white bowl', traits: ['image'], tone: 'ok', title: 'Describes the photo',
      note: 'A short description of what matters in the photo replaces the file name. The decorative divider below is now skipped on purpose.',
      code: 'Image("IMG_2041", label: Text("Lemon pasta with basil…"))\nImage(decorative: "divider-leaves")' },
    { key: 'title', part: 'title', label: 'Lemon Pasta Kit', traits: ['heading'], tone: 'ok', title: 'Now a heading',
      note: 'Marked as a heading, so the rotor’s Headings mode jumps straight to the product name.',
      code: 'Text("Lemon Pasta Kit")\n    .accessibilityAddTraits(.isHeader)' },
    { key: 'info', part: 'info', label: '$14.50, Rated 4 out of 5 stars, In stock', traits: [], tone: 'ok', title: 'One stop for one line of facts',
      note: 'Price, rating and stock status are combined. The stars sit behind one label, and the status now has a visible word, not only a color.',
      code: 'HStack { … }\n    .accessibilityElement(children: .combine)' },
    { key: 'favorite', part: 'favorite', label: 'Favorite', value: st.favorite ? 'Saved' : 'Not saved', traits: ['button'],
      hint: 'Adds or removes it from Favorites.', tone: 'ok', title: 'Label, value and hint',
      note: 'The label says what it is, the value says its state, and the hint says what activating does. Try Double-tap and listen to the value change.',
      code: '.accessibilityLabel("Favorite")\n.accessibilityValue(isFavorite ? "Saved" : "Not saved")\n.accessibilityHint("Adds or removes it from Favorites.")' },
    { key: 'share', part: 'share', label: 'Share', traits: ['button'], hint: 'Opens options for sending this kit.', tone: 'ok', title: 'Named by its action',
      note: 'Voice Control users can now say “Tap Share”, and VoiceOver users know what the button does.',
      code: '.accessibilityLabel("Share")\n.accessibilityHint("Opens options for sending this kit.")' },
    { key: 'cart', part: 'cart', label: st.cart ? 'Added to Cart' : 'Add to Cart', traits: ['button'], tone: 'ok', title: 'Unchanged',
      note: 'It was already accessible. Standard controls with text need no extra code.',
      code: 'Button("Add to Cart") { … }' },
  ];
}

// When switching versions, land on the stop that covers the same content.
const BEFORE_TO_AFTER = { photo: 'photo', divider: 'title', title: 'title', price: 'info', star1: 'info', star2: 'info', star3: 'info', star4: 'info', star5: 'info', favorite: 'favorite', share: 'share', cart: 'cart' };
const AFTER_TO_BEFORE = { photo: 'photo', title: 'title', info: 'price', favorite: 'favorite', share: 'share', cart: 'cart' };

// Parts of the card that VoiceOver does not visit, and why.
const SILENT = {
  before: {
    dot: { title: 'Never announced', tone: 'bad', note: 'The green dot means “In stock”, but it is a Circle filled with a color. A shape has no accessibility element and no words, so VoiceOver skips it, and people who cannot tell green from red miss it too.', code: 'Circle().fill(.green)\nText("In stock")   // add a word' },
  },
  after: {
    divider: { title: 'Skipped on purpose', tone: 'ok', note: 'The divider is decorative, so it is hidden from VoiceOver. One less swipe on every visit to this screen.', code: 'Image(decorative: "divider-leaves")' },
  },
};

const TRAIT_WORD = { image: 'image', button: 'button', heading: 'heading' };

export default {
  name: 'design-voiceover-sim',
  css: `
${iosThemeCss('.w-design-voiceover-sim')}
.w-design-voiceover-sim {
  box-sizing:border-box; height:100%; width:100%; container-type:inline-size; min-height:0;
  font-family:var(--font-ui); color:var(--ink);
}
.w-design-voiceover-sim * { box-sizing:border-box; }
.w-design-voiceover-sim .vo-root { height:100%; display:grid; gap:8px; padding:10px; min-height:0;
  grid-template-columns:minmax(0,1fr); grid-template-rows:auto auto auto auto auto auto auto; align-content:start; }

/* ---------- phone ---------- */
.w-design-voiceover-sim .vo-phonewrap { min-height:0; display:flex; justify-content:center; }
${phoneFrameCss('.w-design-voiceover-sim', { frame: '.vo-phone', radius: '26px', pad: '6px' })}
.w-design-voiceover-sim .vo-phone { width:100%; max-width:330px; }
.w-design-voiceover-sim .vo-screen { position:relative; border-radius:20px; overflow:hidden; background:var(--ios-bg); color:var(--ios-label);
  font-family:-apple-system, "SF Pro Text", system-ui, sans-serif; display:flex; flex-direction:column; outline:none; cursor:default; }
.w-design-voiceover-sim .vo-screen:focus-visible { outline:2px solid var(--focus); outline-offset:4px; }
.w-design-voiceover-sim .vo-status { display:none; }
.w-design-voiceover-sim .vo-photo { margin:8px 8px 0; height:76px; border-radius:12px; position:relative; overflow:hidden; flex:none;
  background:
    radial-gradient(circle at 30% 40%, #5c9a3c 0 3%, transparent 3.5%),
    radial-gradient(circle at 62% 34%, #5c9a3c 0 2.6%, transparent 3%),
    radial-gradient(circle at 55% 66%, #6aa846 0 2.8%, transparent 3.3%),
    repeating-radial-gradient(circle at 48% 52%, #f3d36b 0 2px, #e9be4d 2px 4px),
    #c08a5b; }
.w-design-voiceover-sim .vo-photo::before { content:""; position:absolute; top:10%; bottom:10%; left:50%; aspect-ratio:1; transform:translateX(-50%); border-radius:50%; background:#fbfaf6; box-shadow:0 3px 10px rgba(0,0,0,.25); }
.w-design-voiceover-sim .vo-photo::after { content:""; position:absolute; top:22%; bottom:22%; left:50%; aspect-ratio:1; transform:translateX(-50%); border-radius:50%;
  background:radial-gradient(circle at 40% 45%, #6aa846 0 6%, transparent 7%), radial-gradient(circle at 62% 60%, #5c9a3c 0 5%, transparent 6%), repeating-radial-gradient(circle at 50% 50%, #f5d878 0 2px, #e2b443 2px 4px); }
.w-design-voiceover-sim .vo-file { position:absolute; left:6px; bottom:5px; font:9px var(--font-code); color:#fff; background:rgba(0,0,0,.45); border-radius:4px; padding:1px 4px; z-index:1; }
.w-design-voiceover-sim .vo-divider { display:flex; align-items:center; gap:6px; margin:6px 22px 0; color:var(--ios-green); flex:none; }
.w-design-voiceover-sim .vo-divider i { flex:1; height:1px; background:var(--ios-sep); }
.w-design-voiceover-sim .vo-title { margin:3px 12px 0; font-size:17px; font-weight:700; align-self:flex-start; flex:none; }
.w-design-voiceover-sim .vo-info { display:flex; align-items:center; gap:6px; margin:4px 12px 0; font-size:12px; align-self:flex-start; flex:none; padding:1px 0; }
.w-design-voiceover-sim .vo-price { font-weight:600; }
.w-design-voiceover-sim .vo-stars { display:flex; gap:1px; color:var(--ios-orange); }
.w-design-voiceover-sim .vo-stars span { display:flex; }
.w-design-voiceover-sim .vo-dot { width:9px; height:9px; border-radius:50%; background:var(--ios-green); margin-left:4px; }
.w-design-voiceover-sim .vo-stock { color:var(--ios-green); font-weight:600; font-size:11.5px; }
.w-design-voiceover-sim .vo-actions { display:flex; gap:8px; margin:9px 12px 12px; align-items:center; flex:none; }
.w-design-voiceover-sim .vo-icbtn { width:34px; height:34px; border-radius:50%; background:var(--ios-fill); color:var(--ios-blue); display:flex; align-items:center; justify-content:center; flex:none; }
.w-design-voiceover-sim .vo-icbtn.vo-on { color:var(--ios-red); }
.w-design-voiceover-sim .vo-cart { flex:1; height:34px; border-radius:17px; background:var(--ios-blue); color:#fff; display:flex; align-items:center; justify-content:center; gap:5px; font-size:12.5px; font-weight:600; }
.w-design-voiceover-sim [data-part] { cursor:pointer; }
.w-design-voiceover-sim .vo-caption { display:none; }
.w-design-voiceover-sim .vo-cursor { position:absolute; border:3px solid #111; border-radius:9px; box-shadow:0 0 0 2px #fff, inset 0 0 0 2px #fff; pointer-events:none; z-index:3;
  transition:left .16s ease, top .16s ease, width .16s ease, height .16s ease; }
.w-design-voiceover-sim.vo-still .vo-cursor { transition:none; }
.w-design-voiceover-sim .vo-cursor[hidden] { display:none; }

/* ---------- panel ---------- */
.w-design-voiceover-sim .vo-panel { display:contents; }
.w-design-voiceover-sim .vo-top { order:-1; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.w-design-voiceover-sim .vo-seg { display:inline-flex; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:2px; gap:2px; }
.w-design-voiceover-sim .vo-seg button { font:600 13px var(--font-ui); color:var(--ink-2); background:transparent; border:0; border-radius:8px; padding:5px 12px; cursor:pointer; }
.w-design-voiceover-sim .vo-seg button[aria-checked="true"] { background:var(--panel); color:var(--ink); box-shadow:0 1px 2px rgba(0,0,0,.12); }
.w-design-voiceover-sim .vo-count { font:600 12.5px var(--font-ui); color:var(--ink-2); font-variant-numeric:tabular-nums; }
.w-design-voiceover-sim .vo-count b { color:var(--ink); }
.w-design-voiceover-sim .vo-say { background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:8px 11px; }
.w-design-voiceover-sim .vo-kicker { font:600 10.5px var(--font-ui); letter-spacing:.6px; text-transform:uppercase; color:var(--ink-3); }
.w-design-voiceover-sim .vo-said { font:500 15.5px/1.35 var(--font-ui); margin-top:2px; min-height:1.35em; overflow-wrap:anywhere; }
.w-design-voiceover-sim .vo-said .p-label { color:var(--ink); font-weight:650; }
.w-design-voiceover-sim .vo-said .p-value { color:var(--accent-ink); font-weight:650; }
.w-design-voiceover-sim .vo-said .p-traits { color:var(--link); }
.w-design-voiceover-sim .vo-said .p-hint { color:var(--ink-3); font-style:italic; }
.w-design-voiceover-sim .vo-said .p-quiet { color:var(--ink-3); font-style:italic; }
.w-design-voiceover-sim .vo-parts { display:flex; flex-wrap:wrap; gap:4px 6px; margin-top:6px; }
.w-design-voiceover-sim .vo-chip { font:12px/1.3 var(--font-ui); border:1px solid var(--line); border-left-width:3px; border-radius:6px; padding:2px 6px; background:var(--panel); color:var(--ink-2); max-width:100%; overflow-wrap:anywhere; }
.w-design-voiceover-sim .vo-chip b { font-weight:650; color:var(--ink); }
.w-design-voiceover-sim .vo-chip.c-label { border-left-color:var(--ink); }
.w-design-voiceover-sim .vo-chip.c-value { border-left-color:var(--accent); }
.w-design-voiceover-sim .vo-chip.c-traits { border-left-color:var(--link); }
.w-design-voiceover-sim .vo-chip.c-hint { border-left-color:var(--ink-3); }
.w-design-voiceover-sim .vo-chip.c-none b { color:var(--ink-3); font-weight:500; }
.w-design-voiceover-sim .vo-note { border-radius:var(--r-md); padding:7px 10px; border:1px solid var(--line); display:grid; grid-template-columns:auto minmax(0,1fr); gap:2px 8px; align-items:start; }
.w-design-voiceover-sim .vo-note.t-bad { background:var(--bad-soft); }
.w-design-voiceover-sim .vo-note.t-warn { background:var(--warn-soft); }
.w-design-voiceover-sim .vo-note.t-ok { background:var(--ok-soft); }
.w-design-voiceover-sim .vo-note .vo-nic { display:flex; margin-top:1px; }
.w-design-voiceover-sim .vo-note.t-bad .vo-nic { color:var(--bad); }
.w-design-voiceover-sim .vo-note.t-warn .vo-nic { color:var(--warn); }
.w-design-voiceover-sim .vo-note.t-ok .vo-nic { color:var(--ok); }
.w-design-voiceover-sim .vo-ntitle { font-weight:700; font-size:13px; }
.w-design-voiceover-sim .vo-ntext { grid-column:2; font-size:12.5px; line-height:1.4; color:var(--ink-2); }
.w-design-voiceover-sim .vo-ncode { grid-column:2; margin:3px 0 0; font:11.5px/1.4 var(--font-code); color:var(--type); background:var(--code-bg); border:1px solid var(--line); border-radius:var(--r-sm); padding:3px 6px; white-space:pre-wrap; overflow-wrap:anywhere; }
.w-design-voiceover-sim .vo-ctrls { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.w-design-voiceover-sim .vo-btn { display:inline-flex; align-items:center; gap:5px; font:600 13px var(--font-ui); color:var(--ink); background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:6px 10px; cursor:pointer; }
.w-design-voiceover-sim .vo-btn:hover { border-color:var(--ink-3); }
.w-design-voiceover-sim .vo-btn.vo-primary { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
.w-design-voiceover-sim .vo-btn:disabled { opacity:.5; cursor:not-allowed; }
.w-design-voiceover-sim .vo-check { display:inline-flex; align-items:center; gap:5px; font-size:12.5px; color:var(--ink-2); cursor:pointer; }
.w-design-voiceover-sim .vo-strip { display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:12px; color:var(--ink-2); }
.w-design-voiceover-sim .vo-dots { display:flex; gap:3px; flex-wrap:wrap; }
.w-design-voiceover-sim .vo-dotbtn { width:20px; height:20px; border-radius:50%; border:1px solid var(--line); background:var(--panel-2); color:var(--ink-2); font:600 10px var(--font-ui); padding:0; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.w-design-voiceover-sim .vo-dotbtn.t-bad { border-color:var(--bad); }
.w-design-voiceover-sim .vo-dotbtn.t-warn { border-color:var(--warn); }
.w-design-voiceover-sim .vo-dotbtn.t-ok { border-color:var(--ok); }
.w-design-voiceover-sim .vo-dotbtn[aria-current="true"] { background:var(--ink); color:var(--panel); border-color:var(--ink); }
.w-design-voiceover-sim .vo-miss { font-size:11.5px; border-radius:999px; padding:1px 8px; background:var(--bad-soft); color:var(--bad); font-weight:600; }
.w-design-voiceover-sim .vo-miss.t-ok { background:var(--ok-soft); color:var(--ok); }
.w-design-voiceover-sim button:focus-visible, .w-design-voiceover-sim input:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-design-voiceover-sim .vo-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

/* ---------- narrow stage (phones): compress so everything fits ~600 px ---------- */
@container (max-width: 619.98px) {
  .w-design-voiceover-sim .vo-root { gap:7px; padding:8px; }
  .w-design-voiceover-sim .vo-phone { padding:5px; border-radius:22px; }
  .w-design-voiceover-sim .vo-screen { border-radius:17px; }
  .w-design-voiceover-sim .vo-photo { height:56px; margin:6px 6px 0; }
  .w-design-voiceover-sim .vo-divider { margin-top:4px; }
  .w-design-voiceover-sim .vo-title { font-size:15px; margin-top:2px; }
  .w-design-voiceover-sim .vo-info { margin-top:2px; font-size:11.5px; }
  .w-design-voiceover-sim .vo-actions { margin:6px 10px 8px; }
  .w-design-voiceover-sim .vo-icbtn { width:30px; height:30px; }
  .w-design-voiceover-sim .vo-cart { height:30px; }
  .w-design-voiceover-sim .vo-say { padding:6px 9px; }
  .w-design-voiceover-sim .vo-said { font-size:14px; }
  .w-design-voiceover-sim .vo-parts { margin-top:4px; gap:3px 4px; }
  .w-design-voiceover-sim .vo-chip { font-size:11px; padding:1px 5px; }
  .w-design-voiceover-sim .vo-note { padding:6px 8px; }
  .w-design-voiceover-sim .vo-ntitle { font-size:12.5px; }
  .w-design-voiceover-sim .vo-ntext { font-size:12px; line-height:1.35; }
  .w-design-voiceover-sim .vo-ncode { font-size:10.5px; padding:2px 5px; }
  .w-design-voiceover-sim .vo-ctrls { gap:5px; flex-wrap:nowrap; }
  .w-design-voiceover-sim .vo-btn { font-size:12px; padding:5px 8px; flex:1; justify-content:center; white-space:nowrap; }
  .w-design-voiceover-sim .vo-check { display:none; }
  .w-design-voiceover-sim .vo-strip { gap:4px 6px; font-size:11.5px; }
  .w-design-voiceover-sim .vo-dotbtn { width:18px; height:18px; font-size:9.5px; }
  .w-design-voiceover-sim .vo-count { font-size:12px; }
  .w-design-voiceover-sim .vo-seg button { padding:4px 10px; font-size:12.5px; }
}

/* ---------- wide stage: phone left, panel right ---------- */
@container (min-width: 620px) {
  .w-design-voiceover-sim .vo-root { grid-template-columns:250px minmax(0,1fr); grid-template-rows:minmax(0,1fr); gap:18px; padding:14px 16px; align-content:stretch; }
  .w-design-voiceover-sim .vo-phonewrap { align-items:center; }
  .w-design-voiceover-sim .vo-phone { height:100%; max-height:500px; max-width:250px; }
  .w-design-voiceover-sim .vo-screen { height:100%; }
  .w-design-voiceover-sim .vo-status { display:flex; height:30px; flex:none; align-items:flex-end; justify-content:space-between; padding:0 16px 2px 22px; font-size:10.5px; font-weight:600; position:relative; }
  ${phoneFrameCss('.w-design-voiceover-sim', { island: '.vo-island', home: '.vo-home', islandTop: '8px', islandWidth: '30%', islandHeight: '14px', islandRadius: '8px' })}
  .w-design-voiceover-sim .vo-photo { height:150px; margin:6px 10px 0; }
  .w-design-voiceover-sim .vo-divider { margin-top:12px; }
  .w-design-voiceover-sim .vo-title { margin-top:8px; font-size:19px; }
  .w-design-voiceover-sim .vo-info { margin-top:6px; }
  .w-design-voiceover-sim .vo-actions { margin-top:16px; }
  .w-design-voiceover-sim .vo-caption { display:block; position:absolute; left:8px; right:8px; bottom:16px; background:rgba(28,28,30,.92); color:#fff; border-radius:10px; padding:6px 9px; font-size:10.5px; line-height:1.35; min-height:2.8em; }
  .w-design-voiceover-sim .vo-caption[hidden] { display:none; }
  .w-design-voiceover-sim .vo-panel { display:flex; flex-direction:column; gap:9px; min-width:0; min-height:0; justify-content:center; }
  .w-design-voiceover-sim .vo-said { font-size:17px; }
}
`,
  mount(el, props, ctx) {
    const n = ++instances;
    const id = idScope(NAME, n);
    const icon = (name, size = 16, label = '') => ctx.icon(name, size, label);
    const restoreHost = snapshotHost(el);
    el.classList.add(`w-${NAME}`);
    if (ctx.reducedMotion) el.classList.add('vo-still');

    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
      ? window.speechSynthesis : null;

    const st = { version: props.version === 'after' ? 'after' : 'before', idx: { before: 0, after: 0 }, favorite: false, cart: false, silent: null, speakOnMove: false };
    let stops = buildStops(st.version, st);

    el.innerHTML = `<div class="vo-root">
      <div class="vo-phonewrap">
        <div class="vo-phone">
          <div class="vo-screen" id="${id('screen')}" tabindex="0" role="group"
            aria-label="Simulated iPhone screen with a product card. Use the Left and Right arrow keys to move the VoiceOver cursor, and Enter to double-tap.">
            <div class="vo-card"></div>
            <div class="vo-cursor" hidden></div>
            <div class="vo-caption" aria-hidden="true"></div>
            <div class="vo-home" aria-hidden="true"></div>
          </div>
        </div>
      </div>
      <div class="vo-panel">
        <div class="vo-top">
          <div class="vo-seg" role="radiogroup" aria-label="Version of the card">
            <button type="button" role="radio" id="${id('before')}" data-v="before">Before</button>
            <button type="button" role="radio" id="${id('after')}" data-v="after">After (fixed)</button>
          </div>
          <div class="vo-count" id="${id('count')}"></div>
        </div>
        <div class="vo-say">
          <div class="vo-kicker">VoiceOver says</div>
          <div class="vo-said" id="${id('said')}" aria-live="polite"></div>
          <div class="vo-parts" id="${id('parts')}"></div>
        </div>
        <div class="vo-note" id="${id('note')}"></div>
        <div class="vo-ctrls">
          <button type="button" class="vo-btn" id="${id('prev')}" aria-keyshortcuts="ArrowLeft">${icon('chevron.left', 14)}Previous</button>
          <button type="button" class="vo-btn vo-primary" id="${id('next')}" aria-keyshortcuts="ArrowRight">Next${icon('chevron.right', 14)}</button>
          <button type="button" class="vo-btn" id="${id('activate')}">Double-tap</button>
          <button type="button" class="vo-btn" id="${id('speak')}">Speak</button>
          <label class="vo-check" for="${id('auto')}"><input type="checkbox" id="${id('auto')}"> Speak as I move</label>
        </div>
        <div class="vo-strip">
          <span id="${id('pathlabel')}"></span>
          <div class="vo-dots" id="${id('dots')}" role="group" aria-labelledby="${id('pathlabel')}"></div>
          <span class="vo-miss" id="${id('miss')}"></span>
        </div>
        <div class="vo-sr" aria-live="polite" id="${id('status')}"></div>
      </div>
    </div>`;

    const $ = (sel) => el.querySelector(sel);
    const screen = $('.vo-screen');
    const card = $('.vo-card');
    const cursor = $('.vo-cursor');
    const caption = $('.vo-caption');
    const said = $(`#${id('said')}`);
    const parts = $(`#${id('parts')}`);
    const note = $(`#${id('note')}`);
    const count = $(`#${id('count')}`);
    const dots = $(`#${id('dots')}`);
    const pathLabel = $(`#${id('pathlabel')}`);
    const miss = $(`#${id('miss')}`);
    const status = $(`#${id('status')}`);
    const seg = $('.vo-seg');
    const btnPrev = $(`#${id('prev')}`);
    const btnNext = $(`#${id('next')}`);
    const btnAct = $(`#${id('activate')}`);
    const btnSpeak = $(`#${id('speak')}`);
    const auto = $(`#${id('auto')}`);
    if (!synth) {
      btnSpeak.disabled = true;
      btnSpeak.title = 'Speech is not available in this browser';
      auto.disabled = true;
    }

    function cardHTML() {
      const after = st.version === 'after';
      const stars = [1, 2, 3, 4, 5].map((i) => `<span data-part="star${i}">${icon(i < 5 ? 'star.fill' : 'star', 13)}</span>`).join('');
      return `
        <div class="vo-status" aria-hidden="true"><span>9:41</span><span class="vo-island"></span><span>${icon('wifi', 12)}</span></div>
        <div class="vo-photo" data-part="photo">${after ? '' : '<span class="vo-file">IMG_2041</span>'}</div>
        <div class="vo-divider" data-part="divider"><i></i>${icon('leaf', 13)}<i></i></div>
        <div class="vo-title" data-part="title">Lemon Pasta Kit</div>
        <div class="vo-info" data-part="info">
          <span class="vo-price" data-part="price">$14.50</span>
          <span class="vo-stars">${stars}</span>
          <span class="vo-dot" data-part="dot"></span>${after ? '<span class="vo-stock" data-part="stock">In stock</span>' : ''}
        </div>
        <div class="vo-actions">
          <span class="vo-icbtn${st.favorite ? ' vo-on' : ''}" data-part="favorite">${icon(st.favorite ? 'heart.fill' : 'heart', 17)}</span>
          <span class="vo-icbtn" data-part="share">${icon('square.and.arrow.up', 17)}</span>
          <span class="vo-cart" data-part="cart">${icon(st.cart ? 'checkmark' : 'cart', 14)}${st.cart ? 'Added to Cart' : 'Add to Cart'}</span>
        </div>`;
    }

    function current() { return st.silent ? null : stops[st.idx[st.version]]; }

    function announcement(stop) {
      const main = [stop.label, stop.value, ...stop.traits.map((t) => TRAIT_WORD[t])].filter(Boolean);
      return { main: main.join(', '), hint: stop.hint || '' };
    }
    function spokenText(stop) {
      const a = announcement(stop);
      return a.hint ? `${a.main}. ${a.hint}` : `${a.main}.`;
    }

    function placeCursor() {
      const stop = current();
      if (!stop) { cursor.hidden = true; return; }
      const target = card.querySelector(`[data-part="${stop.part}"]`);
      if (!target) { cursor.hidden = true; return; }
      const s = screen.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const pad = 3;
      cursor.hidden = false;
      cursor.style.left = `${r.left - s.left - pad}px`;
      cursor.style.top = `${r.top - s.top - pad}px`;
      cursor.style.width = `${r.width + pad * 2}px`;
      cursor.style.height = `${r.height + pad * 2}px`;
    }

    function renderNote(info) {
      const ic = info.tone === 'bad' ? 'xmark.circle.fill' : info.tone === 'warn' ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill';
      note.className = `vo-note t-${info.tone}`;
      note.innerHTML = `<span class="vo-nic" aria-hidden="true">${icon(ic, 16)}</span>
        <span class="vo-ntitle">${esc(info.title)}</span>
        <span class="vo-ntext">${esc(info.note)}</span>
        ${info.code ? `<code class="vo-ncode">${esc(info.code)}</code>` : ''}`;
    }

    function renderPanel() {
      const total = stops.length;
      seg.querySelectorAll('[role="radio"]').forEach((b) => {
        const on = b.dataset.v === st.version;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      const stop = current();
      if (stop) {
        const a = announcement(stop);
        const bits = [`<span class="p-label">${esc(stop.label)}</span>`];
        if (stop.value) bits.push(`<span class="p-value">${esc(stop.value)}</span>`);
        stop.traits.forEach((t) => bits.push(`<span class="p-traits">${TRAIT_WORD[t]}</span>`));
        said.innerHTML = `“${bits.join(', ')}.”${a.hint ? ` <span class="p-hint">${esc(a.hint)}</span>` : ''}`;
        const chip = (cls, k, v) => `<span class="vo-chip c-${cls}${v ? '' : ' c-none'}">${k}: <b>${v ? esc(v) : 'none'}</b></span>`;
        parts.innerHTML = chip('label', 'Label', stop.label) + chip('value', 'Value', stop.value)
          + chip('traits', 'Traits', stop.traits.map((t) => TRAIT_WORD[t]).join(', ')) + chip('hint', 'Hint', stop.hint);
        renderNote(stop);
        caption.hidden = false;
        caption.textContent = spokenText(stop);
        count.innerHTML = `Stop <b>${st.idx[st.version] + 1}</b> of <b>${total}</b>`;
      } else {
        const info = st.silent;
        said.innerHTML = '<span class="p-quiet">(VoiceOver says nothing here)</span>';
        parts.innerHTML = '';
        renderNote(info);
        caption.hidden = true;
        count.innerHTML = `Not an element · <b>${total}</b> stops`;
      }
      dots.innerHTML = stops.map((s, i) => `<button type="button" class="vo-dotbtn t-${s.tone}" data-i="${i}" id="${id('stop-' + i)}"
        aria-label="Stop ${i + 1}: ${esc(s.label)}"${stop && i === st.idx[st.version] ? ' aria-current="true"' : ''}>${i + 1}</button>`).join('');
      pathLabel.textContent = `Swipe path: ${total} stops`;
      if (st.version === 'before') {
        miss.className = 'vo-miss';
        miss.textContent = 'Never announced: In stock';
      } else {
        miss.className = 'vo-miss t-ok';
        miss.textContent = 'Nothing missing';
      }
    }

    function renderAll() {
      stops = buildStops(st.version, st);
      card.innerHTML = cardHTML();
      renderPanel();
      placeCursor();
    }

    function speakNow() {
      if (!synth) return;
      const stop = current();
      synth.cancel();
      const text = stop ? spokenText(stop) : 'Nothing.';
      const u = new SpeechSynthesisUtterance(text.replace(/_/g, ' '));
      u.rate = 1.05;
      synth.speak(u);
    }

    function move(delta) {
      const total = stops.length;
      if (st.silent) { st.silent = null; }
      else st.idx[st.version] = Math.max(0, Math.min(total - 1, st.idx[st.version] + delta));
      renderPanel();
      placeCursor();
      if (st.speakOnMove) speakNow();
    }

    function jumpTo(i) {
      st.silent = null;
      st.idx[st.version] = i;
      renderPanel();
      placeCursor();
      if (st.speakOnMove) speakNow();
    }

    function setVersion(v, focus = false) {
      if (v === st.version) return;
      const stop = current();
      const map = v === 'after' ? BEFORE_TO_AFTER : AFTER_TO_BEFORE;
      st.version = v;
      st.silent = null;
      stops = buildStops(v, st);
      if (stop) {
        const key = map[stop.key];
        const i = stops.findIndex((s) => s.key === key);
        st.idx[v] = i < 0 ? 0 : i;
      }
      renderAll();
      if (focus) seg.querySelector(`[data-v="${v}"]`).focus();
    }

    function activate() {
      const stop = current();
      if (!stop) return;
      let msg = '';
      if (stop.key === 'favorite') { st.favorite = !st.favorite; msg = st.favorite ? 'Heart filled in.' : 'Heart cleared.'; }
      else if (stop.key === 'cart') { st.cart = !st.cart; msg = st.cart ? 'Added to cart.' : 'Removed from cart.'; }
      else if (stop.key === 'share') { msg = 'A share sheet would open here.'; }
      else { msg = 'Nothing happens: this element is not a button.'; }
      renderAll();
      status.textContent = msg;
      ctx.toast(msg);
      if (st.speakOnMove) speakNow();
    }

    // Touch to explore: clicking a part of the card moves the cursor there,
    // or explains why VoiceOver stays silent for that part.
    function onCardClick(e) {
      const partEl = e.target.closest('[data-part]');
      if (!partEl) return;
      let part = partEl.dataset.part;
      if (st.version === 'after' && ['price', 'dot', 'stock', 'star1', 'star2', 'star3', 'star4', 'star5'].includes(part)) part = 'info';
      if (st.version === 'before' && part === 'info') return;
      const i = stops.findIndex((s) => s.part === part);
      if (i >= 0) { jumpTo(i); return; }
      const silent = SILENT[st.version][part];
      if (silent) {
        st.silent = silent;
        renderPanel();
        placeCursor();
        if (st.speakOnMove) speakNow();
      }
    }

    function onKey(e) {
      if (e.target.closest('.vo-seg')) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          setVersion(st.version === 'before' ? 'after' : 'before', true);
        }
        return;
      }
      if (e.target === auto) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if ((e.key === 'Enter' || e.key === ' ') && e.target === screen) { e.preventDefault(); activate(); }
    }

    const onSeg = (e) => { const b = e.target.closest('[data-v]'); if (b) setVersion(b.dataset.v); };
    const onDots = (e) => { const b = e.target.closest('[data-i]'); if (b) { jumpTo(Number(b.dataset.i)); dots.querySelector(`[data-i="${b.dataset.i}"]`)?.focus(); } };
    const onPrev = () => move(-1);
    const onNext = () => move(1);
    const onAuto = () => { st.speakOnMove = auto.checked; if (auto.checked) speakNow(); };

    seg.addEventListener('click', onSeg);
    dots.addEventListener('click', onDots);
    card.addEventListener('click', onCardClick);
    el.addEventListener('keydown', onKey);
    btnPrev.addEventListener('click', onPrev);
    btnNext.addEventListener('click', onNext);
    btnAct.addEventListener('click', activate);
    btnSpeak.addEventListener('click', speakNow);
    auto.addEventListener('change', onAuto);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => placeCursor()) : null;
    if (ro) ro.observe(screen);

    renderAll();

    return {
      destroy() {
        if (synth) synth.cancel();
        if (ro) ro.disconnect();
        seg.removeEventListener('click', onSeg);
        dots.removeEventListener('click', onDots);
        card.removeEventListener('click', onCardClick);
        el.removeEventListener('keydown', onKey);
        btnPrev.removeEventListener('click', onPrev);
        btnNext.removeEventListener('click', onNext);
        btnAct.removeEventListener('click', activate);
        btnSpeak.removeEventListener('click', speakNow);
        auto.removeEventListener('change', onAuto);
        el.innerHTML = '';
        restoreHost();
      },
    };
  },
};
