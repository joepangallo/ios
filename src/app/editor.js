// A small, dependency-free code editor: a transparent <textarea> over a
// syntax-highlighted <pre>, with a line gutter, a selected-line band (the line
// being explained), error and trace markers, and Swift-friendly indentation.
import { highlightCode } from './highlight.js';

const LH = 22; // line height in px; must match CSS

export class CodeEditor {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.line = 1;
    this.marks = new Map();
    host.classList.add('ed');
    host.innerHTML = `
      <div class="ed-scroll">
        <div class="ed-inner">
          <div class="ed-gutter" aria-hidden="true"></div>
          <div class="ed-code">
            <div class="ed-band" aria-hidden="true"></div>
            <div class="ed-trace" aria-hidden="true" hidden></div>
            <pre class="ed-hl" aria-hidden="true"></pre>
            <textarea class="ed-ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea>
          </div>
        </div>
      </div>`;
    this.scroll = host.querySelector('.ed-scroll');
    this.inner = host.querySelector('.ed-inner');
    this.gutter = host.querySelector('.ed-gutter');
    this.pre = host.querySelector('.ed-hl');
    this.ta = host.querySelector('.ed-ta');
    this.band = host.querySelector('.ed-band');
    this.traceBand = host.querySelector('.ed-trace');
    this.ta.setAttribute('aria-label', opts.label || 'Swift code editor');
    if (opts.id) this.ta.id = opts.id;
    if (opts.readOnly) this.ta.readOnly = true;
    this.ta.addEventListener('input', () => { this.paint(); this.updateLine(); if (this.opts.onChange) this.opts.onChange(this.ta.value); });
    for (const ev of ['click', 'keyup', 'focus']) this.ta.addEventListener(ev, () => this.updateLine());
    this.ta.addEventListener('keydown', (e) => this.onKey(e));
    this.gutter.addEventListener('click', (e) => {
      const n = e.target.closest('[data-n]');
      if (n) this.setLine(Number(n.dataset.n), true);
    });
    this.setCode(opts.code || '');
  }

  getCode() { return this.ta.value; }

  setCode(code) {
    this.ta.value = code;
    this.paint();
    this.setLine(Math.min(this.line, this.lineCount()), false);
  }

  lineCount() { return this.ta.value.split('\n').length; }

  paint() {
    const code = this.ta.value;
    const lines = highlightCode(code);
    this.pre.innerHTML = lines.map((l) => `<span class="ed-line">${l || ' '}</span>`).join('\n');
    const n = lines.length;
    let g = '';
    for (let i = 1; i <= n; i++) {
      const mk = this.marks.get(i);
      const noted = this.opts.hasNote ? this.opts.hasNote(i, code) : false;
      g += `<span data-n="${i}" class="${i === this.line ? 'on' : ''} ${mk ? 'mk-' + mk.kind : ''} ${noted ? 'noted' : ''}" title="${mk ? mk.msg.replace(/"/g, '&quot;') : `Line ${i}`}">${i}</span>`;
    }
    this.gutter.innerHTML = g;
    const longest = Math.max(...code.split('\n').map((l) => l.length), 10);
    this.inner.style.height = `${n * LH + 24}px`;
    this.inner.style.setProperty('--chars', String(longest + 2));
  }

  // Caret position -> current line number.
  updateLine() {
    const pos = this.ta.selectionStart;
    const line = this.ta.value.slice(0, pos).split('\n').length;
    if (line !== this.line) this.setLine(line, false);
  }

  setLine(n, focusEditor = false, { scroll = true } = {}) {
    n = Math.max(1, Math.min(n, this.lineCount()));
    this.line = n;
    this.band.style.transform = `translateY(${(n - 1) * LH}px)`;
    this.gutter.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
    const g = this.gutter.querySelector(`[data-n="${n}"]`);
    if (g) g.classList.add('on');
    if (scroll) this.ensureVisible(n);
    if (focusEditor) {
      const lines = this.ta.value.split('\n');
      let pos = 0;
      for (let i = 0; i < n - 1; i++) pos += lines[i].length + 1;
      this.ta.focus({ preventScroll: true });
      this.ta.setSelectionRange(pos + lines[n - 1].length - lines[n - 1].trimStart().length, pos + lines[n - 1].length);
    }
    if (this.opts.onLine) this.opts.onLine(n);
  }

  ensureVisible(n) {
    const top = (n - 1) * LH;
    const view = this.scroll;
    if (top < view.scrollTop + 8) view.scrollTop = Math.max(0, top - LH);
    else if (top + LH > view.scrollTop + view.clientHeight - 16) view.scrollTop = top - view.clientHeight + LH * 2;
  }

  setMarks(marks) {
    // marks: [{ line, kind: 'error'|'warn', msg }]
    this.marks = new Map(marks.map((m) => [m.line, m]));
    this.paint();
  }

  setTraceLine(n) {
    if (!n) { this.traceBand.hidden = true; return; }
    this.traceBand.hidden = false;
    this.traceBand.style.transform = `translateY(${(n - 1) * LH}px)`;
    this.ensureVisible(n);
  }

  onKey(e) {
    const ta = this.ta;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (this.opts.onRun) this.opts.onRun(); return; }
    if (e.key === 'Escape') { ta.blur(); return; }
    if (ta.readOnly) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value } = ta;
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      if (e.shiftKey) {
        const lineText = value.slice(lineStart);
        const m = /^ {1,4}/.exec(lineText);
        if (m) { ta.setRangeText('', lineStart, lineStart + m[0].length, 'end'); ta.setSelectionRange(Math.max(lineStart, s - m[0].length), Math.max(lineStart, en - m[0].length)); }
      } else {
        ta.setRangeText('    ', s, en, 'end');
      }
      ta.dispatchEvent(new Event('input'));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value } = ta;
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const current = value.slice(lineStart, s);
      let indent = /^ */.exec(current)[0];
      if (/[{(\[]\s*$/.test(current)) indent += '    ';
      ta.setRangeText('\n' + indent, s, en, 'end');
      ta.dispatchEvent(new Event('input'));
      return;
    }
    if (e.key === '}') {
      const { selectionStart: s, value } = ta;
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const before = value.slice(lineStart, s);
      if (/^ {4,}$/.test(before)) {
        e.preventDefault();
        ta.setRangeText(before.slice(4) + '}', lineStart, s, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    }
  }

  focus() { this.ta.focus(); }
}
