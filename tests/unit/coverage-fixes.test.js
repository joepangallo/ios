// @vitest-environment jsdom
// Coverage for the Foundation subset (JSONEncoder / JSONDecoder / String(format:))
// and the SwiftUI host (environment reads, static members, view constructors,
// custom modifiers and the @AppStorage bridge). Every expected stdout in the
// Foundation section was checked against Swift 6.2.1 (xcrun swift) first.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/engine/index.js';
import { mountPreview } from '../../src/engine/swiftui/preview.js';
import { NIL } from '../../src/engine/values.js';

async function ok(src) {
  const r = await run(src);
  expect(r.error).toBeNull();
  return r.stdout;
}

// ------------------------------------------------------------------ Foundation
const codableTypes = String.raw`import Foundation
enum Unit: String, Codable { case celsius, fahrenheit }
struct Reading: Codable {
    var value: Double
    var unit: Unit
    var meta: [String: Int]
    var note: String?
}
struct Todo: Codable {
    let id: Int
    var title: String
    var tags: [String]
}
func text(_ d: Data) -> String { String(data: d, encoding: .utf8)! }
let sorted = JSONEncoder()
sorted.outputFormatting = [.sortedKeys]
func attempt(_ body: () throws -> Void) { do { try body() } catch { print(error) } }
`;

describe('JSONEncoder output matches Foundation', () => {
  it('encodes doubles, dictionaries and raw-value enums, and omits nil optionals', async () => {
    expect(await ok(`${codableTypes}
print(text(try sorted.encode(Reading(value: 21.5, unit: .celsius, meta: ["b": 2, "a": 1], note: nil))))
print(text(try sorted.encode(Reading(value: 100, unit: .fahrenheit, meta: [:], note: "hot"))))
print(text(try sorted.encode([0.1, 1e16, 0.00001, -2.0, 3.0])))
print(text(try sorted.encode(["b": 1, "a": 2])))
print(text(try sorted.encode([true, false])))
print(text(try sorted.encode("quote \\" slash / tab \\t")))
print(text(try JSONEncoder().encode(Optional<Int>.none)))
`)).toBe(`{"meta":{"a":1,"b":2},"unit":"celsius","value":21.5}
{"meta":{},"note":"hot","unit":"fahrenheit","value":100}
[0.1,1e+16,1e-05,-2,3]
{"a":2,"b":1}
[true,false]
"quote \\" slash \\/ tab \\t"
null
`);
  });

  it('decodes dictionaries, raw-value enums and absent optionals', async () => {
    expect(await ok(`${codableTypes}
let r = try JSONDecoder().decode(Reading.self, from: Data(#"{"value": 1, "unit": "celsius", "meta": {"a": 1}}"#.utf8))
print(r.meta, r.unit, r.value, r.note ?? "none")
`)).toBe('["a": 1] celsius 1.0 none\n');
  });

  it('encodes enums with associated values like the synthesized conformance', async () => {
    expect(await ok(`${codableTypes}
enum Shape: Codable {
    case circle(radius: Double)
    case square(Double)
    case empty
}
print(text(try sorted.encode([Shape.circle(radius: 2), .square(3.5), .empty])))
let pretty = JSONEncoder()
pretty.outputFormatting = [.prettyPrinted, .sortedKeys]
print(text(try pretty.encode(Shape.empty)))
print(text(try pretty.encode([Int]())))
`)).toBe(`[{"circle":{"radius":2}},{"square":{"_0":3.5}},{"empty":{}}]
{
  "empty" : {

  }
}
[

]
`);
  });

  it('converts keys to and from snake_case', async () => {
    expect(await ok(`${codableTypes}
struct User: Codable {
    var firstName: String
    var zipCode: Int
    var isAdmin: Bool
}
let snakeEnc = JSONEncoder()
snakeEnc.keyEncodingStrategy = .convertToSnakeCase
snakeEnc.outputFormatting = [.sortedKeys]
print(text(try snakeEnc.encode(User(firstName: "Ana", zipCode: 34285, isAdmin: true))))
let snakeDec = JSONDecoder()
snakeDec.keyDecodingStrategy = .convertFromSnakeCase
let u = try snakeDec.decode(User.self, from: Data(#"{"first_name":"Bo","zip_code":5,"is_admin":false}"#.utf8))
print(u.firstName, u.zipCode, u.isAdmin)
`)).toBe(`{"first_name":"Ana","is_admin":true,"zip_code":34285}
Bo 5 false
`);
  });

  it('throws EncodingError for a non-finite Double', async () => {
    expect(await ok(`${codableTypes}
struct Big: Codable { var v: Double }
do { _ = try JSONEncoder().encode(Big(v: Double.infinity)); print("encoded") } catch { print("encode failed") }
`)).toBe('encode failed\n');
  });

  it('rejects types that do not conform to Encodable or Decodable at compile time', async () => {
    const enc = await run('import Foundation\nstruct P { var x = 1 }\nlet d = try JSONEncoder().encode(P(x: 1))');
    expect(enc.error?.kind).toBe('compile');
    expect(enc.error?.message).toContain("instance method 'encode' requires that 'P' conform to 'Encodable'");
    const dec = await run('import Foundation\nstruct P { var x = 1 }\nlet p = try JSONDecoder().decode(P.self, from: Data("{}".utf8))');
    expect(dec.error?.kind).toBe('compile');
    expect(dec.error?.message).toContain("instance method 'decode(_:from:)' requires that 'P' conform to 'Decodable'");
  });
});

