// End-to-end walk of the whole course in real browsers.
// For every step: renders without page errors; console examples produce the
// verified output; SwiftUI previews render visible content and no error pane;
// widgets mount; quizzes respond; nothing overflows the viewport at desktop size.
// Every runnable example has a live Run button, and the first Swift example of
// each module is edited, run and reset to prove the editor and runner work.
// Also exercises navigation, search, theme, keyboard, and phone-width layout,
// a runaway program (Stop, the wall-clock watchdog, navigating away while it
// runs), and the page inside a sandboxed iframe.
// Usage: node tests/e2e/run.mjs [--browser=chromium|webkit] [--from=N] [--only=lesson-id] [--shots=/abs/dir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { testResultProblems } from '../../tools/check-test-results.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const engineName = opt.browser || 'chromium';
const RUN_WAIT = 15000; // longest a console program may take
const UI_WAIT = 5000; // longest a click or render may take
const failures = [];
const warnings = [];
const fail = (id, msg) => failures.push(`${id}: ${msg}`);
let checked = 0;

// Runs in the page: true once the console is no longer "Running".
const consoleSettled = () => { const s = document.querySelector('.console-status'); return !!s && !/Running/.test(s.textContent); };

async function readTestResults(page) {
  return page.evaluate(() => {
    const status = document.querySelector('.console-status')?.textContent || '';
    return {
      // a build failure, a crash or a stop all mean the file did not run to the end
      error: /Build failed|Crashed|Stopped/.test(status) ? { message: `${status}: ${document.querySelector('.out')?.textContent || ''}` } : null,
      results: [...document.querySelectorAll('.out .o-test')].map((test) => ({
        name: test.textContent,
        issues: test.classList.contains('bad') ? [{ msg: 'Test failed' }] : [],
      })),
    };
  });
}

// Edits the example, runs it, checks the new line printed, then resets it.
async function probeRun(page, id) {
  try {
    const original = await page.inputValue('.ed-ta');
    await page.fill('.ed-ta', original.replace(/\s+$/, '') + '\nprint("probe")\n');
    await page.click('.run-btn', { timeout: UI_WAIT });
    await page.waitForFunction(consoleSettled, null, { timeout: RUN_WAIT });
    const out = await page.evaluate(() => (document.querySelector('.out')?.textContent || '').trim());
    if (!out.endsWith('probe')) fail(id, `editing and running did not print the added line; console ends with: ${JSON.stringify(out.slice(-120))}`);
    await page.click('.reset-btn', { timeout: UI_WAIT });
    await page.waitForFunction(consoleSettled, null, { timeout: RUN_WAIT });
    if ((await page.inputValue('.ed-ta')) !== original) fail(id, 'Reset did not restore the original code');
  } catch (e) {
    fail(id, `run probe failed: ${String(e.message).split('\n')[0]}`);
  }
}

