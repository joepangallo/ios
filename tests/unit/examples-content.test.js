// @vitest-environment jsdom
// Every worked example in the course, executed. Trace and diagram frames run
// through the real engine and must match their recorded expect/claims; phone
// frames render in the live preview with no error pane, and the final frame
// passes its scripted tap check; every tryIt fails on its starter code and
// passes on its reference solution.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from '../../src/engine/index.js';

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false }));
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
});

const { mountPreview } = await import('../../src/engine/swiftui/preview.js');
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const trimEnd = (s) => String(s ?? '').replace(/\s+$/, '');
const codeOf = (lines) => lines.map((l) => l[0]).join('\n') + '\n';

const DIR = path.resolve('src/content');
const files = fs.readdirSync(DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
const modules = [];
for (const f of files) modules.push({ file: f, mod: (await import(pathToFileURL(path.join(DIR, f)).href)).default });

const examples = [];
for (const { file, mod } of modules) {
  for (const lesson of mod.lessons) {
    lesson.steps.forEach((s, i) => { if (s.kind === 'example') examples.push({ file, lesson, index: i, step: s }); });
  }
}

describe('worked examples exist for every module', () => {
  it('finds the full quota of 29', () => {
    expect(examples.length).toBe(29);
  });
});

for (const { file, lesson, index, step } of examples) {
  describe(`${file} ${lesson.id}.${index + 1} ${step.title}`, () => {
    if (step.adapter === 'trace' || step.adapter === 'diagram') {
      step.frames.forEach((fr, fi) => {
        it(`frame ${fi + 1} runs and matches`, async () => {
          if (fr.static) return; // read-along frame: nothing to execute
          const r = await run(codeOf(fr.lines));
          if (fr.partial && fr.expectError) {
            expect(r.error, `frame ${fi + 1} should fail`).toBeTruthy();
            expect(r.error.message).toContain(fr.expectError);
            return;
          }
          expect(r.error, `frame ${fi + 1} errored: ${r.error?.message}`).toBeNull();
          if (fr.expect !== undefined) expect(trimEnd(r.stdout)).toBe(trimEnd(fr.expect));
          if (fr.claims) for (const c of fr.claims) expect(r.stdout, `frame ${fi + 1} output should contain ${JSON.stringify(c)}`).toContain(c);
          if (step.adapter === 'trace' && fi === step.frames.length - 1) expect(trimEnd(r.stdout)).toBe(trimEnd(step.expect));
        });
      });
    }
    if (step.adapter === 'phone') {
      step.frames.forEach((fr, fi) => {
        it(`frame ${fi + 1} renders in the preview with no error`, async () => {
          const host = document.createElement('div');
          document.body.appendChild(host);
          const errors = [];
          const ctl = mountPreview(host, codeOf(fr.lines), { onError: (e) => errors.push(e) });
          await tick(60);
          expect(errors).toEqual([]);
          expect(host.shadowRoot.querySelector('.error-pane')).toBeNull();
          const content = host.shadowRoot.querySelector('.content');
          expect(content, 'preview rendered no content').toBeTruthy();
          expect(content.textContent.trim().length).toBeGreaterThan(0);
          if (fr.device) ctl.setDevice(fr.device);
          if (fr.dynamicType !== undefined) ctl.setDynamicType(fr.dynamicType);
          await tick(30);
          expect(host.shadowRoot.querySelector('.error-pane')).toBeNull();
          ctl.destroy();
          host.remove();
        });
      });
      it('the scripted tap check passes on the final frame', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const errors = [];
        const ctl = mountPreview(host, codeOf(step.frames[step.frames.length - 1].lines), { onError: (e) => errors.push(e) });
        await tick(60);
        expect(errors).toEqual([]);
        expect(ctl.tap(step.check.tap), `no control labelled ${step.check.tap}`).toBe(true);
        await tick(60);
        expect(ctl.previewText()).toContain(step.check.expectText.replace(/\s+/g, ' ').trim());
        ctl.destroy();
        host.remove();
      });
    }
    it('tryIt fails on the starter and passes on the reference solution', async () => {
      const starter = await run(codeOf(step.tryIt.lines));
      expect(starter.error !== null || trimEnd(starter.stdout) !== trimEnd(step.tryIt.expect), 'starter must not already pass').toBe(true);
      const solution = await run(codeOf(step.tryIt.solution));
      expect(solution.error, `solution errored: ${solution.error?.message}`).toBeNull();
      expect(trimEnd(solution.stdout)).toBe(trimEnd(step.tryIt.expect));
    });
  });
}
