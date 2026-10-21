// Permission-flow simulator: an iPhone running a small app that needs a
// protected resource (location, camera or notifications). The student taps
// the feature, sees the system alert built from the app's Info.plist purpose
// string, picks an answer, and watches the authorization status, the Swift
// branch that runs, and the recovery path through Settings.
import { esc, codeHtml, codeCss, phoneHtml, phoneCss, panelCss, idScope } from './services-kit.js';

const NAME = 'services-permission-sim';
const S = `.w-${NAME}`;

const TRAILS = [
  { name: 'Cedar Creek Loop', km: 3.1, area: 'Forest' },
  { name: 'Fern Gully Path', km: 1.4, area: 'Valley' },
  { name: 'Lakeshore Trail', km: 0.6, area: 'Lake' },
  { name: 'Ridge Overlook', km: 2.3, area: 'Hills' },
  { name: 'Summit Steps', km: 5.2, area: 'Mountain' },
];

const GRANTED = new Set(['authorizedWhenInUse', 'authorizedAlways', 'authorized', 'provisional', 'ephemeral']);

// Everything that differs between the three protected resources.
function featureConfig(feature, app) {
  if (feature === 'camera') {
    return {
      id: 'camera',
      noun: 'camera',
      key: 'NSCameraUsageDescription',
      purpose: `${app} uses the camera to scan trail signs and show the route.`,
      action: 'Scan a trail sign',
      actionIcon: 'camera',
      statuses: ['notDetermined', 'authorized', 'denied', 'restricted'],
      requestCall: 'AVCaptureDevice.requestAccess(for: .video)',
      code: () => [
        'switch AVCaptureDevice.authorizationStatus(for: .video) {',
        'case .notDetermined:',
        '    if await AVCaptureDevice.requestAccess(for: .video) {',
        '        showScanner()',
        '    }',
        'case .authorized:',
        '    showScanner()',
        'case .denied:',
        '    showOpenSettingsPrompt()',
        'case .restricted:',
        '    showRestrictedMessage()',
        '@unknown default:',
        '    break',
        '}',
      ],
      branch: { notDetermined: [1, 2], authorized: [5, 6], denied: [7, 8], restricted: [9, 10] },
      afterAllow: [2, 3],
      afterDeny: [2],
      alertTitle: `“${app}” Would Like to Access the Camera`,
      buttons: [['deny', 'Don’t Allow'], ['allow', 'Allow']],
      prime: { icon: 'camera', title: 'Scan trail signs', text: `Point the camera at a trail sign and ${app} shows the route. Nothing is recorded or uploaded.` },
      offCard: `Camera access is off. You can still browse every trail.`,
      restrictedCard: `The camera is restricted on this device, for example by Screen Time. You can still browse every trail.`,
      canRestrict: true,
    };
  }
  if (feature === 'notifications') {
    return {
      id: 'notifications',
      noun: 'notifications',
      key: null,
      purpose: 'Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.',
      action: 'Remind me before sunset',
      actionIcon: 'bell',
      statuses: ['notDetermined', 'denied', 'authorized', 'provisional', 'ephemeral'],
      requestCall: 'center.requestAuthorization(options:)',
      code: (st) => [
        'let center = UNUserNotificationCenter.current()',
        'switch await center.notificationSettings().authorizationStatus {',
        'case .notDetermined:',
        '    _ = try await center.requestAuthorization(',
        st.provisional ? '        options: [.alert, .sound, .badge, .provisional])' : '        options: [.alert, .sound, .badge])',
        'case .authorized, .provisional, .ephemeral:',
        '    scheduleSunsetReminder()',
        'case .denied:',
        '    showOpenSettingsPrompt()',
        '@unknown default:',
        '    break',
        '}',
      ],
      branch: { notDetermined: [2, 3, 4], authorized: [5, 6], provisional: [5, 6], ephemeral: [5, 6], denied: [7, 8] },
      afterAllow: [5, 6],
      afterDeny: [3, 4],
      alertTitle: `“${app}” Would Like to Send You Notifications`,
      buttons: [['deny', 'Don’t Allow'], ['allow', 'Allow']],
      prime: { icon: 'bell', title: 'Get a sunset reminder', text: `${app} can remind you 30 minutes before sunset, so you are off the trail before dark.` },
      offCard: 'Notifications are off. Turn them on in Settings to get sunset reminders.',
      restrictedCard: '',
      canRestrict: false,
    };
  }
  return {
    id: 'location',
    noun: 'location',
    key: 'NSLocationWhenInUseUsageDescription',
    purpose: `${app} shows trails within walking distance of where you are.`,
    action: 'Show trails near me',
    actionIcon: 'location.fill',
    statuses: ['notDetermined', 'authorizedWhenInUse', 'authorizedAlways', 'denied', 'restricted'],
    requestCall: 'manager.requestWhenInUseAuthorization()',
    code: () => [
      'switch manager.authorizationStatus {',
      'case .notDetermined:',
      '    manager.requestWhenInUseAuthorization()',
      'case .authorizedWhenInUse, .authorizedAlways:',
      '    showNearbyTrails()',
      'case .denied:',
      '    showOpenSettingsPrompt()',
      'case .restricted:',
      '    showRestrictedMessage()',
      '@unknown default:',
      '    break',
      '}',
    ],
    branch: { notDetermined: [1, 2], authorizedWhenInUse: [3, 4], authorizedAlways: [3, 4], denied: [5, 6], restricted: [7, 8] },
    afterAllow: [3, 4],
    afterDeny: [5],
    alertTitle: `Allow “${app}” to use your location?`,
    buttons: [['once', 'Allow Once'], ['allow', 'Allow While Using App'], ['deny', 'Don’t Allow']],
    prime: { icon: 'location.fill', title: 'Find trails near you', text: `${app} uses your location only while the app is open, to sort trails by distance. It never leaves your phone.` },
    offCard: 'Location access is off. You can still browse every trail.',
    restrictedCard: 'Location is restricted on this device, for example by Screen Time. You can still browse every trail.',
    canRestrict: true,
  };
}