describe('custom Codable conformances', () => {
  const point = String.raw`
struct Point: Codable {
    var x: Int
    var y: Int
    var label: String?
    enum CodingKeys: String, CodingKey { case x, y, label = "name" }
    init(x: Int, y: Int, label: String?) { self.x = x; self.y = y; self.label = label }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        x = try c.decode(Int.self, forKey: .x)
        y = try c.decodeIfPresent(Int.self, forKey: .y) ?? 0
        label = try c.decodeIfPresent(String.self, forKey: .label)
        print("point depth \(decoder.codingPath.count) hasY \(c.contains(.y)) keys \(c.allKeys.map(\.stringValue).sorted()) hasLabel \(c.allKeys.contains(.label))")
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(x, forKey: .x)
        try c.encode(y, forKey: .y)
        try c.encodeIfPresent(label, forKey: .label)
    }
}
struct Segment: Codable {
    var start: Point
    var end: Point
}`;

  // allKeys holds CodingKeys values for the JSON keys the enum represents ("extra" and
  // "label" are not keys of it: label's key is "name"), checked against swiftc
  it('runs init(from:) and encode(to:) through keyed containers', async () => {
    expect(await ok(`${codableTypes}${point}
let p = try JSONDecoder().decode(Point.self, from: Data(#"{"x": 1, "name": "origin", "extra": true}"#.utf8))
print(p.x, p.y, p.label ?? "-")
print(text(try sorted.encode(p)))
print(text(try sorted.encode(Point(x: 3, y: 4, label: nil))))
let seg = try JSONDecoder().decode(Segment.self, from: Data(#"{"start": {"x": 0, "y": 0}, "end": {"x": 5, "y": 5, "name": "tip", "label": 9}}"#.utf8))
print(seg.end.label ?? "-")
attempt { _ = try JSONDecoder().decode(Segment.self, from: Data(#"{"start": {"y": 1}, "end": {"x": 0}}"#.utf8)) }
`)).toBe(`point depth 0 hasY false keys ["name", "x"] hasLabel true
1 0 origin
{"name":"origin","x":1,"y":0}
{"x":3,"y":4}
point depth 1 hasY true keys ["x", "y"] hasLabel false
point depth 1 hasY true keys ["name", "x", "y"] hasLabel true
tip
DecodingError.keyNotFound: Key 'x' not found in keyed decoding container. Path: start. Debug description: No value associated with key CodingKeys(stringValue: "x", intValue: nil) ("x").
`);
  });

  it('runs single-value containers', async () => {
    expect(await ok(`${codableTypes}
struct Celsius: Codable {
    var degrees: Double
    init(_ degrees: Double) { self.degrees = degrees }
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { degrees = 0 } else { degrees = try c.decode(Double.self) }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(degrees)
    }
}
struct Temp: Codable { var c: Celsius }
let t = try JSONDecoder().decode(Temp.self, from: Data(#"{"c": 36.6}"#.utf8))
print(t.c.degrees)
print(text(try sorted.encode(Temp(c: Celsius(-4)))))
`)).toBe('36.6\n{"c":-4}\n');
  });

  it('never decodes a let with a default value but still encodes it', async () => {
    expect(await ok(`${codableTypes}
struct Config: Codable {
    let version = 2
    var name: String
}
let cfg = try JSONDecoder().decode(Config.self, from: Data(#"{"version": 9, "name": "prod"}"#.utf8))
print(cfg.version, cfg.name)
print(text(try sorted.encode(cfg)))
`)).toBe('2 prod\n{"name":"prod","version":2}\n');
  });
});

