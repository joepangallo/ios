// @vitest-environment jsdom
// Regression tests for the SwiftUI preview review findings: view identity,
// dismiss from presented screens, render loops, overlays, bindings, numeric
// fields, ForEach keys, color scheme, onChange keys, duplicate ids, motion CSS.
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { mountPreview, morph } from '../../src/engine/swiftui/preview.js';
import { PreviewStateBox, SwiftUIHost, ViewNode, MAX_TEXT_CHARS } from '../../src/engine/swiftui/views.js';
import { DomRenderer, paint, setText, setNodeValue, setAttr, setStyle, setStyleVar, setClass, addClass, toggleClass, setData, setHtml, appendHtml, setProp, MAX_GRADIENT_STOPS, MAX_GRID_TRACKS } from '../../src/engine/swiftui/render.js';
import { PREVIEW_CSS } from '../../src/engine/swiftui/preview-css.js';
import { SArray } from '../../src/engine/values.js';

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = () => ({ matches: false });
});

const mounted = [];
afterEach(() => {
  for (const { host, ctl } of mounted.splice(0)) { ctl.destroy(); host.remove(); }
});

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
function mount(code, opts = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const prints = [];
  const errors = [];
  const ctl = mountPreview(host, code, { onPrint: (text) => prints.push(text.trim()), onError: (e) => errors.push(e.message), ...opts });
  const root = host.shadowRoot;
  const buttons = () => [...root.querySelectorAll('.screen button')];
  const button = (text) => buttons().find((b) => b.textContent.trim() === text);
  const click = async (text) => { expect(button(text), `button "${text}" among ${buttons().map((b) => b.textContent.trim()).join('|')}`).toBeTruthy(); button(text).click(); await tick(); };
  const text = () => root.querySelector('.screen').textContent.replace('9:41', '').trim();
  const status = () => root.querySelector('.pv-status').textContent;
  const result = { host, ctl, root, prints, errors, button, buttons, click, text, status };
  mounted.push(result);
  return result;
}

const counter = String.raw`
struct Counter: View {
    @State var n = 0
    var body: some View { Button("Count: \(n)") { n += 1 } }
}`;

describe('view identity (finding 3)', () => {
  it('keeps @State of a sibling after a preceding `if` branch disappears', async () => {
    const p = mount(`import SwiftUI
${counter}
struct Root: View {
    @State var show = true
    var body: some View {
        VStack {
            if show { Text("Banner") }
            Counter()
            Button("Toggle") { show.toggle() }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Count: 0');
    await p.click('Toggle');
    expect(p.button('Count: 1')).toBeTruthy();
    expect(p.text()).not.toContain('Banner');
    await p.click('Toggle');
    expect(p.button('Count: 1')).toBeTruthy();
    expect(p.text()).toContain('Banner');
    expect(p.errors).toEqual([]);
  });

  it('renders the placeholder of a false `if` without taking space or a list row', async () => {
    const p = mount(`import SwiftUI
#Preview {
    List {
        if false { Text("hidden") }
        Text("shown")
    }
}`);
    await tick();
    expect(p.root.querySelectorAll('.screen .v-row').length).toBe(1);
    expect(p.root.querySelector('.screen .v-empty')).toBeNull();
    expect(PREVIEW_CSS).toMatch(/\.v-empty \{ display: none; \}/);
  });

  it('gives a different view type at the same slot its own @State', async () => {
    const p = mount(`import SwiftUI
struct A: View {
    @State var text = "A-state"
    var body: some View { Text(text) }
}
struct B: View {
    @State var text = "B-state"
    var body: some View { Text(text) }
}
struct Root: View {
    @State var useA = true
    var body: some View {
        VStack {
            if useA { A() } else { B() }
            Button("Swap") { useA.toggle() }
        }
    }
}
#Preview { Root() }`);
    await tick();
    expect(p.text()).toContain('A-state');
    await p.click('Swap');
    expect(p.text()).toContain('B-state');
    expect([...p.ctl.state.keys()].some((k) => k.includes('>B.text'))).toBe(true);
  });
});

describe('dismiss from presented screens (finding 1)', () => {
  const sheetView = String.raw`
struct SheetView: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View { Button("Done") { dismiss() } }
}`;

  it('closes a sheet from a button inside it', async () => {
    const p = mount(`import SwiftUI
${sheetView}
struct Root: View {
    @State var show = false
    var body: some View {
        Button("Open") { show = true }
            .sheet(isPresented: $show) { SheetView() }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Open');
    expect(p.root.querySelector('.sheet')).toBeTruthy();
    await p.click('Done');
    expect(p.root.querySelector('.sheet')).toBeNull();
    expect(p.errors).toEqual([]);
  });

  it('closes a fullScreenCover from a button inside it', async () => {
    const p = mount(`import SwiftUI
${sheetView}
struct Root: View {
    @State var show = false
    var body: some View {
        Button("Open") { show = true }
            .fullScreenCover(isPresented: $show) { SheetView() }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Open');
    expect(p.root.querySelector('.sheet-overlay.cover')).toBeTruthy();
    await p.click('Done');
    expect(p.root.querySelector('.sheet-overlay')).toBeNull();
  });

  it('pops a pushed NavigationStack screen', async () => {
    const p = mount(`import SwiftUI
${sheetView}
#Preview {
    NavigationStack {
        NavigationLink("Push") { SheetView() }
            .navigationTitle("Home")
    }
}`);
    await tick();
    await p.click('Push');
    expect(p.root.querySelector('.v-nav').dataset.depth).toBe('1');
    await p.click('Done');
    expect(p.root.querySelector('.v-nav').dataset.depth).toBe('0');
    expect(p.text()).toContain('Home');
  });

  it('matches the real lesson step: Tap Add, then Save habit', async () => {
    const p = mount(String.raw`import SwiftUI
struct NewHabitSheet: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Button("Save habit") { dismiss() }
                .navigationTitle("New Habit")
        }
    }
}
struct HabitsView: View {
    @State private var showingAdd = false
    var body: some View {
        NavigationStack {
            Text("No habits yet")
                .navigationTitle("Habits")
                .toolbar { Button("Add") { showingAdd = true } }
                .sheet(isPresented: $showingAdd) { NewHabitSheet() }
        }
    }
}
#Preview { HabitsView() }`);
    await tick();
    await p.click('Add');
    expect(p.root.querySelector('.sheet')).toBeTruthy();
    await p.click('Save habit');
    expect(p.root.querySelector('.sheet')).toBeNull();
  });
});

describe('state mutated during body (finding 2)', () => {
  it('does not loop and shows the Xcode runtime warning', async () => {
    const real = globalThis.queueMicrotask;
    let count = 0;
    globalThis.queueMicrotask = (fn) => { count++; if (count > 200) return; real(fn); };
    try {
      const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var n = 0
    func bump() -> String { n += 1; return "n=\(n)" }
    var body: some View { Text(bump()) }
}
#Preview { V() }`);
      await tick(60);
      expect(count).toBeLessThan(20);
      expect(p.errors).toEqual([]);
      expect(p.text()).toContain('n=1');
      expect(p.status()).toBe('Modifying state during view update, this will cause undefined behavior.');
    } finally { globalThis.queueMicrotask = real; }
  });

  it('skips invalidation when a primitive @State is set to the value it already holds', () => {
    let calls = 0;
    const box = new PreviewStateBox(3, () => calls++);
    box.set(3);
    expect(calls).toBe(0);
    box.set(4);
    expect(calls).toBe(1);
    box.set('a'); box.set('a');
    expect(calls).toBe(2);
    // objects are mutated in place by the interpreter and written back, so they always invalidate
    const items = new SArray([1]);
    const arrBox = new PreviewStateBox(items, () => calls++);
    arrBox.set(items);
    expect(calls).toBe(3);
  });

  it('still re-renders when an array @State is mutated in place', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var items = ["a"]
    var body: some View {
        VStack {
            Text(items.joined(separator: ","))
            Button("Add") { items.append("b") }
        }
    }
}
#Preview { V() }`);
    await tick();
    await p.click('Add');
    expect(p.text()).toContain('a,b');
  });
});