async function checkStep(page, i, info, probed) {
  if (info.kind === 'code' && (info.run === 'swift' || info.run === 'swifttest')) {
    try {
      await page.waitForFunction(consoleSettled, null, { timeout: RUN_WAIT });
    } catch { fail(info.id, 'console never finished running'); }
    const status = await page.evaluate(() => ({ text: document.querySelector('.console-status')?.textContent || '', cls: document.querySelector('.console-status')?.className || '', out: document.querySelector('.out')?.textContent || '', diagnostic: !!document.querySelector('.out .o-err') }));
    let matched = false;
    if (info.run === 'swift') {
      // a diagnostic element and a failure status, not just the word "error" in printed output
      if (info.expectError) {
        const statusSaysError = /Build failed|Crashed|This error is the lesson/.test(status.text);
        if (!status.diagnostic || !statusSaysError) fail(info.id, `expected an error diagnostic, got status "${status.text}" and output: ${status.out.slice(0, 120)}`);
      }
      else if (info.nondet) { if (/bad/.test(status.cls)) fail(info.id, `nondeterministic example failed: ${status.out.slice(0, 160)}`); }
      else if (!/Same output/.test(status.text)) fail(info.id, `output differs from verified expect: status="${status.text}" out="${status.out.slice(0, 160)}"`);
      else matched = true;
    }
    if (info.run === 'swifttest') {
      const problems = testResultProblems(await readTestResults(page), info.expectTests);
      if (problems.length) fail(info.id, problems.join(' | '));
      else if (status.text !== 'All tests pass') fail(info.id, `unexpected test status: ${status.text}`);
    }
    if (matched && !probed.has(info.module)) {
      probed.add(info.module);
      await probeRun(page, info.id);
    }
  }
  if (info.kind === 'code' && ['swift', 'swifttest', 'swiftui'].includes(info.run)) {
    // Read-along (static) examples have no Run button by design.
    const btn = await page.evaluate(() => { const b = document.querySelector('.run-btn'); return b ? { disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' } : null; });
    if (!btn) fail(info.id, 'Run button is missing');
    else if (btn.disabled) fail(info.id, 'Run button is disabled');
  }
  if ((info.kind === 'code' && info.run === 'swiftui') || info.kind === 'compare') {
    const pv = await page.evaluate(() => [...document.querySelectorAll('.phone-host, .cmp-phone')].map((h) => {
      const r = h.shadowRoot;
      if (!r) return { missing: true };
      const err = r.querySelector('.error-pane');
      const content = r.querySelector('.content');
      const visible = content ? [...content.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).length : 0;
      return { error: err ? err.textContent : null, content: !!content, visible };
    }));
    pv.forEach((p, k) => {
      if (p.missing) fail(info.id, `preview ${k} did not mount`);
      else if (p.error) fail(info.id, `preview ${k} shows an error: ${p.error.slice(0, 200)}`);
      else if (!p.content) fail(info.id, `preview ${k} rendered no content`);
      else if (!p.visible) fail(info.id, `preview ${k} is blank: nothing inside .content has a size`);
    });
  }
  if (info.kind === 'widget' || info.kind === 'concept') {
    const readHosts = () => page.evaluate(() => [...document.querySelectorAll('.widget-host')].map((h) => ({ empty: h.children.length === 0 && !(h.shadowRoot && h.shadowRoot.childElementCount), text: (h.shadowRoot ? h.shadowRoot.textContent : h.textContent).slice(0, 80) })));
    const w = await readHosts();
    w.forEach((x, k) => { if (x.empty) fail(info.id, `widget ${k} is empty`); if (/could not start|unavailable/i.test(x.text)) fail(info.id, `widget ${k}: ${x.text}`); });
    // Then use it: press the first enabled button in each widget and check it is still standing.
    const pressed = await page.evaluate(() => [...document.querySelectorAll('.widget-host')].map((h) => {
      const b = (h.shadowRoot || h).querySelector('button:not([disabled]):not([aria-disabled="true"])');
      if (b) b.click();
      return !!b;
    }));
    if (pressed.some(Boolean)) {
      await page.waitForTimeout(300);
      const after = await readHosts();
      after.forEach((x, k) => {
        if (!pressed[k]) return;
        if (x.empty) fail(info.id, `widget ${k} is empty after pressing its first button`);
        if (/could not start|unavailable/i.test(x.text)) fail(info.id, `widget ${k} after pressing its first button: ${x.text}`);
      });
    }
  }
  if (info.kind === 'quiz') {
    try {
      await page.click('.choice >> nth=0', { timeout: UI_WAIT });
      const fb = await page.evaluate(() => !document.querySelector('.quiz-feedback')?.hidden);
      if (!fb) fail(info.id, 'quiz did not show feedback after answering');
    } catch (e) { fail(info.id, `quiz choice could not be clicked: ${String(e.message).split('\n')[0]}`); }
  }
  if (info.kind === 'example') await checkExample(page, i, info, probed);
  // one-viewport rule at desktop size
  const fit = await page.evaluate(() => {
    const body = document.getElementById('stage-body');
    const docScroll = document.scrollingElement.scrollHeight > innerHeight + 2;
    const over = [];
    const check = (sel) => document.querySelectorAll(sel).forEach((e) => { if (e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible') over.push(sel); });
    check('.st-concept'); check('.st-quiz'); check('.code-intro');
    const bodyOver = body.scrollHeight > body.clientHeight + 4;
    return { docScroll, over, bodyOver };
  });
  if (fit.docScroll) fail(info.id, 'page scrolls at 1440x900 (breaks the one-viewport layout)');
  if (fit.bodyOver) warnings.push(`${info.id}: stage content taller than the viewport`);
  if (fit.over.length) warnings.push(`${info.id}: internal scroll in ${[...new Set(fit.over)].join(', ')}`);
}

// Worked examples: the player steps with captions, Play autoplays, keyboard
// reaches the end, the checked result appears, the tryIt editor rejects the
// starter and accepts the reference solution, and leaving mid-play leaks no
// live players. Runs on every example step; the leak probe runs once.
async function checkExample(page, i, info, probed) {
  const id = info.id;
  const pos = () => page.evaluate(() => document.querySelector('.st-example .player-pos')?.textContent || '');
  const posIndex = async () => { const m = (await pos()).match(/Step (\d+) of (\d+)/); return m ? { k: Number(m[1]), n: Number(m[2]) } : null; };
  try {
    const present = await page.evaluate(() => ({
      problem: (document.querySelector('.st-example .ex-problem')?.textContent || '').trim().length,
      lines: document.querySelectorAll('.st-example .ex-line').length,
    }));
    if (!present.problem) fail(id, 'worked example has no problem statement');
    if (!present.lines) fail(id, 'worked example shows no code lines');
    const start = await posIndex();
    if (!start || start.k !== 1) fail(id, `player does not start at step 1 (got "${await pos()}")`);

    // Manual stepping updates the caption to the frame's own caption.
    await page.click('.st-example .player-next', { timeout: UI_WAIT });
    const cap2 = await page.evaluate((i) => window.__course.steps[i].step.frames[1].caption, i);
    const shownCap = await page.evaluate(() => document.querySelector('.st-example .ex-caption')?.textContent || '');
    if (shownCap !== cap2) fail(id, 'stepping did not show frame 2\u2019s caption');

    // Play autoplays: the position advances on its own, then pause stops it.
    await page.click('.st-example .player-play', { timeout: UI_WAIT });
    await page.waitForFunction(() => { const m = (document.querySelector('.st-example .player-pos')?.textContent || '').match(/Step (\d+) of/); return m && Number(m[1]) >= 3; }, null, { timeout: 8000 });
    await page.click('.st-example .player-play', { timeout: UI_WAIT });

    // Keyboard: Home returns to the first frame, End jumps to the last.
    await page.click('.st-example .ex-line >> nth=0', { timeout: UI_WAIT });
    await page.evaluate(() => document.querySelector('.st-example .ex-code').focus());
    await page.keyboard.press('Home');
    if ((await posIndex())?.k !== 1) fail(id, 'Home did not return to the first frame');
    await page.keyboard.press('End');
    const end = await posIndex();
    if (!end || end.k !== end.n) fail(id, `End did not reach the final frame (got "${await pos()}")`);

    // The checked result: trace and phone examples report "Checked:"; a
    // diagram example with a result reports "Result:".
    const kind = await page.evaluate((i) => ({ adapter: window.__course.steps[i].step.adapter, hasResult: !!window.__course.steps[i].step.result }), i);
    if (kind.adapter === 'trace' || kind.adapter === 'phone') {
      await page.waitForFunction(() => (document.querySelector('.st-example .ex-result')?.textContent || '').includes('Checked:'), null, { timeout: RUN_WAIT })
        .catch(() => fail(id, 'the checked result never appeared on the final frame'));
    } else if (kind.hasResult) {
      const r = await page.evaluate(() => document.querySelector('.st-example .ex-result')?.textContent || '');
      if (!r.includes('Result:')) fail(id, 'the diagram result never appeared on the final frame');
    }

    // Try it: the starter is a plausible wrong attempt and must fail; the
    // reference solution must pass.
    await page.click('.st-example .ex-check-btn', { timeout: UI_WAIT });
    await page.waitForFunction(() => (document.querySelector('.st-example .ex-try-status')?.textContent || '').includes('Not yet'), null, { timeout: RUN_WAIT })
      .catch(() => fail(id, 'the tryIt starter was not rejected'));
    const solution = await page.evaluate((i) => window.__course.steps[i].step.tryIt.solution.map((l) => l[0]).join('\n'), i);
    await page.fill('.st-example .ex-try-ed .ed-ta', solution);
    await page.waitForFunction(() => (document.querySelector('.st-example .ex-try-status')?.textContent || '').includes('Correct.'), null, { timeout: RUN_WAIT })
      .catch(() => fail(id, 'the tryIt reference solution was not accepted'));

    // Leaving mid-play must destroy THIS step's player (the destination
    // step may register its own, so compare by identity, once per run).
    if (!probed.has('example-leak')) {
      probed.add('example-leak');
      await page.click('.st-example .player-restart', { timeout: UI_WAIT }).catch(() => {});
      await page.click('.st-example .player-play', { timeout: UI_WAIT });
      await page.evaluate(() => { window.__leakProbe = [...window.__stepPlayers]; });
      await page.evaluate((i) => window.__course.go(i + 1), i);
      await page.waitForTimeout(300);
      const leaked = await page.evaluate(() => (window.__leakProbe || []).filter((p) => window.__stepPlayers.has(p)).length);
      if (leaked !== 0) fail(id, `navigating away mid-play left ${leaked} of this step's player(s) alive`);
    }
  } catch (e) {
    fail(id, `worked example check failed: ${String(e.message).split('\n')[0]}`);
  }
}

// Reduced motion: with the media feature emulated, stepping still updates
// captions and no transitions run.
async function checkExampleReducedMotion(page) {
  const id = 'reduced motion example';
  try {
    const idx = await page.evaluate(() => window.__course.steps.findIndex((s) => s.step.kind === 'example'));
    if (idx < 0) { fail(id, 'no worked example found'); return; }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate((i) => window.__course.go(i), idx);
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => document.querySelector('.st-example .ex-caption')?.textContent || '');
    await page.click('.st-example .player-next', { timeout: UI_WAIT });
    const after = await page.evaluate(() => ({
      caption: document.querySelector('.st-example .ex-caption')?.textContent || '',
      transition: getComputedStyle(document.querySelector('.st-example .ex-caption')).transitionDuration,
    }));
    if (after.caption === before) fail(id, 'caption did not update under reduced motion');
    if (after.transition !== '0s') fail(id, `transitions still run under reduced motion (${after.transition})`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  } catch (e) { fail(id, String(e.message).split('\n')[0]); }
}

// Prove the same browser checks reject failing assertions and missing tests.
async function checkTestValidation(page) {
  const testStep = await page.evaluate(() => window.__course.steps.findIndex((s) => s.step.run === 'swifttest'));
  if (testStep < 0) return;
  try {
    await page.evaluate((i) => window.__course.go(i), testStep);
    for (const [label, code, expectedIssue] of [
      ['failing assertion', 'import Testing\n@Test func broken() { #expect(1 == 2) }', 'Test failed'],
      ['missing test', 'import Testing', 'Expected 1 tests, got 0'],
    ]) {
      await page.fill('.ed-ta', code);
      await page.click('.run-btn', { timeout: UI_WAIT });
      await page.waitForFunction(consoleSettled, null, { timeout: RUN_WAIT });
      const problems = testResultProblems(await readTestResults(page), 1);
      if (!problems.some((p) => p.includes(expectedIssue))) fail('test validation', `${label} was not detected: ${problems.join(' | ')}`);
      if (label === 'missing test' && await page.textContent('.console-status') !== 'No tests found') {
        fail('test validation', 'an empty test file was not labelled No tests found');
      }
    }
    await page.click('.reset-btn', { timeout: UI_WAIT });
  } catch (e) { fail('test validation', String(e.message).split('\n')[0]); }
}

// A runaway program runs in the Web Worker: Stop ends it at once, the
// wall-clock watchdog (shortened through window.__runLimitMs, a hook only the
// runtime reads) terminates it, output printed before the stop is kept, and the
// page keeps painting and can navigate away while it runs.
async function checkRunaway(page) {
  const id = 'runaway program';
  const idx = await page.evaluate(() => window.__course.steps.findIndex((s) => s.step.kind === 'code' && s.step.run === 'swift'));
  if (idx < 0) return;
  const read = () => page.evaluate(() => ({
    status: document.querySelector('.console-status')?.textContent || '',
    out: document.querySelector('.out')?.textContent || '',
    stopShown: !document.querySelector('.stop-btn')?.hidden,
    stats: window.__course.runner.stats(),
  }));
  const setLimit = (ms) => page.evaluate((v) => { window.__runLimitMs = v; }, ms);
  const LOOP = 'print("before the loop")\nwhile true { }';
  try {
    await page.evaluate((i) => { localStorage.clear(); window.__course.go(i); }, idx);
    await page.waitForFunction(consoleSettled, null, { timeout: RUN_WAIT });
    if ((await read()).stats.mode !== 'worker') fail(id, `console programs do not run in a Web Worker here (mode ${(await read()).stats.mode})`);

    // Stop: the page paints while the loop runs, and Stop ends it at once.
    await setLimit(60000);
    await page.fill('.ed-ta', LOOP);
    await page.click('.run-btn', { timeout: UI_WAIT });
    await page.waitForSelector('.stop-btn:not([hidden])', { timeout: UI_WAIT });
    const t0 = Date.now();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    if (Date.now() - t0 > 1000) fail(id, `the page took ${Date.now() - t0} ms to paint two frames while a loop ran`);
    await page.click('.stop-btn', { timeout: UI_WAIT });
    await page.waitForFunction(consoleSettled, null, { timeout: UI_WAIT });
    let r = await read();
    if (r.status !== 'Stopped' || !/Stopped\.$/.test(r.out)) fail(id, `Stop did not stop the program: status="${r.status}" out="${r.out.slice(-120)}"`);
    if (r.stopShown) fail(id, 'the Stop button is still shown after the program stopped');
    if (r.stats.active !== 0) fail(id, `Stop left ${r.stats.active} program(s) running`);

    // The watchdog: a bare infinite loop ends with the time-limit message or the step budget's,
    // and a loop stopped by the watchdog keeps what it printed.
    await setLimit(1500);
    await page.fill('.ed-ta', 'while true { }');
    await page.click('.run-btn', { timeout: UI_WAIT });
    await page.waitForFunction(consoleSettled, null, { timeout: RUN_WAIT });
    r = await read();
    if (r.status !== 'Stopped' || !/ran for more than 1\.5 seconds in this in-browser playground\.|Stopped after [\d,]+ steps/.test(r.out)) {
      fail(id, `while true { } was not stopped by the watchdog or the step budget: status="${r.status}" out="${r.out.slice(-160)}"`);
    }
    await setLimit(400);
    await page.fill('.ed-ta', LOOP);
    await page.click('.run-btn', { timeout: UI_WAIT });
    await page.waitForFunction(consoleSettled, null, { timeout: RUN_WAIT });
    r = await read();
    if (r.status !== 'Stopped' || !r.out.startsWith('before the loop') || !r.out.endsWith('Stopped: the program ran for more than 0.4 seconds in this in-browser playground.')) {
      fail(id, `the watchdog did not end the run with its message and the earlier output: status="${r.status}" out="${r.out.slice(-160)}"`);
    }
    if (r.stats.active !== 0) fail(id, `the watchdog left ${r.stats.active} program(s) running`);

    // Leaving the step while a program runs terminates it, and navigation still works.
    await setLimit(60000);
    await page.fill('.ed-ta', 'while true { }');
    await page.click('.run-btn', { timeout: UI_WAIT });
    await page.waitForSelector('.stop-btn:not([hidden])', { timeout: UI_WAIT });
    const before = await page.evaluate(() => location.hash);
    await page.click('.nav-btn.next', { timeout: UI_WAIT });
    await page.waitForFunction((h) => location.hash !== h, before, { timeout: UI_WAIT });
    const after = await page.evaluate(() => window.__course.runner.stats());
    if (after.active !== 0) fail(id, `leaving the step left ${after.active} program(s) running`);
  } catch (e) {
    fail(id, String(e.message).split('\n')[0]);
  } finally {
    await page.evaluate(() => { delete window.__runLimitMs; localStorage.clear(); }).catch(() => {});
  }
}

// The page inside a sandboxed iframe that allows scripts (an opaque origin, as
// when the page is embedded): it loads, and console programs still run in the
// worker started from a Blob URL.
async function checkSandboxedFrame(browser) {
  const id = 'sandboxed frame';
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setContent('<iframe sandbox="allow-scripts" style="width:1400px;height:860px;border:0"></iframe>');
    const html = fs.readFileSync(path.join(ROOT, 'ios-development.html'), 'utf8');
    await page.evaluate((h) => { document.querySelector('iframe').srcdoc = h; }, html);
    let frame = null;
    for (let k = 0; k < 120 && !frame; k++) {
      frame = page.frames().find((f) => f !== page.mainFrame()) || null;
      if (!frame) await page.waitForTimeout(250);
    }
    if (!frame) throw new Error('the iframe never appeared');
    await frame.waitForFunction(() => window.__course && window.__course.steps.length > 0, null, { timeout: 30000 });
    const idx = await frame.evaluate(() => window.__course.steps.findIndex((s) => s.step.kind === 'code' && s.step.run === 'swift' && s.step.expect !== undefined && !s.step.expectError && !s.step.nondeterministic));
    await frame.evaluate((i) => window.__course.go(i), idx);
    await frame.waitForFunction(consoleSettled, null, { timeout: RUN_WAIT });
    const status = await frame.evaluate(() => document.querySelector('.console-status').textContent);
    const mode = await frame.evaluate(() => window.__course.runner.stats().mode);
    if (!/Same output/.test(status)) fail(id, `a console example did not produce its verified output: ${status}`);
    if (mode !== 'worker') fail(id, `programs ran on the main thread (mode ${mode})`);
    if (errors.length) fail(id, `page errors: ${[...new Set(errors)].join(' | ').slice(0, 300)}`);
  } catch (e) {
    fail(id, String(e.message).split('\n')[0]);
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// navigation, keyboard, search, theme
async function checkShell(page) {
  try {
    await page.evaluate(() => window.__course.go(0));
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => location.hash)) !== '#welcome-hello.2') fail('nav', 'ArrowRight did not advance');
    await page.click('.nav-btn.prev', { timeout: UI_WAIT });
    await page.waitForTimeout(200);
    if ((await page.evaluate(() => location.hash)) !== '#welcome-hello.1') fail('nav', 'Previous button did not go back');
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('.palette input', { timeout: UI_WAIT });
    await page.fill('.palette input', 'liquid glass');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    if (!/glass/i.test((await page.textContent('.stage-title')) + (await page.textContent('.crumb-lesson')))) fail('search', '"liquid glass" did not land on a Liquid Glass step');
    await page.click('.theme-btn', { timeout: UI_WAIT });
    await page.click('.theme-btn', { timeout: UI_WAIT });
    if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== 'dark') fail('theme', 'theme toggle did not reach dark');
  } catch (e) { fail('shell', String(e.message).split('\n')[0]); }
}

// phone width: no horizontal overflow on a sample of steps
async function checkPhoneWidth(page, total) {
  try {
    await page.setViewportSize({ width: 400, height: 860 });
    for (const k of [0, 2, 3, Math.floor(total / 3), Math.floor(total / 2), total - 2]) {
      await page.evaluate((k) => window.__course.go(k), k);
      await page.waitForTimeout(500);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (wide) fail(`phone step ${k}`, 'horizontal overflow at 400px');
    }
    // Every worked example at 390 px: the example itself must not overflow
    // horizontally. (Scoped to .st-example: the app shell's top bar is 5 px
    // wider than 390 px on every step kind, a pre-existing shell trait the
    // 400 px sample above already covers as far as it goes.)
    await page.setViewportSize({ width: 390, height: 844 });
    const exampleIdx = await page.evaluate(() => window.__course.steps.map((s, i) => (s.step.kind === 'example' ? i : -1)).filter((i) => i >= 0));
    for (const k of exampleIdx) {
      await page.evaluate((k) => window.__course.go(k), k);
      await page.waitForTimeout(450);
      const wide = await page.evaluate(() => {
        const ex = document.querySelector('.st-example');
        if (!ex) return 'missing';
        if (ex.scrollWidth > ex.clientWidth + 1) return 'scrolls';
        const edge = ex.getBoundingClientRect().right;
        // A descendant may extend past the edge only when an intermediate
        // box clips it (the code panes scroll their own long lines).
        const escapes = [...ex.querySelectorAll('*')].some((e) => {
          if (e.getBoundingClientRect().right <= edge + 1) return false;
          let p = e.parentElement;
          while (p && p !== ex) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return false;
            p = p.parentElement;
          }
          return true;
        });
        return escapes ? 'child' : '';
      });
      if (wide) fail(`phone example step ${k}`, `horizontal overflow at 390px (${wide})`);
    }
  } catch (e) { fail('phone width', String(e.message).split('\n')[0]); }
}

let browser;
try {
  browser = await (engineName === 'webkit' ? webkit : chromium).launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const url = pathToFileURL(path.join(ROOT, 'ios-development.html')).href;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Only network failures (fonts, favicon) are ignored; every other console error counts.
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_|blocked by CORS policy|Failed to load resource|access control checks/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url + '#welcome-hello.1');
  await page.waitForFunction(() => window.__course && window.__course.steps.length > 0, null, { timeout: 30000 });
  const total = await page.evaluate(() => window.__course.steps.length);
  if (opt.shots) fs.mkdirSync(opt.shots, { recursive: true });
  const probed = new Set();

  for (let i = Number(opt.from || 0); i < total; i++) {
    const info = await page.evaluate((i) => {
      const s = window.__course.steps[i];
      return { id: s.id, module: s.module.id, kind: s.step.kind, run: s.step.run, expect: s.step.expect, expectError: s.step.expectError, expectTests: s.step.expectTests, nondet: s.step.nondeterministic, title: s.step.title, quizN: s.step.questions ? s.step.questions.length : 0 };
    }, i);
    if (opt.only && !info.id.startsWith(opt.only + '.')) continue;
    errors.length = 0;
    await page.evaluate((i) => { localStorage.clear(); window.__course.go(i); }, i);
    await page.waitForTimeout(info.kind === 'code' && info.run === 'swiftui' ? 700 : info.kind === 'widget' || info.kind === 'concept' ? 500 : 350);
    checked++;
    try {
      await checkStep(page, i, info, probed);
    } catch (e) { fail(info.id, `check failed: ${String(e.message).split('\n')[0]}`); }
    if (errors.length) fail(info.id, `page errors: ${[...new Set(errors)].join(' | ').slice(0, 400)}`);
    if (opt.shots) await page.screenshot({ path: path.join(opt.shots, `${String(i).padStart(3, '0')}-${info.id}.png`) });
    if (i % 50 === 0) process.stdout.write(`  …${i}/${total}\n`);
  }

  await checkTestValidation(page);
  await checkExampleReducedMotion(page);
  await checkRunaway(page);
  await checkShell(page);
  await checkPhoneWidth(page, total);
  await checkSandboxedFrame(browser);
} catch (e) {
  fail('runner', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : String(e));
} finally {
  if (browser) await browser.close().catch(() => {});
}

console.log(`\n${engineName}: checked ${checked} steps.`);
if (warnings.length) console.log(`\n${warnings.length} layout warnings:\n  ${warnings.slice(0, 60).join('\n  ')}`);
console.log(failures.length ? `\n${failures.length} FAILURES:\n  ${failures.join('\n  ')}` : '\nNo failures.');
process.exitCode = failures.length ? 1 : 0;
