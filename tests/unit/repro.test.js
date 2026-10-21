// @vitest-environment jsdom
import { it, expect, beforeAll } from 'vitest';
beforeAll(() => { globalThis.ResizeObserver = class { observe() {} disconnect() {} }; globalThis.matchMedia = () => ({ matches: false }); });
const { mountPreview } = await import('../../src/engine/swiftui/preview.js');
const tick = () => new Promise((r) => setTimeout(r, 20));
it('each ForEach row keeps its own @State', async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const ctl = mountPreview(host, `import SwiftUI
struct Row: View {
    let label: Int
    @State private var n = 0
    var body: some View { Button("row \\(label): \\(n)") { n += 1 } }
}
struct L: View {
    var body: some View { VStack { ForEach(0..<3, id: \\.self) { i in Row(label: i) } } }
}
#Preview { L() }`, {});
  await tick();
  const btns = () => [...host.shadowRoot.querySelectorAll('.screen button')];
  btns()[1].click();
  await tick();
  btns()[1].click();
  await tick();
  expect(btns().map((b) => b.textContent)).toEqual(['row 0: 0', 'row 1: 2', 'row 2: 0']);
  ctl.update(ctl.code.replace('private var n = 0', 'private var n = 10'));
  await tick();
  expect(btns()[0].textContent).toBe('row 0: 10');
});
it('sibling ForEach rows have separate state', async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const ctl = mountPreview(host, `import SwiftUI
struct C: View { @State var n = 0
    var body: some View { Button("n \\(n)") { n += 1 } } }
#Preview { VStack { ForEach(0..<1) { _ in C() }
    ForEach(0..<1) { _ in C() } } }`, {});
  await tick();
  expect(ctl.state.size).toBe(2);
});
it('a rebuilt preview runs the new .task, not the old one', async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const prints = [];
  const ctl = mountPreview(host, 'import SwiftUI\n#Preview { Text("A").task { try? await Task.sleep(for: .milliseconds(500)); print("OLD") } }', { onPrint: (s) => prints.push(s.trim()) });
  await new Promise((r) => setTimeout(r, 25));
  ctl.update('import SwiftUI\n#Preview { Text("B").task { print("NEW") } }');
  await new Promise((r) => setTimeout(r, 900));
  expect(prints).toEqual(['NEW']);
});
it('.id() on ForEach rows resets their state', async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const ctl = mountPreview(host, `import SwiftUI
struct Child: View { @State var n = 0
    var body: some View { Button("child \\(n)") { n += 1 } } }
struct P: View { @State var gen = 0
    var body: some View { VStack {
        ForEach(0..<1, id: \\.self) { _ in Child().id(gen) }
        Button("regen") { gen += 1 } } } }
#Preview { P() }`, {});
  await tick();
  const btn = (t) => [...host.shadowRoot.querySelectorAll('.screen button')].find((b) => b.textContent.startsWith(t));
  btn('child').click(); await tick();
  expect(btn('child').textContent).toBe('child 1');
  btn('regen').click(); await tick();
  expect(btn('child').textContent).toBe('child 0');
});
