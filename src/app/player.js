// Shared step player: Play/Pause, Prev/Next, Restart, a scrubber and speed
// control, driving any visual through an adapter:
//   adapter = { mount(el), show(frame, { animate }), destroy() }
// Frames are opaque to the player except for `caption` (the narration for the
// frame) and `label` (a short position suffix, e.g. a trace's "about to run
// line 4").
//
// The player renders its controls into `controlsEl`, the caption into
// `captionEl`, and mounts the adapter into `visualEl`. It never autoplays on
// creation. Exactly one timer exists while playing; it is cleared on pause,
// on destroy, when the tab hides, and when the last frame is reached.
// Captions announce through an aria-live region only for manual steps and on
// pause, so autoplay does not flood a screen reader.
import { icon } from './icons.js';

const BASE_MS = 1700; // dwell per frame at 1x
const SPEEDS = [0.5, 1, 2];

// Live players, for leak checks (e2e asserts this empties on navigation).
export const livePlayers = new Set();
if (typeof window !== 'undefined') window.__stepPlayers = livePlayers;

export function createPlayer(opts = {}) {
  const {
    visualEl, captionEl, controlsEl,
    frames = [],
    adapter,
    reducedMotion = false,
    onFrame = null,
    posClass = '',
    btnClass = '',
    prevClass = '',
    nextClass = '',
    label = 'Step player',
  } = opts;
  if (!visualEl || !controlsEl || !adapter) throw new Error('createPlayer needs visualEl, controlsEl and an adapter');

  let framesNow = frames;
  let index = 0;
  let playing = false;
  let speed = 1;
  let timer = null;
  let destroyed = false;

  const root = controlsEl;
  root.classList.add('player-ctl');
  root.innerHTML = `
    <button type="button" class="btn ghost small player-restart ${btnClass}" aria-label="Restart from the first step" title="Restart">${icon('arrow.clockwise', 14)}</button>
    <button type="button" class="btn ghost small player-prev ${btnClass} ${prevClass}" aria-label="Previous step">${icon('chevron.left', 14)}</button>
    <button type="button" class="btn primary small player-play" aria-label="Play" title="Play or pause (Space, when the player has focus)">${icon('play.fill', 13)} <span>Play</span></button>
    <button type="button" class="btn ghost small player-next ${btnClass} ${nextClass}" aria-label="Next step">${icon('chevron.right', 14)}</button>
    <input type="range" class="player-scrub ${posClass === 'trace' ? 'trace-range' : ''}" min="0" max="0" value="0" step="1" aria-label="Step scrubber">
    <span class="player-pos ${posClass === 'trace' ? 'trace-pos' : ''}" aria-hidden="true"></span>
    <label class="player-speed"><span class="sr-only">Playback speed</span><select class="player-speed-sel" aria-label="Playback speed">${SPEEDS.map((s) => `<option value="${s}" ${s === 1 ? 'selected' : ''}>${s}×</option>`).join('')}</select></label>`;
  const btnRestart = root.querySelector('.player-restart');
  const btnPrev = root.querySelector('.player-prev');
  const btnPlay = root.querySelector('.player-play');
  const btnNext = root.querySelector('.player-next');
  const scrub = root.querySelector('.player-scrub');
  const pos = root.querySelector('.player-pos');
  const speedSel = root.querySelector('.player-speed-sel');

  if (captionEl) {
    captionEl.classList.add('player-caption');
    captionEl.setAttribute('aria-live', 'polite');
  }
  visualEl.classList.add('player-visual');
  if (reducedMotion) visualEl.dataset.reduced = 'true';
  adapter.mount(visualEl);

  function captionOf(f) { return f && f.caption ? String(f.caption) : ''; }

  function draw({ announce = false } = {}) {
    const n = framesNow.length;
    const f = framesNow[index];
    scrub.max = String(Math.max(0, n - 1));
    scrub.value = String(index);
    scrub.disabled = n === 0;
    btnPrev.disabled = index <= 0;
    btnNext.disabled = index >= n - 1;
    btnRestart.disabled = n === 0 || index === 0;
    btnPlay.disabled = n === 0;
    pos.textContent = n ? `Step ${index + 1} of ${n}${f && f.label ? ` · ${f.label}` : ''}` : 'No steps';
    if (captionEl) {
      // During autoplay the live region is off; the visible text still updates.
      captionEl.setAttribute('aria-live', playing && !announce ? 'off' : 'polite');
      captionEl.textContent = captionOf(f);
    }
    if (f) adapter.show(f, { animate: !reducedMotion });
    if (onFrame) onFrame(index, f);
  }

  function clearTimer() { if (timer !== null) { clearTimeout(timer); timer = null; } }
  function schedule() {
    clearTimer();
    if (!playing || destroyed) return;
    timer = setTimeout(() => {
      timer = null;
      if (!playing || destroyed) return;
      if (index >= framesNow.length - 1) { pause({ announce: true }); return; }
      index++;
      draw();
      if (index >= framesNow.length - 1) { pause({ announce: true }); return; }
      schedule();
    }, BASE_MS / speed);
  }
  function play() {
    if (destroyed || framesNow.length === 0) return;
    if (index >= framesNow.length - 1) index = 0; // Play at the end restarts
    playing = true;
    btnPlay.innerHTML = `${icon('pause.fill', 13)} <span>Pause</span>`;
    btnPlay.setAttribute('aria-label', 'Pause');
    draw();
    schedule();
  }
  function pause({ announce = false } = {}) {
    if (!playing) return;
    playing = false;
    clearTimer();
    btnPlay.innerHTML = `${icon('play.fill', 13)} <span>Play</span>`;
    btnPlay.setAttribute('aria-label', 'Play');
    draw({ announce });
  }
  function goTo(i, { announce = true } = {}) {
    if (destroyed) return;
    pause();
    index = Math.max(0, Math.min(framesNow.length - 1, i | 0));
    draw({ announce });
  }

  btnPlay.addEventListener('click', () => { if (playing) pause({ announce: true }); else play(); });
  btnPrev.addEventListener('click', () => goTo(index - 1));
  btnNext.addEventListener('click', () => goTo(index + 1));
  btnRestart.addEventListener('click', () => goTo(0));
  scrub.addEventListener('input', () => goTo(Number(scrub.value)));
  speedSel.addEventListener('change', () => { speed = Number(speedSel.value) || 1; if (playing) schedule(); });

  // Keyboard: only when focus is inside the player's controls or visual and
  // not in a text field or editor (the code editor owns its own keys).
  const keyHost = opts.keyHost || root;
  const onKey = (e) => {
    if (destroyed) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && t !== scrub))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // The scrubber handles its own arrow/Home/End keys natively (and fires input).
    if (t === scrub && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    // Handled keys stop here: the app shell uses Left/Right for step
    // navigation, and a focused button would also fire a click on Space.
    if (e.key === ' ') {
      if (t && /^(BUTTON|A)$/.test(t.tagName)) return; // the button's own click handles it
      e.preventDefault(); e.stopPropagation();
      if (playing) pause({ announce: true }); else play();
    }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); goTo(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); goTo(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); goTo(framesNow.length - 1); }
  };
  keyHost.addEventListener('keydown', onKey);

  const onVis = () => { if (document.hidden) pause({ announce: true }); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

  function setFrames(next, { keepIndex = false } = {}) {
    framesNow = next || [];
    if (!keepIndex) index = 0;
    index = Math.max(0, Math.min(Math.max(0, framesNow.length - 1), index));
    if (index >= framesNow.length - 1) pause();
    draw();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    pause();
    clearTimer();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    keyHost.removeEventListener('keydown', onKey);
    try { adapter.destroy(); } catch { /* adapter teardown is best-effort */ }
    root.innerHTML = '';
    root.classList.remove('player-ctl');
    livePlayers.delete(api);
  }

  const api = {
    el: root,
    get index() { return index; },
    get playing() { return playing; },
    get frames() { return framesNow; },
    goTo, play, pause,
    next: () => goTo(index + 1),
    prev: () => goTo(index - 1),
    setFrames, destroy,
  };
  livePlayers.add(api);
  draw();
  return api;
}
