// Regression tests for the interpreter-core fixes: 64-bit Int operators,
// optional-chain writes, self reassignment in nested mutating calls, the cost
// of the ARC simulation, struct self captured by closures, unowned references,
// capacity limits on concatenation, deadlock detection, protocol-extension
// dispatch and the drain helper.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { run, getBuiltins } from '../../src/engine/index.js';
import { Interp, TypeInfo } from '../../src/engine/interp.js';
import { hooks, SDict } from '../../src/engine/values.js';
import { parse } from '../../src/engine/parser.js';

const ok = async (src) => {
  const r = await run(src);
  expect(r.error).toBeNull();
  return r.stdout;
};
const fails = async (src) => {
  const r = await run(src);
  expect(r.error).not.toBeNull();
  return r;
};

describe('Int is a 64-bit two\'s-complement integer (finding 1)', () => {
  it('bit operators and shifts use 64-bit semantics', async () => {
    expect(await ok('print(1 << 63)\nprint((1 << 40) | 1)\nprint(-7 >> 1)\nprint(~0)\nprint(5 ^ 3)')).toBe('-9223372036854775808\n1099511627777\n-4\n-1\n6\n');
    expect(await ok('let one = 1, mx = Int.max, mn = Int.min\nprint(one << 64, one << -1, -one >> 70, mx >> 62, ~mx == mn, mx & one, -one & 255, mn | one, mx ^ mn)')).toBe('0 0 -1 1 true 1 255 -9223372036854775807 -1\n');
  });

  it('wrapping operators wrap at 64 bits', async () => {
    expect(await ok('print(Int.max &+ 1)\nprint((1<<40) &* (1<<40))\nprint(Int.max &- (-1))\nprint(Int.min &- 1, Int.max &* 2, Int.min &+ Int.min)')).toBe('-9223372036854775808\n0\n-9223372036854775808\n9223372036854775807 -2 0\n');
  });

  it('checked operators trap on overflow with Swift wording and keep earlier output', async () => {
    for (const [src, msg] of [
      ['let m = Int.max\nprint(m + 1)', 'Fatal error: arithmetic overflow'],
      ['let m = Int.min\nprint(-m)', 'Fatal error: arithmetic overflow'],
      ['let m = Int.min\nprint(m * 2)', 'Fatal error: arithmetic overflow'],
      ['let m = Int.max\nprint(m - (-1))', 'Fatal error: arithmetic overflow'],
      ['let m = Int.min\nprint(m / -1)', 'Fatal error: Division results in an overflow'],
      ['let m = Int.min\nprint(m % -1)', 'Fatal error: Division results in an overflow in remainder operation'],
      ['let z = 0\nprint(7 / z)', 'Fatal error: Division by zero'],
    ]) {
      const r = await fails('print("before")\n' + src);
      expect(r.error.message).toBe(msg);
      expect(r.error.kind).toBe('runtime');
      expect(r.error.line).toBe(3);
      expect(r.stdout).toBe('before\n');
    }
  });

  it('division truncates toward zero and large results stay exact', async () => {
    expect(await ok('print(-9 / 2, -9 % 2, 7 / -2)\nlet big = 1 << 62\nprint(big + (big - 1), (big - 1) * 2 + 1, big / 2 * 2 == big)')).toBe('-4 -1 -3\n9223372036854775807 9223372036854775807 true\n');
  });

  it('rejects ~ on a non-integer', async () => {
    const r = await fails('print(~"a")');
    expect(r.error.message).toBe("unary operator '~' cannot be applied to an operand of type 'String'");
    expect(r.error.kind).toBe('compile');
  });
});

describe('optional chaining on the write path (finding 2)', () => {
  it('skips the whole assignment, right side included, when a link is nil', async () => {
    expect(await ok(`class C { var x = 0 }
var c: C? = nil
func side() -> Int { print("evaluated"); return 5 }
c?.x = side()
c?.x += 1
print("ok")
c = C()
c?.x = side()
c?.x += 1
print(c!.x)`)).toBe('ok\nevaluated\n6\n');
  });

  it('writes and mutating calls through dictionary and optional struct receivers', async () => {
    expect(await ok(`class C { var x = 0 }
var d: [String: C] = [:]
d["a"]?.x = 3
print("ok")
d["a"] = C()
d["a"]?.x = 3
print(d["a"]!.x)
struct P { var n = 0; mutating func inc() { n += 1 } }
var p: P? = P()
p?.inc()
print(p!.n)
var q: P? = nil
q?.inc()
print(q == nil)
var m: [String: P] = ["k": P()]
m["k"]?.inc()
m["k"]?.n += 10
print(m["k"]!.n)`)).toBe('ok\n3\n1\ntrue\n11\n');
  });
});

describe('self reassignment inside nested mutating calls (finding 3)', () => {
  it('keeps the self a mutating method assigns when called without self.', async () => {
    expect(await ok('struct S { var x = 1; mutating func reset() { self = S(x: 99) }; mutating func a() { reset() } }\nvar s = S()\ns.a()\nprint(s.x)')).toBe('99\n');
    expect(await ok('struct S { var x = 1; mutating func reset() { self = S(x: 99) }; mutating func a() { self.reset() } }\nvar s = S()\ns.a()\nprint(s.x)')).toBe('99\n');
    expect(await ok('enum Light { case red, green; mutating func next() { self = self == .red ? .green : .red }; mutating func advance() { next() } }\nvar l = Light.red\nl.advance()\nprint(l)')).toBe('green\n');
  });

  it('rejects a mutating call from a non-mutating method with swiftc wording', async () => {
    const r = await fails('struct S { var x = 1; mutating func reset() { x = 0 }; func a() { reset() } }\nvar s = S()\ns.a()');
    expect(r.error.message).toBe("cannot use mutating member on immutable value: 'self' is immutable");
    expect(r.error.kind).toBe('compile');
  });
});

describe('ARC simulation cost (finding 4)', () => {
  const program = (deinit) => `class Node { var v = 0${deinit ? '; deinit { }' : ''} }
var keep: [Node] = []
for i in 0..<5000 { keep.append(Node()) }
for i in 0..<5000 { let n = Node(); n.v = i }
print(keep.count)`;

  it('is off without deinit, weak or unowned: 5,000 live objects and 5,000 releases cost no ARC work', async () => {
    const t0 = performance.now();
    const r = await run(program(false));
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('5000\n');
    // Linear in the number of objects: about 25,000 interpreter steps today.
    expect(r.steps).toBeLessThan(60_000);
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
    // The ARC simulation is never constructed for a program without deinit, weak or unowned.
    const interp = new Interp({ builtins: getBuiltins(), write: () => {} });
    const main = interp.scheduler.spawn(interp.runProgram(parse(program(false))), 'main');
    await interp.scheduler.drive(() => main.done);
    expect(main.error).toBeNull(); // spawn() starts every task with error: null
    expect(interp.arcWanted).toBe(false);
    expect(interp.arc).toBeFalsy(); // the simulation object is only created when arcWanted is true
  });

  it('charges its heap scans so a pathological program stops instead of hanging', async () => {
    const t0 = performance.now();
    const r = await fails(program(true));
    expect(r.error.kind).toBe('limit');
    // A hang would hit the 60 s test timeout; under coverage with the whole suite in parallel this takes a few seconds.
    expect(performance.now() - t0).toBeLessThan(15000);
  });

  it('still frees objects, runs deinit and clears weak references', async () => {
    expect(await ok('class A { deinit { print("freed") } }\nvar a: A? = A()\na = nil\nprint("end")')).toBe('freed\nend\n');
    expect(await ok('class M {}\nclass O { weak var m: M? }\nvar m: M? = M()\nlet o = O()\no.m = m\nm = nil\nprint(o.m == nil)')).toBe('true\n');
    expect(await ok('class M {}\nvar m: M? = M()\nlet f = { [weak m] in m == nil }\nprint(f())\nm = nil\nprint(f())')).toBe('false\ntrue\n');
  });
});

describe('closures capture a copy of a struct self (finding 5)', () => {
  it('a closure made in a non-mutating method keeps the self it was made with', async () => {
    expect(await ok('struct Counter { var n = 0; func make() -> () -> Int { { self.n } } }\nvar c = Counter()\nlet f = c.make()\nc.n = 5\nprint(f())')).toBe('0\n');
    expect(await ok('struct Counter { var n = 0; func make() -> () -> Int { { n } } }\nvar c = Counter()\nlet f = c.make()\nc.n = 5\nprint(f(), c.n)')).toBe('0 5\n');
    expect(await ok('struct Counter { var n = 0; func twice() -> Int { n * 2 }; func make() -> () -> Int { { twice() } } }\nvar c = Counter(n: 4)\nlet f = c.make()\nc.n = 50\nprint(f())')).toBe('8\n');
  });

  it('closures in a mutating method still see and change the live self', async () => {
    expect(await ok('struct T { var total = 0; mutating func addAll(_ xs: [Int]) { xs.forEach { total += $0 } } }\nvar t = T()\nt.addAll([1, 2, 3])\nprint(t.total)')).toBe('6\n');
  });
});

describe('unowned references (finding 6)', () => {
  const trap = 'Fatal error: Attempted to read an unowned reference but object was already deallocated';

  it('reading an unowned property after deallocation is a runtime error that keeps earlier output', async () => {
    const r = await run(`class Owner { var name = "o"; deinit { print("owner freed") } }
class Ref { unowned let o: Owner; init(o: Owner) { self.o = o } }
var owner: Owner? = Owner()
let r = Ref(o: owner!)
print(r.o.name)
owner = nil
print(r.o.name)`);
    expect(r.stdout).toBe('o\nowner freed\n');
    expect(r.error.kind).toBe('runtime');
    expect(r.error.message).toBe(trap);
    expect(r.error.line).toBe(7);
  });

  it('an [unowned x] capture traps the same way', async () => {
    const r = await run('class Owner { deinit { print("freed") } }\nvar owner: Owner? = Owner()\nlet f = { [unowned owner] in print(owner == nil) }\nf()\nowner = nil\nf()');
    expect(r.stdout).toBe('false\nfreed\n');
    expect(r.error.kind).toBe('runtime');
    expect(r.error.message).toBe(trap);
  });
});

describe('capacity limits on concatenation (finding 7)', () => {
  const cap = 'Stopped: this in-browser playground caps collections and strings at 16,777,216 elements';

  it('stops array doubling with + before memory runs out', async () => {
    // Every copied element costs a step, so the step budget ends this well
    // before the 16,777,216-element cap (the cap is the backstop).
    const r = await fails('var a = [1]\nfor _ in 0..<26 { a = a + a }\nprint(a.count)');
    expect(r.error.kind).toBe('limit');
    expect([cap, 'Stopped after 3,000,000 steps of work. The program builds more data than this in-browser playground allows.']).toContain(r.error.message);
    expect(r.stdout).toBe('');
  });

  it('stops string and array growth through += too', async () => {
    const s = await fails('var s = "ab"\nfor _ in 0..<30 { s += s }');
    expect(s.error.kind).toBe('limit');
    expect(s.error.message).toBe(cap);
    const a = await fails('var a = [1]\nfor _ in 0..<30 { a += a }');
    expect(a.error.message).toBe(cap);
    const t = await fails('var t = "x"\nfor _ in 0..<30 { t = t + t }');
    expect(t.error.message).toBe(cap);
  });

  it('leaves ordinary concatenation alone', async () => {
    expect(await ok('var s = ""\nfor i in 0..<20000 { s = s + "x" }\nprint(s.count)\nvar a: [Int] = []\nfor i in 0..<100000 { a += [i] }\nprint(a.count, ([1] + [2, 3]).count, "a" + "b")')).toBe('20000\n100000 3 ab\n');
  });

  it('exposes checkCapacity(count, line) for the builtins', () => {
    const interp = new Interp({ builtins: getBuiltins() });
    const before = interp.steps;
    interp.checkCapacity(6400, 3);
    expect(interp.steps).toBeGreaterThan(before);
    expect(() => interp.checkCapacity(16_777_216, 3)).not.toThrow();
    let err = null;
    try { interp.checkCapacity(16_777_217, 3); } catch (e) { err = e; }
    expect(err.kind).toBe('limit');
    expect(err.line).toBe(3);
    expect(err.message).toBe(cap);
  });
});

describe('deadlock detection (finding 8)', () => {
  it('reports tasks waiting on each other instead of success', async () => {
    const r = await run(`var box: [Task<Void, Never>] = []
let a = Task { print("waiting"); await box[0].value }
let b = Task { await a.value }
box.append(b)
await a.value
print("never")`);
    expect(r.stdout).toBe('waiting\n');
    expect(r.error.kind).toBe('limit');
    expect(r.error.message).toBe('Stopped: every task is waiting and none can continue');
  });

  it('lets a program finish with detached tasks still pending', async () => {
    expect(await ok('let t = Task { try? await Task.sleep(nanoseconds: 1_000_000_000); print("late") }\nprint("main done")')).toBe('main done\n');
  });

  it('does not mistake a continuation another task resumes for a deadlock', async () => {
    expect(await ok('let v = await withCheckedContinuation { (c: CheckedContinuation<Int, Never>) in\n  Task { c.resume(returning: 3) }\n}\nprint(v)')).toBe('3\n');
  });

  it('a continuation nobody resumes is a deadlock on the console clock', async () => {
    const r = await run('let v: Int = await withCheckedContinuation { c in\n  print("never resumed")\n}\nprint(v)');
    expect(r.stdout).toBe('never resumed\n');
    expect(r.error.kind).toBe('limit');
    expect(r.error.message).toBe('Stopped: every task is waiting and none can continue');
  });

  it('on the real clock a pending continuation only idles, because a UI event may resume it', async () => {
    const drive = async (clock) => {
      const interp = new Interp({ builtins: getBuiltins(), clock });
      const handle = { done: false, blocked: false, waiters: [], error: null, result: undefined, label: 'continuation' };
      const main = interp.scheduler.spawn((function* () { yield { suspend: 'await', task: handle }; return 'resumed'; })(), 'main');
      main.isMain = true;
      await interp.scheduler.drive(() => main.done);
      handle.done = true;
      interp.scheduler.finish(handle);
      await interp.scheduler.drive(() => main.done);
      return main.result;
    };
    expect(await drive('real')).toBe('resumed');
    await expect(drive('virtual')).rejects.toMatchObject({ kind: 'limit', message: 'Stopped: every task is waiting and none can continue' });
  });
});

describe('observers see the value before an in-place mutation (teammate report)', () => {
  it('didSet and willSet on a struct, array or nested property variable', async () => {
    expect(await ok('struct S { var v = 0 }\nvar s = S() { willSet { print("will", s.v, newValue.v) }; didSet { print("did", oldValue.v, s.v) } }\ns.v = 3\ns.v += 1')).toBe('will 0 3\ndid 0 3\nwill 3 4\ndid 3 4\n');
    expect(await ok('var a = [1, 2] { didSet { print(oldValue, a) } }\na[0] = 9\na.append(3)')).toBe('[1, 2] [9, 2]\n[9, 2] [9, 2, 3]\n');
    expect(await ok('struct Inner { var v = 0 }\nstruct Outer { var inner = Inner() { didSet { print(oldValue.v, inner.v) } } }\nvar o = Outer()\no.inner.v = 7')).toBe('0 7\n');
  });

  it('implicit members resolve against the declared numeric type in every typed position', async () => {
    expect(await ok(`struct Big: Codable { var v: Double }
let b = Big(v: .infinity)
print(b.v, Big(v: .infinity).v)
let d: Double = .pi
func f(_ x: Double) -> Double { x }
func g() -> Double { .greatestFiniteMagnitude }
var z: Float = .zero
var w: Double = 1
w = .infinity
struct P { var n: Int; init(n: Int) { self.n = n } }
let i: Int = .max
print(d, f(.nan), g(), z, w, P(n: .min).n, i, Int.zero, UInt8(0) == .min)`)).toBe('inf inf\n3.141592653589793 nan 1.7976931348623157e+308 0.0 inf -9223372036854775808 9223372036854775807 0 true\n');
  });

  it('implicit members resolve against the other operand in comparisons', async () => {
    expect(await ok(`enum Size: Comparable { case small, medium, large }
print(Size.large > .medium, .small < Size.medium, Size.small <= .small, .large >= Size.large)
let x: Int = 3
print(x > .zero, .zero < x, x >= .max, x == .zero, x != .zero)
let d: Double = 1.5
print(d < .infinity, .pi > d)
switch x {
case .zero: print("zero")
default: print("nonzero")
}`)).toBe('true true true true\ntrue true false false true\ntrue true\nnonzero\n');
  });

  it('synthesizes CodingKeys for Codable types that declare none', async () => {
    // swiftc writes CodingKeys only for a type whose encode(to:) or init(from:) it
    // synthesizes, and keeps it private: the type's own members may use it
    expect(await ok(`import Foundation
struct Person: Codable {
    var name: String
    var age: Int
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name, forKey: .name)
        try c.encode(age + 1, forKey: .age)
    }
    static func show() { print(CodingKeys.name.stringValue, CodingKeys.age, CodingKeys.age.intValue as Any) }
}
struct Plain { var id: Int }
extension Plain: Encodable {
    static func key() -> String { CodingKeys.id.stringValue }
}
let p = try JSONDecoder().decode(Person.self, from: Data("{\\"name\\":\\"Ada\\",\\"age\\":36}".utf8))
print(p.name, p.age)
let enc = JSONEncoder()
enc.outputFormatting = .sortedKeys
print(String(decoding: try enc.encode(p), as: UTF8.self))
Person.show()
print(Plain.key())`)).toBe('Ada 36\n{"age":37,"name":"Ada"}\nname CodingKeys(stringValue: "age", intValue: nil) nil\nid\n');
    // a type that writes both init(from:) and encode(to:) itself gets none
    const r = await fails('import Foundation\nstruct P: Codable {\n    var a: Int\n    init(from decoder: Decoder) throws {\n        let c = try decoder.container(keyedBy: CodingKeys.self)\n        a = try c.decode(Int.self, forKey: .a)\n    }\n    func encode(to encoder: Encoder) throws {}\n}\nprint(try JSONDecoder().decode(P.self, from: Data("{\\"a\\":1}".utf8)).a)');
    expect([r.error.message, r.error.line]).toEqual(["cannot find 'CodingKeys' in scope", 5]);
    // a CodingKey enum's synthesized init?(stringValue:) and init?(intValue:)
    expect(await ok('enum K: String, CodingKey { case a, b }\nprint(K(stringValue: "b") as Any, K(stringValue: "z") as Any, K(intValue: 1) as Any)\nenum N: Int, CodingKey { case x = 1, y = 2 }\nprint(N(intValue: 2) as Any, N(stringValue: "x") as Any)')).toBe('Optional(K(stringValue: "b", intValue: nil)) nil nil\nOptional(N(stringValue: "y", intValue: 2)) Optional(N(stringValue: "x", intValue: 1))\n');
    // an explicit CodingKeys is kept as written
    expect(await ok('import Foundation\nstruct P: Codable { var name: String; enum CodingKeys: String, CodingKey { case name = "n" } }\nprint(String(decoding: try JSONEncoder().encode(P(name: "x")), as: UTF8.self))')).toBe('{"n":"x"}\n');
  });

  it('exposes the call-depth limit as maxDepth', () => {
    const interp = new Interp({ builtins: getBuiltins() });
    expect(interp.maxDepth).toBe(200);
  });
});

describe('protocol-extension static dispatch (finding 9)', () => {
  const decls = 'protocol P { var title: String { get } }\nextension P { var title: String { "P" }; var note: String { "note-P" }; func hi() -> String { "P" } }\nstruct A: P { var title: String { "A" }; var note: String { "note-A" }; func hi() -> String { "A" } }';

  it('uses the extension for non-requirements when the declared type is the protocol', async () => {
    expect(await ok(`${decls}\nlet a: P = A()\nprint(a.hi(), a.note, a.title)\nlet b = A()\nprint(b.hi(), b.note, b.title)`)).toBe('P note-P A\nA note-A A\n');
  });

  it('applies to parameters, optionals, any P and [P] loop variables', async () => {
    expect(await ok(`${decls}\nfunc f(_ x: P) -> String { x.hi() }\nlet o: P? = A()\nlet e: any P = A()\nlet all: [P] = [A()]\nvar s = ""\nfor x in all { s += x.hi() }\nprint(f(A()), o?.hi() ?? "", o!.note, e.hi(), s)`)).toBe('P P note-P P P\n');
  });

  it('a requirement with a default still dispatches to the conforming type', async () => {
    expect(await ok('protocol P { func hi() -> String }\nextension P { func hi() -> String { "P" } }\nstruct A: P { func hi() -> String { "A" } }\nlet a: P = A()\nprint(a.hi())')).toBe('A\n');
    expect(await ok('protocol Q { var text: String { get } }\nprotocol P: Q {}\nextension Q { var text: String { "Q" } }\nstruct A: P { var text: String { "A" } }\nlet a: P = A()\nprint(a.text)')).toBe('A\n');
  });
});