function meaning(status, st, cfg) {
  switch (status) {
    case 'notDetermined': return 'The app has not asked yet. The next request shows the system alert, and iOS shows it only once.';
    case 'authorizedWhenInUse':
      return st.temporary
        ? 'Allow Once: access lasts for this session only. It resets to not determined when the app leaves the screen.'
        : 'Location works while the app is open and on screen.';
    case 'authorizedAlways': return 'Location also works in the background. Apps must ask for this separately and explain why.';
    case 'authorized': return cfg.id === 'camera' ? 'The camera works. The user can switch it off in Settings at any time.' : 'Alerts, sounds and badges can be delivered.';
    case 'provisional': return 'Trial mode: notifications arrive quietly in Notification Center with no alert, until the user decides to keep them.';
    case 'ephemeral': return 'App Clips only: short-lived permission granted automatically.';
    case 'denied': return 'The user said no, or switched access off in Settings. Asking again shows nothing, so offer a way to open Settings.';
    case 'restricted': return 'A device policy such as Screen Time blocks access. The user cannot change it from your app either.';
    default: return '';
  }
}

const STYLE = `
${S} { container: psim / size; box-sizing: border-box; padding: 12px; font: 14px/1.45 var(--font-ui); color: var(--ink); }
${S} *, ${S} *::before, ${S} *::after { box-sizing: border-box; }
${S} .ps-main { display: flex; gap: 14px; height: 100%; min-height: 0; }
${S} .ps-phone-col { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; min-height: 0; }
${S} .svk-phone { height: auto; max-height: none; width: min(calc((100cqh - 24px) * 0.4615), 34cqw); }
${S} .ps-panel { flex: 1 1 auto; min-width: 0; min-height: 0; display: grid; gap: 10px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: auto auto auto minmax(0, 1fr);
  grid-template-areas: "ctl ctl" "status plist" "code code" "log log"; }
${S} .ps-ctl { grid-area: ctl; display: flex; flex-wrap: wrap; gap: 6px; }
${S} .ps-ctl .svk-ctl { font-size: 12.5px; padding: 6px 9px; display: inline-flex; align-items: center; gap: 5px; }
${S} .ps-ctl .svk-ctl svg { flex: 0 0 auto; }
${S} .ps-short { display: none; }
${S} .ps-tabs { display: none; }
${S} .ps-sec { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
${S} .ps-sec[data-sec="status"] { grid-area: status; }
${S} .ps-sec[data-sec="plist"] { grid-area: plist; }
${S} .ps-sec[data-sec="code"] { grid-area: code; padding: 0; background: none; border: 0; }
${S} .ps-sec[data-sec="log"] { grid-area: log; }
${S} .ps-chips { display: flex; flex-wrap: wrap; gap: 5px; }
${S} .ps-chips .svk-chip { font-size: 11.5px; padding: 2px 8px; font-family: var(--font-code); }
${S} .ps-chips .svk-chip.ps-na { opacity: 0.55; }
${S} .ps-meaning { margin: 8px 0 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.4; }
${S} .ps-acc { margin-top: 6px; font: 11.5px/1.4 var(--font-code); color: var(--ink-3); }
${S} .ps-key { font: 600 11.5px/1.4 var(--font-code); color: var(--type); word-break: break-all; }
${S} .ps-xml { font: 11.5px/1.4 var(--font-code); color: var(--ink-3); }
${S} .ps-plist label { display: block; font-size: 11.5px; color: var(--ink-3); margin: 6px 0 3px; }
${S} .ps-plist input { width: 100%; font: 12.5px/1.3 var(--font-ui); color: var(--ink); background: var(--panel);
  border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; }
${S} .ps-plist input.ps-empty { border-color: var(--bad); background: var(--bad-soft); }
${S} .ps-plist .ps-hint { font-size: 11.5px; color: var(--ink-3); margin-top: 4px; }
${S} .ps-plist .ps-sysmsg { font-size: 12px; color: var(--ink-2); margin-top: 6px; font-style: italic; }
${S} .svk-code { font-size: 11.5px; line-height: 1.45; padding: 6px 0; }
${S} .ps-sec[data-sec="log"] .svk-log { flex: 1; }
${S} .ps-log-entry code { font: inherit; color: var(--fn); }
${S} .svk-log div.ps-log-entry { padding: 3px 0; }

/* Phone content */
${S} .svk-screen { font-size: max(4.4cqw, 9px); }
${S} .ps-app { display: flex; flex-direction: column; min-height: 0; flex: 1; }
${S} .ps-action { padding: 1.2cqh 4cqw 0.4cqh; }
${S} .ps-action .svk-btn { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 2cqw;
  font-size: max(4.2cqw, 9px); }
${S} .ps-action .svk-btn svg { width: 4.6cqw; height: 4.6cqw; }
${S} .svk-row { font-size: max(4.1cqw, 9px); justify-content: space-between; min-height: 0; padding: 2.4cqw 4cqw; }
${S} .svk-row .svk-sub { font-size: max(3.4cqw, 8px); white-space: nowrap; }
${S} .svk-large-title { font-size: max(8cqw, 15px); }
${S} .svk-caption { font-size: max(3.4cqw, 8px); }
${S} .ps-card { margin: 1.2cqh 4cqw 0; background: var(--ios-card); border-radius: 3.6cqw; padding: 3cqw 3.6cqw;
  display: flex; gap: 2.6cqw; align-items: flex-start; font-size: max(3.7cqw, 8.5px); }
${S} .ps-card svg { flex: 0 0 auto; width: 5.4cqw; height: 5.4cqw; margin-top: 0.3cqw; }
${S} .ps-card .svk-btn { margin-top: 2cqw; font-size: max(3.6cqw, 8.5px); padding: 1.8cqw 3.6cqw; }
${S} .ps-tone-warn { color: var(--ios-orange); } ${S} .ps-tone-bad { color: var(--ios-red); }
${S} .ps-tone-ok { color: var(--ios-green); } ${S} .ps-tone-info { color: var(--ios-blue); }
${S} .ps-overlay-sheet { position: absolute; inset: 0; z-index: 8; background: var(--ios-bg); display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; padding: 10cqh 8cqw 6cqh; gap: 2.4cqh; }
${S} .ps-prime-icon { width: 20cqw; height: 20cqw; border-radius: 50%; background: var(--ios-fill); color: var(--ios-blue);
  display: flex; align-items: center; justify-content: center; }
${S} .ps-prime-icon svg { width: 10cqw; height: 10cqw; }
${S} .ps-prime-title { font-size: max(6.4cqw, 12px); font-weight: 700; }
${S} .ps-prime-text { font-size: max(4cqw, 9px); color: var(--ios-label-2); }
${S} .ps-prime-btns { display: flex; flex-direction: column; gap: 1.6cqh; width: 100%; margin-top: 2cqh; }
${S} .svk-alert { width: 80cqw; }
${S} .svk-alert-title { font-size: max(4.6cqw, 9.5px); }
${S} .svk-alert-msg { font-size: max(3.7cqw, 8.5px); }
${S} .svk-alert-btn { font-size: max(4cqw, 9px); }
${S} .ps-row-btns { flex-direction: row; }
${S} .ps-row-btns .svk-alert-btn { flex: 1; }
${S} .ps-map { position: relative; margin-top: 3cqw; border-radius: 3cqw; overflow: hidden; height: 24cqw; }
${S} .ps-map > svg { display: block; width: 100%; height: 100%; }
${S} .ps-precise { position: absolute; top: 1.6cqw; left: 1.6cqw; appearance: none; border: 0; border-radius: 99px;
  background: rgba(255, 255, 255, 0.92); color: #007AFF; font-family: inherit; font-weight: 600;
  font-size: max(3.1cqw, 8px); line-height: 1.2; padding: 1.2cqw 2.6cqw; cursor: pointer; display: inline-flex; gap: 1cqw; align-items: center; }
${S} .ps-precise[aria-pressed="false"] { color: #3c3c43; }
${S} .ps-precise:focus-visible, ${S} .ps-back:focus-visible, ${S} .ps-opt:focus-visible, ${S} .ps-switch:focus-visible,
${S} .ps-appicon:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
${S} .ps-banner { position: absolute; top: 7.5cqh; left: 3cqw; right: 3cqw; z-index: 9; background: var(--ios-alert);
  border-radius: 5cqw; padding: 2.8cqw 3.4cqw; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25); display: flex; gap: 2.6cqw;
  font-size: max(3.5cqw, 8px); animation: ps-drop 0.35s ease-out; }
${S}.ps-reduced .ps-banner { animation: none; }
@keyframes ps-drop { from { transform: translateY(-120%); opacity: 0; } to { transform: none; opacity: 1; } }
${S} .ps-banner b { display: block; }
${S} .ps-banner .ps-banner-app { font-size: max(2.9cqw, 7.5px); color: var(--ios-label-2); text-transform: uppercase; letter-spacing: 0.03em; }
${S} .ps-mini-icon { flex: 0 0 auto; width: 8cqw; height: 8cqw; border-radius: 2cqw; background: #2f8f4e; color: #fff;
  display: flex; align-items: center; justify-content: center; }
${S} .ps-mini-icon svg { width: 5cqw; height: 5cqw; }
/* Settings */
${S} .ps-settings { display: flex; flex-direction: column; flex: 1; min-height: 0; }
${S} .ps-back { align-self: flex-start; appearance: none; border: 0; background: none; color: var(--ios-blue); cursor: pointer;
  font-family: inherit; font-size: max(4cqw, 9px); line-height: 1.2; display: inline-flex; align-items: center; gap: 0.6cqw;
  padding: 1cqh 3cqw 0; }
${S} .ps-back svg { width: 4.6cqw; height: 4.6cqw; }
${S} .ps-sec-h { font-size: max(3.2cqw, 8px); color: var(--ios-label-2); text-transform: uppercase; padding: 1.4cqh 8cqw 0; }
${S} .ps-sec-h + .svk-list { margin-top: 0.6cqh; }
${S} .ps-opt { appearance: none; border: 0; background: none; color: inherit; font: inherit; width: 100%; text-align: left; cursor: pointer; }
${S} .ps-opt[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
${S} .ps-opt svg { color: var(--ios-blue); width: 4.8cqw; height: 4.8cqw; flex: 0 0 auto; }
${S} .ps-foot { font-size: max(3.1cqw, 8px); color: var(--ios-label-2); padding: 0 8cqw; }
${S} .ps-switch { appearance: none; border: 0; cursor: pointer; flex: 0 0 auto; width: 11cqw; height: 6.6cqw; border-radius: 99px;
  background: var(--ios-fill); position: relative; padding: 0; }
${S} .ps-switch::after { content: ""; position: absolute; top: 0.6cqw; left: 0.6cqw; width: 5.4cqw; height: 5.4cqw; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: left 0.2s; }
${S}.ps-reduced .ps-switch::after { transition: none; }
${S} .ps-switch[aria-checked="true"] { background: var(--ios-green); }
${S} .ps-switch[aria-checked="true"]::after { left: 5cqw; }
${S} .ps-switch:disabled { opacity: 0.45; cursor: not-allowed; }
/* Home screen */
${S} .ps-home { position: absolute; inset: 0; padding: 10cqh 6cqw 6cqh; display: flex; flex-direction: column; gap: 3cqh;
  background: linear-gradient(160deg, #3b6ea8, #6a4fa0 55%, #c0567a); color: #fff; }
${S} .ps-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3cqh 4cqw; }
${S} .ps-appicon { appearance: none; border: 0; background: none; color: #fff; padding: 0; font: inherit; cursor: default;
  display: flex; flex-direction: column; align-items: center; gap: 0.8cqh; font-size: max(2.8cqw, 7px); }
${S} button.ps-appicon { cursor: pointer; }
${S} .ps-appicon span.ps-tile { width: 14cqw; height: 14cqw; border-radius: 3.6cqw; display: flex; align-items: center;
  justify-content: center; color: #fff; }
${S} .ps-appicon span.ps-tile svg { width: 8cqw; height: 8cqw; }
${S} .ps-home-note { margin-top: auto; background: rgba(0, 0, 0, 0.35); border-radius: 4cqw; padding: 3cqw 4cqw; font-size: max(3.4cqw, 8px); }
/* Camera viewfinder */
${S} .ps-scanner { position: absolute; inset: 0; z-index: 4; background: #0b0f0c; color: #fff; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4cqh; padding: 10cqh 8cqw 6cqh; text-align: center; }
${S} .ps-frame { width: 60cqw; height: 40cqw; position: relative;
  background: linear-gradient(135deg, #24412e, #3c5b33 40%, #6b5a35); border-radius: 2cqw; }
${S} .ps-frame::before, ${S} .ps-frame::after { content: ""; position: absolute; inset: -2cqw; border: 0.8cqw solid #ffd60a; border-radius: 3cqw;
  clip-path: polygon(0 0, 25% 0, 25% 6%, 6% 6%, 6% 25%, 0 25%, 0 75%, 6% 75%, 6% 94%, 25% 94%, 25% 100%, 0 100%,
    100% 100%, 75% 100%, 75% 94%, 94% 94%, 94% 75%, 100% 75%, 100% 25%, 94% 25%, 94% 6%, 75% 6%, 75% 0, 100% 0); }
${S} .ps-frame::after { display: none; }
${S} .ps-sign { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #6b4423; color: #f3e6c8;
  font-size: max(3.2cqw, 8px); font-weight: 700; padding: 1.4cqw 3cqw; border-radius: 1cqw; white-space: nowrap; }
${S} .ps-fade { animation: ps-fade 0.2s ease-out; }
${S}.ps-reduced .ps-fade { animation: none; }
@keyframes ps-fade { from { opacity: 0; } to { opacity: 1; } }

/* Compact: narrow and short (a panel beside code) */
@container psim (max-width: 535px) {
  ${S} .ps-main { gap: 10px; }
  ${S} .svk-phone { width: min(calc((100cqh - 24px) * 0.4615), 47cqw); }
  ${S} .ps-panel { display: flex; flex-direction: column; gap: 8px; }
  ${S} .ps-ctl .svk-ctl { font-size: 11.5px; padding: 5px 7px; }
  ${S} .ps-long { display: none; }
  ${S} .ps-short { display: inline; }
  ${S} .ps-tabs { display: flex; gap: 2px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 2px; }
  ${S} .ps-tab { flex: 1; appearance: none; border: 0; background: none; color: var(--ink-2); font: 600 11.5px/1.2 var(--font-ui);
    padding: 5px 2px; border-radius: 4px; cursor: pointer; }
  ${S} .ps-tab[aria-selected="true"] { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }
  ${S} .ps-tab:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
  ${S} .ps-sec { display: none; flex: 1 1 auto; overflow: auto; }
  ${S}[data-tab="status"] .ps-sec[data-sec="status"], ${S}[data-tab="plist"] .ps-sec[data-sec="plist"],
  ${S}[data-tab="code"] .ps-sec[data-sec="code"], ${S}[data-tab="log"] .ps-sec[data-sec="log"] { display: flex; }
  ${S} .ps-sec[data-sec="code"] .svk-code { flex: 1; font-size: 10.5px; }
}
/* Stacked: narrow but tall (a phone-width page) */
@container psim (max-width: 535px) and (min-height: 576px) {
  ${S} .ps-main { flex-direction: column; }
  ${S} .ps-phone-col { flex: 0 0 52%; }
  ${S} .svk-phone { aspect-ratio: auto; width: min(100%, 250px); height: 100%; }
}
`;