describe('overlay and background content (finding 4)', () => {
  it('runs .onAppear inside .overlay { } and .background { }', async () => {
    const p = mount(`import SwiftUI
#Preview {
    Text("x")
        .overlay { Text("o").onAppear { print("ov-appear") } }
        .background { Color.red.onAppear { print("bg-appear") } }
}`);
    await tick(40);
    expect(p.prints).toContain('ov-appear');
    expect(p.prints).toContain('bg-appear');
    expect(p.root.querySelector('.v-layer.front')).toBeTruthy();
  });

  it('keeps @State inside overlay content between renders', async () => {
    const p = mount(`import SwiftUI
${counter}
struct Root: View {
    @State var n = 0
    var body: some View {
        VStack {
            Button("Parent \\(n)") { n += 1 }
            Color.clear.frame(width: 100, height: 100).overlay { Counter() }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Count: 0');
    await p.click('Parent 0');
    expect(p.button('Count: 1')).toBeTruthy();
  });

  it('presents a sheet attached inside overlay content', async () => {
    const p = mount(`import SwiftUI
struct Badge: View {
    @State var show = false
    var body: some View {
        Button("Badge") { show = true }
            .sheet(isPresented: $show) { Text("Sheet body") }
    }
}
#Preview { Text("x").overlay { Badge() } }`);
    await tick();
    await p.click('Badge');
    expect(p.root.querySelector('.sheet')).toBeTruthy();
    expect(p.text()).toContain('Sheet body');
  });
});

describe('.constant bindings (finding 5)', () => {
  it('renders Toggle(isOn: .constant(true)) and ignores taps', async () => {
    const p = mount(`import SwiftUI
#Preview { VStack { Toggle("Always on", isOn: .constant(true)); TextField("v", text: .constant("fixed")) } }`);
    await tick();
    expect(p.errors).toEqual([]);
    const sw = p.root.querySelector('.v-switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    sw.click();
    await tick();
    expect(p.root.querySelector('.v-switch').getAttribute('aria-checked')).toBe('true');
    expect(p.root.querySelector('.screen input').value).toBe('fixed');
  });

  it('accepts Binding.constant(_:) spelled out and in modifiers', async () => {
    const p = mount(`import SwiftUI
#Preview {
    VStack {
        Slider(value: Binding.constant(0.5))
        Text("x").sheet(isPresented: .constant(true)) { Text("Always shown") }
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelector('.screen input[type=range]').value).toBe('0.5');
    expect(p.text()).toContain('Always shown');
  });
});

describe('numeric TextField (finding 6)', () => {
  const field = String.raw`import SwiftUI
struct V: View {
    @State var x = 1.0
    var body: some View { VStack { TextField("v", value: $x, format: .number); Text("val \(x)") } }
}
#Preview { V() }`;

  it('keeps "1." while the user is mid-decimal', async () => {
    const p = mount(field);
    await tick();
    const input = p.root.querySelector('.screen input');
    input.value = '1.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(p.root.querySelector('.screen input').value).toBe('1.');
    expect(p.text()).toContain('val 1.0');
  });

  it('commits a decimal when editing ends', async () => {
    const p = mount(field);
    await tick();
    const input = p.root.querySelector('.screen input');
    input.value = '1.25';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(p.text()).toContain('val 1.25');
    expect(p.root.querySelector('.screen input').value).toBe('1.25');
  });

  it('reverts text that is not a number, like SwiftUI', async () => {
    const p = mount(field);
    await tick();
    const input = p.root.querySelector('.screen input');
    input.value = 'abc';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(p.root.querySelector('.screen input').value).toBe('1.0');
    expect(p.text()).toContain('val 1.0');
  });

  it('morph leaves a focused numeric field alone and updates an unfocused one', () => {
    const make = (v, numeric) => { const d = document.createElement('div'); const i = document.createElement('input'); i.value = v; if (numeric) i.dataset.numeric = '1'; d.appendChild(i); return d; };
    const a = make('1.', true);
    document.body.appendChild(a);
    a.firstChild.focus();
    expect(document.activeElement).toBe(a.firstChild);
    morph(a, make('1.0', true));
    expect(a.firstChild.value).toBe('1.');
    a.firstChild.blur();
    morph(a, make('2.0', true));
    expect(a.firstChild.value).toBe('2.0');
    const b = make('abc', false);
    morph(b, make('abcd', false));
    expect(b.firstChild.value).toBe('abcd');
    a.remove();
  });
});

describe('ForEach rows that are custom views (finding 7)', () => {
  it('carry data-key like primitive rows', async () => {
    const p1 = mount(`import SwiftUI
struct Row: View { let s: String; var body: some View { Text(s) } }
#Preview { VStack { ForEach(["a", "b"], id: \\.self) { Row(s: $0).padding() } } }`);
    const p2 = mount(`import SwiftUI
#Preview { VStack { ForEach(["a", "b"], id: \\.self) { Text($0) } } }`);
    await tick();
    const keys = (p) => [...p.root.querySelectorAll('.screen .v-stack > [data-key]')].map((e) => e.dataset.key);
    expect(keys(p2).length).toBe(2);
    expect(keys(p1)).toEqual(keys(p2));
  });

  it('plays .transition on a struct row that enters a ForEach', async () => {
    const p = mount(`import SwiftUI
struct Row: View { let s: String; var body: some View { Text(s) } }
struct Root: View {
    @State var items = ["a"]
    var body: some View {
        VStack {
            ForEach(items, id: \\.self) { Row(s: $0).transition(.scale) }
            Button("Add") { withAnimation { items.append("b") } }
        }
    }
}
#Preview { Root() }`);
    await tick();
    p.button('Add').click();
    await new Promise((r) => setTimeout(r, 0));
    const added = [...p.root.querySelectorAll('.screen [data-key]')].find((e) => e.textContent === 'b');
    expect(added).toBeTruthy();
    expect(added.classList.contains('enter-scale')).toBe(true);
  });
});

describe('preferredColorScheme (finding 8)', () => {
  it('agrees with @Environment(\\.colorScheme) on the first paint', async () => {
    const p = mount(`import SwiftUI
struct V: View {
    @Environment(\\.colorScheme) var cs
    var body: some View { Text(cs == .dark ? "env:dark" : "env:light").preferredColorScheme(.dark) }
}
#Preview { V() }`);
    await tick();
    expect(p.root.querySelector('.screen-inner.scheme-dark')).toBeTruthy();
    expect(p.text()).toContain('env:dark');
  });

  it('returns to the device scheme when the modifier is removed', async () => {
    const p = mount('import SwiftUI\n#Preview { Text("a").preferredColorScheme(.dark) }');
    await tick();
    expect(p.root.querySelector('.screen-inner.scheme-dark')).toBeTruthy();
    p.ctl.update('import SwiftUI\n#Preview { Text("b") }');
    await tick();
    expect(p.root.querySelector('.screen-inner.scheme-light')).toBeTruthy();
  });

  it('supports switch over the color scheme and interpolation', async () => {
    const p = mount(`import SwiftUI
struct V: View {
    @Environment(\\.colorScheme) var cs
    var body: some View {
        switch cs {
        case .dark: Text("dark mode \\(cs)")
        default: Text("light mode \\(cs)")
        }
    }
}
#Preview { V().environment(\\.colorScheme, .dark) }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('dark mode dark');
  });
});

describe('onChange keys (finding 9)', () => {
  it('does not fire when an unrelated sibling adds a lifecycle hook', async () => {
    const p = mount(String.raw`import SwiftUI
struct Root: View {
    @State var show = true
    @State var x = 0
    var body: some View {
        VStack {
            if show { Text("Banner").onAppear { } }
            Text("x=\(x)").onChange(of: x) { print("changed") }
            Button("Toggle") { show.toggle() }
            Button("Inc") { x += 1 }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Inc');
    await p.click('Toggle');
    await p.click('Toggle');
    expect(p.prints.filter((s) => s === 'changed').length).toBe(1);
    expect([...p.ctl.changeValues.keys()].length).toBe(1);
  });

  it('prunes values of hooks that left the hierarchy', async () => {
    const p = mount(String.raw`import SwiftUI
struct Root: View {
    @State var show = true
    @State var x = 0
    var body: some View {
        VStack {
            if show { Text("x=\(x)").onChange(of: x) { print("changed") } }
            Button("Toggle") { show.toggle() }
            Button("Inc") { x += 1 }
        }
    }
}
#Preview { Root() }`);
    await tick();
    expect(p.ctl.changeValues.size).toBe(1);
    await p.click('Toggle');
    expect(p.ctl.changeValues.size).toBe(0);
    await p.click('Inc');
    await p.click('Toggle');
    expect(p.prints.filter((s) => s === 'changed').length).toBe(0);
  });
});

describe('duplicate ForEach ids (finding 10)', () => {
  it('shows the Xcode runtime warning with the duplicated id', async () => {
    const p = mount(`import SwiftUI
#Preview { VStack { ForEach([1, 3, 3], id: \\.self) { Text("\\($0)") } } }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.status()).toBe('ForEach<Array<Int>, Int, Text>: the ID 3 occurs multiple times within the collection, this will give undefined results!');
  });

  it('stays quiet for unique ids', async () => {
    const p = mount(`import SwiftUI
#Preview { VStack { ForEach(["a", "b"], id: \\.self) { Text($0) } } }`);
    await tick();
    expect(p.status()).toBe('');
  });
});

describe('motion CSS (finding 11)', () => {
  const reduced = PREVIEW_CSS.slice(PREVIEW_CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
  it('disables every keyframe animation under prefers-reduced-motion', () => {
    for (const sel of ['.anim-push .v-navbody', '.anim-pop .v-navbody', '.sheet-overlay .sheet', '.sheet-overlay .dim', '.alert', '.alert-overlay', '.v-spinner']) {
      expect(reduced, sel).toContain(sel);
    }
    expect(reduced).toMatch(/animation: none !important/);
  });

  it('no longer transitions every property while animating', () => {
    expect(PREVIEW_CSS).not.toMatch(/\.animating \*[^}]*transition: all/);
    expect(PREVIEW_CSS).toMatch(/\.animating \*[^}]*transition-property: opacity, transform, background-color, color/);
  });
});

describe('enum-valued environment keys', () => {
  it('compares and prints dynamicTypeSize like SwiftUI', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @Environment(\.dynamicTypeSize) var dt
    var body: some View {
        VStack {
            Text(dt == .large ? "large? yes" : "large? no")
            Text("is \(dt)")
            Text(dt >= DynamicTypeSize.accessibility1 ? "ax" : "not ax")
            Text(dt < DynamicTypeSize.xLarge ? "below xLarge" : "xLarge or more")
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('large? yes');
    expect(p.text()).toContain('is large');
    expect(p.text()).toContain('not ax');
    expect(p.text()).toContain('below xLarge');
  });

  it('resolves cases in a typed context', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @Environment(\.colorScheme) var cs
    var body: some View {
        let wanted: ColorScheme = .light
        Text(cs == wanted ? "same" : "different")
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toBe('same');
  });

  it('follows .environment(\\.dynamicTypeSize, .xLarge) and the device size slider', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @Environment(\.dynamicTypeSize) var dt
    var body: some View { Text("\(dt)") }
}
#Preview { VStack { V(); V().environment(\.dynamicTypeSize, .accessibility2) } }`);
    await tick();
    expect(p.text()).toBe('largeaccessibility2');
    p.ctl.dtIndex = 6;
    p.ctl.render();
    expect(p.text()).toBe('xxxLargeaccessibility2');
  });

  it('exposes the size classes as optional enums', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @Environment(\.horizontalSizeClass) var h
    @Environment(\.verticalSizeClass) var v
    var body: some View {
        VStack {
            if h == .compact { Text("compact width") }
            if let v, v == .regular { Text("regular height \(v)") }
            switch h {
            case .regular: Text("wide")
            default: Text("narrow")
            }
        }
    }
}
#Preview { V() }`, { device: 'iphone-se' });
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toBe('compact widthregular height regularnarrow');
  });
});

describe('LabeledContent and ProgressView labels', () => {
  it('shows value: and trailing content, never a function', async () => {
    const p = mount(`import SwiftUI
#Preview {
    Form {
        LabeledContent("Sum", value: "3")
        LabeledContent("Count", value: 42)
        LabeledContent("Note") { Text("ok") }
        LabeledContent { Text("v") } label: { Text("Custom") }
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    const rows = [...p.root.querySelectorAll('.screen .v-labeled')].map((e) => [e.firstChild.textContent, e.querySelector('.v-labeled-value').textContent]);
    expect(rows).toEqual([['Sum', '3'], ['Count', '42'], ['Note', 'ok'], ['Custom', 'v']]);
    expect(p.text()).not.toContain('Function');
  });

  it('renders the label of a determinate ProgressView', async () => {
    const p = mount(`import SwiftUI
#Preview {
    VStack {
        ProgressView("Loading", value: 30, total: 100)
        ProgressView(value: 0.5) { Text("Half") }
        ProgressView(value: 0.1)
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('Loading');
    expect(p.text()).toContain('Half');
    const bars = [...p.root.querySelectorAll('.screen .v-progressbar')];
    expect(bars.map((b) => b.getAttribute('aria-valuenow'))).toEqual(['30', '50', '10']);
    expect(bars[0].closest('.v-progress-labeled').firstChild.textContent).toBe('Loading');
    expect(bars[2].closest('.v-progress-labeled')).toBeNull();
  });
});

describe('conditional content identity (review M8)', () => {
  it('keeps a Counter after a two-view true branch when the branch flips', async () => {
    const p = mount(`import SwiftUI
${counter}
struct Root: View {
    @State var show = true
    var body: some View {
        VStack {
            if show { Text("A"); Text("B") }
            Counter()
            Button("Toggle") { show.toggle() }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Count: 0');
    await p.click('Toggle');
    expect(p.button('Count: 1')).toBeTruthy();
    expect(p.text()).not.toContain('A');
    await p.click('Toggle');
    expect(p.button('Count: 1')).toBeTruthy();
    expect(p.text()).toContain('AB');
  });

  it('separates the state of if and else branches with the same view type', async () => {
    const p = mount(`import SwiftUI
${counter}
struct Root: View {
    @State var first = true
    var body: some View {
        VStack {
            if first { Text("one"); Counter() } else { Counter() }
            Button("Swap") { first.toggle() }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Count: 0');
    expect([...p.ctl.state.keys()].some((k) => k.includes('?0/1>Counter.n'))).toBe(true);
    await p.click('Swap');
    // the else branch's Counter is a different view: it starts at 0, not at the if branch's 1
    expect(p.button('Count: 0')).toBeTruthy();
    expect([...p.ctl.state.keys()].some((k) => k.includes('?1/0>Counter.n'))).toBe(true);
    await p.click('Count: 0');
    await p.click('Count: 1');
    expect(p.button('Count: 2')).toBeTruthy();
    // flipping back destroys the else view; the if view is created again, so its state is fresh (as in SwiftUI)
    await p.click('Swap');
    expect(p.button('Count: 0')).toBeTruthy();
    expect([...p.ctl.state.keys()].some((k) => k.includes('?1/'))).toBe(false);
  });

  it('lays out conditional children as direct stack children and applies Group modifiers to each', async () => {
    const p = mount(`import SwiftUI
#Preview {
    VStack {
        if true { Text("A"); Text("B") }
        Group { if true { Text("C") } }.padding(4)
        TabView {
            Tab("One", systemImage: "1.circle") { Text("t1") }
            if true { Tab("Two", systemImage: "2.circle") { Text("t2") } }
        }
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    const stack = p.root.querySelector('.screen .v-stack');
    expect([...stack.children].slice(0, 3).map((e) => e.textContent)).toEqual(['A', 'B', 'C']);
    expect(stack.children[2].classList.contains('v-pad')).toBe(true);
    expect([...p.root.querySelectorAll('.screen .v-tab')].map((t) => t.textContent)).toEqual(['One', 'Two']);
  });
});

describe('ForEach over huge ranges (review H1)', () => {
  it('renders rows at bounds beyond 2^53 instead of looping forever', async () => {
    const p = mount(`import SwiftUI
#Preview { VStack { ForEach(9007199254740992..<9007199254740995, id: \\.self) { Text("\\($0)") } } }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toBe('900719925474099290071992547409939007199254740994');
  });

  it('stops with the capacity error for a range that is too large', async () => {
    const p = mount(`import SwiftUI
#Preview { VStack { ForEach(0..<Int.max, id: \\.self) { Text("\\($0)") } } }`);
    await tick();
    expect(p.errors[0]).toContain('too large for the preview (limit 5,000)');
  });
});

describe('scheduler wake-up after user events (review M9)', () => {
  it('runs a task whose stored continuation a Button resumed', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var result = 0
    @State var stored: CheckedContinuation<Int, Never>? = nil
    var body: some View {
        VStack {
            Text("Result \(result)")
            Button("Resume") { stored?.resume(returning: 42); stored = nil }
        }
        .task {
            let v = await withCheckedContinuation { c in stored = c }
            result = v
        }
    }
}
#Preview { V() }`);
    await tick(40);
    expect(p.text()).toContain('Result 0');
    await p.click('Resume');
    await tick(40);
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('Result 42');
  });
});

describe('numeric TextField Return (review L1)', () => {
  it('commits on Return without .onSubmit', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var x = 1.0
    var body: some View { VStack { TextField("v", value: $x, format: .number); Text("val \(x)") } }
}
#Preview { V() }`);
    await tick();
    const input = p.root.querySelector('.screen input');
    input.value = '12.5';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await tick();
    expect(p.text()).toContain('val 12.5');
  });
});

describe('destroy clears a sleeping task\'s timer (review M10)', () => {
  it('leaves no pending timer after destroy', async () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const ctl = mountPreview(host, String.raw`import SwiftUI
#Preview { Text("sleeper").task { try? await Task.sleep(for: .seconds(3600)) } }`, {});
      await vi.advanceTimersByTimeAsync(50);
      expect(ctl.error).toBeNull();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      ctl.destroy();
      await vi.advanceTimersByTimeAsync(50);
      expect(vi.getTimerCount()).toBe(0);
      expect(ctl.driving).toBe(false);
      host.remove();
    } finally { vi.useRealTimers(); }
  });
});

describe('Review pass 2', () => {
  it('gives the if and else tabs of a TabView separate state (M8)', async () => {
    const p = mount(`import SwiftUI
${counter}
struct Root: View {
    @State var first = true
    var body: some View {
        VStack {
            Button("Flip") { first.toggle() }
            TabView {
                if first { Tab("A", systemImage: "a.circle") { Counter() } }
                else { Tab("B", systemImage: "b.circle") { Counter() } }
            }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Count: 0');
    expect(p.button('Count: 1')).toBeTruthy();
    await p.click('Flip');
    expect(p.button('Count: 0')).toBeTruthy();
    expect([...p.ctl.state.keys()].some((k) => k.includes('/tab0?1/'))).toBe(true);
    expect([...p.ctl.state.keys()].some((k) => k.includes('/tab0?0/'))).toBe(false);
  });

  it('keys toolbar items by the if branch they came through (M8)', async () => {
    const p = mount(`import SwiftUI
${counter}
struct Root: View {
    @State var first = true
    var body: some View {
        NavigationStack {
            Button("Flip") { first.toggle() }
                .toolbar { if first { Counter() } else { Counter() } }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('Count: 0');
    await p.click('Flip');
    expect(p.button('Count: 0')).toBeTruthy();
  });

  it('lets a button action finish before the task it resumed runs (M9)', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var n = 0
    @State var seen = -1
    @State var stored: CheckedContinuation<Int, Never>? = nil
    var body: some View {
        VStack {
            Text("seen \(seen)")
            Button("Resume") { stored?.resume(returning: 42); n = 100 }
        }
        .task {
            let v = await withCheckedContinuation { c in stored = c }
            seen = v == 42 ? n : -2
        }
    }
}
#Preview { V() }`);
    await tick(40);
    await p.click('Resume');
    await tick(40);
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('seen 100');
  });

  it('wakes the retired program so editing the code clears its sleep timer (M10)', async () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const ctl = mountPreview(host, 'import SwiftUI\n#Preview { Text("old").task { try? await Task.sleep(for: .seconds(3600)) } }', {});
      await vi.advanceTimersByTimeAsync(50);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      ctl.update('import SwiftUI\n#Preview { Text("new") }');
      await vi.advanceTimersByTimeAsync(50);
      expect(vi.getTimerCount()).toBe(0);
      expect(ctl.driving).toBe(false);
      expect(host.shadowRoot.querySelector('.screen').textContent).toContain('new');
      ctl.destroy();
      await vi.advanceTimersByTimeAsync(50);
      expect(vi.getTimerCount()).toBe(0);
      host.remove();
    } finally { vi.useRealTimers(); }
  });
});

describe('Review pass 3', () => {
  const doubling = (n) => String.raw`import SwiftUI
struct V: View {
    var body: some View {
        var v = AnyView(Text("x"))
        for _ in 0..<${n} { let w = v; v = AnyView(VStack { w; w }) }
        return v
    }
}
#Preview { V() }`;

  it('renders a view tree that doubles twelve times (H1)', async () => {
    const p = mount(doubling(12));
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelectorAll('.screen .v-text').length).toBe(4096);
  });

  it('stops a view tree that would double thirty times with the capacity error (H1)', async () => {
    const p = mount(doubling(30));
    await tick();
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('too large for the preview (limit 20,000)');
    expect(p.root.querySelectorAll('.screen .v-text').length).toBe(0);
  });

  it('keeps the width of fixed-width range bounds and steps exactly (M3)', async () => {
    const p = mount(String.raw`import SwiftUI
#Preview {
    VStack {
        ForEach(UInt8(254)...UInt8.max, id: \.self) { Text("\($0) \($0 == UInt8.max ? "max" : "below")") }
        ForEach((UInt64.max - 1)...UInt64.max, id: \.self) { Text("\($0)") }
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    expect([...p.root.querySelectorAll('.screen .v-text')].map((e) => e.textContent)).toEqual(['254 below', '255 max', '18446744073709551614', '18446744073709551615']);
  });

  it('keeps toolbar and tab state after a preceding `if` item hides (M9)', async () => {
    const p = mount(`import SwiftUI
${counter}
struct Root: View {
    @State var show = true
    var body: some View {
        NavigationStack {
            VStack {
                Button("Hide") { show.toggle() }
                TabView {
                    if show { Tab("A", systemImage: "a.circle") { Text("a") } }
                    Tab("B", systemImage: "b.circle") { Counter() }
                }
            }
            .toolbar { if show { Text("Banner") }; Counter() }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('B');
    const counters = () => p.buttons().filter((b) => b.textContent.startsWith('Count: ')).map((b) => b.textContent);
    expect(counters()).toEqual(['Count: 0', 'Count: 0']);
    for (const b of p.buttons().filter((x) => x.textContent === 'Count: 0')) { b.click(); await tick(); }
    expect(counters()).toEqual(['Count: 1', 'Count: 1']);
    await p.click('Hide');
    expect(p.text()).not.toContain('Banner');
    expect(counters()).toEqual(['Count: 1', 'Count: 1']);
  });
});

describe('Review pass 4', () => {
  it('caps Group flattening at construction before memory is spent (H1)', async () => {
    const started = performance.now();
    const p = mount(String.raw`import SwiftUI
struct V: View {
    var body: some View {
        var v = AnyView(Text("x"))
        for _ in 0..<22 { let w = v; v = AnyView(Group { w; w }) }
        return v
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('too large for the preview (limit 20,000)');
    // The node count is the real bound: flattening stops at the cap instead of
    // building the four million nodes this tree describes. Time is a hang guard only.
    expect(p.ctl.host.builtNodes).toBeLessThanOrEqual(20_001);
    expect(performance.now() - started).toBeLessThan(10_000);
  });

  it('runs the cancellation handler promptly when a sleeping .task leaves the screen (M3)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Sleeper: View {
    var body: some View {
        Text("sleeping").task {
            do {
                try await Task.sleep(for: .seconds(3600))
                print("woke")
            } catch {
                print(Task.isCancelled ? "cancelled" : "other")
            }
        }
    }
}
struct Root: View {
    @State var show = true
    var body: some View {
        VStack {
            if show { Sleeper() }
            Button("Hide") { show.toggle() }
        }
    }
}
#Preview { Root() }`);
    await tick(40);
    expect(p.prints).toEqual([]);
    await p.click('Hide');
    await tick(60);
    expect(p.errors).toEqual([]);
    expect(p.prints).toEqual(['cancelled']);
    expect(p.ctl.interp.scheduler.tasks.filter((t) => !t.done).length).toBe(0);
  });

  it('keeps the selected tab when an earlier conditional tab disappears (M5)', async () => {
    const p = mount(`import SwiftUI
struct Root: View {
    @State var showA = true
    var body: some View {
        VStack {
            Button("Toggle A") { showA.toggle() }
            TabView {
                if showA { Tab("A", systemImage: "a.circle") { Text("content a") } }
                Tab("B", systemImage: "b.circle") { Text("content b") }
                Tab("C", systemImage: "c.circle") { Text("content c") }
            }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('B');
    expect(p.text()).toContain('content b');
    await p.click('Toggle A');
    expect([...p.root.querySelectorAll('.screen .v-tab')].map((t) => t.textContent)).toEqual(['B', 'C']);
    expect(p.text()).toContain('content b');
    expect(p.root.querySelector('.screen .v-tab.on').textContent).toBe('B');
    await p.click('Toggle A');
    expect(p.text()).toContain('content b');
    await p.click('C');
    await p.click('Toggle A');
    expect(p.text()).toContain('content c');
  });
});

describe('destroy drains cancelled tasks (Review pass 5)', () => {
  const sleeper = String.raw`import SwiftUI
#Preview {
    Text("sleeper").task {
        do { try await Task.sleep(for: .seconds(3600)); print("woke") }
        catch { print(Task.isCancelled ? "cancelled" : "other") }
    }
}`;

  it('runs the catch of an hour-long sleeping .task after destroy', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const prints = [];
    const ctl = mountPreview(host, sleeper, { onPrint: (s) => prints.push(s.trim()) });
    await tick(40);
    expect(prints).toEqual([]);
    ctl.destroy();
    expect(host.shadowRoot.querySelector('.screen')).toBeNull();
    await tick(60);
    expect(prints).toEqual(['cancelled']);
    expect(ctl.halted).toBe(true);
    expect(ctl.driving).toBe(false);
    expect(ctl.interp.scheduler.tasks.every((t) => t.done)).toBe(true);
    host.remove();
  });

  it('bounds the drain so a handler that never yields cannot hold the page', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const prints = [];
    const errors = [];
    const ctl = mountPreview(host, String.raw`import SwiftUI
#Preview {
    Text("sleeper").task {
        do { try await Task.sleep(for: .seconds(3600)) }
        catch { print("cancelled"); var n = 0; while true { n += 1 } }
    }
}`, { onPrint: (s) => prints.push(s.trim()), onError: (e) => errors.push(e.message) });
    await tick(40);
    ctl.destroy();
    await tick(200);
    expect(prints).toEqual(['cancelled']);
    expect(ctl.halted).toBe(true);
    expect(ctl.interp.scheduler.tasks.every((t) => t.done)).toBe(true);
    expect(errors).toEqual([]);
    host.remove();
  });
});

describe('destroy (housekeeping)', () => {
  it('cancels running .task loops', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var n = 0
    var body: some View { Text("\(n)").task { while true { try? await Task.sleep(for: .milliseconds(5)); n += 1 } } }
}
#Preview { V() }`);
    await tick(30);
    p.ctl.destroy();
    await tick(30);
    expect(p.ctl.interp.scheduler.tasks.filter((t) => !t.done && !t.cancelled).length).toBe(0);
  });
});

describe('nested ForEach construction budget (H6)', () => {
  const nested = (n) => String.raw`import SwiftUI
#Preview {
    ScrollView {
        ForEach(0..<${n}, id: \.self) { i in
            ForEach(0..<${n}, id: \.self) { j in Text("\(i),\(j)") }
        }
    }
}`;
  // Counts the Text views the builtin constructor actually creates, independent
  // of the host's own budget counter.
  function countTexts() {
    const counts = { text: 0 };
    const original = SwiftUIHost.prototype.constructView;
    const spy = vi.spyOn(SwiftUIHost.prototype, 'constructView').mockImplementation(function* (t, args, line) {
      if (t.name === 'Text') counts.text++;
      return yield* original.call(this, t, args, line);
    });
    return { counts, restore: () => spy.mockRestore() };
  }

  it('stops a 1,000 x 1,000 nested ForEach at the view limit while it is being built', async () => {
    const { counts, restore } = countTexts();
    try {
      const p = mount(nested(1000));
      await tick();
      expect(p.errors.length).toBe(1);
      expect(p.errors[0]).toContain('too large for the preview (limit 20,000)');
      expect(p.root.querySelectorAll('.screen .v-text').length).toBe(0);
      // Construction stopped near the cap instead of building a million Text views.
      expect(p.ctl.host.builtNodes).toBeLessThanOrEqual(20_001);
      expect(counts.text).toBeGreaterThan(19_000);
      expect(counts.text).toBeLessThanOrEqual(20_100);
      // Before the fix the diagnostic arrived only after 1,021,004 steps.
      expect(p.ctl.interp.steps).toBeLessThan(200_000);
    } finally { restore(); }
  });

  it('stops nested ForEach rows of custom views at the view limit too', async () => {
    const p = mount(String.raw`import SwiftUI
struct Cell: View {
    let i: Int
    let j: Int
    var body: some View { Text("\(i),\(j)") }
}
#Preview {
    VStack {
        ForEach(0..<1000, id: \.self) { i in
            ForEach(0..<1000, id: \.self) { j in Cell(i: i, j: j) }
        }
    }
}`);
    await tick();
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('too large for the preview (limit 20,000)');
    expect(p.ctl.host.builtNodes).toBeLessThanOrEqual(20_001);
    expect(p.ctl.interp.steps).toBeLessThan(200_000);
  });

  it('stops a helper that builds views in a loop before the memory is spent', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    var body: some View {
        var views: [Text] = []
        for i in 0..<1_000_000 { views.append(Text("\(i)")) }
        return views[0]
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('too large for the preview (limit 20,000)');
    expect(p.ctl.host.builtNodes).toBeLessThanOrEqual(20_001);
  });

  it('still renders a 100 x 100 nested ForEach (10,000 views)', async () => {
    const p = mount(nested(100));
    await tick();
    expect(p.errors).toEqual([]);
    const texts = p.root.querySelectorAll('.screen .v-text');
    expect(texts.length).toBe(10_000);
    expect(texts[0].textContent).toBe('0,0');
    expect(texts[texts.length - 1].textContent).toBe('99,99');
    // Building a view and placing it as a row is charged once, not twice.
    expect(p.ctl.host.builtNodes).toBeLessThan(10_300);
  });

  it('still renders 100 x 60 modified rows and custom-view rows', async () => {
    const p = mount(String.raw`import SwiftUI
struct Cell: View {
    let n: Int
    var body: some View { Text("\(n)") }
}
#Preview {
    ScrollView {
        ForEach(0..<100, id: \.self) { i in
            VStack {
                ForEach(0..<40, id: \.self) { j in Text("\(i * 100 + j)").font(.caption).padding(2) }
                ForEach(40..<60, id: \.self) { j in Cell(n: i * 100 + j) }
            }
        }
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelectorAll('.screen .v-text').length).toBe(6_000);
    // A modified Text row is charged once; a custom-view row is its struct plus its body's Text.
    expect(p.ctl.host.builtNodes).toBeLessThan(8_500);
  });

  it('resets the budget on every render', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var n = 0
    var body: some View {
        VStack {
            Button("Bump \(n)") { n += 1 }
            ForEach(0..<60, id: \.self) { i in
                ForEach(0..<100, id: \.self) { j in Text("\(i),\(j)") }
            }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    const first = p.ctl.host.builtNodes;
    for (let k = 0; k < 4; k++) await p.click(`Bump ${k}`);
    expect(p.errors).toEqual([]);
    expect(p.button('Bump 4')).toBeTruthy();
    expect(p.ctl.host.builtNodes).toBe(first);
  });
});

// Records every string charged to a preview's text budget during the test.
function recordCharges() {
  const charged = [];
  const original = SwiftUIHost.prototype.chargeText;
  const spy = vi.spyOn(SwiftUIHost.prototype, 'chargeText').mockImplementation(function (text, line) {
    if (typeof text === 'string' && text.length) charged.push(text);
    return original.call(this, text, line);
  });
  onTestFinished(() => spy.mockRestore());
  return charged;
}

describe('text volume budget (Review pass 7 H2)', () => {
  it('charges one step per 64 characters by running count and stops past the cap', () => {
    const host = new SwiftUIHost(null);
    let steps = 0;
    host.attach({ chargeBulk: (n) => { steps += n; }, fatal: (msg) => new Error(msg) });
    host.chargeText('x'.repeat(63), 1);
    expect(steps).toBe(0);
    host.chargeText('x', 1);
    expect(steps).toBe(1);
    host.chargeText('x'.repeat(640), 1);
    expect(steps).toBe(11);
    expect(host.textChars).toBe(704);
    host.chargeText('x'.repeat(MAX_TEXT_CHARS - 704), 1);
    expect(host.textChars).toBe(MAX_TEXT_CHARS);
    expect(steps).toBe(Math.floor(MAX_TEXT_CHARS / 64));
    expect(() => host.chargeText('x', 1)).toThrow('characters of text and page markup, which is too large for the preview (limit 2,000,000)');
    host.resetBuilt();
    expect(host.textChars).toBe(0);
  });

  it('counts every kind of text a render puts into the page', async () => {
    const charged = recordCharges();
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var name = "Joe"
    @State var query = "sea"
    var body: some View {
        NavigationStack {
            VStack {
                Text("abc")
                Button("Go") {}
                TextField("Name", text: $name)
                Label("Hi", systemImage: "star")
                Text("x").accessibilityLabel("lbl")
            }
            .navigationTitle("Title")
            .searchable(text: $query, prompt: "Find")
            .alert("Oops", isPresented: .constant(true)) { Button("OK") {} } message: { Text("Bad") }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    // Every one of these reaches the page through the page writer, which charges it.
    // Field and search values, the navigation and alert titles, the search prompt and
    // the accessibility label are charged only when written.
    for (const t of ['abc', 'Go', 'Name', 'Joe', 'Hi', 'star', 'lbl', 'Title', 'Find', 'sea', 'Oops', 'OK', 'Bad']) expect(charged, t).toContain(t);
    // The budget is exactly the sum of what was charged.
    expect(p.ctl.host.textChars).toBe(charged.reduce((n, t) => n + t.length, 0));
  });

  it('stops 1,000 rows that share one 100,000-character string at the text cap', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let s = String(repeating: "x", count: 100000)
    var body: some View {
        ScrollView {
            ForEach(0..<1000, id: \.self) { _ in Text(s) }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('characters of text and page markup, which is too large for the preview (limit 2,000,000)');
    expect(p.root.querySelectorAll('.screen .v-text').length).toBe(0);
    // It stopped at the twenty-first row, and the text it took was charged as steps.
    expect(p.ctl.host.textChars).toBe(2_100_000);
    expect(p.ctl.interp.steps).toBeGreaterThanOrEqual(Math.floor(2_000_000 / 64));
  });

  it('stops bound field values that would put too much text into the page', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var s = String(repeating: "x", count: 100000)
    var body: some View {
        ScrollView {
            ForEach(0..<30, id: \.self) { _ in TextField("f", text: $s) }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('characters of text and page markup, which is too large for the preview (limit 2,000,000)');
    expect(p.ctl.host.textChars).toBeLessThanOrEqual(MAX_TEXT_CHARS + 100_000);
  });

  it('renders a screen near the cap and resets the count every render', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var n = 0
    let s = String(repeating: "y", count: 100000)
    var body: some View {
        VStack {
            Button("Bump \(n)") { n += 1 }
            ScrollView { ForEach(0..<9, id: \.self) { _ in Text(s) } }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelectorAll('.screen .v-text').length).toBe(10);
    // Each 100,000-character string counts when its Text is built and when it is written.
    const first = p.ctl.host.textChars;
    expect(first).toBeGreaterThan(1_800_000);
    expect(first).toBeLessThan(MAX_TEXT_CHARS);
    for (let k = 0; k < 3; k++) await p.click(`Bump ${k}`);
    expect(p.errors).toEqual([]);
    expect(p.ctl.host.textChars).toBe(first);
  });
});

describe('modifier wrappers and joined text (Review pass 8)', () => {
  it('stops modifier wrappers shared across rows at the view cap before building any DOM (H4)', async () => {
    const mods = vi.spyOn(DomRenderer.prototype, 'mod');
    try {
      const p = mount(String.raw`import SwiftUI
struct V: View {
    var body: some View {
        var v = AnyView(Text("x"))
        for _ in 0..<1000 { v = AnyView(v.padding(1)) }
        return ScrollView { ForEach(0..<1000, id: \.self) { _ in v } }
    }
}
#Preview { V() }`);
      await tick();
      expect(p.errors.length).toBe(1);
      expect(p.errors[0]).toContain('too large for the preview (limit 20,000)');
      // The cap fired while resolving, so the renderer applied no modifier at all.
      expect(mods).not.toHaveBeenCalled();
      expect(p.root.querySelectorAll('.screen .v-pad').length).toBe(0);
      expect(p.ctl.interp.steps).toBeLessThan(100_000);
    } finally { mods.mockRestore(); }
  });

  it('still renders 5,000 modifier wrappers', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    var body: some View {
        var v = AnyView(Text("x"))
        for _ in 0..<50 { v = AnyView(v.padding(1)) }
        return ScrollView { ForEach(0..<100, id: \.self) { _ in v } }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelectorAll('.screen .v-pad').length).toBe(5_000);
    expect(p.root.querySelectorAll('.screen .v-text').length).toBe(100);
  });

  it('checks joined alert text piece by piece before the joined string exists (H5)', () => {
    const host = new SwiftUIHost(null);
    host.attach({ chargeBulk: () => {}, fatal: (msg) => new Error(msg) });
    const s = 'x'.repeat(100_000);
    let read = 0;
    const pieces = { *[Symbol.iterator]() { for (let i = 0; i < 100; i++) { read++; yield new ViewNode('Text', { text: s }); } } };
    expect(() => host.joinViewText(pieces, ' ', 1)).toThrow('limit 2,000,000');
    // It stopped at the twentieth piece (2,000,019 characters with separators), not after
    // assembling ten million; checking reserves nothing, writing the message charges it.
    expect(read).toBe(20);
    expect(host.textChars).toBe(0);
    expect(host.joinViewText(Array.from({ length: 19 }, () => new ViewNode('Text', { text: s })), ' ', 1).length).toBe(19 * 100_000 + 18);
  });

  it('stops an alert message of 100 shared 100,000-character Texts at the text cap (H5)', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let s = String(repeating: "x", count: 100000)
    var body: some View {
        Text("body")
            .alert("Oops", isPresented: .constant(true)) { Button("OK") {} } message: {
                Group { ForEach(0..<100, id: \.self) { _ in Text(s) } }
            }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('characters of text and page markup, which is too large for the preview (limit 2,000,000)');
    expect(p.ctl.host.textChars).toBeLessThanOrEqual(MAX_TEXT_CHARS + 100_000);
  });

  it('charges a Text when it is built and again when it is written', async () => {
    const charged = recordCharges();
    const p = mount(String.raw`import SwiftUI
#Preview {
    NavigationStack {
        Text("body")
            .navigationTitle(Text("Title"))
            .alert("Oops", isPresented: .constant(true)) { Button("OK") {} } message: { Text("Bad") }
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    const times = (t) => charged.filter((x) => x === t).length;
    // The message Text and the body Text: built once, written once.
    expect(times('Bad')).toBe(2);
    expect(times('body')).toBe(2);
    // The alert title is a plain string: written once.
    expect(times('Oops')).toBe(1);
  });

  it('stops, rather than cuts short, a described array of shared strings past the text budget', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let words = Array(repeating: String(repeating: "x", count: 100000), count: 1000)
    var body: some View {
        NavigationStack { Text("body").accessibilityValue(words) }
    }
}
#Preview { V() }`);
    await tick();
    // describe() counts every character once, so its cut prefix exceeds the budget
    // and the render fails instead of showing a shortened value.
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('characters of text and page markup, which is too large for the preview (limit 2,000,000)');
    expect(p.root.querySelector('.screen [data-a11y-value]')).toBeNull();
  });

  it('describes a value for the page no further than the text budget (H5)', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let nums = Array(repeating: 123456789, count: 1_600_000)
    var body: some View {
        NavigationStack { Text("body").accessibilityValue(nums) }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors.length).toBe(1);
    // The full description is 17.6 million characters. Describing stopped near the text cap
    // instead of running into the interpreter's 16,777,216-element string limit.
    expect(p.errors[0]).toContain('characters of text and page markup, which is too large for the preview (limit 2,000,000)');
    expect(p.ctl.host.textChars).toBeLessThanOrEqual(MAX_TEXT_CHARS + 16);
  });
});

describe('one budgeted page writer (Review pass 9)', () => {
  // Writes that do not touch the DOM but look like DOM writes to the patterns below.
  const NOT_DOM = [
    ['views.js', 'this.value = v;'],
    ['views.js', 'if (title !== undefined) props.title = title;'],
    ['render.js', "case 'navigationTitle': if (env.screen) env.screen.title = a0 instanceof ViewNode ? a0.props.text : this.host.describeBounded(a0); return;"],
  ];
  const FORBIDDEN = [
    /\.setAttribute(NS)?\s*\(/,
    /\.style\s*(\.[A-Za-z_$][\w$]*|\[[^\]]*\])?\s*\+?=(?!=)/,
    /\.style\.(setProperty|cssText)\b/,
    /\.(textContent|innerText|outerText|innerHTML|outerHTML|className|nodeValue|value|title|placeholder|src|href)\s*\+?=(?!=)/,
    /\.dataset\s*(\.[A-Za-z_$][\w$]*|\[[^\]]*\])\s*\+?=(?!=)/,
    /\.classList\.(add|toggle|replace)\s*\(/,
    /\.(insertAdjacentHTML|insertAdjacentText|createTextNode|append|prepend|replaceChildren|setHTMLUnsafe)\s*\(/,
    /document\.write/,
    /=\s*[\w$.]+\.(style|dataset|classList|attributes)\s*;/,
    /Object\.assign\s*\(\s*document\.createElement/,
  ];

  it('writes to the DOM only through the page writer', () => {
    const offenders = [];
    for (const file of ['render.js', 'views.js', 'preview.js']) {
      const lines = readFileSync(`${process.cwd()}/src/engine/swiftui/${file}`, 'utf8').split('\n');
      let inWriter = false;
      lines.forEach((raw, i) => {
        const line = raw.trim();
        if (line === '// page-writer:begin') { inWriter = true; return; }
        if (line === '// page-writer:end') { inWriter = false; return; }
        if (inWriter || line.startsWith('//')) return;
        if (NOT_DOM.some(([f, l]) => f === file && l === line)) return;
        if (FORBIDDEN.some((re) => re.test(line))) offenders.push(`${file}:${i + 1}: ${line.slice(0, 120)}`);
      });
    }
    expect(offenders).toEqual([]);
    // The allowlist names real lines; a stale entry would hide nothing and should go.
    for (const [file, line] of NOT_DOM) {
      expect(readFileSync(`${process.cwd()}/src/engine/swiftui/${file}`, 'utf8')).toContain(line);
    }
  });

  it('the lint catches each kind of direct write', () => {
    const samples = [
      "e.setAttribute('x', y);", 'e.style.color = c;', "e.style['gap'] = g;", "e.style.setProperty('--x', v);", 'e.style.cssText = s;',
      't.textContent = s;', 'e.innerHTML = h;', 'e.className = c;', 'n.nodeValue = v;', 'input.value = v;', 'e.title = t;',
      'e.dataset.path = p;', "e.dataset['key'] = k;", "e.classList.add('x');", "e.classList.toggle('x');",
      "box.insertAdjacentHTML('beforeend', h);", 'e.append(s);', 'const st = e.style;', "Object.assign(document.createElement('div'), { className: 'x' })",
    ];
    for (const sample of samples) expect(FORBIDDEN.some((re) => re.test(sample)), sample).toBe(true);
    for (const ok of ['if (e.dataset.key === k) x();', 'const v = e.style.filter || "";', "e.classList.remove('x');", 'e.disabled = true;', 'delete e.dataset.gw;']) {
      expect(FORBIDDEN.some((re) => re.test(ok)), ok).toBe(false);
    }
  });

  it('charges every write made while painting by its length, and nothing outside a paint', () => {
    const host = new SwiftUIHost(null);
    let steps = 0;
    host.attach({ chargeBulk: (n) => { steps += n; }, fatal: (msg) => new Error(msg) });
    const e = document.createElement('input');
    const t = document.createTextNode('');
    const written = ['abc', 'de', 'red', '4px', 'k', 'm', 'n', 'o', 'R>X', '<b>x</b>', '<i></i>', 'val', 'tip', 'nv'];
    paint(host, () => {
      setText(e, 'abc'); setAttr(e, 'aria-label', 'de'); setStyle(e, 'color', 'red'); setStyleVar(e, '--gap', '4px');
      setClass(e, 'k'); addClass(e, 'm', 'n'); toggleClass(e, 'o', true); setData(e, 'path', 'R>X');
      setHtml(e, '<b>x</b>'); appendHtml(e, '<i></i>'); setProp(e, 'value', 'val'); setProp(e, 'title', 'tip');
      setNodeValue(t, 'nv'); setProp(e, 'disabled', true);
    });
    expect(host.textChars).toBe(written.join('').length);
    setText(e, 'outside a paint');
    setAttr(e, 'aria-label', 'also outside');
    expect(host.textChars).toBe(written.join('').length);
    paint(host, () => setText(e, 'y'.repeat(6_400)));
    expect(steps).toBe(Math.floor((written.join('').length + 6_400) / 64));
    // A write past the cap throws while painting.
    expect(() => paint(host, () => setText(e, 'x'.repeat(MAX_TEXT_CHARS)))).toThrow('limit 2,000,000');
  });

  it('stops data attributes, classes and styles from growing the page past the budget', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let s = String(repeating: "q", count: 100000)
    var body: some View {
        ScrollView {
            ForEach(0..<1000, id: \.self) { i in Text("r").accessibilityHint(s) }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain('characters of text and page markup, which is too large for the preview (limit 2,000,000)');
    expect(p.ctl.host.textChars).toBeLessThanOrEqual(MAX_TEXT_CHARS + 100_000);
  });

  it('draws at most 64 stops of a shared 10,000-stop gradient, with a warning (H3)', async () => {
    const charged = recordCharges();
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let colors = Array(repeating: Color.red, count: 10000)
    var body: some View {
        VStack {
            ForEach(0..<20, id: \.self) { _ in
                LinearGradient(colors: colors, startPoint: .top, endPoint: .bottom).frame(height: 4)
            }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.status()).toContain(`LinearGradient with 10,000 color stops: the preview draws the first ${MAX_GRADIENT_STOPS}`);
    const css = charged.filter((t) => t.startsWith('linear-gradient('));
    expect(css.length).toBe(20);
    for (const c of css) expect(c.split('#FF3B30').length - 1).toBe(MAX_GRADIENT_STOPS);
    // 20 views x 64 stops, not the 1.8 million characters of 20 x 10,000 stops.
    expect(p.ctl.host.textChars).toBeLessThan(60_000);
  });

  it('lays out at most 64 columns of a 10,000-column grid, with a warning (H3)', async () => {
    const charged = recordCharges();
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let cols = Array(repeating: GridItem(.flexible()), count: 10000)
    var body: some View {
        VStack {
            ForEach(0..<20, id: \.self) { _ in LazyVGrid(columns: cols) { Text("a") } }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.status()).toContain(`LazyVGrid with 10,000 columns: the preview lays out the first ${MAX_GRID_TRACKS}`);
    const specs = charged.filter((t) => t.startsWith('minmax(0, 1fr)'));
    expect(specs.length).toBe(20);
    for (const c of specs) expect(c.split('minmax').length - 1).toBe(MAX_GRID_TRACKS);
    expect(p.ctl.host.textChars).toBeLessThan(60_000);
  });

  it('keeps identity paths short for a 10,000-character type name (H4)', async () => {
    const name = 'Cell' + 'X'.repeat(10_000);
    const p = mount(`import SwiftUI
struct ${name}: View {
    @State var n = 0
    var body: some View { Text("c") }
}
#Preview { ScrollView { ForEach(0..<1000, id: \\.self) { _ in ${name}() } } }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelectorAll('.screen .v-text').length).toBe(1000);
    const paths = [...p.root.querySelectorAll('.screen [data-path]')].map((e) => e.dataset.path);
    expect(Math.max(...paths.map((x) => x.length))).toBeLessThan(80);
    expect([...p.ctl.state.keys()].length).toBe(1000);
    expect(Math.max(...[...p.ctl.state.keys()].map((k) => k.length))).toBeLessThan(80);
    expect(p.root.querySelector('.screen').innerHTML).not.toContain('XXXXXXXXXX');
    // 1,000 instances cost a few hundred thousand characters of markup, not ten million.
    expect(p.ctl.host.textChars).toBeLessThan(400_000);
  });

  it('keeps the state of a long-named view across renders (H4)', async () => {
    const name = 'Counter' + 'Y'.repeat(5_000);
    const p = mount(`import SwiftUI
struct ${name}: View {
    @State var n = 0
    var body: some View { Button("Count: \\(n)") { n += 1 } }
}
#Preview { VStack { ${name}(); ${name}() } }`);
    await tick();
    await p.click('Count: 0');
    expect(p.buttons().map((b) => b.textContent.trim())).toEqual(['Count: 1', 'Count: 0']);
    expect(p.errors).toEqual([]);
  });

  it('keeps paths and row keys short for long ForEach ids', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let ids = (0..<50).map { String(repeating: "k", count: 50000) + "\($0)" }
    var body: some View {
        List { ForEach(ids, id: \.self) { id in HStack { Text("row"); Text("\(id.count)") } } }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelectorAll('.screen .v-text').length).toBe(100);
    const keys = [...p.root.querySelectorAll('.screen [data-key]')].map((e) => e.dataset.key);
    expect(new Set(keys).size).toBeGreaterThanOrEqual(50);
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThanOrEqual(64);
    const paths = [...p.root.querySelectorAll('.screen [data-path]')].map((e) => e.dataset.path);
    expect(Math.max(...paths.map((x) => x.length))).toBeLessThan(120);
  });
});

describe('morph keeps unkeyed siblings of keyed rows (review finding)', () => {
  const type = async (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  };

  it('keeps the same focused TextField while typing filters the ForEach rows below it', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var query = ""
    let items = ["apple", "banana", "cherry"]
    var body: some View {
        VStack {
            if !query.isEmpty { Text("Searching") }
            TextField("Search", text: $query)
            ForEach(items.filter { query.isEmpty || $0.contains(query) }, id: \.self) { Text($0) }
        }
    }
}
#Preview { V() }`);
    await tick();
    const input = p.root.querySelector('.screen input');
    input.focus();
    await type(input, 'a');
    expect(p.root.querySelector('.screen input')).toBe(input);
    expect(p.root.activeElement).toBe(input);
    expect(p.text()).toContain('Searching');
    await type(input, 'an');
    expect(p.root.querySelector('.screen input')).toBe(input);
    expect(p.root.activeElement).toBe(input);
    expect(input.value).toBe('an');
    expect([...p.root.querySelectorAll('.screen .v-text')].map((e) => e.textContent)).toEqual(['Searching', 'banana']);
    expect(p.errors).toEqual([]);
  });

  it('moves keyed rows and keeps the header, footer and button elements when the rows reorder', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var order = ["one", "two", "three"]
    var body: some View {
        VStack {
            Text("Header")
            ForEach(order, id: \.self) { Text($0) }
            Text("Footer")
            Button("Reverse") { order.reverse() }
        }
    }
}
#Preview { V() }`);
    await tick();
    const texts = () => [...p.root.querySelectorAll('.screen .v-text')].filter((e) => !e.closest('button'));
    const before = new Map(texts().map((e) => [e.textContent, e]));
    const button = p.button('Reverse');
    await p.click('Reverse');
    expect(texts().map((e) => e.textContent)).toEqual(['Header', 'three', 'two', 'one', 'Footer']);
    // Every element survived: the rows moved, their unkeyed siblings stayed put.
    for (const e of texts()) expect(e).toBe(before.get(e.textContent));
    expect(p.button('Reverse')).toBe(button);
    await p.click('Reverse');
    expect(texts().map((e) => e.textContent)).toEqual(['Header', 'one', 'two', 'three', 'Footer']);
    for (const e of texts()) expect(e).toBe(before.get(e.textContent));
    expect(p.errors).toEqual([]);
  });

  it('removes unkeyed siblings that leave and adds ones that arrive', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var on = true
    var body: some View {
        VStack {
            if on { Text("Banner") }
            ForEach(["a", "b"], id: \.self) { Text($0) }
            if !on { Text("Empty note") }
            Button("Flip") { on.toggle() }
        }
    }
}
#Preview { V() }`);
    await tick();
    const texts = () => [...p.root.querySelectorAll('.screen .v-text')].filter((e) => !e.closest('button')).map((e) => e.textContent);
    expect(texts()).toEqual(['Banner', 'a', 'b']);
    await p.click('Flip');
    expect(texts()).toEqual(['a', 'b', 'Empty note']);
    await p.click('Flip');
    expect(texts()).toEqual(['Banner', 'a', 'b']);
    expect(p.errors).toEqual([]);
  });
});

describe('independent review: preview correctness', () => {
  const press = async (p, label) => {
    const b = p.buttons().find((x) => x.getAttribute('aria-label') === label);
    expect(b, label).toBeTruthy();
    b.click();
    await tick();
  };
  const typeInto = async (input, value, event = 'input') => {
    input.value = value;
    input.dispatchEvent(new Event(event, { bubbles: true }));
    await tick();
  };

  describe('.onChange and .task(id:) use Swift equality (H3)', () => {
    it('fires when a class value is replaced by another instance', async () => {
      const p = mount(String.raw`import SwiftUI
final class Box: Equatable { static func == (a: Box, b: Box) -> Bool { a === b } }
struct V: View {
    @State var item = Box()
    @State var fired = 0
    var body: some View { VStack { Text("fired \(fired)"); Button("New") { item = Box() } }.onChange(of: item) { fired += 1 } }
}
#Preview { V() }`);
      await tick();
      await p.click('New');
      await tick();
      expect(p.text()).toContain('fired 1');
    });

    it("uses the type's own == and notices in-place mutation", async () => {
      const p = mount(String.raw`import SwiftUI
struct P: Equatable { var x: Int; var noise: Int; static func == (a: P, b: P) -> Bool { a.x == b.x } }
struct Q: Equatable { var x: Int }
struct V: View {
    @State var p = P(x: 1, noise: 0)
    @State var q = Q(x: 1)
    @State var arr = [1]
    @State var fired = 0
    @State var firedQ = 0
    @State var firedArr = 0
    var body: some View {
        VStack {
            Text("fired \(fired) \(firedQ) \(firedArr)")
            Button("Noise") { p = P(x: 1, noise: 5) }
            Button("X") { p = P(x: 2, noise: 5) }
            Button("Mutate") { q.x += 1; arr.append(2) }
        }
        .onChange(of: p) { fired += 1 }
        .onChange(of: q) { firedQ += 1 }
        .onChange(of: arr) { firedArr += 1 }
    }
}
#Preview { V() }`);
      await tick();
      await p.click('Noise');
      await tick();
      expect(p.text()).toContain('fired 0 0 0');
      await p.click('X');
      await tick();
      expect(p.text()).toContain('fired 1 0 0');
      await p.click('Mutate');
      await tick();
      expect(p.text()).toContain('fired 1 1 1');
    });

    it('ignores the order of an equal Set', async () => {
      const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var s: Set<Int> = [1, 2, 3, 4, 5, 6, 7, 8]
    @State var fired = 0
    var body: some View { VStack { Text("fired \(fired)"); Button("Same") { s = [8, 7, 6, 5, 4, 3, 2, 1] } }.onChange(of: s) { fired += 1 } }
}
#Preview { V() }`);
      await tick();
      await p.click('Same');
      await tick();
      expect(p.text()).toContain('fired 0');
    });

    it('shows a step limit raised inside a user == in the error pane', async () => {
      const p = mount(String.raw`import SwiftUI
struct P: Equatable { var x: Int; static func == (a: P, b: P) -> Bool { var i = 0; while true { i += 1 }; return true } }
struct V: View {
    @State var p = P(x: 1)
    var body: some View { VStack { Button("Bump") { p.x += 1 } }.onChange(of: p) { print("changed") } }
}
#Preview { V() }`);
      await tick();
      await p.click('Bump');
      await tick();
      expect(p.errors.some((e) => e.includes('Stopped after'))).toBe(true);
      expect(p.prints).not.toContain('changed');
    });
  });

  describe('morph keeps an unkeyed TextField in every case (H4)', () => {
    it('when the ForEach beside it filters to zero rows', async () => {
      const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var q = ""
    let items = ["apple", "banana"]
    var body: some View { VStack { if !q.isEmpty { Text("Searching") }; TextField("Search", text: $q); ForEach(items.filter { q.isEmpty || $0.contains(q) }, id: \.self) { Text($0) } } }
}
#Preview { V() }`);
      await tick();
      const input = p.root.querySelector('.screen input');
      input.focus();
      await typeInto(input, 'z');
      expect(p.root.querySelector('.screen input')).toBe(input);
      expect(p.root.activeElement).toBe(input);
      expect(p.text()).toContain('Searching');
      await typeInto(input, '');
      expect(p.root.querySelector('.screen input')).toBe(input);
      expect(p.text()).toContain('banana');
    });

    it('when the TextField and its siblings are wrapped by modifiers', async () => {
      const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var q = ""
    let items = ["apple", "banana"]
    var body: some View { VStack { if !q.isEmpty { Text("Searching").padding() }; TextField("Search", text: $q).padding(); ForEach(items, id: \.self) { Text($0) } } }
}
#Preview { V() }`);
      await tick();
      const input = p.root.querySelector('.screen input');
      input.focus();
      await typeInto(input, 'a');
      expect(p.root.querySelector('.screen input')).toBe(input);
      expect(p.root.activeElement).toBe(input);
      await typeInto(input, 'ab');
      expect(p.root.querySelector('.screen input')).toBe(input);
      expect(input.value).toBe('ab');
      // the outermost element of a modified view carries its path, like its row key
      expect(input.closest('.v-pad').dataset.path).toBe(input.closest('.v-textfield').dataset.path);
    });
  });

  it('keeps Float, CGFloat and UInt8 bindings in their types (M1)', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var f: Float = 0.25
    @State var c: CGFloat = 1
    @State var u: UInt8 = 1
    @State var t: Float = 1
    var body: some View {
        VStack {
            Slider(value: $f)
            Stepper("C", value: $c, step: 0.5)
            Stepper("U", value: $u)
            TextField("T", value: $t, format: .number)
            Text("types \(type(of: f)) \(type(of: c)) \(type(of: u)) \(type(of: t))")
            Text("sums \(f + Float(1)) \(c + CGFloat(1)) \(u + UInt8(1)) \(t + Float(1))")
        }
    }
}
#Preview { V() }`);
    await tick();
    await typeInto(p.root.querySelector('.screen input[type=range]'), '0.5');
    const inc = () => p.buttons().filter((b) => b.getAttribute('aria-label') === 'Increment');
    inc()[0].click(); await tick();
    inc()[1].click(); await tick();
    await typeInto(p.root.querySelector('.screen .v-textfield input'), '2.5', 'change');
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('types Float CGFloat UInt8 Float');
    expect(p.text()).toContain('sums 1.5 2.5 3 3.5');
  });

  it('keeps a UInt8 stepper inside its range (M1)', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    @State var u: UInt8 = 255
    var body: some View { VStack { Stepper("U", value: $u); Text("u \(u) \(type(of: u))") } }
}
#Preview { V() }`);
    await tick();
    await press(p, 'Increment');
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('u 255 UInt8');
  });

  it('matches navigation destinations by the value type (M2)', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let id = UUID()
    var body: some View {
        NavigationStack {
            VStack {
                NavigationLink("Bool", value: true)
                NavigationLink("Float", value: Float(1.5))
                NavigationLink("UUID", value: id)
                NavigationLink("Byte", value: UInt8(7))
            }
            .navigationDestination(for: Double.self) { d in Text("double \(d)") }
            .navigationDestination(for: Bool.self) { b in Text("bool \(b)") }
            .navigationDestination(for: Float.self) { f in Text("float \(f)") }
            .navigationDestination(for: UUID.self) { _ in Text("uuid ok") }
            .navigationDestination(for: UInt8.self) { b in Text("byte \(b)") }
        }
    }
}
#Preview { V() }`);
    await tick();
    for (const [link, shown] of [['Bool', 'bool true'], ['Float', 'float 1.5'], ['UUID', 'uuid ok'], ['Byte', 'byte 7']]) {
      await p.click(link);
      expect(p.text(), link).toContain(shown);
      p.root.querySelector('.screen .v-back').click();
      await tick();
    }
    expect(p.errors).toEqual([]);
  });

  describe('sheets and covers (M3)', () => {
    it('shows an alert presented from inside a sheet', async () => {
      const p = mount(String.raw`import SwiftUI
struct Inner: View {
    @State var err = true
    var body: some View { Text("in sheet").alert("Inner alert", isPresented: $err) { Button("OK") {} } }
}
struct V: View {
    @State var show = true
    var body: some View { Text("root").sheet(isPresented: $show) { Inner() } }
}
#Preview { V() }`);
      await tick();
      expect(p.text()).toContain('in sheet');
      expect(p.root.querySelector('.screen .alert-title').textContent).toBe('Inner alert');
    });

    it('calls onDismiss of sheet(item:) and presents fullScreenCover(item:) as a cover', async () => {
      const p = mount(String.raw`import SwiftUI
struct Pick: Identifiable { let id: Int }
struct V: View {
    @State var sel: Pick? = Pick(id: 1)
    @State var cover: Pick? = nil
    @State var cleaned = false
    var body: some View {
        VStack {
            Text("cleaned \(cleaned)")
            Button("Cover") { cover = Pick(id: 2) }
        }
        .sheet(item: $sel, onDismiss: { cleaned = true }) { p in Text("item \(p.id)") }
        .fullScreenCover(item: $cover) { p in Text("cover \(p.id)") }
    }
}
#Preview { V() }`);
      await tick();
      expect(p.text()).toContain('item 1');
      p.root.querySelector('.screen .grabber').click();
      await tick(); await tick();
      expect(p.text()).toContain('cleaned true');
      expect(p.text()).not.toContain('item 1');
      await p.click('Cover');
      expect(p.root.querySelector('.screen .sheet-overlay.cover')).toBeTruthy();
      expect(p.text()).toContain('cover 2');
    });

    it('lets @Environment(\\.dismiss) at the root of a NavigationStack close its sheet', async () => {
      const p = mount(String.raw`import SwiftUI
struct SheetRoot: View {
    @Environment(\.dismiss) var dismiss
    var body: some View { Button("Close") { dismiss() } }
}
struct V: View {
    @State var show = true
    var body: some View { Text("shown \(show)").sheet(isPresented: $show) { NavigationStack { SheetRoot() } } }
}
#Preview { V() }`);
      await tick();
      await p.click('Close');
      await tick();
      expect(p.text()).toContain('shown false');
      expect(p.button('Close')).toBeFalsy();
    });
  });

  describe('@EnvironmentObject and @AppStorage (M4)', () => {
    it('reads and binds an @EnvironmentObject passed with .environmentObject(_:)', async () => {
      const p = mount(String.raw`import SwiftUI
class Model: ObservableObject { @Published var name = "Ada" }
struct Child: View {
    @EnvironmentObject var vm: Model
    var body: some View { VStack { Text("name \(vm.name)"); Button("Rename") { vm.name = "Grace" }; TextField("n", text: $vm.name) } }
}
struct V: View {
    @StateObject var vm = Model()
    var body: some View { Child().environmentObject(vm) }
}
#Preview { V() }`);
      await tick();
      expect(p.text()).toContain('name Ada');
      await p.click('Rename');
      expect(p.text()).toContain('name Grace');
      expect(p.root.querySelector('.screen input').value).toBe('Grace');
      expect(p.errors).toEqual([]);
      expect(p.root.querySelector('[data-unsupported]')).toBeNull();
    });

    it("stops with SwiftUI's error when no ancestor provides the object", async () => {
      const p = mount(String.raw`import SwiftUI
class Model: ObservableObject { @Published var name = "Ada" }
struct Child: View {
    @EnvironmentObject var vm: Model
    var body: some View { Text("name \(vm.name)") }
}
#Preview { Child() }`);
      await tick();
      expect(p.errors).toEqual(['Fatal error: No ObservableObject of type Model found. A View.environmentObject(_:) for Model may be missing as an ancestor of this view.']);
    });

    it('keeps an optional @AppStorage value after a write', async () => {
      const p = mount(String.raw`import SwiftUI
struct V: View {
    @AppStorage("review-optional-token") var token: String?
    @AppStorage("review-optional-level") var level: Float? = nil
    var body: some View { VStack { Text("token \(token ?? "none") \(level.map { "\($0)" } ?? "none")"); Button("Set") { token = "abc"; level = 2.5 }; Button("Clear") { token = nil } } }
}
#Preview { V() }`, { storageNamespace: 'review-m4-' + Math.random() });
      await tick();
      expect(p.text()).toContain('token none none');
      await p.click('Set');
      expect(p.text()).toContain('token abc 2.5');
      await p.click('Clear');
      expect(p.text()).toContain('token none 2.5');
      expect(p.errors).toEqual([]);
    });

    it('keeps @AppStorage values across renders when localStorage is blocked', async () => {
      const blocked = () => { throw new Error('blocked'); };
      const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
      const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
      try {
        const p = mount(String.raw`import SwiftUI
struct V: View {
    @AppStorage("review-blocked-count") var count = 0
    var body: some View { Button("Count \(count)") { count += 1 } }
}
#Preview { V() }`);
        await tick();
        await p.click('Count 0');
        await p.click('Count 1');
        expect(p.button('Count 2')).toBeTruthy();
        expect(p.errors).toEqual([]);
      } finally { get.mockRestore(); set.mockRestore(); }
    });
  });

  it('keeps @State declared on an @main App across renders (M5)', async () => {
    const p = mount(String.raw`import SwiftUI
@main
struct MyApp: App {
    @State private var count = 0
    var body: some Scene { WindowGroup { Button("Count \(count)") { count += 1 } } }
}`);
    await tick();
    await p.click('Count 0');
    await p.click('Count 1');
    expect(p.button('Count 2')).toBeTruthy();
    expect(p.errors).toEqual([]);
  });

  it('identifies ForEach rows by a computed id (M6)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Item: Identifiable { let code: String; var id: String { code } }
struct Row: View {
    let item: Item
    @State var taps = 0
    var body: some View { Button("\(item.code) \(taps)") { taps += 1 } }
}
struct V: View {
    @State var items = [Item(code: "a"), Item(code: "b")]
    var body: some View { VStack { Button("Prepend") { items.insert(Item(code: "z"), at: 0) }; ForEach(items) { Row(item: $0) } } }
}
#Preview { V() }`);
    await tick();
    await p.click('a 0');
    await p.click('Prepend');
    // the row for "a" kept its own @State although it moved down one place
    expect(p.buttons().map((b) => b.textContent.trim())).toEqual(['Prepend', 'z 0', 'a 1', 'b 0']);
  });
});

