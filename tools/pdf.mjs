// Builds the printable study guide (PDF) from the same content as the page.
// Usage: node tools/pdf.mjs  -> ios-development-study-guide.pdf
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { highlightCode } from '../src/app/highlight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = fs.readdirSync(path.join(ROOT, 'src/content')).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
const modules = [];
for (const f of files) modules.push((await import(pathToFileURL(path.join(ROOT, 'src/content', f)).href)).default);
modules.sort((a, b) => a.number - b.number);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const AUTO_CLOSE = /^\s*[\}\)\]][\}\)\],;\s]*$/;
const OBJ = {
  CLO1: 'Understand the essentials of Apple development and its ecosystem',
  CLO2: 'Design user interfaces with reactive programming, UI elements and their properties',
  CLO3: 'Create various types of iOS applications in Swift',
  CLO4: 'Store application data locally and in a database',
  CLO5: 'Integrate APIs such as location services and cloud storage',
  CLO6: 'Use network protocols for backend communication',
};

function codeBlock(lines) {
  const html = highlightCode(lines.map((l) => l[0]).join('\n'));
  return `<pre class="code">${html.map((h, i) => `<span class="ln">${i + 1}</span>${h || ' '}`).join('\n')}</pre>`;
}

function notes(lines) {
  const rows = [];
  lines.forEach(([code, note], i) => {
    if (!note) return; // blank lines and closing braces are self-explanatory in print
    rows.push(`<div class="note"><div class="note-head"><span class="note-n">${i + 1}</span><code>${highlightCode(code.trim())[0]}</code></div>
      <dl><dt>Who</dt><dd>${esc(note.who)}</dd><dt>What</dt><dd class="what">${esc(note.what)}</dd><dt>Where</dt><dd>${esc(note.where)}</dd><dt>When</dt><dd>${esc(note.when)}</dd><dt>Why</dt><dd class="why">${esc(note.why)}</dd></dl></div>`);
  });
  return `<div class="notes">${rows.join('')}</div>`;
}

function stepHtml(s, answers) {
  const kindLabel = { concept: 'Concept', code: 'Code', compare: 'Compare', widget: 'Interactive', quiz: 'Check yourself' }[s.kind];
  let h = `<section class="step"><div class="kind">${kindLabel}${s.kind === 'code' ? ` · ${{ swift: 'runs in the browser', swiftui: 'live SwiftUI preview', static: 'read-along', swifttest: 'Swift Testing' }[s.run]}` : ''}</div><h3>${esc(s.title)}</h3>`;
  if (s.kind === 'concept') {
    h += `<div class="prose">${s.body}</div>`;
    if (s.points) h += `<dl class="points">${s.points.map((p) => `<dt>${p.term}</dt><dd>${p.text}</dd>`).join('')}</dl>`;
    if (s.callout) h += `<aside class="callout"><strong>${s.callout.title || ''}</strong>${s.callout.html}</aside>`;
    if (s.figure) h += `<p class="interactive-note">Interactive figure in the HTML version: ${esc(s.figure.widget.replace(/-/g, ' '))}.</p>`;
  }
  if (s.kind === 'code') {
    if (s.intro) h += `<div class="prose">${s.intro}</div>`;
    h += codeBlock(s.lines);
    if (s.expect !== undefined && !s.nondeterministic) h += `<div class="output"><span>Output</span><pre>${esc(s.expect)}</pre></div>`;
    if (s.expectError) h += `<div class="output err"><span>Compiler error (on purpose)</span><pre>${esc(s.expectError)}</pre></div>`;
    h += `<h4>Line by line</h4>${notes(s.lines)}`;
    if (s.try && s.try.length) h += `<aside class="try"><strong>Try it</strong><ol>${s.try.map((t) => `<li>${t}</li>`).join('')}</ol></aside>`;
  }
  if (s.kind === 'compare') {
    if (s.intro) h += `<div class="prose">${s.intro}</div>`;
    for (const side of ['left', 'right']) {
      h += `<h4>${side === 'left' ? 'A' : 'B'}: ${s[side].label}</h4>${codeBlock(s[side].lines)}`;
      if (s[side].expect) h += `<div class="output"><span>Output</span><pre>${esc(s[side].expect)}</pre></div>`;
      h += notes(s[side].lines);
    }
    if (s.verdict) h += `<aside class="callout"><strong>Takeaway</strong>${s.verdict}</aside>`;
  }
  if (s.kind === 'widget') {
    h += `<div class="prose">${s.intro || ''}</div><p class="interactive-note">This step is an interactive simulation in the HTML version.</p>`;
  }
  if (s.kind === 'quiz') {
    h += `<ol class="quiz">${s.questions.map((q, k) => `<li><div class="q">${q.q}</div><ol class="choices" type="A">${q.choices.map((c) => `<li>${c}</li>`).join('')}</ol></li>`).join('')}</ol>`;
    answers.push({ title: s.title, questions: s.questions });
  }
  return h + '</section>';
}