export default {
  name: 'services-permission-sim',
  css: phoneCss(S) + codeCss(S) + panelCss(S) + STYLE,
  mount(el, props = {}, ctx = {}) {
    el.classList.add(`w-${NAME}`);
    const reduced = !!ctx.reducedMotion;
    if (reduced) el.classList.add('ps-reduced');
    const icon = (n, size = 16, label = '') => (ctx.icon ? ctx.icon(n, size, label) : '');
    const app = String(props.appName || 'Trailhead');
    const feature = ['camera', 'notifications'].includes(props.feature) ? props.feature : 'location';
    const cfg = featureConfig(feature, app);
    const id = idScope(NAME);
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

    const st = {
      status: 'notDetermined',
      temporary: false,
      precise: true,
      alertPrecise: true,
      restricted: false,
      prime: false,
      provisional: false,
      screen: 'app', // app | settings | home | scanner
      overlay: null, // null | prime | alert
      appView: 'list', // list | nearby | recovery | restricted | reminder
      crashed: false,
      banner: false,
      purpose: cfg.purpose,
      active: new Set(),
      log: [],
      tab: 'status',
    };

    const effective = () => (st.restricted ? 'restricted' : st.status);
    const tt = (s) => `<code>${esc(s)}</code>`;

    function log(html, tone = '') {
      st.log.unshift({ html, tone });
      if (st.log.length > 40) st.log.pop();
    }

    // ---------- Phone screens ----------
    function trailRows() {
      if (st.appView === 'nearby' && GRANTED.has(effective())) {
        return [...TRAILS].sort((a, b) => a.km - b.km).map((t) => {
          const d = st.precise ? `${t.km.toFixed(1)} km` : `about ${Math.max(1, Math.round(t.km))} km`;
          return `<div class="svk-row"><span>${esc(t.name)}</span><span class="svk-sub">${d}</span></div>`;
        }).join('');
      }
      return [...TRAILS].sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => `<div class="svk-row"><span>${esc(t.name)}</span><span class="svk-sub">${esc(t.area)}</span></div>`).join('');
    }

    function appCard() {
      if (st.appView === 'recovery') {
        return `<div class="ps-card ps-fade" role="status">${icon('exclamationmark.triangle', 16)}<div>
          <div>${esc(cfg.offCard)}</div>
          <button class="svk-btn" id="${id('open-settings-card')}" data-act="settings-from-app">Open Settings</button></div></div>`;
      }
      if (st.appView === 'restricted') {
        return `<div class="ps-card ps-fade" role="status"><span class="ps-tone-bad">${icon('lock.fill', 16)}</span><div>${esc(cfg.restrictedCard)}</div></div>`;
      }
      if (st.appView === 'reminder') {
        const text = st.status === 'provisional'
          ? 'Reminder scheduled. It will arrive quietly in Notification Center.'
          : 'Sunset reminder set for 7:12 PM.';
        return `<div class="ps-card ps-fade" role="status"><span class="ps-tone-ok">${icon('checkmark.circle.fill', 16)}</span><div>${text}</div></div>`;
      }
      if (st.appView === 'nearby' && cfg.id === 'location' && !st.precise) {
        return `<div class="ps-card ps-fade"><span class="ps-tone-info">${icon('info.circle', 16)}</span><div>Approximate location: distances are rounded.</div></div>`;
      }
      return '';
    }

    function caption() {
      if (cfg.id === 'location' && st.appView === 'nearby' && GRANTED.has(effective())) {
        return st.precise ? 'Nearest first, from your location' : 'Nearest first (approximate)';
      }
      return 'All trails, A to Z';
    }

    function mapThumb() {
      return `<div class="ps-map">
        <svg viewBox="0 0 200 80" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
          <rect width="200" height="80" fill="var(--ios-map-land)"/>
          <path d="M0 62 C40 50 70 74 120 60 S180 52 200 58 V80 H0Z" fill="var(--ios-map-water)"/>
          <rect x="120" y="8" width="44" height="26" rx="4" fill="var(--ios-map-park)"/>
          <path d="M0 30 H200 M60 0 V80 M140 0 V48 M0 12 L90 44" stroke="var(--ios-map-road)" stroke-width="4" fill="none"/>
          ${st.alertPrecise
            ? '<circle cx="100" cy="36" r="5.5" fill="#007AFF" stroke="#fff" stroke-width="2"/>'
            : '<circle cx="100" cy="36" r="24" fill="rgba(0,122,255,0.18)" stroke="rgba(0,122,255,0.6)" stroke-width="1.5"/>'}
        </svg>
        <button class="ps-precise" id="${id('precise')}" data-act="precise" aria-pressed="${st.alertPrecise}"
          aria-label="Precise location ${st.alertPrecise ? 'on' : 'off'}">${icon('location.fill', 10)}Precise: ${st.alertPrecise ? 'On' : 'Off'}</button>
      </div>`;
    }

    function overlay() {
      if (st.overlay === 'prime') {
        const p = cfg.prime;
        return `<div class="ps-overlay-sheet ps-fade" role="dialog" aria-label="${esc(app)} explains the request">
          <div class="ps-prime-icon">${icon(p.icon, 28)}</div>
          <div class="ps-prime-title">${esc(p.title)}</div>
          <div class="ps-prime-text">${esc(p.text)}</div>
          <div class="ps-prime-btns">
            <button class="svk-btn" id="${id('prime-continue')}" data-act="prime-continue">Continue</button>
          </div></div>`;
      }
      if (st.overlay === 'alert') {
        const btnClass = cfg.buttons.length === 2 ? 'svk-alert-btns ps-row-btns' : 'svk-alert-btns';
        const btns = cfg.buttons.map(([act, label], i) => `<button class="svk-alert-btn${i === cfg.buttons.length - 1 && cfg.buttons.length === 3 ? ' svk-strong' : ''}${cfg.buttons.length === 2 && act === 'allow' ? ' svk-strong' : ''}"
          id="${id(`alert-${act}`)}" data-act="alert-${act}">${esc(label)}</button>`).join('');
        return `<div class="svk-scrim"><div class="svk-alert ps-fade" role="alertdialog" aria-modal="true"
            aria-labelledby="${id('alert-title')}" aria-describedby="${id('alert-msg')}">
          <div class="svk-alert-title" id="${id('alert-title')}">${esc(cfg.alertTitle)}</div>
          <div class="svk-alert-msg" id="${id('alert-msg')}">${esc(st.purpose)}</div>
          ${cfg.id === 'location' ? mapThumb() : ''}
          <div class="${btnClass}">${btns}</div></div></div>`;
      }
      return '';
    }

    function banner() {
      if (!st.banner) return '';
      return `<div class="ps-banner" role="status"><span class="ps-mini-icon">${icon('leaf', 14)}</span>
        <div><span class="ps-banner-app">${esc(app)} &middot; now</span><b>Sunset in 30 minutes</b>Head back to the trailhead before dark.</div></div>`;
    }

    function appScreen() {
      return `<div class="ps-app">
        <div class="svk-large-title">${esc(app)}</div>
        <div class="svk-caption">${caption()}</div>
        <div class="ps-action"><button class="svk-btn" id="${id('feature')}" data-act="feature">${icon(cfg.actionIcon, 14)}<span>${esc(cfg.action)}</span></button></div>
        ${appCard()}
        <div class="svk-list">${trailRows()}</div>
      </div>${overlay()}${banner()}`;
    }

    function settingsScreen() {
      const back = `<button class="ps-back" id="${id('back')}" data-act="back" aria-label="Back to ${esc(app)}">${icon('chevron.left', 14)}${esc(app)}</button>`;
      const locked = st.restricted;
      const lockNote = locked ? `<div class="ps-foot">This setting is restricted by Screen Time.</div>` : '';
      if (cfg.id === 'location') {
        const opts = [
          ['never', 'Never', 'denied'],
          ['ask', 'Ask Next Time Or When I Share', 'notDetermined'],
          ['using', 'While Using the App', 'authorizedWhenInUse'],
          ['always', 'Always', 'authorizedAlways'],
        ];
        const rows = opts.map(([key, label, status]) => {
          const on = !locked && st.status === status;
          return `<button class="svk-row ps-opt" role="radio" aria-checked="${on}" id="${id(`opt-${key}`)}" data-act="opt" data-status="${status}"
            ${locked ? 'aria-disabled="true"' : ''}><span>${esc(label)}</span>${on ? icon('checkmark', 14) : ''}</button>`;
        }).join('');
        return `<div class="ps-settings">${back}<div class="svk-large-title">Location</div>
          <div class="ps-sec-h">Allow location access</div>
          <div class="svk-list" role="radiogroup" aria-label="Allow location access">${rows}</div>
          <div class="ps-foot">App explanation: “${esc(st.purpose || '(missing)')}”</div>
          <div class="svk-list"><div class="svk-row"><span id="${id('precise-label')}">Precise Location</span>
            <button class="ps-switch" role="switch" id="${id('precise-switch')}" data-act="precise-setting" aria-labelledby="${id('precise-label')}"
              aria-checked="${st.precise}" ${locked ? 'disabled' : ''}></button></div></div>${lockNote}</div>`;
      }
      const title = cfg.id === 'camera' ? app : 'Notifications';
      const rowLabel = cfg.id === 'camera' ? 'Camera' : 'Allow Notifications';
      const head = cfg.id === 'camera' ? `<div class="ps-sec-h">Allow ${esc(app)} to access</div>` : '';
      if (st.status === 'notDetermined' && !locked) {
        return `<div class="ps-settings">${back}<div class="svk-large-title">${esc(title)}</div>${head}
          <div class="svk-list"><div class="svk-row"><span class="svk-sub">No ${esc(rowLabel)} switch yet</span></div></div>
          <div class="ps-foot">${esc(app)} has not asked for ${cfg.noun} yet, so Settings has nothing to switch. The switch appears after the first request.</div></div>`;
      }
      const on = !locked && GRANTED.has(st.status);
      return `<div class="ps-settings">${back}<div class="svk-large-title">${esc(title)}</div>${head}
        <div class="svk-list"><div class="svk-row"><span id="${id('toggle-label')}">${esc(rowLabel)}</span>
          <button class="ps-switch" role="switch" id="${id('toggle')}" data-act="toggle-setting" aria-labelledby="${id('toggle-label')}"
            aria-checked="${on}" ${locked ? 'disabled' : ''}></button></div></div>
        ${st.status === 'provisional' ? '<div class="ps-foot">Currently delivering quietly (provisional).</div>' : ''}${lockNote}</div>`;
    }

    function homeScreen() {
      const tiles = [
        ['Maps', 'map', '#3d8bd9'], ['Camera', 'camera', '#55585e'], ['Photos', 'photo', '#e0773a'], ['Mail', 'envelope', '#2f7bf5'],
        ['Clock', 'clock', '#1c1c1e'], ['Weather', 'cloud.sun', '#3aa0e8'], ['Settings', 'gear', '#8e8e93'],
      ];
      const icons = tiles.map(([label, sym, color]) => `<span class="ps-appicon" aria-hidden="true"><span class="ps-tile" style="background:${color}">${icon(sym, 16)}</span>${label}</span>`).join('');
      const note = st.crashed
        ? `<div class="ps-home-note" role="status">${esc(app)} quit unexpectedly. Tap its icon to relaunch.</div>`
        : `<div class="ps-home-note" role="status">${esc(app)} is in the background. Tap its icon to return.</div>`;
      return `<div class="ps-home ps-fade"><div class="ps-grid">
        <button class="ps-appicon" id="${id('reopen')}" data-act="reopen" aria-label="Open ${esc(app)}"><span class="ps-tile" style="background:#2f8f4e">${icon('leaf', 16)}</span>${esc(app)}</button>
        ${icons}</div>${note}</div>`;
    }

    function scannerScreen() {
      return `<div class="ps-app"><div class="svk-large-title">${esc(app)}</div></div>
        <div class="ps-scanner ps-fade" role="dialog" aria-label="Camera preview">
          <div class="ps-frame"><span class="ps-sign">RIDGE OVERLOOK 2.3 km</span></div>
          <div>Point the camera at a trail sign</div>
          <button class="svk-btn" id="${id('scanner-done')}" data-act="scanner-done">Done</button></div>`;
    }

    function phoneScreen() {
      if (st.screen === 'settings') return settingsScreen();
      if (st.screen === 'home') return homeScreen();
      if (st.screen === 'scanner') return scannerScreen();
      return appScreen();
    }

    // ---------- Panel ----------
    function statusHtml() {
      const cur = effective();
      const chips = cfg.statuses.map((s) => {
        const on = s === cur;
        const label = on && st.temporary && s === 'authorizedWhenInUse' ? `.${s} (this session only)` : `.${s}`;
        const na = s === 'ephemeral' ? ' ps-na' : '';
        return `<span class="svk-chip${on ? ' svk-on' : ''}${na}" ${on ? 'aria-current="true"' : ''}>${esc(label)}</span>`;
      }).join('');
      const acc = cfg.id === 'location' && GRANTED.has(cur)
        ? `<div class="ps-acc">accuracyAuthorization: .${st.precise ? 'fullAccuracy' : 'reducedAccuracy'}</div>` : '';
      return `<p class="svk-kicker">Authorization status</p><div class="ps-chips">${chips}</div>${acc}
        <p class="ps-meaning">${esc(meaning(cur, st, cfg))}</p>`;
    }

    function plistHtml() {
      if (!cfg.key) {
        return `<p class="svk-kicker">Info.plist</p>
          <div class="ps-key">No usage-description key</div>
          <div class="ps-hint">Notifications need no Info.plist entry: the system writes the message itself.</div>
          <div class="ps-sysmsg">“${esc(cfg.purpose)}”</div>`;
      }
      return `<p class="svk-kicker">Info.plist</p>
        <div class="ps-xml">&lt;key&gt;<span class="ps-key">${esc(cfg.key)}</span>&lt;/key&gt;</div>
        <label for="${id('purpose')}">Purpose string (shown in the alert)</label>
        <input id="${id('purpose')}" type="text" value="${esc(st.purpose)}" autocomplete="off" spellcheck="false">
        <div class="ps-hint" id="${id('purpose-hint')}"></div>`;
    }

    const controls = [
      ['prime', 'Prime before asking', 'Prime first', 'Prime', 'hand.thumbsup', true],
      ...(cfg.id === 'notifications' ? [['provisional', 'Ask provisionally (quiet trial)', 'Provisional', 'Quiet trial', 'bell', true]] : []),
      ['background', 'Send app to background', 'Background', 'Background', 'arrow.down', false],
      ['settings', 'Open Settings', 'Open Settings', 'Settings', 'gear', false],
      ...(cfg.canRestrict ? [['restrict', 'Screen Time restriction', 'Screen Time', 'Screen Time', 'lock', true]] : []),
      ['reset', 'Reset (delete and reinstall the app)', 'Reinstall', 'Reset', 'arrow.clockwise', false],
    ];

    el.dataset.tab = st.tab;
    el.innerHTML = `<div class="ps-main">
      <div class="ps-phone-col" id="${id('phone')}"></div>
      <div class="ps-panel">
        <div class="ps-ctl" role="toolbar" aria-label="Simulation controls">
          ${controls.map(([key, full, long, short, sym, toggle]) => `<button class="svk-ctl" id="${id(`ctl-${key}`)}" data-act="ctl-${key}"
            ${toggle ? 'aria-pressed="false"' : ''} aria-label="${esc(full)}" title="${esc(full)}">${icon(sym, 13)}<span class="ps-long">${esc(long)}</span><span class="ps-short">${esc(short)}</span></button>`).join('')}
        </div>
        <div class="ps-tabs" role="tablist" aria-label="Simulator details">
          ${[['status', 'Status'], ['code', 'Code'], ['plist', 'Plist'], ['log', 'Log']].map(([key, label]) =>
            `<button class="ps-tab" role="tab" id="${id(`tab-${key}`)}" data-tab="${key}" aria-controls="${id(`sec-${key}`)}"
              aria-selected="${key === st.tab}" tabindex="${key === st.tab ? 0 : -1}">${label}</button>`).join('')}
        </div>
        <section class="svk-panel ps-sec" data-sec="status" id="${id('sec-status')}" role="tabpanel" aria-labelledby="${id('tab-status')}"></section>
        <section class="svk-panel ps-sec ps-plist" data-sec="plist" id="${id('sec-plist')}" role="tabpanel" aria-labelledby="${id('tab-plist')}">${plistHtml()}</section>
        <section class="ps-sec" data-sec="code" id="${id('sec-code')}" role="tabpanel" aria-labelledby="${id('tab-code')}"
          aria-label="Swift code; the highlighted lines ran last"><div class="svk-code" id="${id('code')}"></div></section>
        <section class="svk-panel ps-sec" data-sec="log" id="${id('sec-log')}" role="tabpanel" aria-labelledby="${id('tab-log')}">
          <p class="svk-kicker">Event log (newest first)</p><div class="svk-log" id="${id('log')}" aria-live="polite"></div></section>
      </div></div>`;

    const phoneCol = el.querySelector(`#${id('phone')}`);
    const statusSec = el.querySelector(`#${id('sec-status')}`);
    const codeEl = el.querySelector(`#${id('code')}`);
    const logEl = el.querySelector(`#${id('log')}`);
    const purposeInput = el.querySelector(`#${id('purpose')}`);
    const purposeHint = el.querySelector(`#${id('purpose-hint')}`);

    function render(focusId) {
      const prevFocus = focusId || (el.contains(document.activeElement) ? document.activeElement.id : '');
      phoneCol.innerHTML = phoneHtml(phoneScreen(), { label: `Simulated iPhone running ${app}` });
      statusSec.innerHTML = statusHtml();
      codeEl.innerHTML = codeHtml(cfg.code(st), st.active);
      logEl.innerHTML = st.log.map((e) => `<div class="ps-log-entry${e.tone ? ` svk-${e.tone}` : ''}">${e.html}</div>`).join('');
      for (const [key, , , , , toggle] of controls) {
        if (!toggle) continue;
        const on = key === 'prime' ? st.prime : key === 'provisional' ? st.provisional : st.restricted;
        el.querySelector(`#${id(`ctl-${key}`)}`).setAttribute('aria-pressed', String(on));
      }
      if (purposeInput) {
        const empty = !st.purpose.trim();
        purposeInput.classList.toggle('ps-empty', empty);
        purposeHint.textContent = empty
          ? (cfg.id === 'camera' ? 'Empty: requesting the camera will crash the app.' : 'Empty: iOS will ignore the request and show no alert.')
          : 'Edit it and watch the alert text change.';
      }
      const target = prevFocus && el.querySelector(`#${CSS.escape(prevFocus)}`);
      if (target) target.focus({ preventScroll: true });
      else if (prevFocus && el.contains(document.activeElement) === false) {
        const fallback = el.querySelector(`#${id('feature')}`) || el.querySelector(`#${id('reopen')}`) || el.querySelector(`#${id('back')}`);
        if (fallback) fallback.focus({ preventScroll: true });
      }
    }

    // ---------- Behavior ----------
    function grantedView(fromAlert) {
      if (cfg.id === 'location') {
        st.appView = 'nearby';
        log(`${tt('showNearbyTrails()')} ran: trails are now sorted by distance${st.precise ? '' : ' (approximate, rounded)'}.`, 'ok');
      } else if (cfg.id === 'camera') {
        st.screen = 'scanner';
        log(`${tt('showScanner()')} ran: the camera preview opens.`, 'ok');
      } else {
        st.appView = 'reminder';
        log(`${tt('scheduleSunsetReminder()')} ran${fromAlert ? ' after the app re-checked the settings' : ''}.`, 'ok');
        if (st.status === 'provisional') {
          log('Provisional: the reminder will arrive quietly in Notification Center, with no banner or sound.');
        } else {
          later(() => { st.banner = true; render(); later(() => { st.banner = false; render(); }, 3200); }, reduced ? 0 : 900);
        }
      }
    }

    function request() {
      st.active = new Set(cfg.branch.notDetermined);
      if (cfg.key && !st.purpose.trim()) {
        if (cfg.id === 'camera') {
          st.screen = 'home';
          st.crashed = true;
          st.overlay = null;
          log(`${esc(app)} crashed: “This app has crashed because it attempted to access privacy-sensitive data without a usage description. The app’s Info.plist must contain an ${tt(cfg.key)} key with a string value explaining to the user how the app uses this data.”`, 'bad');
        } else {
          log(`${tt(cfg.requestCall)} did nothing. Info.plist has no ${tt(cfg.key)}, so iOS ignored the request, showed no alert, and printed a warning in the Xcode console.`, 'warn');
        }
        return;
      }
      if (cfg.id === 'notifications' && st.provisional) {
        st.status = 'provisional';
        log(`${tt('requestAuthorization(options:)')} with ${tt('.provisional')} returned true without any alert. Status is now ${tt('.provisional')}.`, 'ok');
        st.active = new Set(cfg.afterAllow);
        grantedView(true);
        return;
      }
      st.overlay = 'alert';
      st.alertPrecise = true;
      log(cfg.key
        ? `${tt(cfg.requestCall)} ran. iOS shows its own alert with your purpose string; your code cannot change the buttons.`
        : `${tt(cfg.requestCall)} ran. iOS shows its own alert and writes the text itself; your code cannot change it.`);
    }

    function tapFeature() {
      const s = effective();
      st.active = new Set(cfg.branch[s] || []);
      st.banner = false;
      if (s === 'notDetermined') {
        if (st.prime) {
          st.overlay = 'prime';
          log('Your priming screen appeared first. It has exactly one button, Continue, which leads straight to the system alert, as Apple\'s design guidelines ask.');
          return;
        }
        request();
        return;
      }
      if (GRANTED.has(s)) {
        log(`Status is ${tt(`.${s}`)}, so no alert is needed.`);
        grantedView(false);
        return;
      }
      if (s === 'denied') {
        st.appView = 'recovery';
        log(`Status is ${tt('.denied')}, so the app does not ask again (iOS would ignore it: the system alert appears once per install). ${tt('showOpenSettingsPrompt()')} shows a recovery card instead.`, 'warn');
        return;
      }
      st.appView = 'restricted';
      log(`Status is ${tt('.restricted')}: a device policy blocks access and nobody can grant it from this app. ${tt('showRestrictedMessage()')} ran.`, 'warn');
    }

    function answer(choice) {
      st.overlay = null;
      const label = (cfg.buttons.find(([k]) => k === choice) || [])[1] || choice;
      if (choice === 'deny') {
        st.status = 'denied';
        st.temporary = false;
        st.appView = 'list';
        st.active = new Set(cfg.afterDeny);
        log(`The user chose “${esc(label)}”. Status is now ${tt('.denied')}. The app keeps working without ${cfg.noun}.`, 'bad');
        return;
      }
      if (cfg.id === 'location') {
        st.status = 'authorizedWhenInUse';
        st.temporary = choice === 'once';
        st.precise = st.alertPrecise;
        log(`The user chose “${esc(label)}”${st.precise ? '' : ' with Precise off'}. ${tt('locationManagerDidChangeAuthorization(_:)')} reports ${tt('.authorizedWhenInUse')}${st.temporary ? ' for this session only' : ''}.`, 'ok');
      } else {
        st.status = 'authorized';
        log(`The user chose “Allow”. ${tt(cfg.requestCall)} returned true; status is ${tt('.authorized')}.`, 'ok');
      }
      st.active = new Set(cfg.afterAllow);
      grantedView(true);
    }

    function expireAllowOnce(reason) {
      if (st.temporary && st.status === 'authorizedWhenInUse') {
        st.status = 'notDetermined';
        st.temporary = false;
        st.appView = 'list';
        log(`Allow Once expired when ${reason}. Status is back to ${tt('.notDetermined')}, so the next request shows the alert again.`, 'warn');
      }
    }

    function openSettings(fromApp) {
      st.overlay = null;
      st.banner = false;
      if (fromApp) log(`${tt('UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)')} opened Settings on ${esc(app)}’s page.`);
      else log(`The user opened Settings > Apps > ${esc(app)}.`);
      expireAllowOnce('the app left the screen');
      st.screen = 'settings';
    }

    function backToApp() {
      st.screen = 'app';
      const s = effective();
      if (cfg.id === 'location' && GRANTED.has(s)) {
        st.active = new Set(cfg.branch[s]);
        log(`Back in ${esc(app)}. The delegate reports ${tt(`.${s}`)} and the app refreshes.`);
        grantedView(false);
      } else {
        if (st.appView !== 'reminder' || !GRANTED.has(s)) st.appView = 'list';
        log(`Back in ${esc(app)}. Status is ${tt(`.${s}`)}.`);
      }
    }

    function reset() {
      Object.assign(st, {
        status: 'notDetermined', temporary: false, precise: true, alertPrecise: true, restricted: false,
        screen: 'app', overlay: null, appView: 'list', crashed: false, banner: false, active: new Set(),
      });
      st.log = [];
      log(`${esc(app)} was deleted and reinstalled. Every permission is back to ${tt('.notDetermined')}.`);
    }

    function onClick(e) {
      const tab = e.target.closest('.ps-tab');
      if (tab && el.contains(tab)) { selectTab(tab.dataset.tab, true); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn || !el.contains(btn) || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      const act = btn.dataset.act;
      let focus = '';
      switch (act) {
        case 'feature': tapFeature(); focus = st.overlay === 'alert' ? id(`alert-${cfg.buttons[0][0]}`) : st.overlay === 'prime' ? id('prime-continue') : ''; break;
        case 'prime-continue': st.overlay = null; log('The user tapped Continue on your priming screen.'); request(); focus = st.overlay === 'alert' ? id(`alert-${cfg.buttons[0][0]}`) : id('feature'); break;
        case 'alert-once': case 'alert-allow': case 'alert-deny': answer(act.slice(6)); focus = st.screen === 'scanner' ? id('scanner-done') : id('feature'); break;
        case 'precise': st.alertPrecise = !st.alertPrecise; focus = id('precise'); break;
        case 'settings-from-app': openSettings(true); focus = id('back'); break;
        case 'back': backToApp(); focus = st.screen === 'scanner' ? id('scanner-done') : id('feature'); break;
        case 'opt': {
          const status = btn.dataset.status;
          st.status = status;
          st.temporary = false;
          st.appView = 'list';
          const label = btn.textContent.trim();
          log(`In Settings the user picked “${esc(label)}”. The app will read ${tt(`.${status}`)}.`, GRANTED.has(status) ? 'ok' : status === 'denied' ? 'bad' : '');
          focus = btn.id;
          break;
        }
        case 'precise-setting':
          st.precise = !st.precise;
          log(`Precise Location switched ${st.precise ? 'on' : 'off'}: ${tt(`.${st.precise ? 'fullAccuracy' : 'reducedAccuracy'}`)}.`);
          focus = btn.id;
          break;
        case 'toggle-setting': {
          const on = !GRANTED.has(st.status);
          st.status = on ? 'authorized' : 'denied';
          st.appView = 'list';
          log(`In Settings the user switched ${cfg.id === 'camera' ? 'Camera' : 'Allow Notifications'} ${on ? 'on' : 'off'}. Status is now ${tt(`.${st.status}`)}.`, on ? 'ok' : 'bad');
          focus = btn.id;
          break;
        }
        case 'reopen':
          st.screen = 'app';
          if (st.crashed) { st.crashed = false; log(`${esc(app)} relaunched. Add ${tt(cfg.key || '')} to Info.plist to stop the crash.`, 'warn'); }
          else log(`${esc(app)} returned to the foreground.`);
          focus = id('feature');
          break;
        case 'scanner-done': st.screen = 'app'; focus = id('feature'); break;
        case 'ctl-prime':
          st.prime = !st.prime;
          log(st.prime ? 'Priming on: your own screen explains the benefit before the system alert.' : 'Priming off: the system alert appears right away.');
          focus = btn.id;
          break;
        case 'ctl-provisional':
          st.provisional = !st.provisional;
          log(st.provisional ? `Asking provisionally: the request adds ${tt('.provisional')} and shows no alert.` : 'Asking normally: the request shows the alert.');
          focus = btn.id;
          break;
        case 'ctl-background':
          st.overlay = null;
          st.banner = false;
          if (st.screen === 'home') { focus = btn.id; break; }
          st.screen = 'home';
          log(`${esc(app)} moved to the background.`);
          expireAllowOnce('the app went to the background');
          focus = btn.id;
          break;
        case 'ctl-settings': openSettings(false); focus = btn.id; break;
        case 'ctl-restrict':
          st.restricted = !st.restricted;
          if (st.appView === 'restricted' || st.appView === 'nearby' || st.appView === 'recovery') st.appView = 'list';
          log(st.restricted
            ? `Screen Time now blocks ${cfg.noun}. The status reads ${tt('.restricted')}, whatever the user chose before.`
            : `The restriction was lifted. The status is ${tt(`.${st.status}`)} again.`, st.restricted ? 'warn' : '');
          focus = btn.id;
          break;
        case 'ctl-reset': reset(); focus = btn.id; break;
        default: return;
      }
      render(focus);
    }

    function selectTab(key, focus) {
      st.tab = key;
      el.dataset.tab = key;
      el.querySelectorAll('.ps-tab').forEach((t) => {
        const on = t.dataset.tab === key;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
    }

    function onKeydown(e) {
      const tab = e.target.closest('.ps-tab');
      if (!tab) return;
      const tabs = [...el.querySelectorAll('.ps-tab')];
      const i = tabs.indexOf(tab);
      let next = -1;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      selectTab(tabs[next].dataset.tab, true);
    }

    function onInput(e) {
      if (e.target !== purposeInput) return;
      st.purpose = purposeInput.value;
      render(purposeInput.id);
    }

    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKeydown);
    el.addEventListener('input', onInput);

    log(`${esc(app)} launched. Status is ${tt('.notDetermined')}: the app has never asked for ${cfg.noun}.`);
    render();

    return {
      destroy() {
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKeydown);
        el.removeEventListener('input', onInput);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'ps-reduced');
        delete el.dataset.tab;
      },
    };
  },
};