describe('Character and Substring arguments', () => {
  it('shows Character and Substring text in every text position', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let word = "Starling"
    let ch = Array("Q")[0]
    @State var name = "abc"
    @State var on = true
    @State var n = 1
    var body: some View {
        NavigationStack {
            List {
                Section(word.prefix(4)) {
                    Label(word.prefix(1), systemImage: "star".prefix(4))
                    Button(word.prefix(2)) {}
                    Text(word.prefix(3))
                    Text(ch)
                    TextField(word.suffix(4), text: $name)
                    Toggle(word.dropFirst(5), isOn: $on)
                    Stepper(word.prefix(5), value: $n)
                    LabeledContent(word.prefix(6), value: word.suffix(2))
                    Image(systemName: "star".prefix(4))
                    NavigationLink(word.prefix(7), value: ch)
                    ForEach(Array("xyz"), id: \.self) { c in Text("row \(c)") }
                }
            }
            .navigationTitle(word.prefix(8))
            .navigationDestination(for: Character.self) { c in Text("char \(c)") }
        }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    const t = p.text();
    for (const s of ['Star', 'S', 'St', 'Sta', 'Q', 'ling', 'Starl', 'Starli', 'ng', 'Starlin', 'Starling', 'row x', 'row y', 'row z']) expect(t, s).toContain(s);
    expect(p.root.querySelector('.screen input:not([type=range])').placeholder).toBe('ling');
    expect(p.root.querySelectorAll('.screen svg[data-symbol="star"]').length).toBeGreaterThanOrEqual(2);
    expect([...p.root.querySelectorAll('.screen [data-key]')].map((e) => e.dataset.key).filter((k) => /x|y|z/.test(k)).length).toBe(3);
    await p.click('Starlin');
    expect(p.text()).toContain('char Q');
  });

  it('uses a Substring alert title and accessibility label', async () => {
    const p = mount(String.raw`import SwiftUI
struct V: View {
    let word = "Warning sign"
    var body: some View {
        Text("body")
            .accessibilityLabel(word.suffix(4))
            .alert(word.prefix(7), isPresented: .constant(true)) { Button("OK") {} }
    }
}
#Preview { V() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelector('.screen .alert-title').textContent).toBe('Warning');
    expect(p.root.querySelector('.screen [aria-label="sign"]')).toBeTruthy();
  });
});

describe('correctness review (review 15)', () => {
  it('pushes destination links on a NavigationStack with a bound path (2)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Demo: View {
    @State var path: [Int] = []
    var body: some View {
        NavigationStack(path: $path) {
            VStack {
                Text("root \(path.count)")
                NavigationLink("Detail") { DetailView(path: $path) }
                NavigationLink("Seven", value: 7)
            }
            .navigationDestination(for: Int.self) { n in VStack { Text("number \(n)"); NavigationLink("Deeper") { Text("deeper view") } } }
        }
    }
}
struct DetailView: View {
    @Binding var path: [Int]
    var body: some View { VStack { Text("Destination \(path.count)"); Button("Home") { path.removeAll() } } }
}
#Preview { Demo() }`);
    await tick();
    await p.click('Detail');
    // pushed without changing the bound path
    expect(p.text()).toContain('Destination 0');
    p.root.querySelector('.screen .v-back').click();
    await tick();
    expect(p.text()).toContain('root 0');
    // a value link, then a destination link above it; Back pops the destination first
    await p.click('Seven');
    expect(p.text()).toContain('number 7');
    await p.click('Deeper');
    expect(p.text()).toContain('deeper view');
    p.root.querySelector('.screen .v-back').click();
    await tick();
    expect(p.text()).toContain('number 7');
    p.root.querySelector('.screen .v-back').click();
    await tick();
    expect(p.text()).toContain('root 0');
    expect(p.errors).toEqual([]);
  });

  it('drops pushed destination views when the bound path is cleared (2)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Demo: View {
    @State var path: [Int] = []
    var body: some View {
        NavigationStack(path: $path) {
            VStack { Text("root \(path.count)"); NavigationLink("Seven", value: 7) }
            .navigationDestination(for: Int.self) { n in NavigationLink("Deeper") { Button("Home") { path.removeAll() } } }
        }
    }
}
#Preview { Demo() }`);
    await tick();
    await p.click('Seven');
    await p.click('Deeper');
    await p.click('Home');
    expect(p.text()).toContain('root 0');
    expect(p.root.querySelector('.screen .v-back')).toBeNull();
  });

  it('runs onDismiss exactly once however a sheet or cover is dismissed (11)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Pick: Identifiable { let id: Int }
struct Closer: View {
    @Environment(\.dismiss) var dismiss
    var body: some View { Button("Dismiss") { dismiss() } }
}
struct Demo: View {
    @State var show = false
    @State var cover = false
    @State var item: Pick? = nil
    @State var a = 0
    @State var b = 0
    @State var c = 0
    var body: some View {
        VStack {
            Text("counts \(a) \(b) \(c)")
            Button("Open") { show = true }
            Button("Cover") { cover = true }
            Button("Item") { item = Pick(id: 1) }
        }
        .sheet(isPresented: $show, onDismiss: { a += 1 }) { Button("Close") { show = false } }
        .fullScreenCover(isPresented: $cover, onDismiss: { b += 1 }) { Closer() }
        .sheet(item: $item, onDismiss: { c += 1 }) { p in VStack { Text("item \(p.id)"); Button("Next") { item = Pick(id: 2) }; Button("Clear") { item = nil } } }
    }
}
#Preview { Demo() }`);
    await tick();
    await p.click('Open');
    await p.click('Close');
    await tick();
    expect(p.text()).toContain('counts 1 0 0');
    await p.click('Open');
    p.root.querySelector('.screen .grabber').click();
    await tick(); await tick();
    expect(p.text()).toContain('counts 2 0 0');
    await p.click('Cover');
    await p.click('Dismiss');
    await tick();
    expect(p.text()).toContain('counts 2 1 0');
    await p.click('Item');
    // another id ends the first presentation
    await p.click('Next');
    await tick();
    expect(p.text()).toContain('item 2');
    expect(p.text()).toContain('counts 2 1 1');
    await p.click('Clear');
    await tick();
    expect(p.text()).toContain('counts 2 1 2');
    // nothing more fires on later renders
    await p.click('Open');
    await tick();
    expect(p.text()).toContain('counts 2 1 2');
    expect(p.errors).toEqual([]);
  });

  it('keeps a sheet(item:) view\'s @State while the item id is unchanged (12)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Item: Identifiable { var id: Int; var name: String }
struct Child: View {
    @State var count = 0
    var body: some View { Button("Count \(count)") { count += 1 } }
}
struct Demo: View {
    @State var item: Item? = nil
    var body: some View {
        VStack { Button("Open") { item = Item(id: 1, name: "A") } }
        .sheet(item: $item) { value in
            VStack { Text("name \(value.name)"); Child(); Button("Rename") { item = Item(id: 1, name: "B") }; Button("Other") { item = Item(id: 2, name: "C") } }
        }
    }
}
#Preview { Demo() }`);
    await tick();
    await p.click('Open');
    await p.click('Count 0');
    await p.click('Rename');
    expect(p.text()).toContain('name B');
    expect(p.button('Count 1')).toBeTruthy();
    // a new id is a new presentation with fresh state
    await p.click('Other');
    expect(p.text()).toContain('name C');
    expect(p.button('Count 0')).toBeTruthy();
  });

  it('runs every .onAppear and .task on one view (13)', async () => {
    const p = mount(String.raw`import SwiftUI
#Preview {
    Text("Hello")
        .onAppear { print("first") }
        .onAppear { print("second") }
        .task { print("task one") }
        .task { print("task two") }
}`);
    await tick(40);
    expect(p.prints.filter((x) => x === 'first' || x === 'second')).toEqual(['first', 'second']);
    expect(p.prints.filter((x) => x.startsWith('task')).sort()).toEqual(['task one', 'task two']);
  });

  it('lets the environment modifier closest to the view win (14)', async () => {
    const p = mount(String.raw`import SwiftUI
struct ReadScheme: View {
    let label: String
    @Environment(\.colorScheme) var scheme
    var body: some View { Text("\(label) \(scheme == .dark ? "dark" : "light")") }
}
#Preview {
    VStack {
        ReadScheme(label: "same view")
            .environment(\.colorScheme, .dark)
            .environment(\.colorScheme, .light)
        ReadScheme(label: "child").environment(\.colorScheme, .light)
    }
    .environment(\.colorScheme, .dark)
}`);
    await tick();
    expect(p.text()).toContain('same view dark');
    expect(p.text()).toContain('child light');
    expect(p.errors).toEqual([]);
  });
});