describe('review round: scan accounting, copy hook, overloads, scheduler wake, declared types', () => {
  const cap = 'Stopped: this in-browser playground caps collections and strings at 16,777,216 elements';

  it('ARC scans charge every element they look at and skip primitive-typed collections', async () => {
    const program = (decl) => `class Node { deinit { } }
var keep${decl} = []
for i in 0..<10000 { keep.append(i) }
for _ in 0..<100 { let n = Node() }
print(keep.count)`;
    const mixed = await run(program(': [Any]'));
    const typed = await run(program(': [Int]'));
    expect(mixed.error).toBeNull();
    expect(typed.error).toBeNull();
    expect(mixed.stdout).toBe('10000\n');
    // 100 scans over 10,000 primitives, charged at one step per 16 elements
    expect(mixed.steps - typed.steps).toBeGreaterThan(50_000);
  });

  it('hooks.onCopy(delta, total) charges one step per element; hooks.checkCapacity guards descriptions', async () => {
    const interp = new Interp({ builtins: getBuiltins() });
    const main = interp.scheduler.spawn((function* () {
      expect(hooks.onCopy(6400, 6400)).toBe(true);
      expect(interp.steps).toBeGreaterThanOrEqual(6400);
      expect(hooks.checkCapacity(640)).toBe(true);
      hooks.onCopy(1, 16_777_217);
    })(), 'main');
    main.isMain = true;
    await expect(interp.scheduler.drive(() => main.done)).rejects.toMatchObject({ kind: 'limit', message: cap });
    const other = interp.scheduler.spawn((function* () { hooks.checkCapacity(16_777_217); })(), 'other');
    other.isMain = true;
    await expect(interp.scheduler.drive(() => other.done)).rejects.toMatchObject({ kind: 'limit', message: cap });
  });

  it('exponential nested copies hit the default step budget through the copy hook', async () => {
    const before = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    const r = await run('var a: [Any] = [1]\nfor _ in 0..<40 { a = [a, a] }\nprint(a.count)');
    expect(r.error.kind).toBe('limit');
    // nested containers weigh 64 elements in values.js: one copy passes the cap
    // around the 18th doubling, before the step budget is spent
    expect([cap, 'Stopped after 3,000,000 steps of work. The program builds more data than this in-browser playground allows.']).toContain(r.error.message);
    expect(r.stdout).toBe('');
    expect(performance.now() - t0).toBeLessThan(10_000);
    // Heap growth is a loose guard only: V8 may not have collected the earlier runs' garbage yet.
    expect(process.memoryUsage().heapUsed - before).toBeLessThan(600 * 1024 * 1024);
  });

  it('ranges past 2^53 step exactly', async () => {
    expect(await ok('for i in 9007199254740992...9007199254740993 { print(i) }\nfor i in (Int.max - 1)...Int.max { print(i) }\nvar n = 0\nfor _ in 1...5 { n += 1 }\nfor _ in 3..<3 { n += 100 }\nprint(n)')).toBe('9007199254740992\n9007199254740993\n9223372036854775806\n9223372036854775807\n5\n');
  });

  it('overload resolution precedes the mutability check', async () => {
    expect(await ok('struct S { var n = 0; mutating func f(_ x: Int) { n = x }; func f() -> Int { 7 }; func g() -> Int { f() } }\nlet s = S()\nprint(S().g(), s.f())\nvar t = S()\nt.f(3)\nprint(t.n)')).toBe('7 7\n3\n');
  });

  it('a task spawned during a long real-clock sleep runs without waiting for the timer', async () => {
    const interp = new Interp({ builtins: getBuiltins(), clock: 'real' });
    const sch = interp.scheduler;
    const log = [];
    let stop = false;
    sch.spawn((function* () { yield { suspend: 'sleep', ns: 3_600e9 }; log.push('A'); })(), 'A');
    const driving = sch.drive(() => stop);
    await new Promise((r) => setTimeout(r, 20));
    sch.spawn((function* () { log.push('B'); })(), 'B');
    await new Promise((r) => setTimeout(r, 20));
    expect(log).toEqual(['B']);
    stop = true;
    sch.wake(); // what the preview calls on destroy: the pending timer is dropped and drive() returns
    await driving;
    expect(sch.driving).toBe(false);
    expect(sch.interrupt).toBeNull();
  });

  it('wake() tells an idle host to drive again, after the current action has finished', async () => {
    const interp = new Interp({ builtins: getBuiltins(), clock: 'real' });
    let kicks = 0;
    interp.scheduler.onWake = () => { kicks++; };
    const handle = { done: false, blocked: false, waiters: [], error: null, result: undefined, label: 'continuation' };
    const waiter = interp.scheduler.spawn((function* () { yield { suspend: 'await', task: handle }; })(), 'w');
    expect(kicks).toBe(0); // deferred: the spawning action runs to its end first
    await Promise.resolve();
    expect(kicks).toBe(1);
    interp.scheduler.block(waiter, [handle]);
    handle.done = true;
    interp.scheduler.finish(handle);
    expect(waiter.blocked).toBe(false);
    expect(kicks).toBe(1);
    await Promise.resolve();
    expect(kicks).toBe(2);
  });

  it('an interrupted real-clock sleep keeps its deadline instead of restarting', async () => {
    // The scheduler reads performance.now() and setTimeout directly, so both are
    // faked: the clock only moves when the test advances it, and machine load
    // cannot blur the difference between a kept and a restarted deadline.
    const { vi } = await import('vitest');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      const interp = new Interp({ builtins: getBuiltins(), clock: 'real' });
      const sch = interp.scheduler;
      let woke = null;
      const sleeper = sch.spawn((function* () { yield { suspend: 'sleep', ns: 300e6 }; woke = performance.now(); })(), 'sleeper');
      const driving = sch.drive(() => sleeper.done);
      await vi.advanceTimersByTimeAsync(100);
      sch.spawn((function* () {})(), 'quick'); // interrupts the sleep at exactly 100 ms
      await vi.advanceTimersByTimeAsync(199); // 299 ms: not yet due either way
      expect(woke).toBeNull();
      await vi.advanceTimersByTimeAsync(2); // 301 ms: past the original deadline, well before a restarted one (400 ms)
      expect(woke).not.toBeNull();
      expect(woke).toBeLessThanOrEqual(301);
      await vi.runAllTimersAsync();
      await driving;
    } finally {
      vi.useRealTimers();
    }
  });

  it('protocol-extension dispatch follows declared element and return types', async () => {
    expect(await ok(`protocol P {}
extension P { func f() -> String { "P" }; var note: String { "note-P" } }
struct S: P { func f() -> String { "S" }; var note: String { "note-S" } }
let xs: [P] = [S()]
let d: [String: P] = ["k": S()]
func make() -> P { S() }
func maybe() -> P? { S() }
print(xs[0].f(), xs[0].note, d["k"]?.f() ?? "", d["k"]!.note, make().f(), make().note, maybe()?.f() ?? "", maybe()!.note)
struct Box { func make() -> P { S() }; func test() -> String { make().f() } }
print(Box().test(), S().f())`)).toBe('P note-P P note-P P note-P P note-P\nP S\n');
  });
});

describe('review pass 2: implicit parameters, trace cap, release charge, loop snapshots, widths, qualified calls', () => {
  it('refuses absurd anonymous closure arguments and keeps normal ones', async () => {
    const r = await fails('let f = { $100000 }');
    expect(r.error.kind).toBe('compile');
    expect(r.error.message).toBe("anonymous closure argument '$100000' exceeds the 32 anonymous arguments this playground supports");
    expect(await ok('let g: (Int, Int) -> Int = { $0 + $1 }\nprint(g(2, 3), [3, 1, 2].sorted { $0 < $1 })')).toBe('5 [1, 2, 3]\n');
  });

  it('the trace never formats more than the display limit of a value', async () => {
    const r = await run('var s = String(repeating: "x", count: 100000)\nvar n = 0\nfor _ in 0..<3 { n += 1; s += "y" }\nprint(n)', { trace: true });
    expect(r.error).toBeNull();
    const shown = r.trace.map((t) => t.vars.s).filter(Boolean);
    expect(shown.length).toBeGreaterThan(0);
    for (const v of shown) expect(v.length).toBeLessThanOrEqual(302);
    expect(shown[shown.length - 1].endsWith('…')).toBe(true);
  });

  it('releasing a large untyped array charges the traversal', async () => {
    const program = (decl) => `class X { deinit { } }
func f(_ a: inout [${decl}]) {}
var a: [${decl}] = []
for i in 0..<20000 { a.append(i) }
for _ in 0..<50 { f(&a) }
print(a.count)`;
    const any = await run(program('Any'));
    const ints = await run(program('Int'));
    expect(any.error).toBeNull();
    expect(ints.stdout).toBe('20000\n');
    // 50 releases of a 20,000-element array, one step per 16 elements visited
    expect(any.steps - ints.steps).toBeGreaterThan(50_000);
  });

  it('a loop over nested containers walks a snapshot taken at the start', async () => {
    expect(await ok('var a = [[1], [2]]\nfor x in a { print(x); a[1].append(9) }\nprint(a)')).toBe('[1]\n[2]\n[[1], [2, 9, 9]]\n');
    expect(await ok('var b = [1, 2]\nfor x in b { b.append(x * 10) }\nprint(b)')).toBe('[1, 2, 10, 20]\n');
  });

  it('range loops over narrow integers keep their width', async () => {
    expect(await ok('for n in UInt8(254)...UInt8.max { print(n &+ 1, type(of: n)) }\nfor i in Int8(-2)..<Int8(0) { print(i) }')).toBe('255 UInt8\n0 UInt8\n-2\n-1\n');
  });

  it('declared return types flow through qualified method calls', async () => {
    expect(await ok(`protocol P {}
extension P { func f() -> String { "P" } }
struct S: P { func f() -> String { "S" } }
struct Box {
    func make() -> P { S() }
    static func create() -> P { S() }
    func viaSelf() -> String { self.make().f() }
}
let b: Box = Box()
print(Box().make().f(), b.make().f(), Box.create().f(), Box().viaSelf(), S().f())`)).toBe('P P P P S\n');
  });

  it('closures in a non-mutating method see the self snapshot through computed properties and methods', async () => {
    expect(await ok('struct V { var numbers = [1]; var total: Int { numbers[0] }; func read() -> Int { numbers[0] }; func make() -> () -> Int { { total + read() } } }\nvar v = V()\nlet f = v.make()\nv.numbers[0] = 2\nprint(f())')).toBe('2\n');
  });
});

describe('review pass 3: interpolation cap, trace memory, exact ranges, dictionary snapshots, cancel, task pruning', () => {
  const cap = 'Stopped: this in-browser playground caps collections and strings at 16,777,216 elements';

  it('string interpolation is capped like concatenation', async () => {
    const r = await fails('let big = String(repeating: "x", count: 6_000_000)\nlet s = "\\(big)\\(big)\\(big)"\nprint(s.count)');
    expect(r.error.kind).toBe('limit');
    expect(r.error.message).toBe(cap);
    expect(await ok('let n = 3\nprint("n is \\(n), twice \\(n * 2)")')).toBe('n is 3, twice 6\n');
  });

  it('the trace keeps at most 48 variables per frame and stops with a note at its caps', async () => {
    const decls = Array.from({ length: 100 }, (_, i) => `var v${i} = ${i}`).join('\n');
    const r = await run(`${decls}\nvar n = 0\nfor _ in 0..<5 { n += 1 }\nprint(n)`, { trace: true });
    expect(r.error).toBeNull();
    const last = r.trace[r.trace.length - 1];
    expect(Object.keys(last.vars).length).toBeLessThanOrEqual(49);
    expect(last.vars['…']).toMatch(/^\+\d+ more$/);
    expect(last.vars.n).toBe('5');
    const long = await run('var i = 0\nwhile i < 7000 { i += 1 }\nprint(i)', { trace: true });
    expect(long.error).toBeNull();
    expect(long.stdout).toBe('7000\n');
    expect(long.trace.length).toBeLessThanOrEqual(5001);
    expect(long.trace[long.trace.length - 1].vars['…']).toContain('trace stopped');
  });

  it('range membership compares 64-bit values exactly', async () => {
    expect(await ok('let a = UInt64.max - 1, b = UInt64.max\nprint((a..<b) ~= a, (a...a) ~= b, (a...b) ~= b, (a..<b) ~= b)\nswitch Int.max {\ncase (Int.max - 1)...Int.max: print("top")\ndefault: print("no")\n}\nprint((1...3) ~= 2, (1.0..<2.0) ~= 1.5)')).toBe('true false true false\ntop\ntrue true\n');
  });

  it('a loop over a dictionary walks a snapshot of its container values', async () => {
    expect(await ok('var d = [1: [1], 2: [2]]\nvar seen = 0\nfor (k, v) in d { seen += v.count; d[1]?.append(9); d[2]?.append(9) }\nprint(seen, d[1]!.count, d[2]!.count)')).toBe('2 3 3\n');
  });

  it('cancel() ends a real-clock sleep immediately', async () => {
    // Fake clock: it only advances when a timer fires, so if cancel() left the
    // hour-long sleep running, draining the timers would move it by 3,600 s.
    const { vi } = await import('vitest');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const realStart = Date.now();
    try {
      const interp = new Interp({ builtins: getBuiltins(), clock: 'real' });
      const sch = interp.scheduler;
      const t0 = performance.now();
      const sleeper = sch.spawn((function* () { yield { suspend: 'sleep', ns: 3_600e9 }; return 'woke'; })(), 'sleeper');
      const driving = sch.drive(() => sleeper.done);
      await vi.advanceTimersByTimeAsync(20);
      sch.cancel(sleeper);
      await vi.runAllTimersAsync();
      await driving;
      expect(sleeper.cancelled).toBe(true);
      expect(sleeper.result).toBe('woke');
      expect(performance.now() - t0).toBeLessThan(1000);
    } finally {
      vi.useRealTimers();
    }
    expect(Date.now() - realStart).toBeLessThan(10_000); // hang guard only
  });

  it('finished tasks leave the scheduler queue', async () => {
    const interp = new Interp({ builtins: getBuiltins() });
    const sch = interp.scheduler;
    let last = null;
    for (let i = 0; i < 500; i++) last = sch.spawn((function* () { return i; })(), 'quick');
    expect(sch.tasks.length).toBe(500);
    await sch.drive(() => last.done);
    expect(sch.tasks.filter((t) => !t.done).length).toBe(0);
    expect(sch.tasks.length).toBeLessThan(128); // swept in batches, never the whole history
    expect(last.result).toBe(499);
  });

  it('hooks.charge adds work to the running program', async () => {
    const interp = new Interp({ builtins: getBuiltins() });
    const main = interp.scheduler.spawn((function* () { const before = interp.steps; expect(hooks.charge(50)).toBe(true); expect(interp.steps - before).toBe(50); })(), 'main');
    main.isMain = true;
    await interp.scheduler.drive(() => main.done);
    expect(main.error).toBeNull();
  });
});

describe('review pass 4: scheduler heap, sleeper deadlines, [self] captures', () => {
  it('scheduling is cheap for thousands of tasks and keeps the task order', async () => {
    const interp = new Interp({ builtins: getBuiltins() });
    const sch = interp.scheduler;
    let last = null;
    const t0 = performance.now();
    const before = interp.steps;
    for (let i = 0; i < 20000; i++) last = sch.spawn((function* () { return i; })(), 'quick');
    await sch.drive(() => last.done);
    // Every scheduling decision is charged as one step: exactly one per task, so
    // the heap never rescans or drops stale entries for this workload.
    expect(interp.steps - before).toBe(20000);
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
    expect(sch.heap.length).toBe(0);
    expect(await ok('Task { try? await Task.sleep(nanoseconds: 100); print("A") }\nTask { print("B") }\nTask { await Task.yield(); print("C") }\nTask { print("D") }\ntry? await Task.sleep(nanoseconds: 1000)\nprint("main")')).toBe('B\nD\nC\nA\nmain\n');
  });

  it('cancelling one sleeper does not delay another', async () => {
    // Fake clock, as in the other real-clock scheduler tests: time only moves
    // when the test advances it, so the kept credit is checked to the millisecond.
    const { vi } = await import('vitest');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const realStart = Date.now();
    try {
      const interp = new Interp({ builtins: getBuiltins(), clock: 'real' });
      const sch = interp.scheduler;
      let woke = null;
      const long = sch.spawn((function* () { yield { suspend: 'sleep', ns: 400e6 }; woke = performance.now(); })(), 'long');
      const short = sch.spawn((function* () { yield { suspend: 'sleep', ns: 300e6 }; })(), 'short');
      const driving = sch.drive(() => long.done);
      await vi.advanceTimersByTimeAsync(100);
      sch.cancel(short); // interrupts the sleep at exactly 100 ms
      await vi.advanceTimersByTimeAsync(299); // 399 ms: the long sleeper is not due yet
      expect(short.cancelled).toBe(true);
      expect(woke).toBeNull();
      await vi.advanceTimersByTimeAsync(2); // 401 ms: due now; losing the credit for the first 100 ms would end it at 500 ms
      expect(woke).not.toBeNull();
      expect(woke).toBeLessThanOrEqual(401);
      await vi.runAllTimersAsync();
      await driving;
    } finally {
      vi.useRealTimers();
    }
    expect(Date.now() - realStart).toBeLessThan(10_000); // hang guard only
  });

  it('an explicit [self] capture copies a struct', async () => {
    expect(await ok('struct V { var n = 1; func f() -> () -> Int { { [self] in n } } }\nvar v = V()\nlet f = v.f()\nv.n = 2\nprint(f())\nvar k = 1\nlet g = { [k] in k }\nk = 2\nprint(g())')).toBe('1\n1\n');
  });
});

describe('review pass 5: lazy string loops, stale waiters, per-task depth, task sweeping', () => {
  it('a loop over a string is lazy and grapheme-aware', async () => {
    const t0 = performance.now();
    // Counts the characters Intl.Segmenter hands out: 500 loops that each stop
    // after one character segment 500 characters, not 500 whole strings.
    const Real = Intl.Segmenter;
    let segmented = 0;
    Intl.Segmenter = class extends Real {
      segment(s) {
        const inner = super.segment(s);
        return { *[Symbol.iterator]() { for (const x of inner) { segmented++; yield x; } } };
      }
    };
    try {
      expect(await ok('let s = String(repeating: "é", count: 100000)\nvar n = 0\nfor _ in 0..<500 { for ch in s { n += 1; break } }\nprint(n)')).toBe('500\n');
      expect(segmented).toBeLessThanOrEqual(1000); // 500 today; segmenting each whole string would be 50,000,000
      segmented = 0;
      expect(await ok('let s = String(repeating: "é", count: 100000)\nvar n = 0\nfor ch in s { n += 1 }\nprint(n)')).toBe('100000\n');
      expect(segmented).toBeGreaterThanOrEqual(100000); // the counter sees a full walk
    } finally {
      Intl.Segmenter = Real;
    }
    // The ASCII fast path never segments; each loop start pays a step per 256 code units.
    const ascii = await run('let s = String(repeating: "x", count: 100000)\nvar n = 0\nfor _ in 0..<500 { for ch in s { n += 1; break } }\nprint(n)');
    expect(ascii.stdout).toBe('500\n');
    expect(ascii.steps).toBeGreaterThanOrEqual(500 * Math.ceil(100000 / 256));
    expect(ascii.steps).toBeLessThan(400_000); // about 212,000 today
    expect(await ok('var n = 0\nfor ch in "ab👍🏽\\r\\nc" { n += 1 }\nprint(n, "ab👍🏽\\r\\nc".count)\nvar out = ""\nfor ch in "héllo" { out += String(ch).uppercased() }\nprint(out)')).toBe('5 5\nHÉLLO\n');
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
  });

  it('a waiter left on a task group child cannot resume a later unrelated await', async () => {
    expect(await ok(`let r = await withTaskGroup(of: Int.self) { group in
    group.addTask { try? await Task.sleep(nanoseconds: 1); return 1 }
    group.addTask { try? await Task.sleep(nanoseconds: 2); return 2 }
    let first = await group.next()!
    let other = Task { try? await Task.sleep(nanoseconds: 100); return 99 }
    let v = await other.value
    let second = await group.next()!
    return "\\(first), \\(v), \\(second)"
}
print(r)`)).toBe('1, 99, 2\n');
  });

  it('call depth is per task: 3,000 sleeping children do not count as nested calls', async () => {
    expect(await ok(`let total = await withTaskGroup(of: Int.self) { group in
    for i in 0..<3000 { group.addTask { try? await Task.sleep(nanoseconds: 1); return i } }
    var s = 0
    for await v in group { s += v }
    return s
}
print(total)`)).toBe('4498500\n');
    const r = await fails('func down(_ n: Int) -> Int { down(n + 1) }\nprint(down(0))');
    expect(r.error.kind).toBe('limit');
    expect(r.error.message).toContain('200 nested function calls');
  });

  it('100,000 trivial tasks finish in linear work and the task list is swept in batches', async () => {
    const interp = new Interp({ builtins: getBuiltins() });
    const sch = interp.scheduler;
    // Counts every element read from or written to the scheduler's task list,
    // across each list the sweeps put in its place.
    let touched = 0;
    const isIndex = (k) => typeof k === 'string' && /^(0|[1-9]\d*)$/.test(k);
    const counted = (arr) => new Proxy(arr, {
      get(t, k, r) { if (isIndex(k)) touched++; return Reflect.get(t, k, r); },
      set(t, k, v, r) { if (isIndex(k)) touched++; return Reflect.set(t, k, v, r); },
    });
    let list = counted(sch.tasks);
    Object.defineProperty(sch, 'tasks', { configurable: true, enumerable: true, get: () => list, set: (v) => { list = counted(v); } });
    let last = null;
    const t0 = performance.now();
    for (let i = 0; i < 100000; i++) last = sch.spawn((function* () { return i; })(), 'quick');
    await sch.drive(() => last.done);
    // about 300,000 today (a few per task); removing each finished task with a
    // splice grows with the square of the task count
    expect(touched).toBeLessThan(1_000_000);
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
    expect(last.result).toBe(99999);
    expect(sch.tasks.filter((t) => !t.done).length).toBe(0);
    expect(sch.tasks.length).toBeLessThan(128);
  });
});

