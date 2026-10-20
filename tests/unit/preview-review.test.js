// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { mountPreview } from '../../src/engine/swiftui/preview.js';

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = () => ({ matches: false });
});

const mounted = [];
afterEach(() => {
  for (const { host, ctl } of mounted.splice(0)) { ctl.destroy(); host.remove(); }
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
function mount(code) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const prints = [];
  const ctl = mountPreview(host, code, { onPrint: (text) => prints.push(text.trim()) });
  const root = host.shadowRoot;
  const button = (text) => [...root.querySelectorAll('.screen button')].find((b) => b.textContent === text);
  const click = async (text) => { expect(button(text)).toBeTruthy(); button(text).click(); await tick(); expect(ctl.error).toBeNull(); };
  const result = { host, ctl, root, prints, button, click };
  mounted.push(result);
  return result;
}

const counter = String.raw`
struct Counter: View {
    @State var n = 0
    var body: some View { Button("Count: \(n)") { n += 1 } }
}`;

describe('preview recovery and tab state', () => {
  it('removes a previous error banner after a successful rebuild', async () => {
    const { ctl, root } = mount('import SwiftUI\n#Preview { Text("Original") }');
    await tick();
    ctl.update('import SwiftUI\n#Preview { Text(missing) }');
    expect(root.querySelector('.error-pane')?.textContent).toContain("cannot find 'missing'");
    ctl.update('import SwiftUI\n#Preview { Text("Fixed") }');
    await tick();
    expect(ctl.error).toBeNull();
    expect(root.querySelector('.content').textContent).toBe('Fixed');
    expect(root.querySelector('.error-pane')).toBeNull();
  });

  it.each([
    ['Tab', 'Tab("First", systemImage: "house") { Counter() }\nTab("Second", systemImage: "star") { Text("Other") }'],
    ['tabItem', 'Counter().tabItem { Text("First") }\nText("Other").tabItem { Text("Second") }'],
  ])('preserves local state when switching away from and back to a %s', async (_, tabs) => {
    const { click, button } = mount(`import SwiftUI\n${counter}\n#Preview { TabView { ${tabs} } }`);
    await tick();
    await click('Count: 0');
    await click('Second');
    await click('First');
    expect(button('Count: 1')).toBeTruthy();
  });

  it('does not run lifecycle callbacks for hidden tab content', async () => {
    const { click, prints, button } = mount(String.raw`import SwiftUI
struct Counter: View {
    @State var n = 0
    var body: some View {
        Button("Count: \(n)") { n += 1 }
            .onAppear { print("appeared") }
            .onDisappear { print("disappeared") }
            .task { print("task") }
    }
}
struct Parent: View {
    @State var n = 0
    var body: some View {
        VStack {
            Button("Parent: \(n)") { n += 1 }
            TabView {
                Tab("First", systemImage: "house") { Counter() }
                Tab("Second", systemImage: "star") { Text("Other") }
            }
        }
    }
}
#Preview { Parent() }`);
    await tick();
    expect(prints.slice().sort()).toEqual(['appeared', 'task']);
    await click('Count: 0');
    await click('Second');
    expect(prints.filter((p) => p === 'disappeared')).toHaveLength(1);
    const hiddenPrints = prints.slice();
    await click('Parent: 0');
    expect(prints).toEqual(hiddenPrints);
    await click('First');
    expect(button('Count: 1')).toBeTruthy();
    expect(prints.filter((p) => p === 'appeared')).toHaveLength(2);
    expect(prints.filter((p) => p === 'task')).toHaveLength(2);
  });

  it('discards inactive state when the TabView identity changes', async () => {
    const { click, button, ctl } = mount(String.raw`import SwiftUI
${counter}
struct Parent: View {
    @State var generation = 0
    var body: some View {
        VStack {
            Button("New identity") { generation += 1 }
            TabView {
                Tab("First", systemImage: "house") { Counter() }
                Tab("Second", systemImage: "star") { Text("Other") }
            }.id(generation)
        }
    }
}
#Preview { Parent() }`);
    await tick();
    await click('Count: 0');
    await click('Second');
    const oldCounterKey = [...ctl.state.keys()].find((key) => key.endsWith('.n'));
    expect(oldCounterKey).toBeTruthy();
    await click('New identity');
    expect(ctl.state.has(oldCounterKey)).toBe(false);
    expect(button('Count: 0')).toBeTruthy();
  });

  it('cleans up an inactive tab removed from the hierarchy', async () => {
    const { click, button, ctl } = mount(String.raw`import SwiftUI
${counter}
struct Parent: View {
    @State var showExtra = true
    var body: some View {
        VStack {
            Button("Toggle extra") { showExtra.toggle() }
            TabView {
                Tab("First", systemImage: "house") { Text("Home") }
                if showExtra { Tab("Second", systemImage: "star") { Counter() } }
            }
        }
    }
}
#Preview { Parent() }`);
    await tick();
    await click('Second');
    await click('Count: 0');
    await click('First');
    expect([...ctl.state.keys()].some((key) => key.endsWith('.n'))).toBe(true);
    await click('Toggle extra');
    expect([...ctl.state.keys()].some((key) => key.endsWith('.n'))).toBe(false);
    await click('Toggle extra');
    await click('Second');
    expect(button('Count: 0')).toBeTruthy();
  });
});