let body = `<section class="cover">
  <div class="mark">S</div>
  <h1>iOS Development</h1>
  <p class="sub">Study guide: Swift, SwiftUI, design, data, device APIs, networking, testing and shipping</p>
  <p class="cover-note">Companion to the interactive course page. Every code example is printed with a five-part explanation of each line: who acts, what it does, where it lives, when it runs, and why it is written that way.</p>
  <h2>Contents</h2>
  <ol class="toc">${modules.map((m) => `<li><span class="toc-n">${String(m.number).padStart(2, '0')}</span><span>${esc(m.title)}<small>${m.lessons.map((l) => esc(l.title)).join(' · ')}</small></span></li>`).join('')}</ol>
</section>`;

for (const m of modules) {
  body += `<section class="module"><div class="mod-num">Module ${String(m.number).padStart(2, '0')}</div><h1>${esc(m.title)}</h1><p class="summary">${esc(m.summary)}</p>
    <ul class="objectives">${(m.objectives || []).map((o) => `<li>${OBJ[o] || o}</li>`).join('')}</ul></section>`;
  for (const l of m.lessons) {
    const answers = [];
    body += `<section class="lesson"><h2>${esc(l.title)}</h2>`;
    for (const s of l.steps) body += stepHtml(s, answers);
    if (answers.length) {
      body += `<section class="answers"><h4>Answers: ${esc(l.title)}</h4>${answers.map((a) => `<ol>${a.questions.map((q) => `<li><strong>${'ABCDEFG'[q.answer]}. ${q.choices[q.answer]}</strong> <span>${q.explain.replace(/<\/?p>/g, ' ')}</span></li>`).join('')}</ol>`).join('')}</section>`;
    }
    body += '</section>';
  }
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>iOS Development Study Guide</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
@page { size: Letter; margin: 0.65in 0.7in 0.75in; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 Figtree, -apple-system, system-ui, sans-serif; color: #15171c; margin: 0; }
h1, h2, h3, h4 { font-family: "Bricolage Grotesque", Figtree, sans-serif; letter-spacing: -0.01em; break-after: avoid; }
code, pre { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; }
.cover { min-height: 9in; display: flex; flex-direction: column; justify-content: center; break-after: page; }
.cover .mark { width: 64px; height: 64px; border-radius: 16px; background: #f05138; color: #fff; display: grid; place-items: center; font: 700 34pt "Bricolage Grotesque"; }
.cover h1 { font-size: 40pt; margin: 18px 0 4px; }
.cover .sub { font-size: 14pt; color: #474d59; margin: 0 0 18px; }
.cover .cover-note { color: #474d59; max-width: 5.6in; }
.toc { list-style: none; padding: 0; margin: 8px 0 0; }
.toc li { display: grid; grid-template-columns: 36px 1fr; gap: 8px; padding: 6px 0; border-top: 1px solid #d9dde4; }
.toc-n { font: 700 11pt "JetBrains Mono"; color: #f05138; }
.toc small { display: block; color: #6d7380; font-size: 8.5pt; }
.module { break-before: page; padding-top: 1.4in; }
.module h1 { font-size: 30pt; margin: 4px 0 10px; }
.mod-num { font: 700 11pt "JetBrains Mono"; color: #f05138; letter-spacing: .08em; text-transform: uppercase; }
.summary { font-size: 13pt; color: #474d59; max-width: 6in; }
.objectives { color: #474d59; }
.lesson { break-before: page; }
.lesson > h2 { font-size: 20pt; border-bottom: 2px solid #f05138; padding-bottom: 6px; margin: 0 0 10px; }
.step { margin: 0 0 18px; }
.kind { font: 700 7.5pt Figtree; letter-spacing: .1em; text-transform: uppercase; color: #6d7380; }
.step h3 { font-size: 14pt; margin: 2px 0 6px; }
.step h4 { font-size: 10.5pt; margin: 12px 0 6px; color: #474d59; }
.prose p { margin: 0 0 6px; }
.prose code, .points code, .q code, .choices code { font-size: 8.8pt; background: #f2f3f6; padding: 0 3px; border-radius: 3px; }
.points { display: grid; grid-template-columns: 1.6in 1fr; gap: 4px 12px; margin: 8px 0; }
.points dt { font-weight: 700; }
.points dd { margin: 0; color: #474d59; }
.callout, .try { background: #f6f7f9; border-left: 3px solid #f05138; padding: 8px 12px; margin: 8px 0; border-radius: 4px; break-inside: avoid; }
.callout p { margin: 4px 0 0; }
.try ol { margin: 4px 0 0; padding-left: 18px; }
.interactive-note { color: #6d7380; font-style: italic; font-size: 9pt; }
pre.code { background: #fbfbfc; border: 1px solid #d9dde4; border-radius: 6px; padding: 8px 10px; font-size: 8.4pt; line-height: 1.5; white-space: pre-wrap; break-inside: avoid; margin: 8px 0; }
.ln { display: inline-block; width: 22px; color: #a0a5af; user-select: none; }
.t-kw { color: #9b2393; font-weight: 700; } .t-str { color: #c41a16; } .t-num { color: #1c00cf; } .t-cmt { color: #5d6c79; font-style: italic; }
.t-type { color: #0b4f79; } .t-fn, .t-member, .t-decl { color: #326d74; } .t-attr, .t-proj { color: #815f03; } .t-interp { color: #6d7380; }
.output { margin: 6px 0; break-inside: avoid; }
.output span { font: 700 7.5pt Figtree; text-transform: uppercase; letter-spacing: .08em; color: #1a7f45; }
.output.err span { color: #c8281c; }
.output pre { margin: 2px 0 0; background: #f2f3f6; padding: 6px 10px; border-radius: 5px; font-size: 8.4pt; white-space: pre-wrap; }
.notes { display: grid; gap: 6px; }
.note { break-inside: avoid; border-top: 1px solid #e5e8ed; padding-top: 5px; }
.note-head { display: flex; gap: 8px; align-items: baseline; }
.note-n { font: 700 8pt "JetBrains Mono"; color: #f05138; min-width: 18px; }
.note-head code { font-size: 8.4pt; white-space: pre-wrap; }
.note dl { display: grid; grid-template-columns: 0.55in 1fr; gap: 1px 8px; margin: 3px 0 0 26px; font-size: 8.8pt; line-height: 1.4; }
.note dt { font: 700 7pt Figtree; text-transform: uppercase; letter-spacing: .08em; color: #6d7380; padding-top: 2px; }
.note dd { margin: 0; color: #2f333b; }
.note dd.what { font-weight: 600; color: #15171c; }
.quiz { padding-left: 18px; }
.quiz > li { margin-bottom: 8px; break-inside: avoid; }
.quiz .q p { margin: 0 0 3px; }
.choices { margin: 2px 0 0; padding-left: 20px; color: #474d59; }
.answers { background: #f6f7f9; border-radius: 6px; padding: 8px 12px; margin-top: 10px; font-size: 9pt; break-inside: avoid-page; }
.answers h4 { margin: 0 0 6px; }
.answers ol { margin: 0; padding-left: 18px; }
.answers li { margin-bottom: 5px; }
.answers span { color: #474d59; }
svg { display: none; }
</style></head><body>${body}</body></html>`;

// The intermediate HTML goes to a temporary directory, never into the repo.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'study-guide-'));
const out = path.join(tmp, 'study-guide.html');
const pdfPath = path.join(ROOT, 'ios-development-study-guide.pdf');
let browser;
try {
  fs.writeFileSync(out, html);
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(out).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: pdfPath,
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font: 8px Helvetica, Arial, sans-serif; color: #8a8f99; width: 100%; padding: 0 0.7in; display: flex; justify-content: space-between;"><span>iOS Development Study Guide</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '0.6in', bottom: '0.75in', left: '0.7in', right: '0.7in' },
  });
} finally {
  if (browser) await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
const stat = fs.statSync(pdfPath);
console.log(`ios-development-study-guide.pdf  ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