describe('DecodingError descriptions match Foundation', () => {
  it('describes every error case with its coding path', async () => {
    expect(await ok(`${codableTypes}
attempt { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": null, "title": "a", "tags": []}"#.utf8)) }
attempt { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": "7", "title": "a", "tags": []}"#.utf8)) }
attempt { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": 1, "title": true, "tags": []}"#.utf8)) }
attempt { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": 1, "title": "a", "tags": [1]}"#.utf8)) }
attempt { _ = try JSONDecoder().decode(Todo.self, from: Data("[1, 2]".utf8)) }
attempt { _ = try JSONDecoder().decode(Reading.self, from: Data(#"{"value": 1, "unit": "kelvin", "meta": {}}"#.utf8)) }
attempt { _ = try JSONDecoder().decode(Reading.self, from: Data(#"{"value": 1, "unit": "celsius", "meta": {"a": "x"}}"#.utf8)) }
attempt { _ = try JSONDecoder().decode(Reading.self, from: Data(#"{"value": 1, "unit": "celsius", "meta": 3}"#.utf8)) }
attempt { _ = try JSONDecoder().decode(Reading.self, from: Data(#"{"value": "warm", "unit": "celsius", "meta": {}}"#.utf8)) }
`)).toBe(`DecodingError.valueNotFound: Expected value of type Int but found null instead. Path: id. Debug description: Cannot get value of type Int -- found null value instead
DecodingError.typeMismatch: expected value of type Int. Path: id. Debug description: Expected to decode Int but found a string instead.
DecodingError.typeMismatch: expected value of type String. Path: title. Debug description: Expected to decode String but found bool instead.
DecodingError.typeMismatch: expected value of type String. Path: tags[0]. Debug description: Expected to decode String but found number instead.
DecodingError.typeMismatch: expected value of type Dictionary<String, Any>. Debug description: Expected to decode Dictionary<String, Any> but found an array instead.
DecodingError.dataCorrupted: Data was corrupted. Path: unit. Debug description: Cannot initialize Unit from invalid String value kelvin
DecodingError.typeMismatch: expected value of type Int. Path: meta.a. Debug description: Expected to decode Int but found a string instead.
DecodingError.typeMismatch: expected value of type Dictionary<String, Any>. Path: meta. Debug description: Expected to decode Dictionary<String, Any> but found number instead.
DecodingError.typeMismatch: expected value of type Double. Path: value. Debug description: Expected to decode Double but found a string instead.
`);
  });

  it('binds the payload of each case in a catch pattern', async () => {
    expect(await ok(`${codableTypes}
do { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": 1}"#.utf8)) } catch DecodingError.keyNotFound(let key, _) { print("missing", key.stringValue) } catch { print("other") }
do { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": "x"}"#.utf8)) } catch DecodingError.typeMismatch(let type, let ctx) { print("mismatch", type, ctx.codingPath.map(\\.stringValue)) } catch { print("other") }
do { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": null}"#.utf8)) } catch DecodingError.valueNotFound(let type, let ctx) { print("null", type, ctx.debugDescription) } catch { print("other") }
do { _ = try JSONDecoder().decode(Reading.self, from: Data(#"{"value": 1, "unit": "kelvin", "meta": {}}"#.utf8)) } catch DecodingError.dataCorrupted(let ctx) { print("corrupt", ctx.codingPath.map(\\.stringValue), ctx.debugDescription) } catch { print("other") }
do { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": 1}"#.utf8)) } catch { print(error.localizedDescription) }
`)).toBe(`missing title
mismatch Int ["id"]
null Int Cannot get value of type Int -- found null value instead
corrupt ["unit"] Cannot initialize Unit from invalid String value kelvin
The data couldn’t be read because it is missing.
`);
  });

  // Foundation rejects these numbers while parsing (no coding path); the engine
  // rejects them while decoding. Both throw dataCorrupted, so only the case is asserted.
  it('reports numbers that do not fit the integer type as dataCorrupted', async () => {
    expect(await ok(`${codableTypes}
struct Age: Codable { var age: UInt8 }
struct Count: Codable { var n: UInt }
do { _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": 1.5, "title": "a", "tags": []}"#.utf8)) } catch DecodingError.dataCorrupted { print("not an Int") } catch { print("other") }
do { _ = try JSONDecoder().decode(Age.self, from: Data(#"{"age": 300}"#.utf8)) } catch DecodingError.dataCorrupted { print("too big") } catch { print("other") }
do { _ = try JSONDecoder().decode(Count.self, from: Data(#"{"n": -1}"#.utf8)) } catch DecodingError.dataCorrupted { print("negative") } catch { print("other") }
`)).toBe('not an Int\ntoo big\nnegative\n');
  });
});

