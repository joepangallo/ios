// @vitest-environment jsdom
import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { mountPreview } from '../../src/engine/swiftui/preview.js';
import { runSync } from '../../src/engine/swiftui/views.js';

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = () => ({ matches: false });
});

const previews = [];
afterEach(() => {
  for (const ctl of previews.splice(0)) ctl.destroy();
  document.body.replaceChildren();
});

function mount(source) {
  const element = document.createElement('div');
  document.body.append(element);
  const output = [];
  const ctl = mountPreview(element, source, { onPrint: (text) => output.push(text) });
  previews.push(ctl);
  expect(ctl.error).toBeNull();
  return { ctl, output, root: element.shadowRoot };
}

describe('ARC ownership in the SwiftUI host', () => {
  it.each([
    ['a modified user view', 'Content(model: model).padding()'],
    ['a modifier argument', 'Text("alive").environment(model)'],
    ['a nested button action', 'VStack { Button("alive") { print(model) } }'],
  ])('retains a local model returned inside %s', (_, expression) => {
    const { ctl, output, root } = mount(`import SwiftUI
class Model { deinit { print("freed") } }
struct Content: View {
    let model: Model
    var body: some View { Text("alive") }
}
#Preview {
    let model = Model()
    ${expression}
}`);
    expect(root.querySelector('.screen').textContent).toContain('alive');
    expect(output).toEqual([]);
    expect(ctl.interp.arc.live.size).toBe(1);
  });

  it('counts persistent StateBox values as roots outside active Swift frames', () => {
    const { ctl, output } = mount(`import SwiftUI
class Model { deinit { print("freed") } }
func borrow(_ model: Model) {}
struct Content: View {
    @State var model = Model()
    var body: some View { Text("alive") }
}
#Preview { Content() }`);
    const box = [...ctl.state.values()][0];
    const model = box.value;
    const borrow = ctl.interp.globals.funcs.get('borrow')[0];
    runSync(ctl.interp, ctl.interp.callFunction(borrow, [{ label: null, value: model }], 0));
    expect(output).toEqual([]);
    expect(ctl.interp.arc.live.has(model)).toBe(true);

    // Host roots are read live; removing the state must not retain the model.
    ctl.state.clear();
    ctl.interp.arc.released(model, ctl.interp.globals);
    expect(output).toEqual(['freed\n']);
    expect(ctl.interp.arc.live.has(model)).toBe(false);
  });

  it('does not strengthen weak captures stored in a returned button', () => {
    const { ctl, output, root } = mount(`import SwiftUI
class Model { deinit { print("freed") } }
#Preview {
    let model = Model()
    Button("Inspect") { [weak model] in print(model == nil) }
}`);
    expect(output).toEqual(['freed\n']);
    root.querySelector('.screen button').click();
    expect(ctl.error).toBeNull();
    expect(output).toEqual(['freed\n', 'true\n']);
  });

  it('keeps weak references to State models without deinit alive', () => {
    const { ctl } = mount(`import SwiftUI
class Model {}
var inspect: () -> Bool = { false }
func borrow(_ model: Model) { inspect = { [weak model] in model != nil } }
struct Content: View {
    @State var model = Model()
    var body: some View { Text("alive") }
}
#Preview { Content() }`);
    const model = [...ctl.state.values()][0].value;
    const borrow = ctl.interp.globals.funcs.get('borrow')[0];
    runSync(ctl.interp, ctl.interp.callFunction(borrow, [{ label: null, value: model }], 0));
    const inspect = () => runSync(ctl.interp, ctl.interp.callValue(ctl.interp.globals.vars.get('inspect').value, [], 0));
    expect(inspect()).toBe(true);
    ctl.state.clear();
    ctl.interp.arc.released(model, ctl.interp.globals);
    expect(inspect()).toBe(false);
  });
});
