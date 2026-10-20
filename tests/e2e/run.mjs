// End-to-end walk of the whole course in real browsers.
// For every step: renders without page errors; console examples produce the
// verified output; SwiftUI previews render without an error pane; widgets
// mount; quizzes respond; nothing overflows the viewport at desktop size.
// Also exercises navigation, search, theme, keyboard, and phone-width layout.
// Usage: node tests/e2e/run.mjs [--browser=chromium|webkit] [--from=N] [--only=lesson-id] [--shots=/abs/dir]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { testResultProblems } from '../../tools/check-test-results.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const engineName = opt.browser || 'chromium';
const browser = await (engineName === 'webkit' ? webkit : chromium).launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const url = pathToFileURL(path.join(ROOT, 'ios-development.html')).href;
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto(url + '#welcome-hello.1');
await page.waitForFunction(() => window.__course && window.__course.steps.length > 0);
const total = await page.evaluate(() => window.__course.steps.length);
if (opt.shots) fs.mkdirSync(opt.shots, { recursive: true });
const failures = [];
const warnings = [];
const fail = (id, msg) => failures.push(`${id}: ${msg}`);
let checked = 0;

async function readTestResults() {
  return page.evaluate(() => {
    const status = document.querySelector('.console-status')?.textContent || '';
    return {
      error: /Build failed/.test(status) ? { message: document.querySelector('.out')?.textContent || status } : null,
      results: [...document.querySelectorAll('.out .o-test')].map((test) => ({
        name: test.textContent,
        issues: test.classList.contains('bad') ? [{ msg: 'Test failed' }] : [],
      })),
    };
  });
}

for (let i = Number(opt.from || 0); i < total; i++) {
  const info = await page.evaluate((i) => {
    const s = window.__course.steps[i];
    return { id: s.id, kind: s.step.kind, run: s.step.run, expect: s.step.expect, expectError: s.step.expectError, expectTests: s.step.expectTests, nondet: s.step.nondeterministic, title: s.step.title, quizN: s.step.questions ? s.step.questions.length : 0 };
  }, i);
  if (opt.only && !info.id.startsWith(opt.only + '.')) continue;
  errors.length = 0;
  await page.evaluate((i) => { localStorage.clear(); window.__course.go(i); }, i);
  await page.waitForTimeout(info.kind === 'code' && info.run === 'swiftui' ? 700 : info.kind === 'widget' || info.kind === 'concept' ? 500 : 350);
  checked++;
  if (info.kind === 'code' && (info.run === 'swift' || info.run === 'swifttest')) {
    try {
      await page.waitForFunction(() => { const s = document.querySelector('.console-status'); return s && !/Running/.test(s.textContent); }, null, { timeout: 15000 });
    } catch { fail(info.id, 'console never finished running'); }
    const status = await page.evaluate(() => ({ text: document.querySelector('.console-status')?.textContent || '', cls: document.querySelector('.console-status')?.className || '', out: document.querySelector('.out')?.textContent || '' }));
    if (info.run === 'swift') {
      if (info.expectError) { if (!/error/i.test(status.out) && !/lesson/.test(status.text)) fail(info.id, `expected a compile error, got: ${status.out.slice(0, 120)}`); }
      else if (info.nondet) { if (/bad/.test(status.cls)) fail(info.id, `nondeterministic example failed: ${status.out.slice(0, 160)}`); }
      else if (!/Same output/.test(status.text)) fail(info.id, `output differs from verified expect: status="${status.text}" out="${status.out.slice(0, 160)}"`);
    }
    if (info.run === 'swifttest') {
      const problems = testResultProblems(await readTestResults(), info.expectTests);
      if (problems.length) fail(info.id, problems.join(' | '));
      else if (status.text !== 'All tests pass') fail(info.id, `unexpected test status: ${status.text}`);
    }
  }
  if ((info.kind === 'code' && info.run === 'swiftui') || info.kind === 'compare') {
    const pv = await page.evaluate(() => [...document.querySelectorAll('.phone-host, .cmp-phone')].map((h) => {
      const r = h.shadowRoot;
      if (!r) return { missing: true };
      const err = r.querySelector('.error-pane');
      return { error: err ? err.textContent : null, content: !!r.querySelector('.content') };
    }));
    pv.forEach((p, k) => {
      if (p.missing) fail(info.id, `preview ${k} did not mount`);
      else if (p.error) fail(info.id, `preview ${k} shows an error: ${p.error.slice(0, 200)}`);
      else if (!p.content) fail(info.id, `preview ${k} rendered no content`);
    });
  }
  if (info.kind === 'widget' || info.kind === 'concept') {
    const w = await page.evaluate(() => [...document.querySelectorAll('.widget-host')].map((h) => ({ empty: h.children.length === 0 && !h.shadowRoot, text: h.textContent.slice(0, 80) })));
    w.forEach((x, k) => { if (x.empty) fail(info.id, `widget ${k} is empty`); if (/could not start|unavailable/i.test(x.text)) fail(info.id, `widget ${k}: ${x.text}`); });
  }
  if (info.kind === 'quiz') {
    await page.click('.choice >> nth=0');
    const fb = await page.evaluate(() => !document.querySelector('.quiz-feedback')?.hidden);
    if (!fb) fail(info.id, 'quiz did not show feedback after answering');
  }
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
  if (errors.length) fail(info.id, `page errors: ${[...new Set(errors)].join(' | ').slice(0, 400)}`);
  if (opt.shots) await page.screenshot({ path: path.join(opt.shots, `${String(i).padStart(3, '0')}-${info.id}.png`) });
  if (i % 50 === 0) process.stdout.write(`  …${i}/${total}\n`);
}