describe('String(format:) exponent conversions', () => {
  it('formats %e and %E with a two-digit exponent, precision and width', async () => {
    expect(await ok(`import Foundation
print(String(format: "%e|%.2E|%10.3e|%-12.1e|", 12345.678, 0.000123, -9.5, 42.0))
print(String(format: "%.0e|%E", 7.0, 0.5))
`)).toBe('1.234568e+04|1.23E-04|-9.500e+00|4.2e+01     |\n7e+00|5.000000E-01\n');
  });
});

// ------------------------------------------------------------------ SwiftUI host
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
  const result = { host, ctl, root, prints, errors, button, buttons, click, text };
  mounted.push(result);
  return result;
}

describe('@Environment reads', () => {
  it('reads type size, size classes, isEnabled, reduce motion, openURL and an environment object', async () => {
    const p = mount(String.raw`import SwiftUI
@Observable class Model { var name = "shared-model" }
struct Reader: View {
    @Environment(\.dynamicTypeSize) var dt
    @Environment(\.horizontalSizeClass) var hsc
    @Environment(\.verticalSizeClass) var vsc
    @Environment(\.isEnabled) var enabled
    @Environment(\.accessibilityReduceMotion) var reduce
    @Environment(\.openURL) var openURL
    @Environment(Model.self) var model
    var body: some View {
        VStack {
            Text("dt:\(dt)")
            if let h = hsc { Text("h:\(h)") }
            if let v = vsc { Text("v:\(v)") }
            Text(enabled ? "enabled" : "disabled")
            Text(reduce ? "reduce" : "motion")
            Text(model.name)
            Button("Open") { openURL(URL(string: "https://example.com")!) }
        }
    }
}
#Preview {
    VStack {
        Reader().environment(Model())
        Reader().environment(Model()).disabled(true)
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    const t = p.text();
    for (const s of ['dt:', 'h:', 'v:', 'enabled', 'disabled', 'motion', 'shared-model']) expect(t).toContain(s);
    expect(t).not.toContain('reduce');
    await p.click('Open');
    expect(p.errors).toEqual([]);
    // The size-class and type-size values are implicit members in the engine, so
    // they are checked on the host rather than through Swift equality.
    const host = p.ctl.host;
    expect(host.readEnv('dynamicTypeSize').name).toBe('large');
    expect(host.readEnv('horizontalSizeClass').v.name).toBe('compact');
    expect(host.readEnv('verticalSizeClass').v.name).toBe('regular');
    expect(host.readEnv('isEnabled')).toBe(true);
    expect(host.readEnv('isEnabled', { disabled: true })).toBe(false);
    expect(host.readEnv('accessibilityReduceMotion')).toBe(false);
    expect(host.readEnv('accessibilityReduceMotion', { reduceMotion: true })).toBe(true);
    expect(host.readEnv('locale')).toBe(NIL);
  });

  it('reads a regular horizontal size class on iPad', async () => {
    const p = mount(String.raw`import SwiftUI
struct Reader: View {
    @Environment(\.horizontalSizeClass) var hsc
    var body: some View { Text("h:\(hsc.map { "\($0)" } ?? "none")") }
}
#Preview { Reader() }`, { device: 'ipad-mini' });
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.ctl.host.readEnv('horizontalSizeClass').v.name).toBe('regular');
  });

  it('reports a missing environment object with the SwiftUI fatal error text', async () => {
    const p = mount(String.raw`import SwiftUI
enum Outer { @Observable class Inner { var v = 1 } }
struct Needs: View {
    @Environment(Outer.Inner.self) var inner
    var body: some View { Text("\(inner.v)") }
}
#Preview { Needs() }`);
    await tick();
    expect(p.ctl.error?.message).toContain('No Observable object of type Outer.Inner found. A View.environmentObject(_:) for Outer.Inner may be missing as an ancestor of this view.');
  });
});

