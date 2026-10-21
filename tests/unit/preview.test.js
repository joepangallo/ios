// @vitest-environment jsdom
// Renders every SwiftUI example in the course with the live preview (jsdom),
// checks there is no build/runtime error, then exercises state updates.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false }));
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
});

const { mountPreview } = await import('../../src/engine/swiftui/preview.js');
const tick = () => new Promise((r) => setTimeout(r, 20));

function mount(code) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const errors = [];
  const ctl = mountPreview(host, code, { onError: (e) => errors.push(e) });
  return { host, ctl, errors, root: host.shadowRoot };
}

describe('live preview basics', () => {
  it('renders text and updates @State on tap', async () => {
    const { root, errors } = mount(`import SwiftUI
struct C: View {
    @State private var n = 0
    var body: some View {
        VStack {
            Text("Count: \\(n)")
            Button("Add") { n += 1 }
        }
    }
}
#Preview { C() }`);
    await tick();
    expect(errors).toEqual([]);
    expect(root.querySelector('.screen').textContent).toContain('Count: 0');
    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent.includes('Add'));
    btn.click();
    await tick();
    expect(root.querySelector('.screen').textContent).toContain('Count: 1');
  });
  it('binds a TextField and a Toggle', async () => {
    const { root } = mount(`import SwiftUI
struct F: View {
    @State private var name = ""
    @State private var on = false
    var body: some View {
        Form {
            TextField("Name", text: $name)
            Toggle("On", isOn: $on)
            Text(on ? "Hi \\(name)" : "off")
        }
    }
}
#Preview { F() }`);
    await tick();
    const input = root.querySelector('.screen input');
    input.value = 'Ana';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector('[role="switch"]').click();
    await tick();
    expect(root.querySelector('.screen').textContent).toContain('Hi Ana');
  });
  it('shows a build error with its line', async () => {
    const { root, errors } = mount('import SwiftUI\nstruct V: View { var body: some View { Text(nope) } }\n#Preview { V() }');
    await tick();
    expect(errors[0].message).toContain("cannot find 'nope' in scope");
    expect(root.querySelector('.error-pane').textContent).toContain('Build failed');
  });
  it('pushes onto a NavigationStack', async () => {
    const { root } = mount(`import SwiftUI
struct N: View {
    var body: some View {
        NavigationStack {
            List {
                NavigationLink("Detail") { Text("Inside detail") }
            }
            .navigationTitle("Home")
        }
    }
}
#Preview { N() }`);
    await tick();
    [...root.querySelectorAll('button')].find((b) => b.textContent.includes('Detail')).click();
    await tick();
    expect(root.querySelector('.screen').textContent).toContain('Inside detail');
  });
});

// Under jsdom, relative URLs resolve against the fake document origin, so resolve with path instead.
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/content');
for (const f of fs.readdirSync(DIR).filter((x) => /^\d\d-.*\.js$/.test(x)).sort()) {
  const mod = (await import(pathToFileURL(path.join(DIR, f)).href)).default;
  const units = [];
  for (const lesson of mod.lessons) lesson.steps.forEach((s, i) => {
    if (s.kind === 'code' && s.run === 'swiftui') units.push([`${lesson.id}.${i + 1} ${s.title}`, s.lines]);
    if (s.kind === 'compare') for (const side of ['left', 'right']) if (s[side] && s[side].run === 'swiftui') units.push([`${lesson.id}.${i + 1} ${s.title} [${side}]`, s[side].lines]);
  });
  if (!units.length) continue;
  describe(`SwiftUI examples in ${f}`, () => {
    for (const [name, lines] of units) {
      it(name, async () => {
        const { root, errors, ctl } = mount(lines.map((l) => l[0]).join('\n'));
        await tick();
        expect(errors.map((e) => e.message)).toEqual([]);
        // The .content wrapper exists whatever the renderer does, so require the
        // lesson's own views inside it: every view the renderer draws carries data-path.
        const content = root.querySelector('.screen .content');
        expect(content).toBeTruthy();
        expect(content.querySelector('[data-path]')).toBeTruthy();
        ctl.destroy();
      });
    }
  });
}