describe('correctness review (review 16)', () => {
  const enter = async (input) => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick(); };
  const back = async (p) => { p.root.querySelector('.screen .v-back').click(); await tick(); await tick(); };

  it('gives only the visible navigation screen live lifecycle hooks (11)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Root: View {
    var body: some View {
        NavigationStack {
            NavigationLink("Go") {
                Text("Detail").onAppear { print("detail appear") }.onDisappear { print("detail disappear") }
            }
            .onAppear { print("root appear") }
            .onDisappear { print("root disappear") }
            .task { print("root task") }
        }
    }
}
#Preview { Root() }`);
    await tick(40);
    expect([...p.prints].sort()).toEqual(['root appear', 'root task']);
    p.prints.length = 0;
    await p.click('Go');
    await tick();
    expect(p.prints).toEqual(['detail appear', 'root disappear']);
    p.prints.length = 0;
    await back(p);
    await tick(40);
    expect(p.prints.filter((x) => x !== 'root task')).toEqual(['root appear', 'detail disappear']);
    expect(p.prints).toContain('root task');
  });

  it('pushes a Boolean destination declared inside another one (12)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Root: View {
    @State var first = false
    @State var second = false
    var body: some View {
        NavigationStack {
            Button("First") { first = true }
                .navigationDestination(isPresented: $first) {
                    Button("Second") { second = true }
                        .navigationDestination(isPresented: $second) {
                            VStack { Text("Second screen"); Button("Close all") { first = false } }
                        }
                }
        }
    }
}
#Preview { Root() }`);
    await tick();
    await p.click('First');
    await p.click('Second');
    expect(p.text()).toContain('Second screen');
    await back(p);
    expect(p.button('Second')).toBeTruthy();
    await p.click('Second');
    expect(p.text()).toContain('Second screen');
    // dismissing the outer destination pops both
    await p.click('Close all');
    expect(p.button('First')).toBeTruthy();
    expect(p.text()).not.toContain('Second screen');
    expect(p.root.querySelector('.screen .v-back')).toBeNull();
    expect(p.errors).toEqual([]);
  });

  it('propagates isEnabled from .environment and .disabled, and disables controls (13)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Child: View {
    let label: String
    @Environment(\.isEnabled) var enabled
    var body: some View { Button("\(label) \(enabled)") { print("clicked \(label)") } }
}
struct Controls: View {
    @State var n = 1
    @State var v = 0.5
    var body: some View {
        VStack {
            Stepper("S", value: $n)
            Slider(value: $v)
            NavigationLink("Link") { Text("pushed") }
        }
    }
}
#Preview {
    NavigationStack {
        VStack {
            Child(label: "env").environment(\.isEnabled, false)
            VStack { Child(label: "inner").environment(\.isEnabled, true) }.disabled(true)
            Child(label: "plain")
            Controls().disabled(true)
        }
    }
}`);
    await tick();
    expect(p.text()).toContain('env false');
    expect(p.text()).toContain('inner true');
    expect(p.text()).toContain('plain true');
    p.buttons().find((b) => b.textContent.includes('env false')).click();
    await tick();
    p.buttons().find((b) => b.textContent.includes('plain true')).click();
    await tick();
    expect(p.prints).toEqual(['clicked plain']);
    expect(p.buttons().filter((b) => ['Decrement', 'Increment'].includes(b.getAttribute('aria-label'))).every((b) => b.disabled)).toBe(true);
    expect(p.root.querySelector('.screen input[type=range]').disabled).toBe(true);
    expect(p.button('Link').disabled).toBe(true);
  });

  it('runs a field\'s .onSubmit and every ancestor\'s, for every field (14)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Contact: View {
    @State var name = ""
    @State var email = ""
    @State var query = ""
    var body: some View {
        NavigationStack {
            VStack {
                VStack {
                    TextField("Name", text: $name).onSubmit { print("field") }
                    TextField("Email", text: $email)
                }
                .onSubmit { print("group") }
            }
            .onSubmit { print("form") }
            .searchable(text: $query)
            .onSubmit(of: .search) { print("search") }
        }
    }
}
#Preview { Contact() }`);
    await tick();
    const [name, email] = [...p.root.querySelectorAll('.screen .v-textfield input')];
    await enter(name);
    expect(p.prints).toEqual(['field', 'group', 'form']);
    p.prints.length = 0;
    await enter(email);
    expect(p.prints).toEqual(['group', 'form']);
    p.prints.length = 0;
    await enter(p.root.querySelector('.screen input[type=search]'));
    expect(p.prints).toEqual(['search']);
    expect(p.errors).toEqual([]);
  });
});