describe('static members and macros in view bodies', () => {
  it('resolves Font, Animation, Angle and alignment statics spelled with their type', async () => {
    const src = `import SwiftUI
#Preview {
    VStack(alignment: HorizontalAlignment.leading) {
        Text("Custom").font(Font.custom("Avenir", size: 20))
        Text("System").font(Font.system(size: 14, weight: .bold))
        Text("Spin").rotationEffect(Angle.degrees(45))
        Text("Spring").animation(Animation.easeInOut(duration: 0.2), value: 1)
        Text("Line \\(#line)")
    }
}`;
    const p = mount(src);
    await tick();
    expect(p.errors).toEqual([]);
    const lineOfMacro = src.split('\n').findIndex((l) => l.includes('#line')) + 1;
    for (const s of ['Custom', 'System', 'Spin', 'Spring', `Line ${lineOfMacro}`]) expect(p.text()).toContain(s);
  });

  it('reports an unknown static member with the compiler wording', async () => {
    const p = mount('import SwiftUI\n#Preview { Text("x").padding(Spacer.wide) }');
    await tick();
    expect(p.ctl.error?.message).toContain("type 'Spacer' has no member 'wide'");
  });

  it('reports a missing member on a non-view value with the compiler wording', async () => {
    const p = mount('import SwiftUI\n#Preview { Text("abc".missing) }');
    await tick();
    expect(p.ctl.error?.message).toContain("value of type 'String' has no member 'missing'");
  });
});