// Prove the same browser checks reject failing assertions and missing tests.
const testStep = await page.evaluate(() => window.__course.steps.findIndex((s) => s.step.run === 'swifttest'));
if (testStep >= 0) {
  await page.evaluate((i) => window.__course.go(i), testStep);
  for (const [label, code, expectedIssue] of [
    ['failing assertion', 'import Testing\n@Test func broken() { #expect(1 == 2) }', 'Test failed'],
    ['missing test', 'import Testing', 'Expected 1 tests, got 0'],
  ]) {
    await page.fill('.ed-ta', code);
    await page.click('.run-btn');
    await page.waitForFunction(() => !/Running/.test(document.querySelector('.console-status')?.textContent || 'Running'));
    const problems = testResultProblems(await readTestResults(), 1);
    if (!problems.some((p) => p.includes(expectedIssue))) fail('test validation', `${label} was not detected: ${problems.join(' | ')}`);
    if (label === 'missing test' && await page.textContent('.console-status') !== 'No tests found') {
      fail('test validation', 'an empty test file was not labelled No tests found');
    }
  }
  await page.click('.reset-btn');
}

// navigation, keyboard, search, theme
await page.evaluate(() => window.__course.go(0));
await page.waitForTimeout(300);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
if ((await page.evaluate(() => location.hash)) !== '#welcome-hello.2') fail('nav', 'ArrowRight did not advance');
await page.click('.nav-btn.prev');
await page.waitForTimeout(200);
if ((await page.evaluate(() => location.hash)) !== '#welcome-hello.1') fail('nav', 'Previous button did not go back');
await page.keyboard.press('Meta+k');
await page.waitForSelector('.palette input');
await page.fill('.palette input', 'liquid glass');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
if (!/glass/i.test((await page.textContent('.stage-title')) + (await page.textContent('.crumb-lesson')))) fail('search', '"liquid glass" did not land on a Liquid Glass step');
await page.click('.theme-btn');
await page.click('.theme-btn');
if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== 'dark') fail('theme', 'theme toggle did not reach dark');

// phone width: no horizontal overflow on a sample of steps
await page.setViewportSize({ width: 400, height: 860 });
for (const k of [0, 2, 3, Math.floor(total / 3), Math.floor(total / 2), total - 2]) {
  await page.evaluate((k) => window.__course.go(k), k);
  await page.waitForTimeout(500);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (wide) fail(`phone step ${k}`, 'horizontal overflow at 400px');
}
await browser.close();
console.log(`\n${engineName}: checked ${checked} steps.`);
if (warnings.length) console.log(`\n${warnings.length} layout warnings:\n  ${warnings.slice(0, 60).join('\n  ')}`);
console.log(failures.length ? `\n${failures.length} FAILURES:\n  ${failures.join('\n  ')}` : '\nNo failures.');
process.exitCode = failures.length ? 1 : 0;