// Runs programs in a worker thread that is ended after `ms`: a regression that
// loops forever inside one JS call then fails the test instead of hanging the suite.
function runInWorker(programs, ms = 10_000) {
  const url = pathToFileURL(path.resolve('src/engine/index.js')).href;
  const code = `const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const { run } = await import(workerData.url);
  const out = [];
  for (const src of workerData.programs) { const r = await run(src); out.push({ stdout: r.stdout, error: r.error }); }
  parentPort.postMessage(out);
})();`;
  return new Promise((resolve, reject) => {
    const w = new Worker(code, { eval: true, workerData: { url, programs } });
    const timer = setTimeout(() => { w.terminate(); reject(new Error(`still running after ${ms} ms`)); }, ms);
    w.once('message', (m) => { clearTimeout(timer); w.terminate(); resolve(m); });
    w.once('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

describe('review pass 6: inheritance cycles and loops that copy only what they need', () => {
  it('H1: an inheritance cycle is the compile error swiftc reports, on the cycle\'s first class', async () => {
    // every message and line checked against swiftc 6.2; the first three used to hang
    const cases = [
      ['class A: A {}\nlet a = A()\nprint("x")', "'A' inherits from itself", 1],
      ['class A: B {}\nclass B: A {}\nlet a = A()\nprint("x")', "'A' inherits from itself", 1],
      ['class A: A, Codable {}\nprint("x")', "'A' inherits from itself", 1],
      ['class A: B {}\nclass B: C {}\nclass C: A {}\nprint("x")', "'A' inherits from itself", 1],
      ['class B: A {}\nclass A: B {}\nprint("x")', "'B' inherits from itself", 1],
      ['class C: A {}\nclass A: B {}\nclass B: A {}\nprint("x")', "'A' inherits from itself", 2],
      ['class Z: B {}\nclass B: C {}\nclass C: B {}\nprint("x")', "'B' inherits from itself", 2],
      ['class A: B {}; class B: A {}\nprint("x")', "'A' inherits from itself", 1],
      ['struct Outer {\n  class A: A {}\n}\nprint("x")', "'A' inherits from itself", 2],
    ];
    const results = await runInWorker(cases.map(([src]) => src));
    results.forEach((r, i) => {
      expect(r.stdout).toBe('');
      expect(r.error).toEqual({ message: cases[i][1], line: cases[i][2], kind: 'compile' });
    });
    // a long acyclic chain with Codable on the leaf still links and runs
    expect(await ok('class Base { var a = 1 }\nclass Mid: Base { var b = 2 }\nclass Leaf: Mid, Codable { var c = 3 }\nlet l = Leaf()\nprint(l is Base, l.a + l.b + l.c)')).toBe('true 6\n');
  });

  it('H1: the superclass link refuses a cycle, so every walk up the chain ends', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((n, i) => { const t = new TypeInfo(n, 'class', null); t.declOrder = i + 1; t.decl = { line: i + 1 }; return t; });
    a.superclass = b;
    b.superclass = c;
    let err = null;
    try { c.superclass = a; } catch (e) { err = e; }
    expect(err).toMatchObject({ message: "'A' inherits from itself", line: 1, kind: 'compile' });
    expect(() => { a.superclass = a; }).toThrow("'A' inherits from itself");
    expect(c.superclass).toBeNull();
    expect(a.superclass).toBe(b);
    const chain = [];
    for (let t = a; t; t = t.superclass) chain.push(t.name);
    expect(chain).toEqual(['A', 'B', 'C']);
    a.superclass = null;
    expect(a.superclass).toBeNull();
  });

  const build = 'var d: [Int: Int] = [:]\nfor i in 0..<50000 { d[i] = i }\nvar s = 0\n';

  it('H5: a dictionary loop that breaks early pays for what it runs, not for the dictionary', async () => {
    const base = await run(build + 'print(d.count)');
    const early = await run(build + 'for _ in 0..<1000 { for (_, v) in d { s += v; break } }\nprint(s)');
    const keys = await run(build + 'for _ in 0..<1000 { for k in d.keys { s += k; break } }\nprint(s)');
    const full = await run(build + 'for (_, v) in d { s += v }\nprint(s)');
    expect([base.stdout, early.stdout, keys.stdout, full.stdout]).toEqual(['50000\n', '0\n', '0\n', '1249975000\n']);
    for (const r of [early, keys]) {
      expect(r.steps - base.steps).toBeGreaterThanOrEqual(1000); // every loop pays for the iteration it runs
      // about 5,000 today, against about 100,000 for building the dictionary once
      expect(r.steps - base.steps).toBeLessThan(base.steps / 10);
    }
    expect(full.steps - base.steps).toBeGreaterThanOrEqual(50000); // a full walk pays per entry
  });

  it('H5: the loop reads only the entries it visits (counted on the dictionary itself)', async () => {
    // a 50,000-entry dictionary whose storage counts every entry its iterators hand out
    let handedOut = 0;
    const counting = (it) => ({ next() { const r = it.next(); if (!r.done) handedOut++; return r; }, [Symbol.iterator]() { return this; } });
    class CountingMap extends Map {
      values() { return counting(super.values()); }
      entries() { return counting(super.entries()); }
      keys() { return counting(super.keys()); }
      [Symbol.iterator]() { return this.entries(); }
    }
    const d = new SDict();
    d.map = new CountingMap();
    for (let i = 0; i < 50000; i++) d.set(i, i);
    const out = [];
    const interp = new Interp({ builtins: getBuiltins(), write: (x) => out.push(x) });
    interp.globals.declare('d', d, false);
    const src = 'var s = 0\nfor _ in 0..<1000 { for (_, v) in d { s += v; break }; for k in d.keys { s += k; break }; for v in d.values { s += v; break } }\nprint(s)';
    const main = interp.scheduler.spawn(interp.runProgram(parse(src)), 'main');
    await interp.scheduler.drive(() => main.done);
    expect(main.error).toBeNull();
    expect(out.join('')).toBe('0\n');
    expect(handedOut).toBeLessThanOrEqual(3000); // one entry per loop; a snapshot per loop was 150,000,000
    // finished loops leave nothing registered on the dictionary: no guard, and no
    // keys or values view that a later change would have to fill
    expect(d.views ? d.views.size : 0).toBe(0);
  });

  it('H5: loops still see the collection as it was when they started (checked against swiftc)', async () => {
    // full walks that remove, replace and add entries as they go
    expect(await ok(build + 'var n = 0\nfor (k, v) in d { d[k] = nil; d[k + 100000] = v; n += 1; s += v }\nprint(n, s, d.count)')).toBe('50000 1249975000 50000\n');
    expect(await ok(build + 'var n = 0, first = true\nfor (k, v) in d { if first { d.removeAll(); first = false }; d[k + 100000] = v; n += 1 }\nprint(n, d.count, d[100000]!, d[149999]!)')).toBe('50000 50000 0 49999\n');
    // containers stored in entries the loop has not reached yet, changed in place first
    expect(await ok([
      'struct P { var items: [Int] = []; var n = 0 }',
      'func bump(_ a: inout [Int]) { a.append(7) }',
      'var out: [String] = []',
      'var d1 = ["a": [3, 1], "b": [3, 1]]',
      'for (k, v) in d1 { d1["b"]!.sort(); d1["a"]!.sort(); out.append("\\(k)\\(v)") }',
      'var d2 = ["a": [1], "b": [1]]',
      'for (k, v) in d2 { d2["b"]![0] = 5; d2["a"]![0] = 5; out.append("\\(k)\\(v)") }',
      'var d3 = ["a": P(), "b": P()]',
      'for (k, v) in d3 { d3["b"]!.n += 1; d3["a"]!.items.append(1); d3["b"]!.items.append(1); d3["a"]!.n += 1; out.append("\\(k)\\(v.items)\\(v.n)") }',
      'var d4 = ["a": [1], "b": [1]]',
      'for (k, v) in d4 { bump(&d4["b"]!); bump(&d4["a"]!); out.append("\\(k)\\(v)") }',
      'var d5 = ["a": [1], "b": [1]]',
      'for (k, v) in d5 { d5["b"]?.append(2); d5["a"]?.append(2); out.append("\\(k)\\(v)") }',
      'var d6 = ["a": ["x": 1], "b": ["x": 1]]',
      'for (k, v) in d6 { d6["b"]!["y"] = 2; d6["a"]!["y"] = 2; out.append("\\(k)\\(v.count)") }',
      'var d7 = ["a": [1, 2], "b": [1, 2]]',
      'for v in d7.values { d7["b"]!.swapAt(0, 1); d7["a"]!.swapAt(0, 1); out.append("\\(v)") }',
      'var d8 = ["a": [1], "b": [1]]',
      'for (k, v) in d8 { d8["b", default: []] += [4]; d8["a", default: []] += [4]; out.append("\\(k)\\(v)") }',
      'print(out.sorted())',
    ].join('\n'))).toBe('["[1, 2]", "[1, 2]", "a1", "a[1]", "a[1]", "a[1]", "a[1]", "a[3, 1]", "a[]0", "b1", "b[1]", "b[1]", "b[1]", "b[1]", "b[3, 1]", "b[]0"]\n');
    // keys and values views, whole-entry bindings, nested loops, arrays and sets
    expect(await ok([
      'var f = ["p": [1], "q": [2]]',
      'var vs: [[Int]] = []',
      'for v in f.values { f["q"]!.append(7); f["p"]!.append(7); vs.append(v) }',
      'var ks: [String] = []',
      'for k in f.keys { f["r"] = [0]; f.removeValue(forKey: "q"); ks.append(k) }',
      'print(vs.sorted(by: { $0[0] < $1[0] }), ks.sorted(), f.count)',
      'var g = ["m": [1], "n": [2]]',
      'var ents: [String] = []',
      'for entry in g { g["n"]!.append(5); g["m"]!.append(5); ents.append("\\(entry.key)\\(entry.value)") }',
      'let h = ["a": 1, "b": 2, "c": 3]',
      'var pairs = 0',
      'for (_, x) in h { for (_, y) in h { if x < y { pairs += 1 } } }',
      'print(ents.sorted(), pairs)',
      'var grid = [[1], [2], [3]]',
      'var rows: [[Int]] = []',
      'for row in grid { grid[2].append(9); grid.append([0]); rows.append(row) }',
      'var nums = [1, 2, 3]',
      'var got: [Int] = []',
      'for n in nums { nums.append(n * 10); nums[2] = 99; got.append(n) }',
      'print(rows, grid.count, got, nums)',
      'var s: Set = [1, 2, 3]',
      'var sc = 0',
      'for x in s { s.insert(x + 10); s.remove(1); sc += 1 }',
      'var t: Set = [1, 2]',
      'var tc = 0',
      'for _ in t { t.removeAll(); tc += 1 }',
      'print(sc, s.count, tc, t.count)',
    ].join('\n'))).toBe('[[1], [2]] ["p", "q"] 2\n["m[1]", "n[2]"] 3\n[[1], [2], [3]] 6 [1, 2, 3] [1, 2, 99, 10, 20, 30]\n3 5 2 0\n');
  });

  it('H5: a loop that changes the dictionary pays for the entries it then copies', async () => {
    // the same loop, once writing a scalar and once adding an entry on its first iteration
    const kept = await run(build + 'var n = 0\nfor (k, v) in d { if k == 0 { s = -1 }; n += v }\nprint(n)');
    const changed = await run(build + 'var n = 0\nfor (k, v) in d { if k == 0 { d[-1] = -1 }; n += v }\nprint(n)');
    expect([kept.stdout, changed.stdout]).toEqual(['1249975000\n', '1249975000\n']);
    // the 49,999 entries not yet visited are taken at a step per 16 (about 3,130 more today)
    expect(changed.steps - kept.steps).toBeGreaterThanOrEqual(Math.ceil(49999 / 16));
    expect(changed.steps - kept.steps).toBeLessThan(10_000);
  });

  it('H5: array and set loops pay for their snapshot', async () => {
    for (const make of ['Array(0..<50000)', 'Set(0..<50000)']) {
      const base = await run(`let a = ${make}\nvar s = 0\nprint(a.count)`);
      const loops = await run(`let a = ${make}\nvar s = 0\nfor _ in 0..<100 { for x in a { s += x; break } }\nprint(s >= 0)`);
      expect([base.stdout, loops.stdout]).toEqual(['50000\n', 'true\n']);
      expect(loops.steps - base.steps).toBeGreaterThanOrEqual(100 * 50000 / 16);
    }
  });
});

describe('review pass 7: inheritance and refinement cycles are checked before anything runs', () => {
  it('reports the diagnostic swiftc prints first, wherever the cycle is declared', async () => {
    // every message and line checked against swiftc 6.2 (the first one it prints)
    const cases = [
      // protocols: depth-first from each protocol's parents, the first one reached again
      ['protocol P: Q {}\nprotocol Q: P {}\nprint("x")', "protocol 'Q' refines itself", 2],
      ['protocol P: P {}\nprint("x")', "protocol 'P' refines itself", 1],
      ['protocol Q: P {}\nprotocol P: Q {}\nprint("x")', "protocol 'P' refines itself", 2],
      ['protocol A: B {}\nprotocol B: C {}\nprotocol C: A {}\nprint("x")', "protocol 'B' refines itself", 2],
      ['protocol Z: B {}\nprotocol B: C {}\nprotocol C: B {}\nprint("x")', "protocol 'B' refines itself", 2],
      ['protocol Z: C {}\nprotocol B: C {}\nprotocol C: B {}\nprint("x")', "protocol 'C' refines itself", 3],
      // a conformance or generic constraint starts the walk at the protocol it names
      ['struct S: P {}\nprotocol P: Q {}\nprotocol Q: P {}\nprint("x")', "protocol 'P' refines itself", 2],
      ['func f<T: P>(_ t: T) {}\nprotocol P: Q {}\nprotocol Q: P {}\nprint("x")', "protocol 'P' refines itself", 2],
      ['extension Int: P {}\nprotocol P: Q {}\nprotocol Q: P {}\nprint("x")', "protocol 'P' refines itself", 2],
      // nested, extension and function-local declarations
      ['struct S {\n  protocol P: Q {}\n  protocol Q: P {}\n}\nprint("x")', "protocol 'Q' refines itself", 3],
      ['struct S {\n  protocol Q: S.P {}\n}\nextension S {\n  protocol P: Q {}\n}\nprint("x")', "protocol 'P' refines itself", 5],
      ['func g() {\n  protocol P: P {}\n}\nprint("x")', "protocol 'P' refines itself", 2],
      ['func g() {\n  class A: A {}\n}\nprint("ok")', "'A' inherits from itself", 2],
      ['struct S {}\nextension S {\n  class A: A {}\n}\nprint("x")', "'A' inherits from itself", 3],
      ['class A {}\nfunc g() {\n  class B: A {}\n  class A: B {}\n}\nprint("x")', "'B' inherits from itself", 3],
      ['actor A: A {}\nprint("x")', "'A' inherits from itself", 1],
      ['class A: B {}\ntypealias B = A\nprint("x")', "'A' inherits from itself", 1],
      // classes: up the superclass chain, the first class reached twice
      ['class Z: C {}\nclass B: C {}\nclass C: B {}\nprint("x")', "'C' inherits from itself", 3],
      // function, method, initializer and accessor bodies come after every declaration;
      // closures in top-level code and property initializers do not
      ['func g() {\n  class A: A {}\n}\nclass B: B {}\nprint("x")', "'B' inherits from itself", 4],
      ['struct S {\n  func m() { class A: A {} }\n  class B: B {}\n}\nprint("x")', "'B' inherits from itself", 3],
      ['struct S {\n  init() { class A: A {} }\n}\nclass B: B {}\nprint("x")', "'B' inherits from itself", 4],
      ['var v: Int { class A: A {}; return 1 }\nclass B: B {}\nprint("x")', "'B' inherits from itself", 2],
      ['protocol P: Q {}\nfunc g() { class A: A {} }\nprotocol Q: P {}\nprint("x")', "protocol 'Q' refines itself", 3],
      ['let c = {\n  class A: A {}\n}\nclass B: B {}\nprint("x")', "'A' inherits from itself", 2],
      ['struct S {\n  var f = { class A: A {} }\n}\nclass B: B {}\nprint("x")', "'A' inherits from itself", 2],
    ];
    const results = await runInWorker(cases.map(([src]) => src));
    results.forEach((r, i) => {
      expect([i, r.stdout]).toEqual([i, '']);
      expect([i, r.error]).toEqual([i, { message: cases[i][1], line: cases[i][2], kind: 'compile' }]);
    });
  });

  it('leaves valid hierarchies alone: shadowing, generic parameters, nested and local types', async () => {
    // output checked against swiftc
    expect(await ok('protocol A {}\nprotocol B: A {}\nprotocol C: A {}\nprotocol D: B, C {}\nstruct S: D {}\nclass Base {}\nstruct Box<Base> { var a: Base }\nclass K: Base, D {}\nfunc g() {\n  class Base {}\n  class L: Base {}\n  print(L() is Base)\n}\ng()\nprint(S() is A, Box(a: 1).a, K() is A)'))
      .toBe('true\ntrue 1 true\n');
    // not cycles (swiftc reports other errors for these two); the pass ends and claims none
    for (const src of ['class A {}\nclass B<A>: A {}\nprint("x")', 'typealias X = Y\ntypealias Y = X\nclass A: X {}\nprint("x")']) {
      const r = await run(src);
      expect(r.error ? r.error.message : '').not.toMatch(/inherits from itself|refines itself/);
    }
  });

  it('is charged a step per declaration and handles long chains without recursion', async () => {
    const none = await run('print(1)');
    const many = await run(Array.from({ length: 1000 }, (_, i) => `func f${i}() {}`).join('\n') + '\nprint(1)');
    expect(many.stdout).toBe('1\n');
    // a step per declaration for the check plus the step each top-level statement already costs
    expect(many.steps - none.steps).toBeGreaterThanOrEqual(2000);
    expect(many.steps - none.steps).toBeLessThan(3000);
    const n = 5000;
    const protocols = Array.from({ length: n - 1 }, (_, i) => `protocol P${i}: P${i + 1} {}`);
    expect((await fails([...protocols, `protocol P${n - 1}: P0 {}`, 'print("x")'].join('\n'))).error)
      .toEqual({ message: "protocol 'P1' refines itself", line: 2, kind: 'compile' });
    const classes = ['class C0 {}', ...Array.from({ length: n - 1 }, (_, i) => `class C${i + 1}: C${i} {}`)];
    expect(await ok([...classes, `print(C${n - 1}() is C0)`].join('\n'))).toBe('true\n');
    expect((await fails(['class C0: C4999 {}', ...classes.slice(1), 'print("x")'].join('\n'))).error)
      .toEqual({ message: "'C0' inherits from itself", line: 1, kind: 'compile' });
  });
});

describe('review pass 8: qualified casts, classes in extensions, typealiased inheritance', () => {
  it('is and as? match the declaration a qualified or nested name denotes, not its simple name', async () => {
    // output checked against swiftc 6.2
    expect(await ok([
      'class Node {}',
      'struct Tree {',
      '  class Node {}',
      '  class Leaf: Node {}',
      '  struct Item {}',
      '}',
      'struct Other {',
      '  class Node {}',
      '  struct Item {}',
      '}',
      'let leaf: Any = Tree.Leaf()',
      'print(leaf is Tree.Node, leaf is Node, leaf is Other.Node, leaf is Tree.Leaf)',
      'let items: [Any] = [Tree.Item(), Other.Item(), Node(), Other.Node()]',
      'for x in items {',
      '  switch x {',
      '  case is Tree.Item: print("tree item")',
      '  case is Other.Item: print("other item")',
      '  case let n as Other.Node: print("other node", n is Node)',
      '  case is Node: print("top node")',
      '  default: print("?")',
      '  }',
      '}',
      'print((leaf as? Tree.Node) != nil, (leaf as? Node) != nil)',
      'extension Tree {',
      '  func check(_ v: Any) -> Bool { v is Node }',
      '}',
      'print(Tree().check(Tree.Leaf()), Tree().check(Node()))',
    ].join('\n'))).toBe('true false false true\ntree item\nother item\ntop node\nother node false\ntrue false\ntrue false\n');
  });

  it('classes declared in extensions link to their superclass and conformances', async () => {
    // output from the swiftc-compiled program (the swift JIT cannot run classes declared in extensions)
    expect(await ok([
      'import Foundation',
      'struct Tree { class Node { func hi() -> String { "node" } } }',
      'extension Tree {',
      '  class Leaf: Node { override func hi() -> String { "leaf+" + super.hi() } }',
      '  class Bud: Twig {}',
      '  struct Rec: Codable { var a = 1 }',
      '}',
      'extension Tree { class Twig: Leaf {} }',
      'let b = Tree.Bud()',
      'print(b is Tree.Node, b is Tree.Leaf, b.hi())',
      'let n: Tree.Node = Tree.Leaf()',
      'print(n.hi())',
      'class Base { var v = 1 }',
      'extension Int { class Box: Base {} }',
      'print(Int.Box().v, Int.Box() is Base)',
      'let data = try! JSONEncoder().encode(Tree.Rec())',
      'print(String(data: data, encoding: .utf8)!)',
    ].join('\n'))).toBe('true true leaf+node\nleaf+node\n1 true\n{"a":1}\n');
  });

  it('inheritance, conformance and casts resolve typealiases', async () => {
    // output checked against swiftc 6.2
    expect(await ok([
      'class A { var x = 1 }',
      'typealias Base = A',
      'class B: Base { var y = 2 }',
      'protocol P { func p() -> String }',
      'typealias PAlias = P',
      'struct S: PAlias { func p() -> String { "p" } }',
      'let b = B()',
      'print(b.x, b.y, b is A, b is Base, S() is P, (S() as PAlias).p())',
      'struct Outer { typealias Inner = A; class C: Inner {} }',
      'print(Outer.C().x, Outer.C() is A, Outer.C() is Outer.Inner)',
      'typealias Shape = P',
      'func describe(_ s: Shape) -> String { s.p() }',
      'print(describe(S()))',
      'let items: [Any] = [B(), S()]',
      'for i in items { if let a = i as? Base { print("base", a.x) } else if i is PAlias { print("palias") } }',
    ].join('\n'))).toBe('1 2 true true true p\n1 true true\np\nbase 1\npalias\n');
    // an alias that names itself ends the lookup instead of recursing
    const r = await run('typealias X = Y\ntypealias Y = X\nclass A: X {}\nprint(A() is X)');
    expect(r.error ? r.error.kind : 'none').not.toBe('internal');
  });
});

describe('review pass 9: Float is a 32-bit value, literals take their floating-point context', () => {
  it('computes and prints Float at float32 precision everywhere a Float flows', async () => {
    // output checked against swiftc 6.2
    expect(await ok([
      'let f: Float = 1.0 / 3.0',
      'print(f)',
      'let x: Float = 0.1',
      'print(x * 3, x + 0.2, -x, x == 0.1, x < 0.2)',
      'var c: Float = 1',
      'c += 0.1',
      'c *= 3',
      'print(c)',
      'func g(_ v: Float) -> Float { v * 2 }',
      'print(g(1.1))',
      'func h() -> Float { 2.0 / 3.0 }',
      'print(h())',
      'let arr: [Float] = [1, 2.5, 0.1]',
      'print(arr)',
      'let p: Float = .pi',
      'print(p, Float.pi)',
      'let big: Float = 16777217',
      'print(big)',
      'let lit: Float = 123456789012345678901234567890',
      'print(lit)',
      'print("\\(f) and \\(x)")',
      'let d = Double(f)',
      'print(d, Float(d), Float(0.1) == x)',
      'var n: Float? = 0.5',
      'n! += 1',
      'print(n!)',
      'let t: (Float, Int) = (1.0 / 3.0, 1)',
      'print(t)',
      'let dict: [String: Float] = ["a": 0.1]',
      'print(dict["a"]!)',
      'struct S { var w: Float = 0.7 }',
      'print(S().w, S(w: 1.0 / 3.0).w)',
      'print(Float(1) / 3, f * f)',
      'print(Float(16777217), Float(1e40), Float(-0.0))',
    ].join('\n'))).toBe([
      '0.33333334', '0.3 0.3 -0.1 true true', '3.3000002', '2.2', '0.6666667', '[1.0, 2.5, 0.1]', '3.1415925 3.1415925',
      '16777216.0', '1.2345679e+29', '0.33333334 and 0.1', '0.3333333432674408 0.33333334 true', '1.5', '(0.33333334, 1)',
      '0.1', '0.7 0.33333334', '0.33333334 0.11111112', '16777216.0 inf -0.0', '',
    ].join('\n'));
    for (const [src, out] of [
      ['let f: Float = 0.1\nlet g: Float = 0.2\nprint(f + g, f * g, f / g, f - g)', '0.3 0.020000001 0.5 -0.1\n'],
      ['let a: [Float] = [0.1, 0.2]\nprint(a.reduce(0, +), a.map { $0 * 2 })', '0.3 [0.2, 0.4]\n'],
      ['let f: Float = 3\nlet r = f > 2.5 ? f : 0.5\nprint(r, type(of: r))', '3.0 Float\n'],
      ['func avg(_ xs: [Float]) -> Float { xs.reduce(0, +) / Float(xs.count) }\nprint(avg([1, 2, 2]))', '1.6666666\n'],
      ['let x: Float = 7\nprint(x.squareRoot(), (x / 3).rounded(), Float.pi * 2)', '2.6457512 2.0 6.283185\n'],
      ['var total: Float = 0\nfor v in [0.1, 0.2, 0.3] as [Float] { total += v }\nprint(total)', '0.6\n'],
      ['let f: Float = -0.1\nprint(-f, f < 0, abs(f))', '0.1 true 0.1\n'],
      ['var f = Float(1)\nf = 0.1\nprint(f)\nf = 3\nprint(f)', '0.1\n3.0\n'],
      // literal arithmetic is done in the contextual type, one operation at a time
      ['let f: Float = 1 / 3\nprint(f)', '0.33333334\n'],
      ['let f: Float = 0.1 + 0.2 + 0.3\nprint(f)', '0.6\n'],
      ['let d: Double = 1 / 3\nprint(d)\nlet e: Double = 7 / 2 + 0.5\nprint(e)', '0.3333333333333333\n4.0\n'],
      ['var f: Float = 1\nf = 1 / 4\nprint(f)', '0.25\n'],
      ['func g() -> Float { 2.0 }\nfunc h() -> Float { 1 / 3 }\nfunc k() -> Double { 1 / 3 }\nprint(g(), h(), k())', '2.0 0.33333334 0.3333333333333333\n'],
      // elements, dictionary defaults, implicit members, stored properties, sets
      [[
        'var arr: [Float] = [0.1, 0.2]', 'arr[0] += 0.1', 'arr.append(1.0 / 3.0)', 'print(arr, arr.max()!)',
        'let f: Float = 2', 'print(f < .pi, f == .zero, max(f, 0.2), min(f, 7))',
        'var m: [String: Float] = [:]', 'm["a", default: 0] += 0.1', 'm["a"]! *= 3', 'print(m["a"]!)',
        'struct P { var x: Float; var y: Float }', 'let p = P(x: 0.1, y: 1 / 3)', 'print(p.x + p.y, p)',
        'let fs: Set<Float> = [0.5, 0.25]', 'print(fs.contains(0.5), Float.infinity > f, -Float.greatestFiniteMagnitude < f)',
        'let s = (1...3).map { Float($0) / 3 }', 'print(s)',
        'var acc: Float = 0', 'for i in 1...10 { acc += Float(i) * 0.1 }', 'print(acc)',
      ].join('\n'), '[0.2, 0.2, 0.33333334] 0.33333334\ntrue false 2.0 2.0\n0.3\n0.43333334 P(x: 0.1, y: 0.33333334)\ntrue true true\n[0.33333334, 0.6666667, 1.0]\n5.5\n'],
      ['var m: [String: Double] = [:]\nm["a", default: 0] += 0.1\nprint(m["a"]!)', '0.1\n'],
    ]) expect(await ok(src)).toBe(out);
  });

  it('mixing Float with Double or Int is the compile error swiftc reports', async () => {
    // every message and line checked against swiftc 6.2
    for (const [src, msg, line] of [
      ['let a: Float = 1.5\nlet b: Double = 2\nprint(a + b)', "binary operator '+' cannot be applied to operands of type 'Float' and 'Double'", 3],
      ['let a: Float = 1.5\nlet i: Int = 2\nprint(a * i)', "binary operator '*' cannot be applied to operands of type 'Float' and 'Int'", 3],
      ['let a: Float = 1.5\nlet b: Double = 2\nprint(a < b)', "binary operator '<' cannot be applied to operands of type 'Float' and 'Double'", 3],
      ['let a: Float = 1.5\nlet b: Double = 2\nprint(a == b)', "binary operator '==' cannot be applied to operands of type 'Float' and 'Double'", 3],
      ['let a: Float = 1.5\nlet d = 2.0\nprint(a - d)', "binary operator '-' cannot be applied to operands of type 'Float' and 'Double'", 3],
      ['let f: Float = 1.5\nlet d = 2.0\nprint(d + f)', "binary operator '+' cannot be applied to operands of type 'Double' and 'Float'", 3],
      ['let f: Float = 1.5\nlet i = 2\nprint(i < f)', "binary operator '<' cannot be applied to operands of type 'Int' and 'Float'", 3],
      ['var a: Float = 1.5\nlet b: Double = 2\na += b', "cannot convert value of type 'Double' to expected argument type 'Float'", 3],
      ['var f: Float = 1\nlet i = 2\nf += i', "cannot convert value of type 'Int' to expected argument type 'Float'", 3],
      ['var d = 1.0\nlet i = 2\nd += i', "cannot convert value of type 'Int' to expected argument type 'Double'", 3],
      ['let b: Double = 2\nlet a: Float = b', "cannot convert value of type 'Double' to specified type 'Float'", 2],
      ['func g(_ v: Float) {}\nlet b = 2.0\ng(b)', "cannot convert value of type 'Double' to expected argument type 'Float'", 3],
      ['func r(_ d: Double) {}\nlet f: Float = 1\nr(f)', "cannot convert value of type 'Float' to expected argument type 'Double'", 3],
      ['func g() -> Float { let b = 2.0; return b }\nprint(g())', "cannot convert return expression of type 'Double' to return type 'Float'", 1],
      ['func r() -> Double { let f: Float = 1; return f }\nprint(r())', "cannot convert return expression of type 'Float' to return type 'Double'", 1],
      ['var f = Float(1)\nlet d = 2.0\nf = d', "cannot assign value of type 'Double' to type 'Float'", 3],
      ['var f: Float = 1\nlet d = 2.0\nf = d', "cannot assign value of type 'Double' to type 'Float'", 3],
      ['var d: Double = 1\nlet i = 2\nd = i', "cannot assign value of type 'Int' to type 'Double'", 3],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });

  it('an over-wide integer literal takes a Double or Float context the parser cannot see, and overflows Int elsewhere', async () => {
    // outputs and messages checked against swiftc 6.2 (it only warns for the Double and Float forms)
    const B = '123456789012345678901234567890';
    for (const [src, want] of [
      [`var d = 0.0\nd = ${B}\nprint(d)`, '1.2345678901234568e+29\n'],
      [`var d = 0.0\nd += ${B}\nprint(d)`, '1.2345678901234568e+29\n'],
      [`var d = 0.0\nd = -${B}\nprint(d)`, '-1.2345678901234568e+29\n'],
      [`var f: Float = 0\nf = ${B}\nprint(f)`, '1.2345679e+29\n'],
      [`var o: Double? = nil\no = ${B}\nprint(o!)`, '1.2345678901234568e+29\n'],
      [`func k() -> Double { ${B} }\nprint(k())`, '1.2345678901234568e+29\n'],
      [`func k() -> Float { return ${B} }\nprint(k())`, '1.2345679e+29\n'],
      [`let c: () -> Double = { ${B} }\nprint(c())`, '1.2345678901234568e+29\n'],
      [`let x = 2.0\nprint(x * ${B}, ${B} * x)`, '2.4691357802469136e+29 2.4691357802469136e+29\n'],
      [`let f: Float = 1\nprint(f + ${B})`, '1.2345679e+29\n'],
      [`func h(_ d: Double) { print(d) }\nh(${B})`, '1.2345678901234568e+29\n'],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
    const overflow = (into) => `integer literal '${B}' overflows when stored into '${into}'`;
    for (const [src, msg, line] of [
      [`var i = 0\ni = ${B}`, overflow('Int'), 2],
      [`var i = 0\ni += ${B}`, overflow('Int'), 2],
      [`let i = ${B}`, overflow('Int'), 1],
      [`func h(_ i: Int) {}\nh(${B})`, overflow('Int'), 2],
      // decided before anything runs, even in a function that is never called
      [`func k() -> Int { return ${B} }`, overflow('Int'), 1],
      [`print("a")\nfunc k() -> UInt8? { ${B} }`, overflow('UInt8'), 2],
      [`let c = { () -> Int in return ${B} }`, overflow('Int'), 1],
    ]) {
      const r = await fails(src);
      expect([src, r.stdout, r.error]).toEqual([src, '', { message: msg, line, kind: 'compile' }]);
    }
  });

  it('a collection literal with a Float infers Float for the plain literals beside it', async () => {
    // output checked against swiftc 6.2
    expect(await ok('let f: Float = 0.1\nlet xs = [f, 0.1]\nprint(xs, type(of: xs), Set(xs).count)\nlet ys = [0.1, f, 1]\nprint(ys, type(of: ys))\nprint([f, -0.5, (2)])\nlet s: Set = [f, 0.1]\nprint(s.count)'))
      .toBe('[0.1, 0.1] Array<Float> 1\n[0.1, 0.1, 1.0] Array<Float>\n[0.1, -0.5, 2.0]\n1\n');
    expect(await ok('let f: Float = 0.5\nlet m = ["a": f, "b": 0.1]\nprint(m["b"]!, type(of: m))\nlet a = ["a": 1, "b": 2]\nlet b = [1: "x"]\nlet c = ["k": 0.5]\nlet d = ["k": true]\nprint(type(of: a), type(of: b), type(of: c), type(of: d))'))
      .toBe('0.1 Dictionary<String, Float>\nDictionary<String, Int> Dictionary<Int, String> Dictionary<String, Double> Dictionary<String, Bool>\n');
  });

  it('a prefix minus on an implicit member resolves the member against the contextual type first', async () => {
    // output checked against swiftc 6.2
    expect(await ok([
      'let x: Double = -.infinity',
      'let m: Int = -.max',
      'func f(_ d: Double) -> Double { d }',
      'print(x, m, f(-.pi))',
      'let y = 2.0',
      'print(y > -.infinity, -.infinity < y, y == -.infinity, y != -.zero)',
      'let fl: Float = -.pi',
      'var z: Double = 0',
      'z = -.greatestFiniteMagnitude',
      'func g() -> Double { -.infinity }',
      'func h() -> Float { return -.ulpOfOne }',
      'let arr: [Double] = [-.infinity, 1, -.pi]',
      'let o: Double? = -.infinity',
      'print(fl, z, g(), h(), arr, o as Any)',
      'let i8: Int8 = -.max',
      'print(i8, -(-.pi) as Double, max(y, -.infinity))',
      'struct V { static let unit = V(v: 1); var v: Int',
      '  static prefix func - (a: V) -> V { V(v: -a.v) } }',
      'let nv: V = -.unit',
      'print(nv.v, (-V(v: 3)).v)',
    ].join('\n'))).toBe('-inf -9223372036854775807 -3.141592653589793\ntrue true false true\n-3.1415925 -1.7976931348623157e+308 -inf -1.1920929e-07 [-inf, 1.0, -3.141592653589793] Optional(-inf)\n-127 3.141592653589793 2.0\n-1 -3\n');
    expect(await ok('let y = 2.0\nprint(max(y, .infinity), min(.zero, y))')).toBe('inf 0.0\n');
    // without a contextual type: swiftc's wording depends on the member
    for (const [src, msg, line] of [
      ['enum C { case red }\nlet c: C = -.red', "unary operator '-' cannot be applied to an operand of type 'C'", 2],
      ['let x = -.infinity', "ambiguous use of 'infinity'", 1],
      ['var y = -.pi', "ambiguous use of 'pi'", 1],
      ['let x = -.nan', "ambiguous use of 'nan'", 1],
      ['let x = -.zero', "ambiguous use of operator '-'", 1],
      ['let x = -.max', "referencing operator function '-' on 'SIMD' requires that 'Self.Scalar' conform to 'FloatingPoint'", 1],
      ['let z = +.pi', "type 'AdditiveArithmetic' has no member 'pi'", 1],
      ['let x = .infinity', "reference to member 'infinity' cannot be resolved without a contextual type", 1],
      ['enum C { case red }\nlet c = -.red', "reference to member 'red' cannot be resolved without a contextual type", 2],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });
});

describe('review pass 10: CGFloat beside Double and Float, Float literals rounded once', () => {
  it('CGFloat and Double convert into each other implicitly (SE-0307); Float and Int do not', async () => {
    // output checked against swiftc 6.2
    expect(await ok([
      'import CoreGraphics',
      'let c: CGFloat = 1.5',
      'let d: Double = 2',
      'let w = CGFloat(3)',
      'print(c + d, type(of: c + d), d + c, type(of: d * c), c + 1.0, type(of: c + 1.0), c * 2, type(of: c * 2))',
      'let r: CGFloat = d',
      'let q: Double = c',
      'let m: CGFloat = c * d',
      'print(r, type(of: r), q, type(of: q), m, type(of: m))',
      'var x: CGFloat = 0',
      'x += d',
      'x += 1',
      'var y = d',
      'y += c',
      'print(x, type(of: x), y, type(of: y))',
      'func takesD(_ v: Double) -> Double { v }',
      'func takesC(_ v: CGFloat) -> CGFloat { v }',
      'func retD() -> Double { c }',
      'func retC() -> CGFloat { return d }',
      'print(takesD(c), takesC(d), type(of: takesC(d)), retD(), retC(), type(of: retC()))',
      'print(-c, type(of: -c), (c as Any) is Double, (c as Any) is CGFloat, (d as Any) is CGFloat, (c as Any) as? Double as Any)',
      'print([c, 2.5], type(of: [c, 2.5]), [w, 1], c > d, c == 1.5, d < w)',
      'let arr: [CGFloat] = [1, 2.5]',
      'let cd: [String: CGFloat] = ["a": 1]',
      'print(arr, type(of: arr), cd["a"]!, type(of: cd["a"]!))',
      'let neg: CGFloat = -.pi',
      'print(neg, max(c, 1), type(of: max(c, 1)))',
    ].join('\n'))).toBe([
      '3.5 Double 3.5 Double 2.5 CGFloat 3.0 CGFloat', '2.0 CGFloat 1.5 Double 3.0 CGFloat', '3.0 CGFloat 3.5 Double',
      '1.5 2.0 CGFloat 1.5 2.0 CGFloat', '-1.5 CGFloat false true false nil', '[1.5, 2.5] Array<CGFloat> [3.0, 1.0] false true true',
      '[1.0, 2.5] Array<CGFloat> 1.0 CGFloat', '-3.141592653589793 1.5 CGFloat', '',
    ].join('\n'));
    for (const [src, out] of [
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet d = 2.0\nprint(c == d, d != c)', 'false true\n'],
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet x = true ? c : 2.0\nprint(type(of: x))', 'CGFloat\n'],
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet d = 2.0\nlet xs = [c, d]\nprint(type(of: xs))', 'Array<Double>\n'],
      ['import CoreGraphics\nvar c = CGFloat(1)\nlet d = 2.5\nc = d\nc = 3\nprint(c, type(of: c))', '3.0 CGFloat\n'],
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet x = false ? c : 2.0\nlet o: CGFloat? = nil\nprint(type(of: x), o ?? 4, type(of: o ?? 4))', 'CGFloat 4.0 CGFloat\n'],
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet m = ["a": c, "b": 0.5]\nlet d = 2.0\nlet n = ["a": c, "b": d]\nprint(type(of: m), type(of: n))', 'Dictionary<String, CGFloat> Dictionary<String, Double>\n'],
      ['import CoreGraphics\nvar m: [String: CGFloat] = [:]\nm["a", default: 0] += 0.5\nprint(m["a"]!, type(of: m["a"]!))', '0.5 CGFloat\n'],
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet d: Double = 2\nlet x = c + 1.0\nlet r: CGFloat = d\nlet q: Double = c\nlet m: CGFloat = c * d\nprint(type(of: x), r, q, type(of: q), m, type(of: m), type(of: d * c), Array(stride(from: CGFloat(0), to: 1, by: 0.5)), c > d)', 'CGFloat 2.0 1.5 Double 3.0 CGFloat Double [0.0, 0.5] false\n'],
    ]) expect([src, await ok(src)]).toEqual([src, out]);
    // every message and line checked against swiftc 6.2
    for (const [src, msg, line] of [
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet f: Float = 2\nprint(c + f)', "binary operator '+' cannot be applied to operands of type 'CGFloat' and 'Float'", 4],
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet f: Float = c', "cannot convert value of type 'CGFloat' to specified type 'Float'", 3],
      ['import CoreGraphics\nlet f: Float = 2\nlet c: CGFloat = f', "cannot convert value of type 'Float' to specified type 'CGFloat'", 3],
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet i = 2\nprint(c * i)', "binary operator '*' cannot be applied to operands of type 'CGFloat' and 'Int'", 4],
      ['import CoreGraphics\nvar c: CGFloat = 1.5\nlet f: Float = 2\nc += f', "binary operator '+=' cannot be applied to operands of type 'CGFloat' and 'Float'", 4],
      ['import CoreGraphics\nvar c: CGFloat = 1.5\nlet i = 2\nc += i', "binary operator '+=' cannot be applied to operands of type 'CGFloat' and 'Int'", 4],
      ['import CoreGraphics\nlet c: CGFloat = 1.5\nlet f: Float = 2\nprint(c < f)', "binary operator '<' cannot be applied to operands of type 'CGFloat' and 'Float'", 4],
      ['import CoreGraphics\nfunc g(_ v: Float) {}\nlet c: CGFloat = 1\ng(c)', "cannot convert value of type 'CGFloat' to expected argument type 'Float'", 4],
      ['import CoreGraphics\nfunc g() -> Float { let c: CGFloat = 1; return c }\nprint(g())', "cannot convert return expression of type 'CGFloat' to return type 'Float'", 2],
      ['import CoreGraphics\nvar c = CGFloat(1)\nlet f: Float = 2\nc = f', "cannot assign value of type 'Float' to type 'CGFloat'", 4],
      ['import CoreGraphics\nvar f: Float = 1\nlet c: CGFloat = 1\nf += c', "cannot convert value of type 'CGFloat' to expected argument type 'Float'", 4],
      ['import CoreGraphics\nvar d = 1.0\nlet f: Float = 1\nd += f', "cannot convert value of type 'Float' to expected argument type 'Double'", 4],
      ['import CoreGraphics\nlet c: CGFloat = 1\nlet f: Float = 1\nprint(c == f)', "binary operator '==' cannot be applied to operands of type 'CGFloat' and 'Float'", 4],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });

  it("the lead's CGFloat and Float-literal probe prints what swiftc prints", async () => {
    expect(await ok([
      'import CoreGraphics',
      'let c: CGFloat = 1.5',
      'let d: Double = 2.0',
      'print(type(of: c), type(of: c + d), c * 2)',
      'print((c as Any) is Double, (c as Any) is CGFloat)',
      'let arr = [c, 2.5]',
      'print(type(of: arr))',
      'let g: Float = 1152921573326323713',
      'print(g.bitPattern)',
    ].join('\n'))).toBe('CGFloat Double 3.0\nfalse true\nArray<CGFloat>\n1568669697\n');
  });

  it('an integer literal rounds to Float once; a decimal literal goes through Double first, as swiftc does', async () => {
    // bit patterns checked against swiftc 6.2 on arm64: only Float(String) rounds the decimal text once
    expect(await ok([
      'let a: Float = 1.000000059604644775390625001',
      'let b = Float("1.000000059604644775390625001")!',
      'var c: Float = 0',
      'c = 1.000000059604644775390625001',
      'func k() -> Float { 1.000000059604644775390625001 }',
      'let arr: [Float] = [1.000000059604644775390625001]',
      'let g: Float = 1',
      'print(a.bitPattern, b.bitPattern, c.bitPattern, k().bitPattern, arr[0].bitPattern, (g * 1.000000059604644775390625001).bitPattern)',
      'var f: Float = 0',
      'f = 1152921573326323713',
      'let h: Float = 1152921573326323713',
      'print(f.bitPattern, h.bitPattern)',
    ].join('\n'))).toBe('1065353216 1065353217 1065353216 1065353216 1065353216 1065353216\n1568669697 1568669697\n');
  });
});

describe('review pass 11: Float and CGFloat take their context in keys, literal arithmetic, ?? and annotations', () => {
  it('keys, literal arithmetic beside a floating operand, and ?? defaults take the floating type (checked against swiftc 6.2)', async () => {
    for (const [src, want] of [
      ["import CoreGraphics\nlet d: [Float: String] = [0.1: \"a\"]\nprint(d[Float(0.1)] as Any, type(of: d.keys.first!), d[0.1] as Any)\nvar e: [Float: String] = [:]\ne[0.1] = \"a\"\ne[0.2, default: \"z\"] += \"!\"\nprint(e[Float(0.1)] as Any, e[0.2]!, e.count)\nlet s: [String: Float] = [\"x\": 0.1]\nprint(s[\"x\"]! == Float(0.1), type(of: s[\"x\"]!))\nvar cg: [CGFloat: Int] = [0.5: 1]\ncg[1.5] = 2\nprint(cg[CGFloat(0.5)] as Any, cg[1.5] as Any, type(of: cg.keys.first!))\nvar mf: [Float: Int] = [:]\nmf[1] = 5\nprint(mf[Float(1)] as Any, mf.keys.contains(1))\nvar vc: [String: CGFloat] = [:]\nvc[\"a\"] = 0.5\nprint(type(of: vc[\"a\"]!))", "Optional(\"a\") Float Optional(\"a\")\nOptional(\"a\") z! 2\ntrue Float\nOptional(1) Optional(2) CGFloat\nOptional(5) true\nCGFloat\n"],
      ["import CoreGraphics\nlet f: Float = 1\nprint(f + (1 / 2), f * (1 / 2), (1 / 3) * f, f - (2 / 4 + 1))\nlet c: CGFloat = 1\nprint(c + (1 / 2), type(of: c + (1 / 2)), c * (1 / 4))\nlet d = 1.0\nprint(d + (1 / 2), d * (1 / 2))\nvar g: Float = 1\ng += 1 / 2\nprint(g)\nprint(f < 1 / 2 + 1, f == 2 / 2)", "1.5 0.5 0.33333334 -0.5\n1.5 CGFloat 0.25\n1.5 0.5\n1.5\ntrue true\n"],
      ["import CoreGraphics\nlet f: Float? = nil\nlet x = f ?? 0.1\nprint(type(of: x), x)\nlet c: CGFloat? = nil\nlet y = c ?? 0.5\nprint(type(of: y), y)\nlet z = f ?? 2\nprint(type(of: z), z)\nlet g: Float? = 0.25\nprint(g ?? 0.1, type(of: g ?? 1 / 3), g ?? 1 / 3)\nlet d: Double? = nil\nprint(type(of: d ?? 1))", "Float 0.1\nCGFloat 0.5\nFloat 2.0\n0.25 Float 0.25\nDouble\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });

  it('a non-numeric value where Double, Float or CGFloat is declared is the conversion error swiftc reports', async () => {
    for (const [src, msg, line] of [
      ["import CoreGraphics\nlet f: Float = true", "cannot convert value of type 'Bool' to specified type 'Float'", 2],
      ["import CoreGraphics\nlet c: CGFloat = \"text\"", "cannot convert value of type 'String' to specified type 'CGFloat'", 2],
      ["import CoreGraphics\nfunc g(_ v: Float) {}\ng(\"x\")", "cannot convert value of type 'String' to expected argument type 'Float'", 3],
      ["import CoreGraphics\nfunc g(_ v: CGFloat) {}\ng(true)", "cannot convert value of type 'Bool' to expected argument type 'CGFloat'", 3],
      ["import CoreGraphics\nfunc g() -> Float { return \"s\" }\nprint(g())", "cannot convert return expression of type 'String' to return type 'Float'", 2],
      ["import CoreGraphics\nvar f: Float = 1\nf = \"s\"", "cannot assign value of type 'String' to type 'Float'", 3],
      ["import CoreGraphics\nlet f: Float = [1]", "cannot convert value of type '[Int]' to specified type 'Float'", 2],
      ["import CoreGraphics\nlet f: Float? = \"a\"", "cannot convert value of type 'String' to specified type 'Float'", 2],
      ["import CoreGraphics\nstruct P { var x: Float }\nprint(P(x: \"a\").x)", "cannot convert value of type 'String' to expected argument type 'Float'", 3],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });
});

describe('review pass 12: over-wide literals keep their sign and their integer target', () => {
  it('reports swiftc\'s overflow wording, and keeps a literal that fits a UInt64', async () => {
    // every message and output checked against swiftc 6.2
    for (const [src, msg, line] of [
      ['var n = 0\nn = -99999999999999999999', "integer literal '-99999999999999999999' overflows when stored into 'Int'", 2],
      ['let x = 1\nlet y = -99999999999999999999 * x', "integer literal '-99999999999999999999' overflows when stored into 'Int'", 2],
      ['func k() -> UInt64 { return -18446744073709551616 }', "negative integer '-18446744073709551616' overflows when stored into unsigned type 'UInt64'", 1],
      ['func k() -> Int { -99999999999999999999 }', "integer literal '-99999999999999999999' overflows when stored into 'Int'", 1],
      ['var u: UInt64 = 0\nu = -18446744073709551616', "negative integer '-18446744073709551616' overflows when stored into unsigned type 'UInt64'", 2],
      ['var u: UInt8 = 0\nu = 99999999999999999999', "integer literal '99999999999999999999' overflows when stored into 'UInt8'", 2],
      ['var w = UInt64(1)\nw = 18446744073709551616', "integer literal '18446744073709551616' overflows when stored into 'UInt64'", 2],
      ['var b: Int8 = 0\nb = -99999999999999999999', "integer literal '-99999999999999999999' overflows when stored into 'Int8'", 2],
      ['var u: UInt = 0\nu = -99999999999999999999', "negative integer '-99999999999999999999' overflows when stored into unsigned type 'UInt'", 2],
      ['func k() -> Int8 { return -99999999999999999999 }', "integer literal '-99999999999999999999' overflows when stored into 'Int8'", 1],
      ['func k() -> UInt { -99999999999999999999 }', "negative integer '-99999999999999999999' overflows when stored into unsigned type 'UInt'", 1],
      ['let x = 1\nprint(x + -99999999999999999999)', "integer literal '-99999999999999999999' overflows when stored into 'Int'", 2],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
    expect(await ok('var u: UInt64 = 0\nu = 18446744073709551615\nfunc k() -> UInt64 { 18446744073709551615 }\nvar w = UInt64(1)\nw = 18446744073709551615\nprint(u, k(), w)'))
      .toBe('18446744073709551615 18446744073709551615 18446744073709551615\n');
  });
});

describe('review pass 13: trace size caps, ?? typed by the wrapped type, user values into Float', () => {
  it('caps each traced name and stops the trace at its character budget', async () => {
    const name = 'v' + 'x'.repeat(10000);
    const r = await run(`var ${name} = 0\nwhile ${name} < 5000 { ${name} += 1 }\nprint(${name})`, { trace: true });
    expect(r.stdout).toBe('5000\n');
    for (const frame of r.trace) for (const k of Object.keys(frame.vars)) expect(k.length).toBeLessThanOrEqual(121);
    expect(JSON.stringify(r.trace).length).toBeLessThan(2_000_000); // about 800,000 today; uncapped names made 50,000,000
    // 40 long strings per frame: the 4,000,000-character budget stops the trace with its note
    const decls = Array.from({ length: 40 }, (_, i) => `let s${i} = String(repeating: "y", count: 400)`).join('\n');
    const w = await run(`${decls}\nvar n = 0\nwhile n < 3000 { n += 1 }\nprint(n)`, { trace: true });
    expect(w.stdout).toBe('3000\n');
    expect(w.trace[w.trace.length - 1].vars['…']).toContain('trace stopped');
    expect(JSON.stringify(w.trace).length).toBeLessThan(4_500_000);
  });

  it('a ?? default takes the wrapped type of subscripts, properties, optional chains and calls (checked against swiftc 6.2)', async () => {
    for (const [src, want] of [
      ["import CoreGraphics\nlet d: [String: Float] = [:]\nlet x = d[\"missing\"] ?? 0.1\nprint(type(of: x), x)\nvar e = [\"a\": Float(0.5)]\nlet y = e[\"b\"] ?? 0.1\nprint(type(of: y), y)\nstruct S { var p: Float? = nil; var c: CGFloat? = nil\n  func m() -> Float { p ?? 0.25 } }\nlet s = S()\nprint(type(of: s.p ?? 0.1), s.p ?? 0.1, type(of: s.c ?? 0.5), s.m())\nclass K { var q: Float? }\nlet k: K? = K()\nprint(type(of: k?.q ?? 0.3), k?.q ?? 0.3)\nfunc f() -> Float? { nil }\nprint(type(of: f() ?? 0.1), f() ?? 0.5)\nlet nilFloat: Float? = nil\nlet arr: [Float?] = [nil]\nprint(type(of: arr[0] ?? 0.1))", "Float 0.1\nFloat 0.1\nFloat 0.1 CGFloat 0.25\nFloat 0.3\nFloat 0.5\nFloat\n"],
      ["let n: Float? = nil\nlet v = n ?? (1 / 2)\nprint(v, type(of: v))", "0.5 Float\n"],
      ["let n: Float? = nil\nlet v = n ?? (1 / 0)\nprint(v)", "inf\n"],
      ["let n: Float? = nil\nlet v = n ?? 1 / 3\nprint(v, type(of: v))", "0.33333334 Float\n"],
      ["let n: Float? = nil\nlet v = n ?? 2\nprint(v, type(of: v))", "2.0 Float\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });

  it('a user-defined value or unknown member where Double, Float or CGFloat is declared is swiftc\'s error', async () => {
    for (const [src, msg, line] of [
      ["import CoreGraphics\nstruct Item {}\nlet f: Float = Item()", "cannot convert value of type 'Item' to specified type 'Float'", 3],
      ["import CoreGraphics\nclass K {}\nfunc g(_ c: CGFloat) {}\ng(K())", "cannot convert value of type 'K' to expected argument type 'CGFloat'", 4],
      ["import CoreGraphics\nenum E { case a }\nlet f: Float = E.a", "cannot convert value of type 'E' to specified type 'Float'", 3],
      ["import CoreGraphics\nstruct Item {}\nfunc r() -> Float { Item() }\nprint(r())", "cannot convert return expression of type 'Item' to return type 'Float'", 3],
      ["import CoreGraphics\nstruct Item {}\nvar f: Float = 1\nf = Item()", "cannot assign value of type 'Item' to type 'Float'", 4],
      ["import CoreGraphics\nstruct Item {}\nlet d: Double = Item()", "cannot convert value of type 'Item' to specified type 'Double'", 3],
      ["import CoreGraphics\nenum E { case a }\nlet c: CGFloat = .a", "type 'CGFloat' has no member 'a'", 3],
      ["import CoreGraphics\nstruct P { var x: Float }\nstruct Item {}\nprint(P(x: Item()).x)", "cannot convert value of type 'Item' to expected argument type 'Float'", 4],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });
});

describe('review pass 14: ?? passed as Any follows swiftc', () => {
  it('a ?? default takes Float from a method call on an inferred receiver and from a temporary\'s property (checked against swiftc 6.2)', async () => {
    expect(await ok("struct S { var f: Float? = nil; func make() -> Float? { nil } }\nlet s = S(); let x = s.make() ?? 0.1; let y = S().f ?? 0.1; print(type(of: x), type(of: y))\nclass K { var c: Float? = nil; func g() -> Float? { nil }; static func mk() -> K { K() } }\nlet k = K()\nprint(type(of: k.g() ?? 0.1), type(of: K().g() ?? 0.1), type(of: K.mk().c ?? 0.1), type(of: S().make() ?? 0.1))\nvar o: S? = S()\nprint(type(of: o?.make() ?? 0.1), type(of: o?.f ?? 0.1))")).toBe('Float Float\nFloat Float Float Float\nFloat Float\n');
  });

  it('a builtin collection constructor keeps its written generic arguments (checked against swiftc 6.2)', async () => {
    expect(await ok('var fs = Set<Float>()\nfs.insert(0.1)\nprint(type(of: fs.first!), type(of: fs), fs.contains(0.1))\nvar d = Dictionary<String, Float>()\nd["a"] = 0.1\nprint(type(of: d), type(of: d["a"]!))\nvar a = Array<Float>()\na.append(0.1)\nprint(type(of: a), type(of: a[0]), a)\nlet s2 = Set<Int>([1, 2])\nprint(type(of: s2), s2.count)'))
      .toBe('Float Set<Float> true\nDictionary<String, Float> Float\nArray<Float> Float [0.1]\nSet<Int> 2\n');
  });

  it('integer-literal arithmetic after ?? stays Int where Any is expected; lone literals and generic contexts take the wrapped type', async () => {
    // outputs checked against swiftc 6.2 (print/debugPrint items, [Any] elements, as Any, Any parameters)
    for (const [src, want] of [
      ["let n: Float? = nil\nprint(n ?? (1 / 2))\nprint(\"\\(n ?? 0.1)\")\nlet a: [Any] = [n ?? 1]\nprint(a)", "0\n0.1\n[1.0]\n"],
      ["import CoreGraphics\nlet n: Float? = nil\nprint(n ?? (1 / 2))\nprint(\"\\(n ?? 0.1)\")\nlet a: [Any] = [n ?? 1]\nprint(a)\nprint(n ?? 1, n ?? 0.1, n ?? 2.5, n ?? (1 + 1))\nprint(type(of: n ?? 1), type(of: n ?? 0.1))\ndebugPrint(n ?? 1, n ?? 0.5)\nprint(\"\\(n ?? 1) \\(n ?? (3 / 2)) \\(n ?? 1.5)\")\nlet x = n ?? 1 as Any\nprint(x)\nlet b: [Any] = [n ?? 0.1, n ?? (1 / 2)]\nprint(b)\nlet d: Double? = nil\nprint(d ?? 1, d ?? (1 / 2), \"\\(d ?? 2)\")\nlet c: CGFloat? = nil\nprint(c ?? 1, c ?? (1 / 2))\nlet i: Int? = nil\nprint(i ?? 2)\nlet g: Float? = 0.25\nprint(g ?? 1, g ?? (1 / 2))", "0\n0.1\n[1.0]\n1.0 0.1 2.5 2\nFloat Float\n1.0 0.5\n1.0 1.5 1.5\n1\n[0.1, 0]\n1.0 0 2.0\n1.0 0\n2\n0.25 0.25\n"],
      ["let n: Float? = nil\nprint(n ?? -1, n ?? (2), n ?? -(1), n ?? 2 * 3, n ?? 1.5 * 2, n ?? -(1 / 2))\nlet b: [Any] = [n ?? 1.5 * 2, n ?? -1, n ?? (1 / 2)]\nprint(type(of: b[0]), type(of: b[1]), type(of: b[2]))\nlet x = (n ?? (1 / 2)) as Any\nprint(x, type(of: x))\nfunc f(_ v: Any) { print(v) }\nf(n ?? (1 / 2))\nf(n ?? 1)\nlet y: Any = n ?? (1 / 2)\nprint(y)\nlet z: Any? = n ?? (1 / 2)\nprint(z!)\nprint(n ?? 0.5 + 0.25, n ?? 1 / 2 * 3)\ndebugPrint(n ?? (1 / 2))\nprint([n ?? (1 / 2)])\nprint((n ?? (1 / 2), 1))", "-1.0 2.0 -1.0 6 3.0 0\nFloat Float Int\n0 Int\n0\n1.0\n0\n0\n0.75 0\n0\n[0.5]\n(0.5, 1)\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });
});

describe('review: a closure captures only the outer variables it uses', () => {
  it('shorthand if let / guard let / while let reads the outer variable, so the closure captures it (checked against swiftc 6.2)', async () => {
    for (const [src, want] of [
      ["class Node { deinit { print(\"deinit\") } }\nfunc make() -> () -> Void { let n: Node? = Node(); return { if let n { print(\"alive\") } } }\nlet f = make(); print(\"after make\"); f()", "after make\nalive\n"],
      ["class Node { let id: Int; init(_ id: Int) { self.id = id }; deinit { print(\"deinit\", id) } }\nfunc mk() -> [() -> Void] {\n  let a: Node? = Node(1), b: Node? = Node(2), c: Node? = Node(3)\n  return [\n    { guard let a else { return }; print(\"guard\", a.id) },\n    { var i = 0; while let b, i < 1 { print(\"while\", b.id); i += 1 } },\n    { if let c, c.id > 0 { print(\"if\", c.id) } },\n  ]\n}\nvar fs: [() -> Void]? = mk()\nprint(\"after mk\")\nfor f in fs! { f() }\nfs = nil\nprint(\"end\")", "after mk\nguard 1\nwhile 2\nif 3\ndeinit 1\ndeinit 2\ndeinit 3\nend\n"],
      ["struct Counter {\n  var label: String? = \"hits\"\n  func reporter() -> () -> String { { if let label { return label } else { return \"none\" } } }\n}\nvar c = Counter()\nlet r = c.reporter()\nc.label = nil\nprint(r(), c.label as Any)", "hits nil\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });

  it('names a closure declares itself are not captures; a use before a shadowing declaration is (checked against swiftc 6.2)', async () => {
    for (const [src, want] of [
      ["class Box { deinit { print(\"freed\") } }\nvar fn: (() -> Void)? = nil\ndo { let item = Box(); fn = { let item = 42; print(item) } }\nprint(\"after scope\")", "freed\nafter scope\n"],
      ["class Box { let n: Int; init(_ n: Int) { self.n = n }; deinit { print(\"freed\", n) } }\nvar fn: (() -> Void)? = nil\ndo { let item = Box(1); fn = { print(item.n); let item = 42; print(item) } }\nprint(\"after scope\")\nfn?()\nfn = nil\nprint(\"end\")", "after scope\n1\n42\nfreed 1\nend\n"],
      ["class Box { let n: Int; init(_ n: Int) { self.n = n }; deinit { print(\"freed\", n) } }\nvar fn: (() -> Void)? = nil\ndo {\n  let item = Box(1)\n  fn = { if true { let item = 0; print(item) }; print(item.n) }\n}\nprint(\"after scope\")\nfn = nil\nprint(\"end\")", "after scope\nfreed 1\nend\n"],
      ["class Box { let n: Int; init(_ n: Int) { self.n = n }; deinit { print(\"freed\", n) } }\nvar fns: [() -> Void] = []\ndo {\n  let a = Box(1), b = Box(2), c = Box(3), d = Box(4), e = Box(5), g = Box(6)\n  fns.append { for a in [1, 2] { print(a) } }\n  fns.append { if let b = Optional(7) { print(b) } }\n  fns.append { [1].forEach { c in print(c) } }\n  fns.append { func inner(d: Int) -> Int { d }; print(inner(d: 3)) }\n  fns.append { do { throw NSErrorLike() } catch let e { print(e is NSErrorLike) } }\n  fns.append { guard let g = Optional(9) else { return }; print(g) }\n}\nstruct NSErrorLike: Error {}\nprint(\"after scope\")\nfor f in fns { f() }", "freed 6\nfreed 5\nfreed 4\nfreed 3\nfreed 2\nfreed 1\nafter scope\n1\n2\n7\n1\n3\ntrue\n9\n"],
      ["class Box { let n: Int; init(_ n: Int) { self.n = n }; deinit { print(\"freed\", n) } }\ndo {\n  let a = Box(1)\n  let b = Box(2)\n  let c = Box(3), d = Box(4)\n  print(a.n + b.n + c.n + d.n)\n}\nprint(\"after\")", "10\nfreed 4\nfreed 3\nfreed 2\nfreed 1\nafter\n"],
      ["class Box { let n: Int; init(_ n: Int) { self.n = n }; deinit { print(\"freed\", n) } }\nfunc f() {\n  let a = Box(1)\n  let b = Box(2)\n  print(a.n + b.n)\n}\nf()\nfunc g(_ p: Box) { let q = Box(9); print(p.n, q.n) }\ng(Box(8))\nprint(\"end\")", "3\nfreed 2\nfreed 1\n8 9\nfreed 9\nfreed 8\nend\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });
});

describe('review: builtin types in casts, integer-only compound operators on floating point', () => {
  it('is / as? recognise UUID, URL, Date, Data, Set, Range and their conformances (checked against swiftc 6.2)', async () => {
    expect(await ok("import Foundation\nlet u = UUID(), url = URL(string: \"https://a.b\")!, dt = Date(timeIntervalSince1970: 0), data = Data([1, 2])\nlet s: Set<Int> = [1], r = 0..<3, cr = 1...2, dec = JSONDecoder(), enc = JSONEncoder()\nlet items: [Any] = [u, url, dt, data, s, r, cr, dec, enc]\nprint(items.map { $0 is UUID }, items.map { $0 is URL }, items.map { $0 is Date }, items.map { $0 is Data })\nprint(items.map { $0 is Set<Int> }, items.map { $0 is Range<Int> }, items.map { $0 is ClosedRange<Int> }, items.map { $0 is JSONDecoder })\nprint(items.map { $0 is any Hashable }, items.map { $0 is any Equatable }, items.map { $0 is any Codable })\nprint(items.compactMap { $0 as? UUID }.count, items.compactMap { $0 as? URL }.first!.absoluteString, (items[2] as? Date) == dt)\nprint(items.map { $0 is any Comparable }, items[4] is Set<String>, items[5] is Range<Double>)")).toBe("[true, false, false, false, false, false, false, false, false] [false, true, false, false, false, false, false, false, false] [false, false, true, false, false, false, false, false, false] [false, false, false, true, false, false, false, false, false]\n[false, false, false, false, true, false, false, false, false] [false, false, false, false, false, true, false, false, false] [false, false, false, false, false, false, true, false, false] [false, false, false, false, false, false, false, true, false]\n[true, true, true, true, true, true, true, false, false] [true, true, true, true, true, true, true, false, false] [true, true, true, true, true, true, true, false, false]\n1 https://a.b true\n[true, false, true, false, false, false, false, false, false] false false\n");
  });

  it('integer-only compound operators on a floating-point variable give swiftc\'s errors', async () => {
    for (const [src, msg, line] of [
      ["var f: Float = 1\nf &+= 1", "binary operator '&+=' cannot be applied to operands of type 'Float' and '_'", 2],
      ["var d = 1.5\nd %= 1", "'%=' is unavailable: For floating point numbers use formTruncatingRemainder instead", 2],
      ["var d = 1.5\nlet i = 2\nd <<= i", "binary operator '<<=' cannot be applied to operands of type 'Double' and 'Int'", 3],
      ["var d = 1.5\nlet e = 2.0\nd &+= e", "binary operator '&+=' cannot be applied to two 'Double' operands", 3],
      ["var d = 1.5\nlet i = 2\nd &+= i", "binary operator '&+=' cannot be applied to operands of type 'Double' and '_'", 3],
      ["var d = 1.5\nd &+= 1", "binary operator '&+=' cannot be applied to operands of type 'Double' and '_'", 2],
      ["var d = 1.5\nd &= 1", "binary operator '&=' cannot be applied to operands of type 'Double' and '_'", 2],
      ["var d = 1.5\nd |= 1", "binary operator '|=' cannot be applied to operands of type 'Double' and '_'", 2],
      ["var d = 1.5\nd >>= 1", "binary operator '>>=' cannot be applied to operands of type 'Double' and 'Int'", 2],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });
});

describe('review: typed collections keep their full generic element types', () => {
  it('a typed literal stores Optional<Int>, Array<Int>... and casts check them (checked against swiftc 6.2)', async () => {
    expect(await ok('let a: [Int?] = []\nlet b: [String: [Int]] = [:]\nlet c: Set<[Int]> = []\nvar e: [Int?] = [1, nil]\ne[0] = nil\nlet items: [Any] = [a, b]\nprint(type(of: a), type(of: b), type(of: c), e, items[0] is [Int?], items[0] is [Int], items[1] is [String: [Int]])'))
      .toBe('Array<Optional<Int>> Dictionary<String, Array<Int>> Set<Array<Int>> [nil, nil] true true true\n');
  });
});

describe('review: Character, Substring and ArraySlice are their own types', () => {
  it('literals, iteration, conversions, comparisons, casts and slice indices behave as in swiftc 6.2', async () => {
    for (const [src, want] of [
      ["let s = \"hello\"\nlet c: Character = \"a\"\nlet sub = s.prefix(3)\nprint(type(of: c), type(of: sub), type(of: s.first!), \"\\(c)\\(sub)\", sub == \"hel\", sub == s, c == \"a\")\nvar counts: [Character: Int] = [:]\nfor ch in s { counts[ch, default: 0] += 1 }\nprint(counts[\"l\"]!, type(of: counts), counts[\"h\"] as Any)\nlet arr = [10, 20, 30, 40]\nlet sl = arr[1...2]\nprint(sl[1], sl[2], sl.startIndex, sl.endIndex, type(of: sl), sl.count)\nfor (i, x) in sl.enumerated() { print(i, x) }\nfor i in sl.indices { print(i, sl[i]) }\nlet items: [Any] = [c, sub, sl, s]\nprint(items.map { $0 is Character }, items.map { $0 is Substring }, items.map { $0 is String }, items.map { $0 is ArraySlice<Int> })\nprint(String(sub) + \"!\", String(c) + s, s + String(c))\nvar t = \"ab\"\nt.append(c)\nprint(t, t.contains(c), Array(s).count, type(of: Array(s)))\nlet chars: [Character] = [\"x\", \"y\"]\nprint(chars, type(of: chars), String(chars))\nprint(sl.first!, sl.last!, Array(sl), sl.map { $0 * 2 })", "Character Substring Character ahel true false true\n2 Dictionary<Character, Int> Optional(1)\n20 30 1 3 ArraySlice<Int> 2\n0 20\n1 30\n1 20\n2 30\n[true, false, false, false] [false, true, false, false] [false, false, false, true] [false, false, true, false]\nhel! ahello helloa\naba true 5 Array<Character>\n[\"x\", \"y\"] Array<Character> xy\n20 30 [20, 30] [40, 60]\n"],
      ["let sub = \"abc\".prefix(2)\nlet s = \"x\"\nprint(sub + s, type(of: sub + s), sub + sub, type(of: sub + sub))", "abx Substring abab Substring\n"],
      ["let sl = [1, 2, 3][1...]\nlet items: [Any] = [sl]\nprint(items[0] is [Int], items[0] is ArraySlice<Int>)", "false true\n"],
      ["let s = \"a1b2\"\nvar out = \"\"\nfor ch in s where ch.isLetter { out.append(ch) }\nprint(out, s.filter { $0.isNumber })", "ab 12\n"],
      ["let c: Character = \"a\"\nprint(c < \"b\", c == \"a\", \"\\(c)!\", [c], String(repeating: c, count: 3))", "true true a! [\"a\"] aaa\n"],
      ["let s = \"ab\"\nlet c: Character = \"a\"\nprint(s.first == c, s.contains(c), s.firstIndex(of: c) != nil)", "true true true\n"],
      ["let words = \"a b\".split(separator: \" \")\nprint(words, type(of: words), words.map { String($0) })", "[\"a\", \"b\"] Array<Substring> [\"a\", \"b\"]\n"],
      ["func g(_ c: Character) { print(c) }\ng(\"a\")\nlet cs: Set<Character> = [\"a\", \"b\"]\nprint(cs.contains(\"a\"), type(of: cs))", "a\ntrue Set<Character>\n"],
      ["var a = [1, 2, 3]\nprint(a, a.removeLast(), a)", "[1, 2, 3] 3 [1, 2]\n"],
      ["var s = \"ab\"\nlet sub = \"cd\".prefix(1)\ns += sub\nprint(s)", "abc\n"],
      ["let s = \"ab\"\nlet sub = \"cd\".prefix(1)\nprint(s + sub, type(of: s + sub))", "abc String\n"],
      ["let sub = \"hello\".prefix(2)\nlet c = sub.first!\nlet x: Substring = \"lit\"\nprint(c, x, type(of: x), sub < \"z\")", "h lit Substring true\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });

  it('String and Substring extend with Substrings, literals and Character arrays, keeping the left side\'s type (checked against swiftc 6.2)', async () => {
    expect(await ok("let s = \"ab\", w = \"hello\"\nlet sub = s.dropFirst()\nlet c: Character = \"c\"\nprint(String(w.prefix(1)).uppercased() + w.dropFirst())\nprint(s + sub, type(of: s + sub), sub + s, type(of: sub + s), sub + sub, type(of: sub + sub))\nprint(s + [c], type(of: s + [c]), \"x\" + sub, type(of: \"x\" + sub), sub + \"x\", type(of: sub + \"x\"))\nvar t = \"t\"\nt += sub\nvar u = sub\nu += \"y\"\nprint(t, u, type(of: u), sub + [c], type(of: sub + [c]))\nvar v = \"v\"\nv += [c, c]\nprint(v)")).toBe("Hello\nabb String bab Substring bb Substring\nabc String xb String bx Substring\ntb by Substring bc Substring\nvcc\n");
  });

  it('text keys of the wrong type and Substring-returning calls in String contexts get swiftc\'s wording', async () => {
    // every message and line checked against swiftc 6.2 ('subscript ' keeps swiftc's trailing space)
    for (const [src, msg, line] of [
      ["var counts: [String: Int] = [:]\nfor word in \"a b a\".split(separator: \" \") { counts[word, default: 0] += 1 }\nprint(counts)", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 2],
      ["let s: String = \"ab\".dropFirst()", "no 'dropFirst' candidates produce the expected contextual result type 'String'", 1],
      ["func f(_ s: String) {}\nf(\"ab\".dropFirst())", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 2],
      ["var counts = [String: Int]()\nlet w = \"ab\".prefix(1)\nprint(counts[w] as Any)", "no exact matches in call to subscript ", 3],
      ["var d: [String: Int] = [\"a\": 1]\nlet c: Character = \"a\"\nprint(d[c] as Any)", "no exact matches in call to subscript ", 3],
      ["var d: [String: Int] = [:]\nlet w = \"ab\".prefix(1)\nd[w] = 1", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 3],
      ["var d: [Character: Int] = [:]\nlet s = \"a\"\nprint(d[s] as Any)", "no exact matches in call to subscript ", 3],
      ["var d: [String: Int] = [:]\nlet c: Character = \"a\"\nd[c, default: 0] += 1", "cannot convert value of type 'Character' to expected argument type 'String'", 3],
      ["var d: [Substring: Int] = [:]\nlet s = \"a\"\nprint(d[s] as Any)", "no exact matches in call to subscript ", 3],
      ["var d: [String: Int] = [:]\nlet w: Substring = \"a\"\nprint(d[w] as Any)", "no exact matches in call to subscript ", 3],
      ["var d = [\"a\": 1]\nlet w = \"ab\".prefix(1)\nprint(d[w] as Any)", "no exact matches in call to subscript ", 3],
      ["var d: [String: Int] = [:]\nlet w: Substring = \"a\"\nd[w, default: 0] += 1", "cannot convert value of type 'Substring' to expected argument type 'String'", 3],
      ["var t = \"x\"\nt = \"ab\".dropFirst()", "no 'dropFirst' candidates produce the expected contextual result type 'String'", 2],
      ["let s: String = \"ab\".suffix(1)", "no 'suffix' candidates produce the expected contextual result type 'String'", 1],
      ["let s: String = \"a b\".split(separator: \" \")[0]", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to specified type 'String'", 1],
      ["var t = \"x\"\nlet w = \"ab\".dropFirst()\nt = w", "cannot assign value of type 'String.SubSequence' (aka 'Substring') to type 'String'", 3],
      ["func g() -> String { \"ab\".dropFirst() }\nprint(g())", "no 'dropFirst' candidates produce the expected contextual result type 'String'", 1],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });

  it('a Substring or Character key checks against the declared key or element type (the lesson\'s counts[word, default: 0])', async () => {
    // every message and line checked against swiftc 6.2
    for (const [src, msg, line] of [
      ["var counts: [String: Int] = [:]\nfor word in \"a b a\".split(separator: \" \") { counts[word, default: 0] += 1 }\nprint(counts)", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 2],
      ["var d: [String: Int] = [:]\nlet w = \"ab\".prefix(1)\nd.updateValue(1, forKey: w)", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 3],
      ["var d: [String: Int] = [:]\nlet w = \"ab\".prefix(1)\nd.removeValue(forKey: w)", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 3],
      ["var s: Set<String> = []\nlet w = \"ab\".prefix(1)\ns.insert(w)", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 3],
      ["var s: Set<String> = []\nlet w = \"ab\".prefix(1)\nprint(s.contains(w))", "instance method 'contains' requires the types 'String' and 'Substring.Element' (aka 'Character') be equivalent", 3],
      ["var s: Set<String> = []\nlet w = \"ab\".prefix(1)\ns.remove(w)", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 3],
      ["var s: Set<Character> = []\nlet t = \"a\"\ns.insert(t)", "cannot convert value of type 'String' to expected argument type 'Character'", 3],
      ["var d: [Character: Int] = [:]\nlet t = \"a\"\nd.updateValue(1, forKey: t)", "cannot convert value of type 'String' to expected argument type 'Character'", 3],
      ["var d: [String: Int] = [:]\nlet c: Character = \"a\"\nd.removeValue(forKey: c)", "cannot convert value of type 'Character' to expected argument type 'String'", 3],
      ["var d: [String: Int] = [:]\nlet w = \"ab\".prefix(1)\nd[w] += 1", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 3],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
    // a String is a sequence of Characters, so Set<Character>.contains(string) type-checks
    expect(await ok("var s: Set<Character> = []\nlet t = \"a\"\nprint(s.contains(t))")).toBe("false\n");
    // constructors keep the full element type (fix-lang2's construct with writtenTypeName)
    expect(await ok("print(type(of: [Int?]()), type(of: [String: Int?]()), type(of: Set<Int?>()), type(of: [[Int]?]()), type(of: [String: [Int]]()))\nlet a: [Int?] = []\nlet b: [String: [Int]] = [:]\nlet c: Set<[Int]> = []\nvar e: [Int?] = [1, nil]\ne[0] = nil\nlet items: [Any] = [a, b]\nprint(type(of: a), type(of: b), type(of: c), e, items[0] is [Int?], items[0] is [Int], items[1] is [String: [Int]])")).toBe("Array<Optional<Int>> Dictionary<String, Optional<Int>> Set<Optional<Int>> Array<Optional<Array<Int>>> Dictionary<String, Array<Int>>\nArray<Optional<Int>> Dictionary<String, Array<Int>> Set<Array<Int>> [nil, nil] true true true\n");
  });

  it('mixing String with Character, Substring or ArraySlice is the error swiftc reports', async () => {
    for (const [src, msg, line] of [
      ["func f(_ s: String) {}\nlet sub = \"hello\".prefix(2)\nf(sub)", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'", 3],
      ["let c: Character = \"a\"\nlet s: String = c", "cannot convert value of type 'Character' to specified type 'String'", 2],
      ["let s = \"ab\"\nlet c: Character = \"c\"\nprint(s + c)", "cannot convert value of type 'Character' to expected argument type 'String'", 3],
      ["let c: Character = \"ab\"", "cannot convert value of type 'String' to specified type 'Character'", 1],
      ["func f(_ s: String) {}\nlet c: Character = \"a\"\nf(c)", "cannot convert value of type 'Character' to expected argument type 'String'", 3],
      ["let sub = \"hello\".prefix(2)\nlet s: String = sub", "cannot convert value of type 'String.SubSequence' (aka 'Substring') to specified type 'String'", 2],
      ["func g() -> String { let sub = \"hi\".prefix(1); return sub }\nprint(g())", "cannot convert return expression of type 'String.SubSequence' (aka 'Substring') to return type 'String'", 1],
      ["var s = \"x\"\nlet c: Character = \"c\"\ns = c", "cannot assign value of type 'Character' to type 'String'", 3],
      ["let c: Character = \"a\"\nlet d: Character = \"b\"\nprint(c + d)", "binary operator '+' cannot be applied to two 'Character' operands", 3],
      ["let s = \"ab\"\nlet c: Character = \"c\"\nprint(s == c)", "binary operator '==' cannot be applied to operands of type 'String' and 'Character'", 3],
      ["let arr = [1, 2, 3]\nlet sl = arr[1...]\nlet a: [Int] = sl", "cannot convert value of type 'Array<Int>.SubSequence' (aka 'ArraySlice<Int>') to specified type '[Int]'", 3],
      ["func h(_ a: [Int]) {}\nlet sl = [1, 2, 3][1...]\nh(sl)", "cannot convert value of type 'Array<Int>.SubSequence' (aka 'ArraySlice<Int>') to expected argument type '[Int]'", 3],
      ["func f(_ s: String) {}\nlet sub: Substring = \"ab\"\nf(sub)", "cannot convert value of type 'Substring' to expected argument type 'String'", 3],
      ["let c: Character = \"a\"\nlet sub = \"abc\".prefix(1)\nprint(c == sub)", "binary operator '==' cannot be applied to operands of type 'Character' and 'String.SubSequence' (aka 'Substring')", 3],
      ["var s = \"ab\"\nlet c: Character = \"c\"\ns += c", "cannot convert value of type 'Character' to expected argument type 'String'", 3],
      ["let sl: ArraySlice<Int> = [1, 2]\nlet a: [Int] = sl", "cannot convert value of type 'ArraySlice<Int>' to specified type '[Int]'", 2],
      ["func g(_ c: Character) {}\ng(\"ab\")", "cannot convert value of type 'String' to expected argument type 'Character'", 2],
      ["let c: Character = \"a\"\nlet s = \"b\"\nprint(c + s)", "cannot convert value of type 'Character' to expected argument type 'String'", 3],
      ["let sub = \"abc\".prefix(1)\nlet c: Character = \"z\"\nprint(sub + c)", "binary operator '+' cannot be applied to operands of type 'String.SubSequence' (aka 'Substring') and 'Character'", 3],
      ["let c: Character = \"a\"\nprint(c + \"b\")", "cannot convert value of type 'Character' to expected argument type 'String'", 2],
      ["let s = \"ab\"\nlet c: Character = \"a\"\nprint(s < c)", "binary operator '<' cannot be applied to operands of type 'String' and 'Character'", 3],
      ["let sub: Substring = \"a\"\nlet c: Character = \"a\"\nprint(sub == c)", "binary operator '==' cannot be applied to operands of type 'Substring' and 'Character'", 3],
      ["let a: [String] = [\"x\"]\nlet c: Character = \"c\"\nlet b: [String] = [c]", "cannot convert value of type 'Character' to expected element type 'String'", 3],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });
});

describe('review: assignments through subscripts, arrays of Substrings, reversed collections in Array slots', () => {
  it('reports swiftc\'s wording for subscript assignments and [String] / [Substring] mixes', async () => {
    // every message and line checked against swiftc 6.2
    for (const [src, msg, line] of [
      ["var list: [String] = []\nlet words = \"a b\".split(separator: \" \")\nlist += words", "binary operator '+=' cannot be applied to operands of type '[String]' and '[String.SubSequence]' (aka 'Array<Substring>')", 3],
      ["var list: [String] = []\nlet words = \"a b\".split(separator: \" \")\nlist = words", "cannot assign value of type '[String.SubSequence]' (aka 'Array<Substring>') to type '[String]'", 3],
      ["var list: [String] = [\"x\"]\nlet w = \"ab\".prefix(1)\nlist[0] = w", "cannot assign value of type 'String.SubSequence' (aka 'Substring') to subscript of type 'String'", 3],
      ["var list: [String] = [\"x\"]\nlist[0] = 5", "cannot assign value of type 'Int' to subscript of type 'String'", 2],
      ["var list: [String] = []\nlet words: [Substring] = [\"a\"]\nlist += words", "binary operator '+=' cannot be applied to operands of type '[String]' and '[Substring]'", 3],
      ["var list: [String] = []\nlet words: [Substring] = [\"a\"]\nlist = words", "cannot assign value of type '[Substring]' to type '[String]'", 3],
      ["var d: [String: Int] = [:]\nd[\"a\"] = \"x\"", "cannot assign value of type 'String' to subscript of type 'Int'", 2],
      ["var list = [\"x\"]\nlet words = \"a b\".split(separator: \" \")\nlist = words", "cannot assign value of type '[String.SubSequence]' (aka 'Array<Substring>') to type '[String]'", 3],
      ["var list: [Int] = [1]\nlist[0] = 2.5", "cannot assign value of type 'Double' to subscript of type 'Int'", 2],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });

  it('a ReversedCollection becomes an Array where an Array is declared or held, and stays one elsewhere', async () => {
    // the reversed value is injected, so this half does not depend on builtins producing it
    const { SReversed } = await import('../../src/engine/values.js');
    const out = [];
    const interp = new Interp({ builtins: getBuiltins(), write: (x) => out.push(x) });
    interp.globals.declare('rev', new SReversed([3, 2, 1], 'Int', null), true);
    const src = 'func f(_ x: [Int]) -> [Int] { x }\nfunc g() -> [Int] { rev }\nlet r: [Int] = rev\nvar b = [0]\nb = rev\nb.append(9)\nstruct S { var v: [Int] }\nprint(f(rev), g(), r, b, S(v: rev).v, type(of: r), type(of: b), type(of: g()))';
    const main = interp.scheduler.spawn(interp.runProgram(parse(src)), 'main');
    await interp.scheduler.drive(() => main.done);
    expect(main.error).toBeNull();
    expect(out.join('')).toBe('[3, 2, 1] [3, 2, 1] [3, 2, 1] [3, 2, 1, 9] [3, 2, 1] Array<Int> Array<Int> Array<Int>\n');
  });
});

describe('review: a Character or array from a String is spelled as its Element in diagnostics', () => {
  it('String.Element / Substring.Element / [String.Element] where swiftc says so, plain Character elsewhere', async () => {
    // every message and line checked against swiftc 6.2
    for (const [src, msg, line] of [
      ["let s = \"abc\"\nlet t: String = s.first!", "cannot convert value of type 'String.Element' (aka 'Character') to specified type 'String'", 2],
      ["let s = \"abc\"\nfunc f(_ x: String) {}\nf(s.first!)", "cannot convert value of type 'String.Element' (aka 'Character') to expected argument type 'String'", 3],
      ["let s = \"abc\"\nfor ch in s { let t: String = ch }", "cannot convert value of type 'Character' to specified type 'String'", 2],
      ["let s = \"abc\"\nlet c = s.first!\nlet t: String = c", "cannot convert value of type 'String.Element' (aka 'Character') to specified type 'String'", 3],
      ["let s = \"abc\"\nlet t: String = s[s.startIndex]", "cannot convert value of type 'Character' to specified type 'String'", 2],
      ["let s = \"abc\"\nprint(s + s.first!)", "cannot convert value of type 'String.Element' (aka 'Character') to expected argument type 'String'", 2],
      ["let s = \"abc\"\nvar d: [String: Int] = [:]\nfor ch in s { d[ch, default: 0] += 1 }", "cannot convert value of type 'Character' to expected argument type 'String'", 3],
      ["let s = \"abc\"\nvar t = \"x\"\nt = s.last!", "cannot assign value of type 'String.Element' (aka 'Character') to type 'String'", 3],
      ["let s = \"abc\"\nlet c: Character = \"z\"\nfunc f(_ x: String) {}\nf(c)", "cannot convert value of type 'Character' to expected argument type 'String'", 4],
      ["let s = \"abc\"\nlet arr = Array(s)\nlet t: [String] = arr", "cannot assign value of type '[String.Element]' (aka 'Array<Character>') to type '[String]'", 3],
      ["let s = \"abc\"\nfor ch in s { print(ch == s) }", "binary operator '==' cannot be applied to operands of type 'Character' and 'String'", 2],
      ["let s = \"abc\"\nvar list: [String] = []\nfor ch in s { list.append(ch) }", "cannot convert value of type 'Character' to expected argument type 'String'", 3],
      ["let s = \"abc\"\nlet t: [String] = Array(s)", "missing argument label 'arrayLiteral:' in call", 2],
      ["let t: [String] = \"a b\".split(separator: \" \")", "no 'split' candidates produce the expected contextual result type '[String]'", 1],
      ["let w = \"a b\".split(separator: \" \")\nlet t: [String] = w", "cannot assign value of type '[String.SubSequence]' (aka 'Array<Substring>') to type '[String]'", 2],
      ["let w = \"a b\".split(separator: \" \")\nfunc f(_ x: [String]) {}\nf(w)", "cannot convert value of type '[String.SubSequence]' (aka 'Array<Substring>') to expected argument type '[String]'", 3],
      ["let w = \"a b\".split(separator: \" \")\nfunc g() -> [String] { w }\nprint(g())", "cannot convert return expression of type '[String.SubSequence]' (aka 'Array<Substring>') to return type '[String]'", 2],
      ["let s = \"ab\"\nlet arr = Array(s)\nfunc f(_ x: [String]) {}\nf(arr)", "cannot convert value of type '[String.Element]' (aka 'Array<Character>') to expected argument type '[String]'", 4],
      ["let words: [Substring] = [\"a\"]\nlet t: [String] = words", "cannot assign value of type '[Substring]' to type '[String]'", 2],
      ["let s = \"ab\"\nlet c = s.first!\nlet d = c\nlet t: String = d", "cannot convert value of type 'String.Element' (aka 'Character') to specified type 'String'", 4],
      ["let s = \"ab\"\nlet arr = Array(s)\nvar list: [String] = []\nlist = arr", "cannot assign value of type '[String.Element]' (aka 'Array<Character>') to type '[String]'", 4],
      ["let s = \"ab\"\nvar list: [String] = []\nlist += Array(s)", "binary operator '+=' cannot be applied to operands of type '[String]' and '[String.Element]' (aka 'Array<Character>')", 3],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });
});

describe('review: Set elements and Dictionary keys must be Hashable', () => {
  it('a function type in a Set element or Dictionary key annotation is swiftc\'s error, even unused', async () => {
    // every message and line checked against swiftc 6.2
    for (const [src, msg, line] of [
      ["var s: Set<() -> Void> = []", "type '() -> Void' does not conform to protocol 'Hashable'", 1],
      ["var d: [() -> Void: Int] = [:]", "type '() -> Void' does not conform to protocol 'Hashable'", 1],
      ["let s: Set<(Int) -> Int>", "type '(Int) -> Int' does not conform to protocol 'Hashable'", 1],
      ["func f(_ s: Set<() -> Void>) {}", "type '() -> Void' does not conform to protocol 'Hashable'", 1],
      ["struct S { var s: Set<() -> Void> = [] }", "type '() -> Void' does not conform to protocol 'Hashable'", 1],
      ["var s: Set<[() -> Void]> = []", "type '() -> Void' does not conform to protocol 'Hashable'", 1],
    ]) {
      const r = await fails(src);
      expect([src, r.stdout, r.error]).toEqual([src, '', { message: msg, line, kind: 'compile' }]);
    }
    expect(await ok('var d: [String: () -> Void] = [:]\nprint(d.count)')).toBe('0\n');
  });

  it('a user type, tuple or generic instance must conform to Hashable as a Set element or key (checked against swiftc 6.2)', async () => {
    for (const [src, msg, line] of [
      ["struct P { var x = 1 }\nvar s: Set<P> = []", "type 'P' does not conform to protocol 'Hashable'", 2],
      ["struct P { var x = 1 }\nvar d: [P: Int] = [:]", "type 'P' does not conform to protocol 'Hashable'", 2],
      ["class C {}\nvar s: Set<C> = []", "type 'C' does not conform to protocol 'Hashable'", 2],
      ["enum E { case a(Int) }\nvar s: Set<E> = []", "type 'E' does not conform to protocol 'Hashable'", 2],
      ["var s: Set<(Int, Int)> = []", "type '(Int, Int)' does not conform to protocol 'Hashable'", 1],
      ["struct P { var x = 1 }\nfunc f(_ s: Set<P>) {}", "type 'P' does not conform to protocol 'Hashable'", 2],
      ["struct P: Equatable { var x = 1 }\nvar s: Set<P> = []", "type 'P' does not conform to protocol 'Hashable'", 2],
      ["struct P { var x = 1 }\nvar s: Set<[P]> = []", "type 'P' does not conform to protocol 'Hashable'", 2],
      ["struct G<T> { var t: T }\nvar s: Set<G<Int>> = []", "type 'G<Int>' does not conform to protocol 'Hashable'", 2],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
    // conformance through the declaration, an extension or a refining protocol; enums without payloads
    for (const [src, want] of [
      ["enum E { case a, b }\nvar s: Set<E> = []\nprint(s.count)", "0\n"],
      ["struct P: Hashable { var x = 1 }\nvar s: Set<P> = []\nprint(s.count)", "0\n"],
      ["struct P { var x = 1 }\nextension P: Hashable {}\nvar s: Set<P> = []\nprint(s.count)", "0\n"],
      ["protocol Q: Hashable {}\nstruct P: Q { var x = 1 }\nvar s: Set<P> = []\nprint(s.count)", "0\n"],
      ["enum E: String { case a }\nvar d: [E: Int] = [:]\nprint(d.count)", "0\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });
});

describe('review: a collection type value prints with its generic arguments', () => {
  it('[Int].self, [String: Int].self, Set<Int>.self... print, compare and qualify as in swiftc 6.2', async () => {
    expect(await ok("print([Int].self, [String: Int].self, Array<Int>.self, [Int?].self, [(Int) -> Int].self)\nprint(Set<Int>.self, Optional<String>.self, (Int, String).self)\nstruct Box<T> { var v: T }\nprint(Box<Int>.self, [Box<Int>].self)\nlet t = [Int].self\nprint(t, t == [Int].self, [Int].self == [String].self)\nprint([[Int].self], [Set<String>.self], Optional([Int].self) as Any)")).toBe("Array<Int> Dictionary<String, Int> Array<Int> Array<Optional<Int>> Array<(Int) -> Int>\nSet<Int> Optional<String> (Int, String)\nBox<Int> Array<Box<Int>>\nArray<Int> true false\n[Swift.Array<Swift.Int>] [Swift.Set<Swift.String>] Optional(Swift.Array<Swift.Int>)\n");
  });
});

describe('review: instances of user generic types carry their generic arguments', () => {
  it('infers, takes explicit and declared arguments, retypes T literals, prints and casts as swiftc 6.2 does', async () => {
    // outputs from swiftc with the file named main.swift, so debug descriptions say main.Box<Swift.Int>
    for (const [src, want] of [
      ["struct Box<T> { var v: T }\nprint(type(of: Box(v: 1)), Box(v: 1), [Box(v: 1)], Box(v: \"a\"))\nlet e = Box<String>(v: \"a\")\nlet b: Box<Double> = Box(v: 1)\nprint(type(of: e), type(of: b), b.v, b)\nlet d = Box<Double>(v: 1)\nprint(d.v, type(of: d.v), Box<Float>(v: 0.1).v)\nlet items: [Any] = [Box(v: 1), Box(v: \"x\")]\nprint(items.map { $0 is Box<Int> }, items.compactMap { $0 as? Box<String> }.count, b is Box<Double>)\nstruct Pair<A, B> { var a: A; var b: B }\nprint(type(of: Pair(a: 1, b: \"x\")), Pair(a: 1.5, b: [1]))\nprint(type(of: Box(v: [1, 2])), type(of: Box(v: Box(v: true))), type(of: Box(v: Optional(3))))\nclass Node<T> { var value: T; init(_ v: T) { value = v } }\nlet n = Node(5)\nprint(type(of: n), n is Node<Int>, type(of: Node<String>(\"s\")))\nenum Res<T> { case ok(T), none }\nprint(type(of: Res.ok(1)), Res.ok(\"a\"), type(of: Res<Int>.none), Res<Double>.ok(1))\nstruct Stack<Element> { var items: [Element] = []; mutating func push(_ x: Element) { items.append(x) } }\nvar s = Stack<String>()\ns.push(\"a\")\nprint(type(of: s), s, type(of: Stack(items: [1])))\nextension Box { func map<U>(_ f: (T) -> U) -> Box<U> { Box<U>(v: f(v)) } }\nprint(type(of: Box(v: 2).map { \"\\($0)\" }), Box(v: 2).map { Double($0) })", "Box<Int> Box<Int>(v: 1) [main.Box<Swift.Int>(v: 1)] Box<String>(v: \"a\")\nBox<String> Box<Double> 1.0 Box<Double>(v: 1.0)\n1.0 Double 0.1\n[true, false] 1 true\nPair<Int, String> Pair<Double, Array<Int>>(a: 1.5, b: [1])\nBox<Array<Int>> Box<Box<Bool>> Box<Optional<Int>>\nNode<Int> true Node<String>\nRes<Int> ok(\"a\") Res<Int> ok(1.0)\nStack<String> Stack<String>(items: [\"a\"]) Stack<Int>\nBox<String> Box<Double>(v: 2.0)\n"],
      ["struct Box<T> { var v: T\n  func same() -> Self { Self(v: v) }\n  mutating func set(_ x: T) { v = x } }\nextension Box: Equatable where T: Equatable {}\nextension Box: Hashable where T: Hashable {}\nvar b = Box(v: 1)\nb.set(5)\nlet c = b\nprint(b == Box(v: 5), c, type(of: b.same()), Set([Box(v: 1), Box(v: 1)]).count)\nclass Node<T> { var value: T; init(_ v: T) { value = v } }\nprint(Node(3), Node(\"a\").value)\nenum Res<T> { case ok(T), none }\nlet r: Res<Int> = .none\nlet r2: Res<Double> = .ok(2)\nprint(type(of: r), r2, type(of: r2))\nstruct Wrapper<T> { var items: [T] = [] }\nlet w = Wrapper<Int>()\nvar w2 = w\nw2.items.append(1)\nprint(type(of: w), type(of: w2), w2)\nfunc make<T>(_ x: T) -> Box<T> { Box(v: x) }\nprint(type(of: make(\"s\")), make(2.5))\nlet any: Any = Box(v: [1])\nif let bx = any as? Box<[Int]> { print(\"matched\", bx.v) }\nprint(any is Box<[String]>)", "true Box<Int>(v: 5) Box<Int> 1\nmain.Node<Swift.Int> a\nRes<Int> ok(2.0) Res<Double>\nWrapper<Int> Wrapper<Int> Wrapper<Int>(items: [1])\nBox<String> Box<Double>(v: 2.5)\nmatched [1]\nfalse\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });
});

describe('review pass 15: constrained extensions, missing returns, Int == Double', () => {
  it('a constrained extension applies only to instances meeting its where clause (checked against swiftc 6.2)', async () => {
    expect(await ok("struct Box<T> { var value: T }\nextension Box where T == Int { var label: String { \"number\" }; func twice() -> Int { value * 2 } }\nextension Box where T == String { var label: String { \"text\" } }\nextension Box where T: Equatable { func same(_ o: Box) -> Bool { value == o.value } }\nprint(Box(value: 1).label, Box(value: \"hi\").label, Box(value: 3).twice(), Box(value: 2).same(Box(value: 2)))\nstruct Stack<Element> { var items: [Element] }\nextension Stack where Element: Numeric { func total() -> Element { items.reduce(0, +) } }\nextension Stack where Element == String { func joined() -> String { items.joined(separator: \",\") } }\nprint(Stack(items: [1, 2]).total(), Stack(items: [\"a\", \"b\"]).joined())\nextension Array where Element == Int { func sumAll() -> Int { reduce(0, +) } }\nextension Array where Element == String { func sumAll() -> String { joined() } }\nprint([1, 2].sumAll(), [\"a\", \"b\"].sumAll())\nprotocol Shape { var area: Double { get } }\nstruct Sq: Shape { var area: Double { 4 } }\nextension Array where Element: Shape { var totalArea: Double { reduce(0) { $0 + $1.area } } }\nprint([Sq(), Sq()].totalArea)")).toBe("number text 6 true\n3 a,b\n3 ab\n8.0\n");
  });

  it('a non-Void body whose end can be reached is swiftc\'s missing-return error, before anything runs', async () => {
    for (const [src, msg, line] of [
      ["struct S { func f(_ x: Bool) -> Int { if x { return 1 } } }", "missing return in instance method expected to return 'Int'", 1],
      ["struct S { static func f(_ x: Bool) -> Int { if x { return 1 } } }", "missing return in static method expected to return 'Int'", 1],
      ["struct S { var v: Int { if Bool.random() { return 1 } } }", "missing return in getter for property expected to return 'Int'", 1],
      ["let c = { (x: Bool) -> Int in if x { return 1 } }", "missing return in closure expected to return 'Int'", 1],
      ["func outer() { func inner(_ x: Bool) -> Int { if x { return 1 } } }", "missing return in local function expected to return 'Int'", 1],
      ["var g: Int { if Bool.random() { return 1 } }", "missing return in getter for var expected to return 'Int'", 1],
      ["struct S { subscript(i: Int) -> Int { if i > 0 { return 1 } } }", "missing return in getter for subscript expected to return 'Int'", 1],
      ["class C { init?() {} ; func f() -> String? { if Bool.random() { return nil } } }", "missing return in instance method expected to return 'String?'", 1],
    ]) {
      const r = await fails(src);
      expect([src, r.stdout, r.error]).toEqual([src, '', { message: msg, line, kind: 'compile' }]);
    }
    // bodies that cannot fall off the end: switches, fatalError, Never, while true, if expressions...
    expect(await ok("enum E: Error { case a, b }\nfunc f1(_ e: E) -> Int { switch e { case .a: return 1; case .b: return 2 } }\nfunc f2(_ x: Int) -> Int { switch x { case 0: return 0; default: fatalError(\"no\") } }\nfunc f3() -> Never { fatalError(\"x\") }\nfunc f4() throws -> Int { throw E.a }\nfunc f5(_ x: Int) -> Int { while true { switch x { case 1: break; default: return 1 } } }\nfunc f6(_ x: Int?) -> Int { guard let v = x else { return 0 }; return v }\nfunc f7(_ x: Int) -> String { if x > 0 { \"pos\" } else if x < 0 { \"neg\" } else { \"zero\" } }\nfunc f8(_ x: Int) -> Int { do { if x > 0 { return 1 }; return 2 } }\nstruct S { var v: Int { get { if Bool.random() { return 1 } else { return 2 } } set {} } }\nlet c = { (x: Int) -> Int in x * 2 }\nlet d = { (x: Int) -> Int in if x > 0 { return 1 }; return 0 }\nfunc f9(_ x: Int) -> Int { precondition(x >= 0); return x }\nfunc f10(_ x: Int) -> Int? { x > 0 ? x : nil }\nprint(f1(.a), f2(0), f5(2), f6(nil), f7(-1), f8(1), c(2), d(1), f9(3), f10(0) as Any, (try? f4()) as Any)")).toBe("1 0 1 0 neg 1 4 1 3 nil nil\n");
  });

  it('== and != between Int and Double values is an error; an Int literal still adapts', async () => {
    for (const [src, msg, line] of [
      ["let n = 1\nlet d = 1.0\nprint(n == d)", "binary operator '==' cannot be applied to operands of type 'Int' and 'Double'", 3],
      ["let n = 1\nlet d = 1.0\nprint(d != n)", "binary operator '!=' cannot be applied to operands of type 'Double' and 'Int'", 3],
      ["let n = 1\nprint(n == 1.0)", "binary operator '==' cannot be applied to operands of type 'Int' and 'Double'", 2],
      ["let n: Int = 2\nlet f: Float = 2\nprint(n == f)", "binary operator '==' cannot be applied to operands of type 'Int' and 'Float'", 3],
      ["let n = 1\nprint(n == 1.5)", "binary operator '==' cannot be applied to operands of type 'Int' and 'Double'", 2],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
    expect(await ok("let d = 1.0\nprint(d == 1, 1 == d, d != 2)")).toBe("true true true\n");
  });
});

describe('review: enum initializers that assign self, init?(rawValue:) beside init(from:)', () => {
  it('self = .case in an enum init stores the case; a declared init(from:) keeps init?(rawValue:) (checked against swiftc 6.2)', async () => {
    for (const [src, want] of [
      ["enum Shape { case circle(Double), square\n  init(code: String) { self = code == \"sq\" ? .square : .circle(1.5) } }\nprint(Shape(code: \"sq\"), Shape(code: \"c\"))\nenum Level: Int { case low = 1, high = 2\n  init(big: Bool) { self = big ? .high : .low } }\nprint(Level(big: true), Level(big: false).rawValue)\nenum Dir: String { case n, s\n  init?(letter: Character) { switch letter { case \"n\": self = .n; case \"s\": self = .s; default: return nil } } }\nprint(Dir(letter: \"n\") as Any, Dir(letter: \"x\") as Any, Dir(rawValue: \"s\") as Any)", "square circle(1.5)\nhigh 1\nOptional(main.Dir.n) nil Optional(main.Dir.s)\n"],
      ["import Foundation\nenum Status: String, Codable { case on, off\n  init(from decoder: Decoder) throws {\n    let s = try decoder.singleValueContainer().decode(String.self)\n    self = Status(rawValue: s) ?? .off\n  } }\nprint(Status(rawValue: \"on\") as Any, Status(rawValue: \"zz\") as Any)\nlet d = try! JSONDecoder().decode([Status].self, from: Data(\"[\\\"on\\\", \\\"x\\\"]\".utf8))\nprint(d)", "Optional(main.Status.on) nil\n[main.Status.on, main.Status.off]\n"],
    ]) expect([src, await ok(src)]).toEqual([src, want]);
  });
});

describe('review: super.init, synthesized super Codable, missing returns on the closing brace', () => {
  it('super.init(...) delegates through class hierarchies, implicit initializers included (checked against swiftc 6.2)', async () => {
    expect(await ok("class Animal {\n  var name: String\n  var legs: Int\n  init(name: String, legs: Int) { self.name = name; self.legs = legs }\n  convenience init(name: String) { self.init(name: name, legs: 4) }\n  func describe() -> String { \"\\(name) has \\(legs) legs\" }\n}\nclass Bird: Animal {\n  var canFly: Bool\n  init(name: String, canFly: Bool) {\n    self.canFly = canFly\n    super.init(name: name, legs: 2)\n  }\n  override func describe() -> String { super.describe() + (canFly ? \" and flies\" : \"\") }\n}\nclass Penguin: Bird {\n  init() { super.init(name: \"Pingu\", canFly: false) }\n}\nclass Base { var a = 1 }\nclass Kid: Base { var b = 2; override init() { super.init(); a = 10 } }\nprint(Bird(name: \"Robin\", canFly: true).describe(), Penguin().describe(), Animal(name: \"Cat\").describe())\nlet k = Kid()\nprint(k.a, k.b, Penguin() is Animal)")).toBe("Robin has 2 legs and flies Pingu has 2 legs Cat has 4 legs\n10 2 true\n");
  });

  it('super.encode(to:) and super.init(from:) reach the superclass\'s synthesized Codable', async () => {
    // output from the swiftc-compiled program
    expect(await ok("import Foundation\nclass Base: Codable { var a = 1 }\nclass Kid: Base {\n  var c = 3\n  enum K: String, CodingKey { case c }\n  override init() { super.init() }\n  required init(from decoder: Decoder) throws {\n    let k = try decoder.container(keyedBy: K.self)\n    c = try k.decode(Int.self, forKey: .c)\n    try super.init(from: decoder)\n  }\n  override func encode(to e: Encoder) throws {\n    try super.encode(to: e)\n    var k = e.container(keyedBy: K.self)\n    try k.encode(c, forKey: .c)\n  }\n}\nlet enc = JSONEncoder()\nenc.outputFormatting = .sortedKeys\nprint(String(data: try! enc.encode(Kid()), encoding: .utf8)!)\nlet k = try! JSONDecoder().decode(Kid.self, from: Data(\"{\\\"a\\\":7,\\\"c\\\":9}\".utf8))\nprint(k.a, k.c)")).toBe("{\"a\":1,\"c\":3}\n7 9\n");
  });

  it('a missing return is reported on the line of the body\'s closing brace, as swiftc does', async () => {
    for (const [src, msg, line] of [
      ["func find(_ yes: Bool) -> Int? {\n    if yes { return 1 }\n}\nprint(find(false) as Any)", "missing return in global function expected to return 'Int?'", 3],
      ["func f(_ x: Int) -> Int {\n  for i in 0..<x { return i }\n}", "missing return in global function expected to return 'Int'", 3],
      ["struct S {\n  var v: Int {\n    if Bool.random() {\n      return 1\n    }\n  }\n}", "missing return in getter for property expected to return 'Int'", 6],
      ["let c = { (x: Bool) -> Int in\n  if x { return 1 }\n}", "missing return in closure expected to return 'Int'", 3],
      ["struct S {\n  subscript(i: Int) -> Int {\n    if i > 0 { return 1 }\n  }\n}", "missing return in getter for subscript expected to return 'Int'", 4],
      ["var g: Int {\n  get {\n    if Bool.random() { return 1 }\n  }\n  set {}\n}", "missing return in getter for var expected to return 'Int'", 4],
    ]) {
      const r = await fails(src);
      expect([src, r.error]).toEqual([src, { message: msg, line, kind: 'compile' }]);
    }
  });
});

describe('compile-time checks swiftc makes (review 16)', () => {
  const errs = async (cases) => {
    for (const [src, message, line] of cases) {
      const r = await fails(src);
      expect([src, r.error.message, r.error.line, r.error.kind]).toEqual([src, message, line, 'compile']);
    }
  };

  it('checks collection literal elements against the element type, in swiftc\'s wording for each context', async () => {
    await errs([
      ['let values: [Int] = [1, "two"]\nprint(values)', "cannot convert value of type 'String' to expected element type 'Int'", 1],
      ['func f() -> [Int] { return [1, "x"] }\nprint(f())', "cannot convert value of type 'String' to expected element type 'Int'", 1],
      ['struct P { var a: [Int] }\nlet p = P(a: [1, "x"])', "cannot convert value of type 'String' to expected element type 'Array<Int>.ArrayLiteralElement' (aka 'Int')", 2],
      ['var a: [Int] = []\na = [1, "x"]', "cannot convert value of type 'String' to expected element type 'Array<Int>.ArrayLiteralElement' (aka 'Int')", 2],
      ['let s: Set<Int> = [1, "b"]', "cannot convert value of type 'String' to expected element type 'Set<Int>.ArrayLiteralElement' (aka 'Int')", 1],
      ['let d: [String: Int] = ["a": "b"]', "cannot convert value of type 'String' to expected dictionary value type 'Int'", 1],
      ['func f(_ d: [String: Int]) {}\nf([1: 2])', "cannot convert value of type 'Int' to expected dictionary key type 'String'", 2],
      ['let a: [[Int]] = [[1, "x"]]', "cannot convert value of type 'String' to expected element type 'Array<Int>.ArrayLiteralElement' (aka 'Int')", 1],
      ['func f(_ a: [Int?]) {}\nf([1, "x"])', "cannot convert value of type 'String' to expected element type 'Array<Int?>.ArrayLiteralElement' (aka 'Optional<Int>')", 2],
      ['let a: [Int] = [1, 2.5]', "cannot convert value of type 'Double' to expected element type 'Int'", 1],
      ['let n = 1\nlet a: [Double] = [n, 2.5]', "cannot convert value of type 'Int' to expected element type 'Double'", 2],
      ['let a: [Int] = [1, nil]', "'nil' is not compatible with expected element type 'Int'", 1],
      ['typealias Row = [Int]\nlet r: Row = [1, "x"]', "cannot convert value of type 'String' to expected element type 'Int'", 2],
      ['let a: [Int]? = [1, "x"]', "cannot convert value of type 'String' to expected element type 'Array<Int>.ArrayLiteralElement' (aka 'Int')", 1],
    ]);
  });

  it('checks a tuple literal\'s arity, labels and elements', async () => {
    await errs([
      ['let point: (Int, Int) = (1, 2, 3)\nprint(point)', "'(Int, Int, Int)' is not convertible to '(Int, Int)', tuples have a different number of elements", 1],
      ['func f() -> (Int, Int) { (1, 2, 3) }\nprint(f())', "cannot convert return expression of type '(Int, Int, Int)' to return type '(Int, Int)'", 1],
      ['var p: (Int, Int) = (0, 0)\np = (1, 2, 3)', "cannot assign value of type '(Int, Int, Int)' to type '(Int, Int)'", 2],
      ['let t: (a: Int, b: Int) = (a: 1, c: 2)', "cannot convert value of type '(a: Int, c: Int)' to specified type '(a: Int, b: Int)'", 1],
      ['let p: (Int, Int) = (1, "x")', "cannot convert value of type '(Int, String)' to specified type '(Int, Int)'", 1],
      ['let p: (Int, Int)? = (1, 2, 3)', "cannot convert value of type '(Int, Int, Int)' to specified type '(Int, Int)'", 1],
      ['let a: [(Int, Int)] = [(1, 2, 3)]', "cannot convert value of type '(Int, Int, Int)' to expected element type '(Int, Int)'", 1],
      ['let p: (Int, Int) = (1, nil)', "'nil' requires a contextual type", 1],
    ]);
  });

  it('checks an array literal joined to a typed array with + or +=, and converts its elements', async () => {
    await errs([
      ['var values = [1, 2]\nvalues += ["x"]', "cannot convert value of type 'String' to expected element type 'Array<Int>.ArrayLiteralElement' (aka 'Int')", 2],
      ['let a: [Int] = [1, 2]\nlet b: [Int] = a + ["x"]', "cannot convert value of type 'String' to expected element type 'Array<Int>.ArrayLiteralElement' (aka 'Int')", 2],
      ['var values: [Int] = [1]\nvalues += [2.5]', "cannot convert value of type 'Double' to expected element type 'Array<Int>.ArrayLiteralElement' (aka 'Int')", 2],
    ]);
    expect(await ok('var ds = [1.5]\nlet e = ds + [2]\nlet f = [3] + ds\nds += [1]\nvar fs: [Float] = [0.5]\nfs += [1]\nprint(ds, e, f, fs)')).toBe('[1.5, 1.0] [1.5, 2.0] [3.0, 1.5] [0.5, 1.0]\n');
  });

  it('still accepts what Swift converts, and gives a tuple the declared labels', async () => {
    expect(await ok('let a: [Any] = [1, "x"]\nlet b: [Double] = [1, 2]\nlet c: [Int?] = [1, nil]\nlet p: (Double, Int) = (1, 2)\nlet d: [Double] = [1 + 2, 2.5]\nprint(a, b, c, p, d)')).toBe('[1, "x"] [1.0, 2.0] [Optional(1), nil] (1.0, 2) [3.0, 2.5]\n');
    expect(await ok('let p: (Int, Int) = (a: 1, b: 2)\nlet q: (a: Int, b: Int) = (b: 2, a: 1)\nlet r: (a: Int, b: Int) = (a: 1, 2)\nprint(p, q, r)')).toBe('(1, 2) (a: 1, b: 2) (a: 1, b: 2)\n');
  });

  it('binds a generic function\'s type parameters in its body', async () => {
    expect(await ok('func identify<T>(_ value: T) {\n    print(T.self)\n}\nidentify(42)')).toBe('Int\n');
    expect(await ok('func pair<A, B>(_ a: A, _ b: B) { print(A.self, B.self) }\npair(2.5, [true])\nfunc opt<T>(_ a: T?) { print(T.self) }\nopt(Optional(3))\nstruct Box<T> { var v: T }\nfunc un<T>(_ b: Box<T>) { print(T.self) }\nun(Box(v: "s"))\nfunc meta<T>(_ t: T.Type) { print(T.self) }\nmeta(Double.self)\nfunc check<T>(_ v: Any, as t: T.Type) -> Bool { v is T }\nprint(check(3, as: Int.self), check("s", as: Int.self))')).toBe('Double Array<Bool>\nInt\nString\nDouble\ntrue false\n');
  });

  it('rejects a generic call whose arguments break the constraints', async () => {
    await errs([
      ['struct Person { var name: String }\nfunc same<T: Equatable>(_ a: T, _ b: T) -> Bool { a == b }\nprint(same(Person(name: "A"), Person(name: "A")))', "global function 'same' requires that 'Person' conform to 'Equatable'", 3],
      ['struct P {}\nfunc f<T>(_ a: T) where T: Hashable { print(a) }\nf(P())', "global function 'f' requires that 'P' conform to 'Hashable'", 3],
      ['struct P {}\nstruct S { func f<T: Comparable>(_ a: T) {} }\nS().f(P())', "instance method 'f' requires that 'P' conform to 'Comparable'", 3],
      ['struct P {}\nstruct S { static func f<T: Comparable>(_ a: T) {} }\nS.f(P())', "static method 'f' requires that 'P' conform to 'Comparable'", 3],
      ['protocol Shape {}\nstruct P {}\nfunc f<T: Shape>(_ a: T) {}\nf(P())', "global function 'f' requires that 'P' conform to 'Shape'", 4],
      ['func f<T: Comparable>(_ a: [T]) {}\nf([[1]])', "global function 'f' requires that '[Int]' conform to 'Comparable'", 2],
      ['class C {}\nfunc same<T: Equatable>(_ a: T, _ b: T) -> Bool { a == b }\nprint(same(C(), C()))', "global function 'same' requires that 'C' conform to 'Equatable'", 3],
      ['func f<T>(_ a: T) where T == Int { print(a) }\nf("x")', "cannot convert value of type 'String' to expected argument type 'Int'", 2],
      ['func f<T: Equatable & Comparable>(_ a: T) {}\nstruct P: Equatable {}\nf(P())', "global function 'f' requires that 'P' conform to 'Comparable'", 3],
      ['struct P {}\nfunc outer() {\n    func f<T: Equatable>(_ a: T) {}\n    f(P())\n}\nouter()', "local function 'f' requires that 'P' conform to 'Equatable'", 4],
      ['struct P {}\nstruct S { init<T: Equatable>(_ a: T) {} }\n_ = S(P())', "initializer 'init(_:)' requires that 'P' conform to 'Equatable'", 3],
    ]);
  });

  it('accepts generic calls that meet their constraints, through extensions, superclasses and implicit conformances', async () => {
    expect(await ok('protocol Shape { func area() -> Double }\nextension Int: Shape { func area() -> Double { Double(self) } }\nfunc total<T: Shape>(_ xs: [T]) -> Double { xs.reduce(0) { $0 + $1.area() } }\nprint(total([1, 2, 3]))\nclass Animal: Equatable { static func == (a: Animal, b: Animal) -> Bool { true } }\nclass Dog: Animal {}\nfunc same<T: Equatable>(_ a: T, _ b: T) -> Bool { a == b }\nprint(same(Dog(), Dog()))\nenum E { case a, b }\nprint(same(E.a, E.b))\nfunc make<T: Numeric>(_ x: T) -> T { x * 2 }\nprint(make(3), make(2.5))\nfunc eqArr<T: Equatable>(_ a: [T], _ b: [T]) -> Bool { a == b }\nprint(eqArr([1, 2], [1, 2]))')).toBe('6.0\ntrue\nfalse\n6 5.0\ntrue\n');
  });

  it('rejects a declared conformance whose requirements are missing, before anything runs', async () => {
    await errs([
      ['print("before")\nprotocol Named { var name: String { get } }\nstruct Person: Named {}\nprint("ok")', "type 'Person' does not conform to protocol 'Named'", 3],
      ['protocol A { func a() }\nprotocol B: A { func b() }\nstruct S: B { func b() {} }', "type 'S' does not conform to protocol 'A'", 3],
      ['protocol A { func a() }\nprotocol B: A { func b() }\nstruct S: B {}', "type 'S' does not conform to protocol 'B'", 3],
      ['protocol Named { var name: String { get set } }\nstruct S: Named { let name = "x" }', "type 'S' does not conform to protocol 'Named'", 2],
      ['protocol P { var n: Int { get set } }\nstruct S: P { var n: Int { 3 } }', "type 'S' does not conform to protocol 'P'", 2],
      ['protocol Named { var name: String { get } }\nstruct S { }\nextension S: Named {}', "type 'S' does not conform to protocol 'Named'", 3],
      ['protocol P { func f(x: Int) }\nstruct S: P { func f(y: Int) {} }', "instance method 'f(y:)' has different argument labels from those required by protocol 'P' ('f(x:)')", 2],
      ['protocol P { static func make() -> Self }\nstruct S: P {}', "type 'S' does not conform to protocol 'P'", 2],
      ['protocol P { subscript(i: Int) -> Int { get } }\nstruct S: P {}', "type 'S' does not conform to protocol 'P'", 2],
      ['protocol P { func f() }\nstruct Outer { struct Inner: P {} }', "type 'Outer.Inner' does not conform to protocol 'P'", 2],
      ['struct S: CustomStringConvertible {}', "type 'S' does not conform to protocol 'CustomStringConvertible'", 1],
      ['struct S: Identifiable { var name = "" }', "type 'S' does not conform to protocol 'Identifiable'", 1],
    ]);
    const r = await fails('print("before")\nprotocol Named { var name: String { get } }\nstruct Person: Named {}');
    expect(r.stdout).toBe('');
  });

  it('counts defaults, superclass members, extensions and synthesized members as witnesses', async () => {
    expect(await ok('protocol Mk { init(name: String) }\nstruct S: Mk { var name: String }\nprint(S(name: "a").name)\nprotocol P { static var a: Self { get } }\nenum E: P { case a }\nprint(E.a)\nprotocol D { func f() }\nextension D { func f() { print("default") } }\nstruct T: D {}\nT().f()\nprotocol N { var n: Int { get } }\nclass Base { var n = 1 }\nclass Sub: Base, N {}\nprint(Sub().n)\nstruct U: N { var n: Int { 3 } }\nstruct V { }\nextension V: N { var n: Int { 4 } }\nprint(U().n, V().n)\nprotocol I { associatedtype Item; func get() -> Item }\nstruct W: I { func get() -> Int { 1 } }\nprint(W().get())\nclass C: Identifiable {}\nprotocol Q { init(x: Int) }\nfinal class F: Q { init(x: Int) {} }\nprint("ok")')).toBe('a\na\ndefault\n1\n3 4\n1\nok\n');
  });

  it('rejects an escaping closure or local function that captures an inout parameter', async () => {
    await errs([
      ['func makeNext(_ n: inout Int) -> () -> Int {\n    return { n += 1; return n }\n}\nvar n = 0\nlet next = makeNext(&n)\nprint(next(), n)', "escaping closure captures 'inout' parameter 'n'", 2],
      ['func f(_ n: inout Int) {\n    let g = { n += 1 }\n    g()\n}', "escaping closure captures 'inout' parameter 'n'", 2],
      ['func f(_ n: inout Int) -> () -> Void {\n    { n += 1 }\n}', "escaping closure captures 'inout' parameter 'n'", 2],
      ['var saved: (() -> Void)?\nfunc f(_ n: inout Int) {\n    saved = { n += 1 }\n}', "escaping closure captures 'inout' parameter 'n'", 3],
      ['func run(_ c: @escaping () -> Void) { c() }\nfunc f(_ n: inout Int) {\n    run { n += 1 }\n}', "escaping closure captures 'inout' parameter 'n'", 3],
      ['func f(_ n: inout Int) {\n    Task { n += 1 }\n}', "escaping closure captures 'inout' parameter 'n'", 2],
      ['func f(_ n: inout Int) -> () -> Void {\n    func inner() { n += 1 }\n    return inner\n}', "escaping local function captures 'inout' parameter 'n'", 3],
    ]);
  });

  it('allows non-escaping uses of an inout parameter in closures and local functions', async () => {
    expect(await ok('func run(_ c: () -> Void) { c() }\nfunc f(_ n: inout Int) {\n    run { n += 1 }\n    [1, 2].forEach { n += $0 }\n    func inner() { n += 10 }\n    inner()\n}\nvar x = 0; f(&x); print(x)\nfunc g(_ n: inout Int) -> () -> Int {\n    let m = n\n    return { m + 1 }\n}\nfunc h(_ n: inout Int) -> () -> Int {\n    return { [n] in n + 1 }\n}\nprint(g(&x)(), h(&x)())')).toBe('14\n15 15\n');
  });

  it('cancels an unawaited async let child at scope exit before waiting for it', async () => {
    expect(await ok('func child() async -> Int {\n    try? await Task.sleep(for: .milliseconds(20))\n    print(Task.isCancelled)\n    return 1\n}\nfunc parent() async {\n    async let value = child()\n}\nawait parent()')).toBe('true\n');
    expect(await ok('func child(_ n: Int, _ ms: Int) async -> Int {\n    try? await Task.sleep(for: .milliseconds(ms))\n    print(n, Task.isCancelled)\n    return n\n}\nfunc parent() async {\n    async let a = child(1, 10)\n    async let b = child(2, 300)\n    let x = await a\n    print("got", x)\n}\nawait parent()\nprint("done")')).toBe('1 false\ngot 1\n2 true\ndone\n');
    expect(await ok('func child() async -> Int {\n    do { try await Task.sleep(for: .seconds(5)) } catch { print("cancelled:", error is CancellationError) }\n    return 1\n}\nfunc parent() async {\n    async let v = child()\n    print("leaving")\n}\nawait parent()\nprint("done")')).toBe('leaving\ncancelled: true\ndone\n');
  });
});

describe('drain helper (finding 10)', () => {
  it('runs a generator to completion and returns its value', () => {
    const interp = new Interp({ builtins: getBuiltins() });
    expect(interp.drain((function* () { yield 1; yield 2; return 'done'; })())).toBe('done');
  });

  it('is the only synchronous drain loop left in the interpreter and the ARC simulation', () => {
    const src = (f) => fs.readFileSync(path.resolve('src/engine', f), 'utf8');
    expect(src('interp.js').match(/while \(!r\.done\) r = /g)).toHaveLength(1);
    expect(src('arc.js').match(/while \(!r\.done\)/g)).toBeNull();
  });
});