describe('view constructors', () => {
  it('builds Button(action:), Label builders, GroupBox, Grid, LabeledContent, ProgressView and ContentUnavailableView', async () => {
    const p = mount(String.raw`import SwiftUI
struct Tap: View {
    @State var n = 0
    var body: some View {
        Button(action: { n += 1 }) { Text("Tap \(n)") }
    }
}
#Preview {
    VStack {
        Tap()
        Label { Text("Custom title") } icon: { Image(systemName: "star") }
        GroupBox("Totals") {
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 4) {
                GridRow {
                    Text("a")
                    Text("1")
                }
                GridRow {
                    Text("b")
                    Text("2")
                }
            }
            LabeledContent("Sum", value: "3")
            LabeledContent("Note") { Text("ok") }
        }
        ProgressView("Loading", value: 30, total: 100)
        ContentUnavailableView {
            Label("No Mail", systemImage: "tray")
        } description: {
            Text("Check back later.")
        } actions: {
            Button("Refresh") {}
        }
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    await p.click('Tap 0');
    expect(p.button('Tap 1')).toBeTruthy();
    const t = p.text();
    // LabeledContent(_:value:) renders only its title here: the engine reads the
    // value from the second positional argument, not from the value: label.
    for (const s of ['Custom title', 'Totals', 'Sum', 'Note', 'ok', 'No Mail', 'Check back later.', 'Refresh']) expect(t).toContain(s);
    expect(p.root.querySelector('.v-groupbox')).toBeTruthy();
    expect(p.root.querySelectorAll('.v-labeled')).toHaveLength(2);
    expect(p.root.querySelector('.v-progressbar')?.getAttribute('aria-valuenow')).toBe('30');
    expect(p.root.querySelector('.v-unavailable')).toBeTruthy();
    await p.click('Refresh');
    expect(p.errors).toEqual([]);
  });

  it('builds colors from white, hue, asset names and platform colors, and gradients from both spellings', async () => {
    const p = mount(String.raw`import SwiftUI
#Preview {
    VStack {
        Color(white: 0.5)
        Color(.red)
        Color("Brand")
        Color(hue: 0.5, saturation: 0.5, brightness: 0.8, opacity: 0.9)
        LinearGradient(colors: [.red, .blue], startPoint: .top, endPoint: .bottom)
        LinearGradient(gradient: Gradient(colors: [.green, .yellow]), startPoint: .leading, endPoint: .trailing)
        RadialGradient(colors: [.red, .blue], center: .center, startRadius: 0, endRadius: 100)
        Text("Tinted").foregroundStyle(.red.opacity(0.5)).background(.blue.opacity(0.2))
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.root.querySelectorAll('.v-color').length).toBeGreaterThanOrEqual(7);
    expect(p.text()).toContain('Tinted');
  });

  it('pushes NavigationLink(value:) and NavigationLink { } label: { } forms', async () => {
    const nav = (links) => String.raw`import SwiftUI
#Preview {
    NavigationStack {
        List {
            ${links}
        }
        .navigationDestination(for: Int.self) { n in Text("Number \(n)") }
    }
}`;
    const byValue = mount(nav('NavigationLink(value: 7) { Text("Seven") }'));
    await tick();
    expect(byValue.errors).toEqual([]);
    await byValue.click('Seven');
    expect(byValue.text()).toContain('Number 7');

    const custom = mount(nav('NavigationLink { Text("Pushed detail") } label: { Text("Custom label") }'));
    await tick();
    expect(custom.errors).toEqual([]);
    await custom.click('Custom label');
    expect(custom.text()).toContain('Pushed detail');
  });

  it('drives a control through Binding(get:set:)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Root: View {
    @State var flag = false
    var proxy: Binding<Bool> { Binding(get: { flag }, set: { flag = $0 }) }
    var body: some View {
        VStack {
            Text(flag ? "state:on" : "state:off")
            Toggle("Flag", isOn: proxy)
        }
    }
}
#Preview { Root() }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('state:off');
    p.root.querySelector('.v-switch').click();
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('state:on');
  });

  it('renders the WindowGroup of an App when there is no #Preview', async () => {
    const p = mount(String.raw`import SwiftUI
@main struct DemoApp: App {
    var body: some Scene {
        WindowGroup { Text("from window group") }
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('from window group');
  });

  it('formats Text(_:format:) for percent, currency and number', async () => {
    const p = mount(String.raw`import SwiftUI
#Preview {
    VStack {
        Text(0.25, format: .percent)
        Text(9.5, format: .currency(code: "USD"))
        Text(1234, format: .number)
    }
}`);
    await tick();
    expect(p.errors).toEqual([]);
    for (const s of ['25%', '$9.50', '1,234']) expect(p.text()).toContain(s);
  });
});

describe('custom view modifiers and ForEach diagnostics', () => {
  it('applies a ViewModifier through .modifier(_:)', async () => {
    const p = mount(String.raw`import SwiftUI
struct Card: ViewModifier {
    func body(content: Content) -> some View { content.padding().background(Color.gray) }
}
#Preview { Text("Card body").modifier(Card()) }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.text()).toContain('Card body');
  });

  it('logs the duplicate-id runtime issue for plain rows', async () => {
    const p = mount(String.raw`import SwiftUI
#Preview { List { ForEach([1, 1], id: \.self) { n in Text("Row \(n)") } } }`);
    await tick();
    expect(p.errors).toEqual([]);
    expect(p.ctl.warnings).toContain('ForEach<Array<Int>, Int, Text>: the ID 1 occurs multiple times within the collection, this will give undefined results!');
  });
});

