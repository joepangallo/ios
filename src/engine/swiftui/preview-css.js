// Styles for the simulated iOS 26 device. Lives inside the preview's shadow
// root, so it never touches the page and the page never touches it.
export const PREVIEW_CSS = `
:host { display: block; position: relative; min-height: 0; contain: layout paint; }
* { box-sizing: border-box; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.pv { height: 100%; display: flex; flex-direction: column; gap: 8px; min-height: 0; font: 13px/1.3 -apple-system, system-ui, sans-serif; }
.pv-bar { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: center; color: var(--pv-ink, #444); }
.pv-bar .pv-dtlabel { display: none; }
:host([data-wide]) .pv-bar .pv-dtlabel { display: inline; }
.pv-ctl { display: inline-flex; align-items: center; gap: 6px; }
.pv-device { font: inherit; font-size: 12px; padding: 4px 4px; border-radius: 8px; border: 1px solid var(--pv-line, #ccd); background: var(--pv-panel, #fff); color: inherit; }
.pv-btn { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--pv-line, #ccd); background: var(--pv-panel, #fff); color: inherit; cursor: pointer; }
.pv-btn[aria-pressed="true"] { background: var(--pv-accent, #f05138); color: #fff; border-color: transparent; }
.pv-btn:focus-visible, .pv-device:focus-visible, .pv-dtsize:focus-visible { outline: 2px solid var(--pv-focus, #0a84ff); outline-offset: 2px; }
.pv-dt { padding: 0 4px; }
.pv-dtsize { width: 64px; accent-color: var(--pv-accent, #f05138); }
.pv-dtlabel { min-width: 52px; font-variant-numeric: tabular-nums; }
.pv-stage { flex: 1; min-height: 0; position: relative; overflow: hidden; }
.pv-scale { transform-origin: top left; position: absolute; left: 0; top: 0; }
.pv-status:empty { display: none; }

/* ---------------- device */
.device { width: calc(var(--w) + 28px); height: calc(var(--h) + 28px); padding: 14px; border-radius: calc(var(--radius) + 14px); background: linear-gradient(145deg, #2b2c30, #0d0d0f); box-shadow: 0 0 0 2px #3a3b40, 0 30px 60px rgba(0,0,0,.35); position: relative; }
.device.home { border-radius: 52px; padding: 70px 14px; height: calc(var(--h) + 140px); }
.device.home::after { content: ""; position: absolute; left: 50%; bottom: 14px; width: 46px; height: 46px; margin-left: -23px; border-radius: 50%; border: 3px solid #45464b; }
.screen { width: var(--w); height: var(--h); border-radius: var(--radius); overflow: hidden; position: relative; isolation: isolate; }
.screen-inner { position: absolute; inset: 0; display: flex; flex-direction: column;
  --sf: -apple-system, "SF Pro Text", "SF Pro", system-ui, "Helvetica Neue", Arial, sans-serif;
  font-family: var(--sf); font-size: calc(17px * var(--dt)); line-height: 1.25; letter-spacing: -0.01em;
  color: var(--label); background: var(--bg); -webkit-font-smoothing: antialiased; }
.scheme-light { --bg: #FFFFFF; --bg2: #F2F2F7; --grouped: #F2F2F7; --cell: #FFFFFF; --label: #000000; --label2: rgba(60,60,67,.6); --label3: rgba(60,60,67,.3); --sep: rgba(60,60,67,.29); --fill: rgba(120,120,128,.16); --fill2: rgba(118,118,128,.12); --tint: #007AFF; --ios-bg: #FFFFFF; --glass: rgba(255,255,255,.55); --glass-edge: rgba(255,255,255,.75); --shadow: rgba(0,0,0,.12); }
.scheme-dark { --bg: #000000; --bg2: #1C1C1E; --grouped: #000000; --cell: #1C1C1E; --label: #FFFFFF; --label2: rgba(235,235,245,.6); --label3: rgba(235,235,245,.3); --sep: rgba(84,84,88,.65); --fill: rgba(120,120,128,.36); --fill2: rgba(118,118,128,.24); --tint: #0A84FF; --ios-bg: #000000; --glass: rgba(40,40,44,.55); --glass-edge: rgba(255,255,255,.18); --shadow: rgba(0,0,0,.5); }
.island { position: absolute; top: 11px; left: 50%; width: 124px; height: 36px; margin-left: -62px; background: #000; border-radius: 20px; z-index: 30; }
.home-indicator { position: absolute; bottom: 8px; left: 50%; width: 140px; height: 5px; margin-left: -70px; border-radius: 3px; background: var(--label); opacity: .85; z-index: 30; pointer-events: none; }
.statusbar { position: absolute; top: 0; left: 0; right: 0; height: var(--safe-top); display: flex; align-items: center; justify-content: space-between; padding: 6px 34px 0 46px; font: 600 17px/1 var(--sf); z-index: 25; pointer-events: none; color: var(--label); }
.statusbar.compact { padding: 0 8px; font-size: 13px; height: 20px; }
.statusbar.compact .sb-time { margin: 0 auto; }
.sb-icons { display: inline-flex; gap: 6px; align-items: center; }
.ipad .statusbar { padding: 0 24px; font-size: 14px; }

/* ---------------- content placement */
.content { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0; }
.content.centered { padding: var(--safe-top) 0 var(--safe-bottom); align-items: center; justify-content: center; }
.content.centered > * { max-width: 100%; max-height: 100%; }
.content.full > * { flex: 1; min-height: 0; align-self: stretch; }

.content.in-sheet.centered { padding: 24px 0; }
.content.in-sheet.full > .v-list, .content.in-sheet.full > .v-scroll { padding-top: 0; }

/* ---------------- primitives */
.v-stack { display: flex; min-width: 0; min-height: 0; }
.v-v { flex-direction: column; gap: 8px; }
.v-h { flex-direction: row; gap: 8px; }
.v-z { display: grid; }
.v-z > * { grid-area: 1 / 1; }
.v-group { gap: 8px; }
.v-text { white-space: pre-wrap; overflow-wrap: anywhere; text-align: start; min-width: 0; }
.v-text.secondary { color: var(--label2); text-align: center; }
.v-text.title { font-size: calc(22px * var(--dt)); font-weight: 700; text-align: center; }
.v-text.headline { font-weight: 600; }
.v-img { display: inline-flex; align-items: center; justify-content: center; line-height: 0; flex-shrink: 0; }
.v-img svg { width: 1.2em; height: 1.2em; }
.v-img.resizable { width: 100%; height: 100%; }
.v-img.resizable svg { width: 100%; height: 100%; }
.v-asset { color: var(--label3); background: var(--fill2); border-radius: 8px; padding: 6px; }
.v-label { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.v-label .v-label-icon { color: var(--tint); }
.v-label.in-list { gap: 14px; }
.v-spacer { flex: 1 1 0; min-width: var(--min, 0px); min-height: var(--min, 0px); }
.v-h > .v-spacer { min-width: var(--min, 8px); }
.v-v > .v-spacer { min-height: var(--min, 8px); }
.v-divider { background: var(--sep); flex-shrink: 0; }
.v-v > .v-divider, .v-wrap > .v-divider, .content > .v-divider { height: .5px; align-self: stretch; }
.v-h > .v-divider { width: .5px; align-self: stretch; }
.v-color { min-width: 0; min-height: 0; }
.v-shape { background: var(--label); min-width: 0; min-height: 0; }
.v-shape.circle { border-radius: 50%; }
.v-frame > .v-shape, .v-frame > .v-color { width: 100%; height: 100%; flex: 1 1 auto; }
.content.centered > .v-color, .content.centered > .v-shape { width: 100%; }
/* greedy layout: [data-gw] takes all offered width, [data-gh] all offered height */
.v-v > [data-gw], .v-wrap > [data-gw], .content.centered > [data-gw], .v-navcontent > [data-gw], .v-unavailable > [data-gw], .v-tabcontent > [data-gw] { align-self: stretch; }
.v-v > [data-gh], .v-wrap > [data-gh], .content.centered > [data-gh], .v-navcontent > [data-gh], .v-tabcontent > [data-gh] { flex: 1 1 0; min-height: 0; }
.v-h > [data-gw] { flex: 1 1 0; min-width: 0; }
.v-h > [data-gh] { align-self: stretch; }
.v-z > [data-gw] { justify-self: stretch; }
.v-z > [data-gh] { align-self: stretch; }
.v-scroll.horizontal .v-h > [data-gw] { flex: 0 0 auto; }
.v-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; min-height: 0; position: relative; }
.v-wrap > * { max-width: 100%; }
.v-frame { flex-shrink: 1; }
.has-layer { position: relative; isolation: isolate; }
.v-layer { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.v-layer > * { pointer-events: auto; }
.v-layer.back { z-index: -1; }
.v-layer.back > * { width: 100%; height: 100%; }
.v-layer[data-align="top"] { place-items: start center; } .v-layer[data-align="bottom"] { place-items: end center; }
.v-layer[data-align="topTrailing"] { place-items: start end; } .v-layer[data-align="topLeading"] { place-items: start start; }
.v-layer[data-align="bottomTrailing"] { place-items: end end; } .v-layer[data-align="bottomLeading"] { place-items: end start; }
.v-layer[data-align="leading"] { place-items: center start; } .v-layer[data-align="trailing"] { place-items: center end; }
.material { backdrop-filter: blur(20px) saturate(1.6); -webkit-backdrop-filter: blur(20px) saturate(1.6); background: var(--glass); }
.ignores-safe { }
.content.centered > .ignores-safe, .v-z > .ignores-safe { margin-top: calc(-1 * var(--safe-top)); margin-bottom: calc(-1 * var(--safe-bottom)); }
.tappable { cursor: pointer; }
.is-disabled { opacity: .45; pointer-events: none; }

/* ---------------- Liquid Glass (iOS 26) */
.glass { position: relative; background: var(--glass); backdrop-filter: blur(14px) saturate(1.8) brightness(1.05); -webkit-backdrop-filter: blur(14px) saturate(1.8) brightness(1.05);
  box-shadow: inset 0 1px 0 var(--glass-edge), inset 0 -1px 1px rgba(255,255,255,.12), 0 6px 18px var(--shadow); border: .5px solid rgba(255,255,255,.35); }
.glass-clear { background: rgba(255,255,255,.12); backdrop-filter: blur(4px) saturate(1.4); -webkit-backdrop-filter: blur(4px) saturate(1.4); }
.glass-container { gap: 10px; }

/* ---------------- buttons */
.v-button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: var(--tint); cursor: pointer; font: inherit; min-height: 22px; text-align: center; max-width: 100%; position: relative; }
.v-button:focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; border-radius: 8px; }
.v-button:active { opacity: .55; }
.v-button.destructive { color: #FF3B30; }
.v-button.disabled, .v-button:disabled { color: var(--label3); cursor: default; }
.v-button.style-borderedProminent { background: var(--tint); color: #fff; padding: 7px 16px; border-radius: 9999px; font-weight: 600; min-height: 34px; }
.v-button.style-borderedProminent.destructive { background: #FF3B30; }
.v-button.style-bordered { background: color-mix(in srgb, var(--tint) 15%, transparent); padding: 7px 16px; border-radius: 9999px; min-height: 34px; }
.v-button.style-glass, .v-button.style-glassProminent { padding: 8px 18px; border-radius: 9999px; min-height: 36px; background: var(--glass); backdrop-filter: blur(14px) saturate(1.8); -webkit-backdrop-filter: blur(14px) saturate(1.8); box-shadow: inset 0 1px 0 var(--glass-edge), 0 4px 14px var(--shadow); border: .5px solid rgba(255,255,255,.35); color: var(--label); font-weight: 500; }
.v-button.style-glassProminent { background: color-mix(in srgb, var(--tint) 82%, transparent); color: #fff; font-weight: 600; }
.v-button.style-plain { color: inherit; }
.v-button.size-large.style-borderedProminent, .v-button.size-large.style-bordered, .v-button.size-large.style-glass, .v-button.size-large.style-glassProminent { min-height: 50px; padding: 12px 22px; }
.v-button.size-extraLarge { min-height: 56px; padding: 14px 24px; }
.v-button.size-small { min-height: 28px; padding: 4px 12px; font-size: .88em; }
.v-button.size-mini { min-height: 24px; padding: 2px 10px; font-size: .8em; }
.v-button.style-swipe { background: var(--tint); color: #fff; padding: 0 16px; height: 100%; border-radius: 0; min-width: 64px; }
.v-button.style-swipe.destructive { background: #FF3B30; color: #fff; }
.v-button.toggled { background: var(--tint); color: #fff; }
.v-badge { position: absolute; top: -6px; right: -10px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #FF3B30; color: #fff; font-size: 12px; font-weight: 600; display: grid; place-items: center; }

/* ---------------- controls */
.v-textfield { display: flex; align-items: center; min-width: 0; min-height: 22px; }
.v-textfield input, .v-textfield textarea, .v-texteditor { all: unset; box-sizing: border-box; flex: 1; min-width: 0; font: inherit; color: var(--label); caret-color: var(--tint); }
.v-textfield textarea { resize: none; field-sizing: content; }
.v-textfield input::placeholder, .v-textfield textarea::placeholder { color: var(--label3); }
.v-textfield.bordered { border: .5px solid var(--sep); border-radius: 8px; padding: 6px 8px; background: var(--bg); }
.v-texteditor { min-height: 120px; width: 100%; white-space: pre-wrap; }
.v-toggle { display: flex; align-items: center; gap: 12px; min-width: 0; cursor: pointer; }
.v-toggle-label { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.labels-hidden .v-toggle-label, .labels-hidden .v-stepper-label, .labels-hidden .v-picker-title { display: none; }
.v-switch { all: unset; position: relative; width: 64px; height: 28px; border-radius: 14px; background: var(--fill); transition: background .25s; flex-shrink: 0; cursor: pointer; }
.v-switch.on { background: #34C759; }
.v-switch .knob { position: absolute; top: 2px; left: 2px; width: 38px; height: 24px; border-radius: 12px; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.18); transition: transform .25s; }
.v-switch.on .knob { transform: translateX(22px); }
.v-switch:focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; }
.v-slider { position: relative; height: 28px; display: flex; align-items: center; min-width: 60px; }
.v-slider input { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 3px; margin: 0; background: linear-gradient(to right, var(--tint) var(--pct), var(--fill) var(--pct)); outline: none; }
.v-slider input::-webkit-slider-thumb { -webkit-appearance: none; width: 38px; height: 24px; border-radius: 12px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: pointer; }
.v-slider input::-moz-range-thumb { width: 38px; height: 24px; border-radius: 12px; background: #fff; border: 0; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.v-slider input:focus-visible { outline: 2px solid var(--tint); outline-offset: 4px; }
.v-stepper { display: flex; align-items: center; gap: 12px; min-width: 0; }
.v-stepper-label { flex: 1; min-width: 0; }
.v-stepper-ctl { display: inline-flex; align-items: center; background: var(--fill2); border-radius: 9999px; height: 32px; }
.v-stepper-ctl button { all: unset; width: 46px; height: 32px; display: grid; place-items: center; color: var(--label); cursor: pointer; }
.v-stepper-ctl button:disabled { color: var(--label3); }
.v-stepper-ctl button:focus-visible { outline: 2px solid var(--tint); border-radius: 9999px; }
.v-stepper-ctl .sep { width: .5px; height: 18px; background: var(--sep); }
.v-segmented { display: flex; padding: 2px; border-radius: 9999px; background: var(--fill2); gap: 2px; min-width: 0; }
.v-segmented .seg { all: unset; flex: 1; text-align: center; padding: 5px 10px; border-radius: 9999px; font-size: .82em; font-weight: 500; cursor: pointer; color: var(--label); white-space: nowrap; display: grid; place-items: center; }
.v-segmented .seg.on { background: var(--cell); box-shadow: 0 2px 6px rgba(0,0,0,.12); font-weight: 600; }
.scheme-dark .v-segmented .seg.on { background: #636366; }
.v-segmented .seg:focus-visible { outline: 2px solid var(--tint); }
.v-picker { display: flex; align-items: center; gap: 12px; min-width: 0; }
.v-picker-title { flex: 1; }
.v-picker-value { position: relative; display: inline-flex; align-items: center; gap: 4px; color: var(--label2); }
.v-picker-value select { position: absolute; inset: 0; opacity: 0; cursor: pointer; font: inherit; }
.v-picker-value select:focus-visible + * { outline: 2px solid var(--tint); }
.v-picker-inline { display: flex; flex-direction: column; align-self: stretch; }
.pick-row { justify-content: space-between !important; padding: 6px 0; }
.pick-row .check { color: var(--tint); }
.v-progress-wrap { display: inline-flex; flex-direction: column; align-items: center; gap: 8px; }
.v-spinner { width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid var(--fill); border-top-color: var(--label2); animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.v-progressbar { height: 4px; border-radius: 2px; background: var(--fill); overflow: hidden; min-width: 60px; }
.v-progressbar .fill { height: 100%; background: var(--tint); border-radius: 2px; transition: width .3s; }
.v-unavailable { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; color: var(--label); align-self: stretch; flex: 1; }
.v-unavailable .big { color: var(--label2); font-size: 2.6em; }
.v-groupbox { background: var(--bg2); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px; align-self: stretch; }
.v-labeled { display: flex; align-items: center; gap: 12px; min-width: 0; }
.v-labeled > :first-child { flex: 1; }
.v-labeled-value { color: var(--label2); }
.v-grid { display: grid; min-width: 0; align-self: stretch; }
.v-fits { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.v-fit-option { display: flex; flex-direction: column; align-items: center; max-width: 100%; }
.v-fit-option[hidden] { display: none; }
.v-fit-option.measuring { position: absolute; visibility: hidden; max-width: none; width: max-content; }
.v-fit-option.measuring .v-text { white-space: pre; }
.v-grid > * { min-width: 0; }

/* ---------------- scroll & list */
.v-scroll { overflow-y: auto; overflow-x: hidden; min-height: 0; align-self: stretch; scrollbar-width: none; }
.v-scroll::-webkit-scrollbar { display: none; }
.v-scroll.horizontal { overflow-x: auto; overflow-y: hidden; }
.v-scroll-content { align-items: center; padding-bottom: var(--safe-bottom); min-width: 100%; }
.v-scroll.horizontal .v-scroll-content { min-width: max-content; padding-bottom: 0; }
.v-list { overflow-y: auto; background: var(--grouped); min-height: 0; padding: 0 0 calc(var(--safe-bottom) + 16px); scrollbar-width: none; align-self: stretch; display: flex; flex-direction: column; }
.v-list::-webkit-scrollbar { display: none; }
.v-list.no-scroll-bg { background: transparent; }
.v-list.style-plain { background: var(--bg); }
.v-section { margin: 0 16px; padding-top: 18px; }
.v-section-header { font-size: calc(13px * var(--dt)); color: var(--label2); padding: 0 20px 7px; font-weight: 600; }
.v-section-footer { font-size: calc(13px * var(--dt)); color: var(--label2); padding: 7px 20px 0; }
.v-rows { background: var(--cell); border-radius: 22px; overflow: hidden; }
.style-plain .v-section { margin: 0; padding-top: 0; }
.style-plain .v-rows { border-radius: 0; }
.style-grouped .v-section { margin: 0; }
.style-grouped .v-rows { border-radius: 0; }
.v-row { position: relative; min-height: 48px; padding: 11px 20px; display: flex; align-items: center; gap: 12px; }
.v-row > :first-child { flex: 1; min-width: 0; justify-content: flex-start; align-items: center; }
.v-row + .v-row::before { content: ""; position: absolute; top: 0; left: 20px; right: 0; height: .5px; background: var(--sep); }
.v-row > .v-stack.v-h, .v-row > .v-wrap { align-self: stretch; }
.v-row .v-navlink { color: var(--label); width: 100%; justify-content: flex-start; gap: 12px; }
.v-row.nav .v-chevron { margin-left: auto; color: var(--label3); display: inline-flex; }
.v-row .v-button { justify-content: flex-start; }
.v-row > .v-button { width: 100%; }
.v-row .v-textfield, .v-row .v-toggle, .v-row .v-stepper, .v-row .v-picker, .v-row .v-slider, .v-row .v-labeled { width: 100%; }
.v-row.deletable { padding-right: 52px; }
.v-row-delete { all: unset; position: absolute; right: 10px; top: 50%; margin-top: -16px; width: 32px; height: 32px; border-radius: 16px; display: grid; place-items: center; color: #FF3B30; cursor: pointer; opacity: .55; }
.v-row-delete:hover, .v-row-delete:focus-visible { opacity: 1; background: rgba(255,59,48,.12); }
.v-row-swipe { position: absolute; right: 0; top: 0; bottom: 0; display: flex; opacity: 0; pointer-events: none; transform: translateX(20px); transition: opacity .2s, transform .2s; }
.v-row.swiped .v-row-swipe, .v-row.has-swipe:hover .v-row-swipe { opacity: 1; pointer-events: auto; transform: none; }
.v-row-swipe .v-button { --tint: #8E8E93; }
.v-row-more { all: unset; position: absolute; right: 10px; top: 50%; margin-top: -16px; width: 32px; height: 32px; border-radius: 16px; display: grid; place-items: center; color: var(--label3); cursor: pointer; }
.v-row-more:focus-visible { outline: 2px solid var(--tint); }
.v-tab-centered { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--safe-top) 16px calc(var(--safe-bottom) + 80px); }
.v-tab { position: relative; }
.v-tab .v-badge { top: 2px; right: calc(50% - 26px); }
.v-list.at-root, .v-scroll.at-root { padding-top: var(--safe-top); }
.v-loose-section .v-section-header { padding: 4px 0; }

/* ---------------- navigation */
.v-nav { display: flex; flex-direction: column; min-height: 0; background: var(--grouped); position: relative; }
.v-navbar { flex-shrink: 0; padding: var(--safe-top) 16px 0; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: calc(var(--safe-top) + 52px); position: relative; z-index: 3; }
.v-navbar.large { grid-template-columns: 1fr auto; min-height: calc(var(--safe-top) + 48px); }
.v-navbar.large .v-navtitle { display: none; }
.v-navbar-side { display: flex; align-items: center; gap: 8px; min-width: 0; }
.v-navbar-side.right { justify-content: flex-end; grid-column: -2 / -1; }
.v-navtitle { font-weight: 600; text-align: center; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v-toolbar-item { display: inline-flex; align-items: center; gap: 6px; background: var(--glass); backdrop-filter: blur(14px) saturate(1.8); -webkit-backdrop-filter: blur(14px) saturate(1.8); box-shadow: inset 0 1px 0 var(--glass-edge), 0 4px 12px var(--shadow); border-radius: 9999px; min-height: 44px; min-width: 44px; padding: 0 12px; justify-content: center; }
.v-toolbar-item .v-button { color: var(--label); }
.v-glass-circle { all: unset; width: 44px; height: 44px; border-radius: 22px; display: grid; place-items: center; color: var(--label); background: var(--glass); backdrop-filter: blur(14px) saturate(1.8); -webkit-backdrop-filter: blur(14px) saturate(1.8); box-shadow: inset 0 1px 0 var(--glass-edge), 0 4px 12px var(--shadow); cursor: pointer; }
.v-glass-circle:focus-visible { outline: 2px solid var(--tint); }
.v-navbody { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: none; }
.v-navbody::-webkit-scrollbar { display: none; }
.v-largetitle { font-size: calc(34px * var(--dt)); font-weight: 700; padding: 4px 20px 8px; letter-spacing: .01em; line-height: 1.15; }
.v-search { margin: 0 16px 8px; display: flex; align-items: center; gap: 6px; padding: 0 12px; height: 40px; border-radius: 9999px; background: var(--fill2); color: var(--label2); }
.v-search input { all: unset; flex: 1; font: inherit; color: var(--label); }
.v-navcontent { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; padding-bottom: var(--safe-bottom); }
.v-navcontent.fills { align-items: stretch; justify-content: flex-start; padding-bottom: 0; }
.v-navcontent.fills > * { flex: 1; }
.v-navcontent > .v-list { padding-top: 0; }
.v-nav:has(.v-navcontent:not(.fills)) { background: var(--bg); }
.v-bottombar { position: absolute; left: 16px; right: 16px; bottom: calc(var(--safe-bottom) + 6px); display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-radius: 9999px; background: var(--glass); backdrop-filter: blur(14px) saturate(1.8); -webkit-backdrop-filter: blur(14px) saturate(1.8); box-shadow: inset 0 1px 0 var(--glass-edge), 0 6px 16px var(--shadow); z-index: 4; }
.anim-push .v-navbody { animation: pushIn .32s cubic-bezier(.2,.8,.2,1); }
.anim-pop .v-navbody { animation: popIn .32s cubic-bezier(.2,.8,.2,1); }
@keyframes pushIn { from { transform: translateX(40%); opacity: .4; } }
@keyframes popIn { from { transform: translateX(-25%); opacity: .4; } }

/* ---------------- tab view (floating Liquid Glass tab bar) */
.v-tabview { position: relative; display: flex; flex-direction: column; min-height: 0; background: var(--bg); }
.v-tabcontent { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.v-tabcontent > * { flex: 1; min-height: 0; align-self: stretch; }
.v-tabbar { position: absolute; left: 22px; right: 22px; bottom: calc(var(--safe-bottom) - 6px); height: 62px; border-radius: 31px; display: flex; align-items: stretch; padding: 4px; gap: 2px; z-index: 6;
  background: var(--glass); backdrop-filter: blur(16px) saturate(1.9); -webkit-backdrop-filter: blur(16px) saturate(1.9); box-shadow: inset 0 1px 0 var(--glass-edge), 0 8px 24px var(--shadow); border: .5px solid rgba(255,255,255,.3); }
.v-tab { all: unset; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 27px; color: var(--label); font-size: 10px; font-weight: 600; cursor: pointer; min-width: 0; }
.v-tab .v-img svg { width: 24px; height: 24px; }
.v-tab.on { color: var(--tint); background: var(--fill2); }
.v-tab:focus-visible { outline: 2px solid var(--tint); }
.v-tab-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.v-tabview .v-list, .v-tabview .v-navcontent, .v-tabview .v-scroll-content { padding-bottom: calc(var(--safe-bottom) + 80px); }

/* ---------------- overlays */
.overlay { position: absolute; inset: 0; z-index: 20; }
.sheet-overlay .dim { position: absolute; inset: 0; background: rgba(0,0,0,.3); animation: fadeIn .25s; }
.sheet-overlay .sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; top: calc(var(--safe-top) + 10px); border-radius: 36px; background: var(--grouped); box-shadow: 0 -10px 40px rgba(0,0,0,.25); overflow: hidden; animation: sheetUp .35s cubic-bezier(.2,.8,.2,1); display: flex; flex-direction: column; }
.sheet-overlay.cover .sheet { inset: 0; border-radius: 0; }
.sheet .content { position: relative; inset: auto; flex: 1; }
.scheme-light .sheet-overlay .sheet:has(.content.centered) { background: var(--bg); }
.grabber { all: unset; display: block; width: 36px; height: 5px; border-radius: 3px; background: var(--label3); margin: 6px auto 0; cursor: pointer; flex-shrink: 0; }
.grabber:focus-visible { outline: 2px solid var(--tint); outline-offset: 4px; }
.sheet .v-nav { background: transparent; }
.sheet .v-navbar { padding-top: 6px; min-height: 56px; }
@keyframes sheetUp { from { transform: translateY(100%); } }
@keyframes fadeIn { from { opacity: 0; } }
.alert-overlay { background: rgba(0,0,0,.22); display: grid; place-items: center; animation: fadeIn .2s; }
.alert { width: 300px; border-radius: 34px; padding: 22px 20px 16px; background: var(--glass); backdrop-filter: blur(30px) saturate(1.8); -webkit-backdrop-filter: blur(30px) saturate(1.8); box-shadow: 0 20px 50px rgba(0,0,0,.3); text-align: center; animation: pop .25s; }
.scheme-light .alert { background: rgba(255,255,255,.88); }
.scheme-dark .alert { background: rgba(44,44,46,.9); }
@keyframes pop { from { transform: scale(1.1); opacity: 0; } }
.alert-title { font-weight: 600; font-size: 17px; }
.alert-message { font-size: 15px; margin-top: 6px; color: var(--label); }
.alert-actions { display: flex; gap: 10px; margin-top: 18px; }
.alert-actions.stacked { flex-direction: column; }
.alert-btn { all: unset; flex: 1; min-height: 48px; border-radius: 9999px; background: var(--fill2); color: var(--label); font-weight: 600; font-size: 17px; cursor: pointer; display: grid; place-items: center; }
.alert-btn:last-child:not(.cancel) { background: var(--tint); color: #fff; }
.alert-btn.destructive { color: #FF3B30; background: var(--fill2) !important; }
.alert-btn:focus-visible { outline: 2px solid var(--tint); }

/* ---------------- animation */
.animating * { transition: all .35s cubic-bezier(.2,.8,.2,1); }
.animated, .animated * { transition: all .35s cubic-bezier(.2,.8,.2,1); }
.enter.enter-opacity { opacity: 0; }
.enter.enter-scale { opacity: 0; transform: scale(.5); }
.enter.enter-slide, .enter.enter-move { transform: translateX(-30px); opacity: 0; }
.enter { transition: opacity .35s, transform .35s; }
@media (prefers-reduced-motion: reduce) { .animating *, .animated, .animated *, .enter { transition: none !important; animation: none !important; } }

/* ---------------- errors & inspector */
.error-pane { position: absolute; left: 12px; right: 12px; bottom: 40px; z-index: 40; background: #1c1c1e; color: #fff; border-radius: 22px; padding: 14px 16px; box-shadow: 0 10px 30px rgba(0,0,0,.4); font: 14px/1.4 -apple-system, system-ui, sans-serif; border: 1px solid #ff453a; }
.err-kind { display: flex; align-items: center; gap: 8px; color: #ff6961; font-weight: 700; }
.err-line { color: #aeaeb2; font-size: 12px; margin-top: 2px; }
.err-msg { font-family: ui-monospace, Menlo, monospace; font-size: 13px; margin-top: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
.err-hint { color: #aeaeb2; font-size: 12px; margin-top: 8px; }
.insp { position: absolute; inset: 0; pointer-events: none; z-index: 35; }
.insp-box { position: absolute; border: 1.5px solid #30d158; background: rgba(48,209,88,.12); border-radius: 6px; }
.insp-box.small { border-color: #ff453a; background: rgba(255,69,58,.18); }
.insp-box span { position: absolute; top: -16px; left: 0; font: 600 10px/14px ui-monospace, Menlo, monospace; background: #30d158; color: #000; padding: 0 4px; border-radius: 4px; white-space: nowrap; }
.insp-box.small span { background: #ff453a; color: #fff; }
`;