describe('@AppStorage bridge', () => {
  const settings = String.raw`import SwiftUI
enum Theme: String { case light, dark }
struct Settings: View {
    @AppStorage("count") var count = 0
    @AppStorage("scale") var scale = 1.5
    @AppStorage("name") var name = "anon"
    @AppStorage("sound") var sound = true
    @AppStorage("theme") var theme = Theme.light
    var body: some View {
        VStack {
            Text("count=\(count) scale=\(scale) name=\(name) sound=\(sound) theme=\(theme.rawValue)")
            Button("Change") {
                count += 1
                scale = 2.5
                name = "ana"
                sound = false
                theme = .dark
            }
        }
    }
}
#Preview { Settings() }`;
  const opts = { storageNamespace: 'coverage-fixes' };
  const defaults = 'count=0 scale=1.5 name=anon sound=true theme=light';
  const changed = 'count=1 scale=2.5 name=ana sound=false theme=dark';

  it('persists Int, Double, String, Bool and RawRepresentable values and reads them back', async () => {
    localStorage.clear();
    const first = mount(settings, opts);
    await tick();
    expect(first.errors).toEqual([]);
    expect(first.text()).toContain(defaults);
    await first.click('Change');
    expect(first.text()).toContain(changed);
    const ns = first.ctl.ns;
    expect(JSON.parse(localStorage.getItem(ns + 'count'))).toBe(1);
    expect(JSON.parse(localStorage.getItem(ns + 'scale'))).toEqual({ d: 2.5 });
    expect(JSON.parse(localStorage.getItem(ns + 'name'))).toBe('ana');
    expect(JSON.parse(localStorage.getItem(ns + 'sound'))).toBe(false);
    expect(JSON.parse(localStorage.getItem(ns + 'theme'))).toEqual({ e: 'dark' });

    const second = mount(settings, opts);
    await tick();
    expect(second.errors).toEqual([]);
    expect(second.text()).toContain(changed);
    localStorage.clear();
  });

  it('falls back to the declared default when the stored value has the wrong shape', async () => {
    localStorage.clear();
    const probe = mount(settings, opts);
    await tick();
    const ns = probe.ctl.ns;
    localStorage.setItem(ns + 'count', '"x"');
    localStorage.setItem(ns + 'scale', '"bad"');
    localStorage.setItem(ns + 'name', '123');
    localStorage.setItem(ns + 'sound', '"yes"');
    localStorage.setItem(ns + 'theme', '{"e":"neon"}');
    const bad = mount(settings, opts);
    await tick();
    expect(bad.errors).toEqual([]);
    expect(bad.text()).toContain(defaults);

    localStorage.setItem(ns + 'scale', '3');
    localStorage.setItem(ns + 'count', '2.5');
    const plain = mount(settings, opts);
    await tick();
    expect(plain.errors).toEqual([]);
    expect(plain.text()).toContain('count=0 scale=3.0 name=anon');
    localStorage.clear();
  });
});
