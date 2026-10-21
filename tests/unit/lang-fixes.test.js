// Regression tests for the parser / builtins / values fixes (observer blocks after an
// initializer call, integer conversions and fixed-width integers, struct hashing,
// String.Index performance, large-collection growth, continuations, stack-overflow
// labelling, error construction and per-run value ownership).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { run } from '../../src/engine/index.js';
import { parse } from '../../src/engine/parser.js';
import { tokenize } from '../../src/engine/lexer.js';
import {
  hashKey, equals, describe as describeValue, SStruct, SEnum, SArray, SSet, SData, Opt, guardResult, FixedInt, fixedIntOp, fitsFixedInt, wrapFixedInt, typeNameOf, compare, copyValue, hooks,
} from '../../src/engine/values.js';
import { RESULT_TYPE, charsOf, graphemeCount } from '../../src/engine/builtins.js';
import { convertFromSnakeCase, convertToSnakeCase } from '../../src/engine/foundation.js';
import { formatFloat, Flt, CGF, toFloat, floatResult, bigToFloat32, decimalToFloat32, SObject, diagTypeName } from '../../src/engine/values.js';
import { bigLiteralValue } from '../../src/engine/parser.js';

const ok = async (src, opts) => {
  const r = await run(src, opts);
  expect(r.error).toBeNull();
  return r.stdout;
};
const fails = async (src, opts) => {
  const r = await run(src, opts);
  expect(r.error).toBeTruthy();
  return r.error;
};

describe('observer blocks after an initializer call (finding 1)', () => {
  it('didSet on a var initialized by a call is not a trailing closure', async () => {
    expect(await ok('var items = [String]() { didSet { print("changed") } }\nitems.append("a")')).toBe('changed\n');
  });
  it('didSet on a stored property initialized by a memberwise call', async () => {
    const src = 'struct Settings { var dark = false }\nclass VM { var settings = Settings() { didSet { print("x") } } }\nlet vm = VM()\nvm.settings.dark = true';
    expect(await ok(src)).toBe('x\n');
  });
  it('keeps working with a type annotation and with willSet', async () => {
    expect(await ok('var x: [String] = [] { didSet { print("n", x.count) } }\nx.append("a")')).toBe('n 1\n');
    const src = 'struct S { var v = 0 }\nvar s = S() { willSet { print("will", newValue.v) } didSet { print("did", s.v) } }\ns.v = 3';
    expect(await ok(src)).toBe('will 3\ndid 3\n');
  });
  it('genuine trailing closures in initializers still parse', async () => {
    expect(await ok('let doubled = [1, 2].map { $0 * 2 }\nprint(doubled)')).toBe('[2, 4]\n');
    expect(await ok('var task = Task { print("in task") }\nawait task.value')).toBe('in task\n');
    const ast = parse('var t = Task { didSetLike() }');
    expect(ast.body[0].bindings[0].init.k).toBe('call');
    expect(ast.body[0].bindings[0].accessors).toBeUndefined();
  });
});

describe('integer conversions and fixed-width integers (finding 2)', () => {
  it('Int(Double) is exact beyond 2^53', async () => {
    expect(await ok('print(Int(pow(2.0, 62.0)))')).toBe('4611686018427387904\n');
    expect(await ok('print(Int(-pow(2.0, 62.0)), Int(3.99), Int(-3.99))')).toBe('-4611686018427387904 3 -3\n');
  });
  it('out-of-range doubles trap with the Swift wording', async () => {
    // swiftc's runtime wording (a literal argument would be rejected at compile time)
    let e = await fails('var d: Double = 1e30\nd += 1\nprint(Int(d))');
    expect(e.message).toBe('Fatal error: Double value cannot be converted to Int because the result would be greater than Int.max');
    expect((await fails('var d: Double = -1\nd += 0\nprint(UInt(d))')).message).toBe('Fatal error: Double value cannot be converted to UInt because the result would be less than UInt.min');
    expect(e.kind).toBe('runtime');
    e = await fails('print(Int(Double.nan))');
    expect(e.message).toBe('Fatal error: Double value cannot be converted to Int because it is either infinite or NaN');
    e = await fails('print(Int(Double.infinity))');
    expect(e.message).toBe('Fatal error: Double value cannot be converted to Int because it is either infinite or NaN');
  });
  it('narrow conversions trap when the value does not fit', async () => {
    expect((await fails('print(Int8(200))')).message).toBe('Fatal error: Not enough bits to represent the passed value');
    expect((await fails('print(UInt8(-1))')).message).toBe('Fatal error: Negative value is not representable');
    expect(await ok('print(Int8(exactly: 200) == nil, UInt8("300") == nil, UInt8("200")!, Int8(truncatingIfNeeded: 200), UInt8(clamping: 300))')).toBe('true true 200 -56 255\n');
  });
  it('wrapping operators wrap at the declared width', async () => {
    expect(await ok('print(UInt8(255) &+ 1, Int8(127) &+ 1, UInt8(0) &- 1, Int32(2147483647) &+ 1, Int32.max &* 2)')).toBe('0 -128 255 -2147483648 -2\n');
    expect(await ok('print(UInt8.max, Int8.min, Int16.max, UInt32.max, Int32.min, UInt8.max.bitWidth)')).toBe('255 -128 32767 4294967295 -2147483648 8\n');
  });
  it('checked operators trap on overflow and narrow values print like Swift', async () => {
    expect(await ok('let a: UInt8 = 250\nprint(a &+ 10)')).toBe('4\n');
    const e = await fails('let a: UInt8 = 250\nprint(a + 10)');
    expect(e.message).toMatch(/arithmetic overflow/);
    expect(e.kind).toBe('runtime');
    expect((await fails('print(UInt8(250) + 10)')).message).toMatch(/arithmetic overflow/);
    expect(await ok('let b = UInt8(200)\nprint(b / 3, b % 7, b & 0x0F, b | 1, b ^ 0xFF, b >> 2, Int8(-8) >> 1, Int8(1) << 7, type(of: b), Int(b) + 100, Double(b) / 2)')).toBe('66 4 8 201 55 50 -4 -128 UInt8 300 100.0\n');
  });
  it('narrow values hash, compare and encode like their Int value', async () => {
    expect(await ok('var d: [UInt8: String] = [:]\nd[UInt8(3)] = "three"\nprint(d[3] ?? "-", Set([UInt8(1), UInt8(1), UInt8(2)]).count, UInt8(5) == 5, UInt8(200) > UInt8(100))')).toBe('three 2 true true\n');
    expect(await ok('import Foundation\nstruct P: Codable { var age: UInt8 }\nlet data = try JSONEncoder().encode(P(age: UInt8(7)))\nprint(String(decoding: data, as: UTF8.self), try JSONDecoder().decode(P.self, from: data).age)')).toBe('{"age":7} 7\n');
  });
  it('fixedIntOp and the helpers implement two\'s complement arithmetic', () => {
    const interp = { fatal: (m) => new Error('Fatal error: ' + m), compileError: (m) => new Error(m) };
    const u = (v) => new FixedInt(v, 'UInt8'), s = (v) => new FixedInt(v, 'Int8');
    expect(fixedIntOp('&+', u(255), 1, 0, interp).v).toBe(0);
    expect(fixedIntOp('&-', u(0), 1, 0, interp).v).toBe(255);
    expect(fixedIntOp('&*', s(64), 2, 0, interp).v).toBe(-128);
    expect(() => fixedIntOp('+', u(250), 10, 0, interp)).toThrow(/arithmetic overflow/);
    expect(() => fixedIntOp('-', u(0), 1, 0, interp)).toThrow(/arithmetic overflow/);
    expect(() => fixedIntOp('/', u(1), 0, 0, interp)).toThrow(/Division by zero/);
    expect(() => fixedIntOp('+', u(1), s(1), 0, interp)).toThrow(/cannot be applied to operands of type 'UInt8' and 'Int8'/);
    expect(fixedIntOp('<<', u(1), 9, 0, interp).v).toBe(0);
    expect(fixedIntOp('>>', s(-128), 100, 0, interp).v).toBe(-1);
    expect(fixedIntOp('<<', s(1), -1, 0, interp).v).toBe(0);
    expect(wrapFixedInt(300n, 'UInt8').v).toBe(44);
    expect(fitsFixedInt(127, 'Int8')).toBe(true);
    expect(fitsFixedInt(128, 'Int8')).toBe(false);
    expect(fitsFixedInt(2.5, 'Int8')).toBe(false);
    expect(typeNameOf(u(1))).toBe('UInt8');
    expect(describeValue(s(-5))).toBe('-5');
    expect(equals(u(5), 5)).toBe(true);
    expect(equals(u(5), u(5))).toBe(true);
    expect(compare(u(5), 7n)).toBe(-1);
    expect(hashKey(u(5))).toBe(hashKey(5));
  });
  it('integer literals that do not fit Int64 are compile errors', async () => {
    const e = await fails('print(99999999999999999999)');
    expect(e.message).toBe("integer literal '99999999999999999999' overflows when stored into 'Int'");
    expect(e.kind).toBe('compile');
    expect((await fails('print(9223372036854775808)')).message).toBe("integer literal '9223372036854775808' overflows when stored into 'Int'");
    expect(await ok('let m = -9223372036854775808\nprint(m, 9223372036854775807)')).toBe('-9223372036854775808 9223372036854775807\n');
    expect(() => parse('let x = 1_000_000_000_000_000_000_000')).toThrow(/overflows when stored into 'Int'/);
    expect(tokenize('1_000_000_000_000_000_000_000')[0].v).toBe(1000000000000000000000n);
  });
});

describe('Hashable agrees with Equatable on struct field order (finding 3)', () => {
  it('hashKey does not depend on field insertion order', () => {
    const type = { name: 'P', interp: { userEquals: () => undefined, userLess: () => undefined, describeUser: () => null } };
    const a = new SStruct(type, new Map([['x', 1], ['y', 2]]));
    const b = new SStruct(type, new Map([['y', 2], ['x', 1]]));
    expect(equals(a, b)).toBe(true);
    expect(hashKey(a)).toBe(hashKey(b));
  });
  it('a Set of structs built by different init branches has one element', async () => {
    const src = `struct P: Hashable {
    var x: Int
    var y: Int
    init(_ flip: Bool) {
        if flip { y = 2; x = 1 } else { x = 1; y = 2 }
    }
}
let s: Set<P> = [P(true), P(false)]
print(s.count, P(true) == P(false))`;
    expect(await ok(src)).toBe('1 true\n');
  });
});

describe('String index APIs and trimming are linear (finding 4)', () => {
  it('100k String.Index lookups cost a linear number of steps', async () => {
    // A quadratic index walk would need about five billion grapheme steps here and trip the hang guard.
    const src = 'let s = String(repeating: "ab", count: 50000)\nvar n = 0\nfor i in 0..<s.count { if s[s.index(s.startIndex, offsetBy: i)] == "a" { n += 1 } }\nprint(n)';
    const t0 = performance.now();
    const r = await run(src);
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('50000\n');
    expect(r.steps).toBeLessThan(600_000); // about 264,000 today
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
  });
  it('trimming a long interior run of spaces is linear', async () => {
    // A quadratic trim would scan the million spaces a million times and trip the hang guard.
    const src = 'let s = "a" + String(repeating: " ", count: 1000000) + "b  "\nprint(s.trimmingCharacters(in: .whitespaces).count)';
    const t0 = performance.now();
    const r = await run(src);
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('1000002\n');
    expect(r.steps).toBeLessThan(400_000); // about 156,000 today
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
    expect(await ok('print("  hi \\t".trimmingCharacters(in: .whitespaces) + "|" + "\\n\\nhi\\n".trimmingCharacters(in: .newlines) + "|" + "!!hi?".trimmingCharacters(in: .punctuationCharacters) + "|" + " \\n x \\n".trimmingCharacters(in: .whitespacesAndNewlines))')).toBe('hi|hi|hi|x\n');
  });
  it('the grapheme cache is never mutated by String members', async () => {
    const src = `var s = "abc"
s.removeLast()
var t = "abc"
t.removeFirst()
var u = "abc"
u.insert("X", at: u.startIndex)
var w = "abc"
w.remove(at: w.index(w.startIndex, offsetBy: 1))
print(s, t, u, w, "abc".count, String("abc".reversed()), "abc".count, "abc".first!, "abc".last!)
let e = "a\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}b"
print(e.count, e[e.index(e.startIndex, offsetBy: 1)] == "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}", e[e.index(before: e.endIndex)])`;
    expect(await ok(src)).toBe('ab bc Xabc ac 3 cba 3 a c\n3 true b\n');
  });
});

describe('growing collections (finding 5)', () => {
  it('append(contentsOf:) handles hundreds of thousands of elements', async () => {
    const src = 'var a = [Int]()\na.append(contentsOf: Array(repeating: 1, count: 200000))\na.append(contentsOf: a)\na.insert(contentsOf: [7, 8], at: 1)\nprint(a.count, a[1], a[2], a[3])';
    expect(await ok(src, { maxSteps: 5_000_000 })).toBe('400002 7 8 1\n');
  });
  it('range replacement, joined and flatMap do not spread arguments', async () => {
    expect(await ok('var a = [1, 2, 3, 4]\na[1...2] = [9, 9, 9]\nprint(a, [[1], [2, 3]].joined().count, [[1], [2, 3]].flatMap { $0 })')).toBe('[1, 9, 9, 9, 4] 3 [1, 2, 3]\n');
    expect((await fails('var a = [1, 2]\na[1...4] = [0]')).message).toMatch(/Array index is out of range|subrange extends past the end/);
  });
  it('huge allocations are refused by the budget, not by a JS error', async () => {
    const r = await run('let a = Array(repeating: 0, count: 17000000)');
    expect(r.error?.kind).toMatch(/limit|runtime/);
    expect(r.error?.message).not.toMatch(/Internal error|call stack/);
  });
});

describe('continuations (finding 6)', () => {
  it('resumes synchronously and from another task', async () => {
    expect(await ok('let v: Int = await withCheckedContinuation { c in c.resume(returning: 5) }\nprint(v)')).toBe('5\n');
    const src = `func fetch() async -> Int {
    await withCheckedContinuation { c in
        Task {
            try? await Task.sleep(for: .seconds(1))
            c.resume(returning: 42)
        }
    }
}
print(await fetch())`;
    expect(await ok(src)).toBe('42\n');
  });
  it('resume(throwing:) rethrows at the await', async () => {
    const src = 'enum E: Error { case x }\ndo {\n    let _: Int = try await withCheckedThrowingContinuation { c in c.resume(throwing: E.x) }\n} catch {\n    print("caught", error)\n}';
    expect(await ok(src)).toBe('caught x\n');
  });
  it('a continuation that is never resumed does not spin', async () => {
    const r = await run('await withCheckedContinuation { c in print("started") }\nprint("unreachable")', { maxSteps: 3_000_000 });
    expect(r.stdout).toBe('started\n');
    expect(r.steps).toBeLessThan(10000);
    // reported as a stuck program, never as an infinite loop
    expect(r.error?.kind).toBe('limit');
    expect(r.error.message).toBe('Stopped: every task is waiting and none can continue');
  });
});

describe('stack overflow labelling (finding 7)', () => {
  it('a parser stack overflow is a compile diagnostic', async () => {
    const r = await run('print(' + '('.repeat(6000) + '1' + ')'.repeat(6000) + ')');
    expect(r.error?.kind).toBe('compile');
    expect(r.error?.message).toBe('expression is too complex or nested too deeply for this in-browser playground');
    expect(r.stdout).toBe('');
  });
  it('a deeply nested expression at run time is not blamed on recursion', async () => {
    const r = await run('let x = ' + '1 + '.repeat(30000) + '1\nprint(x)');
    expect(r.error?.kind).toBe('limit');
    expect(r.error?.message).toBe('Stopped: this expression nests too deeply for this in-browser playground.');
  });
  it('runaway recursion still mentions the base case', async () => {
    const r = await run('func f(_ n: Int) -> Int { f(n + 1) }\nprint(f(0))');
    expect(r.error?.kind).toBe('limit');
    expect(r.error?.message).toMatch(/base case/);
  });
});

describe('error construction (finding 8)', () => {
  it('precondition, assert and the failure variants use the Swift wording', async () => {
    expect((await fails('precondition(1 > 2, "bad")')).message).toBe('Precondition failed: bad');
    expect((await fails('assert(false)')).message).toBe('Assertion failed');
    expect((await fails('preconditionFailure("boom")')).message).toBe('Fatal error: boom');
    expect((await fails('assertionFailure()')).message).toBe('Fatal error');
    expect((await fails('fatalError()')).message).toBe('Fatal error');
    const e = await fails('precondition(false)');
    expect(e.kind).toBe('runtime');
    expect(e.line).toBe(1);
  });
  it('no builtin builds errors through a constructor lookup', () => {
    for (const f of ['src/engine/builtins.js', 'src/engine/foundation.js']) {
      const src = fs.readFileSync(path.resolve(f), 'utf8');
      expect(src).not.toMatch(/\.constructor\)\(/);
    }
  });
});

describe('values of builtin enums belong to their run (finding 9)', () => {
  it('describe() asks the owning interpreter when the type is shared', () => {
    const owner = { describeUser: () => 'from owner', moduleName: 'main' };
    const v = new SEnum(RESULT_TYPE, 'success', [1], [null]);
    v.interp = owner;
    expect(describeValue(v)).toBe('from owner');
    const plain = new SEnum(RESULT_TYPE, 'success', [1], [null]);
    expect(describeValue(plain)).toBe('success(1)');
  });
  it('Result values created by a program carry that program', async () => {
    const src = `enum E: Error { case bad }
func f(_ ok: Bool) -> Result<Int, E> { ok ? .success(1) : .failure(.bad) }
let r = Result { 3 }
print(f(true), f(false), r, f(true) == .success(1))
switch f(false) {
case .success(let v): print(v)
case .failure(let e): print("err", e)
}`;
    expect(await ok(src)).toBe('success(1) failure(main.E.bad) success(3) true\nerr bad\n');
  });
  it('two concurrent runs printing Result and custom descriptions never mix', async () => {
    const a = 'struct A: CustomStringConvertible { var description: String { print("A-side-effect"); return "A" } }\nlet r: Result<Int, Never> = .success(1)\nprint(A(), r)';
    const b = 'struct B: CustomStringConvertible { var description: String { "B" } }\nprint(B(), Result<Int, Never>.success(2))';
    const [ra, rb] = await Promise.all([run(a), run(b)]);
    expect(ra.stdout).toBe('A-side-effect\nA success(1)\n');
    expect(rb.stdout).toBe('B success(2)\n');
  });
});

describe('Foundation decoding divergences (round 2)', () => {
  const corrupted = (n) => `DecodingError.dataCorrupted: Data was corrupted. Debug description: The given data was not valid JSON.. Underlying error: Error Domain=NSCocoaErrorDomain Code=3840 "Number ${n} is not representable in Swift." UserInfo={NSDebugDescription=Number ${n} is not representable in Swift.}`;
  const decodeErr = (decl, type, json) => `import Foundation\n${decl}\ndo { _ = try JSONDecoder().decode(${type}, from: ${JSON.stringify(json)}.data(using: .utf8)!); print("ok") } catch { print(error) }`;
  it('non-representable numbers are rejected by the parser with an empty path', async () => {
    expect(await ok(decodeErr('struct A: Codable { var id: Int }', 'A.self', '{"id": 1.5}'))).toBe(corrupted('1.5') + '\n');
    expect(await ok(decodeErr('struct B: Codable { var age: UInt8 }', 'B.self', '{"age": 300}'))).toBe(corrupted('300') + '\n');
    expect(await ok(decodeErr('struct C: Codable { var n: UInt }', 'C.self', '{"n": -1}'))).toBe(corrupted('-1') + '\n');
    expect(await ok(decodeErr('struct D: Codable { var x: Int8 }', 'D.self', '{"x": -129}'))).toBe(corrupted('-129') + '\n');
    expect(await ok(decodeErr('struct A: Codable { var id: Int }', 'A.self', '{"id": 1e400}'))).toBe(corrupted('1e400') + '\n');
    expect(await ok(decodeErr('struct B: Codable { var age: UInt8 }', 'B.self', '{"age": 300.0}'))).toBe(corrupted('300.0') + '\n');
    expect(await ok(decodeErr('struct A: Codable { var id: Int }', 'A.self', '{"id": 9223372036854775808}'))).toBe(corrupted('9223372036854775808') + '\n');
    expect(await ok(decodeErr('', '[Int].self', '[1, 2.5]'))).toBe(corrupted('2.5') + '\n');
    expect(await ok(decodeErr('struct D: Codable { var d: Double }', 'D.self', '{"d": 1e400}'))).toBe(corrupted('1e400') + '\n');
    // integral spellings still decode, and large integers stay exact
    expect(await ok('import Foundation\nstruct A: Codable { var id: Int }\nlet a = try JSONDecoder().decode([A].self, from: "[{\\"id\\": 1.0}, {\\"id\\": 10e-1}, {\\"id\\": -0}, {\\"id\\": 9007199254740993}]".data(using: .utf8)!)\nprint(a.map { $0.id })')).toBe('[1, 1, 0, 9007199254740993]\n');
    expect(await ok(decodeErr('struct B: Codable { var age: UInt8 }', 'B.self', '{"age": 2.0}'))).toBe('ok\n');
  });
  it('null reports the container kind Swift reports', async () => {
    expect(await ok(decodeErr('struct A: Codable { var id: Int }', 'A.self', '{"id": null}'))).toBe('DecodingError.valueNotFound: Expected value of type Int but found null instead. Path: id. Debug description: Cannot get value of type Int -- found null value instead\n');
    expect(await ok(decodeErr('struct L: Codable { var xs: [Int] }', 'L.self', '{"xs": null}'))).toBe('DecodingError.valueNotFound: Expected value of type Array<Any> but found null instead. Path: xs. Debug description: Cannot get unkeyed decoding container -- found null value instead\n');
    expect(await ok(decodeErr('struct Plain: Codable { var v: Double }\nstruct Outer: Codable { var p: Plain }', 'Outer.self', '{"p": null}'))).toBe('DecodingError.valueNotFound: Expected value of type Dictionary<String, Any> but found null instead. Path: p. Debug description: Cannot get keyed decoding container -- found null value instead\n');
    expect(await ok(decodeErr('enum Kind: String, Codable { case a, b }\nstruct K: Codable { var k: Kind }', 'K.self', '{"k": null}'))).toBe('DecodingError.valueNotFound: Expected value of type String but found null instead. Path: k. Debug description: Cannot get value of type String -- found null value instead\n');
    expect(await ok(decodeErr('struct DO: Codable { var d: Date }', 'DO.self', '{"d": null}'))).toBe('DecodingError.valueNotFound: Expected value of type Date but found null instead. Path: d. Debug description: Cannot get value of type Date -- found null value instead\n');
  });
  it('a custom init(from:) runs when the value is null', async () => {
    const src = `import Foundation
struct Celsius: Codable {
    var value: Double?
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { value = nil; print("init ran, nil") } else { value = try c.decode(Double.self); print("init ran", value!) }
    }
    func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); try c.encode(value) }
}
struct Temp: Codable { var c: Celsius }
let t = try JSONDecoder().decode(Temp.self, from: "{\\"c\\": null}".data(using: .utf8)!)
print(t.c.value as Any)
let t2 = try JSONDecoder().decode(Temp.self, from: "{\\"c\\": 21.5}".data(using: .utf8)!)
print(t2.c.value as Any)
print(String(data: try JSONEncoder().encode(t), encoding: .utf8)!)
struct Keyed: Codable {
    var v: Int
    enum CodingKeys: String, CodingKey { case v }
    init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); v = try c.decode(Int.self, forKey: .v) }
}
struct KO: Codable { var k: Keyed }
do { _ = try JSONDecoder().decode(KO.self, from: "{\\"k\\": null}".data(using: .utf8)!) } catch { print(error) }`;
    expect(await ok(src)).toBe('init ran, nil\nnil\ninit ran 21.5\nOptional(21.5)\n{"c":null}\nDecodingError.valueNotFound: Expected value of type Dictionary<String, Any> but found null instead. Path: k. Debug description: Cannot get keyed decoding container -- found null value instead\n');
  });
  it('Date initializers and intervals use the reference date', async () => {
    const src = `import Foundation
struct E: Codable { var d: Date }
let enc = JSONEncoder()
print(String(data: try enc.encode(E(d: Date(timeIntervalSinceReferenceDate: 86400))), encoding: .utf8)!)
print(String(data: try enc.encode(E(d: Date(timeIntervalSince1970: 0))), encoding: .utf8)!)
print(String(data: try enc.encode(E(d: Date(timeIntervalSinceReferenceDate: 1.5))), encoding: .utf8)!)
let d = Date(timeIntervalSinceReferenceDate: 86400)
print(d.timeIntervalSinceReferenceDate, d.timeIntervalSince1970)
let d2 = Date(timeIntervalSince1970: 978307200)
print(d2.timeIntervalSinceReferenceDate, d2.timeIntervalSince1970)
print(d)
print(Date(timeIntervalSinceReferenceDate: 0))
let back = try JSONDecoder().decode(E.self, from: "{\\"d\\":86400}".data(using: .utf8)!)
print(back.d.timeIntervalSinceReferenceDate, back.d == d)
print(Date(timeIntervalSinceReferenceDate: 0).timeIntervalSince1970)
print(d.addingTimeInterval(60).timeIntervalSinceReferenceDate, d2.timeIntervalSince(d), d2 < d)`;
    expect(await ok(src)).toBe('{"d":86400}\n{"d":-978307200}\n{"d":1.5}\n86400.0 978393600.0\n0.0 978307200.0\n2001-01-02 00:00:00 +0000\n2001-01-01 00:00:00 +0000\n86400.0 true\n978307200.0\n86460.0 -86400.0 true\n');
  });
  it('enums with associated values decode from the synthesized form', async () => {
    const src = `import Foundation
enum Shape: Codable, Equatable { case circle(radius: Double), square(Double), empty }
let json = "[{\\"circle\\":{\\"radius\\":2}},{\\"square\\":{\\"_0\\":3.5}},{\\"empty\\":{}}]"
let shapes = try JSONDecoder().decode([Shape].self, from: json.data(using: .utf8)!)
print(shapes.count, shapes)
print(String(data: try JSONEncoder().encode(shapes), encoding: .utf8)!)
enum Pet: Codable { case dog(name: String, age: Int), cat }
let pets = try JSONDecoder().decode([Pet].self, from: "[{\\"dog\\":{\\"name\\":\\"Rex\\",\\"age\\":3}},{\\"cat\\":{}}]".data(using: .utf8)!)
print(pets)
func attempt(_ s: String) { do { _ = try JSONDecoder().decode([Shape].self, from: s.data(using: .utf8)!); print("ok") } catch { print(error) } }
attempt("[{\\"triangle\\":{}}]")
attempt("[{\\"circle\\":{}}]")
attempt("[{}]")
attempt("[{\\"circle\\":{\\"radius\\":2},\\"empty\\":{}}]")
attempt("[\\"empty\\"]")
attempt("[{\\"circle\\":{\\"radius\\":\\"x\\"}}]")
attempt("[{\\"circle\\":{\\"radius\\":2,\\"extra\\":1}}]")
attempt("[{\\"circle\\":null}]")
attempt("[null]")`;
    expect(await ok(src)).toBe([
      '3 [main.Shape.circle(radius: 2.0), main.Shape.square(3.5), main.Shape.empty]',
      '[{"circle":{"radius":2}},{"square":{"_0":3.5}},{"empty":{}}]',
      '[main.Pet.dog(name: "Rex", age: 3), main.Pet.cat]',
      'DecodingError.typeMismatch: expected value of type Shape. Path: [0]. Debug description: Invalid number of keys found, expected one.',
      'DecodingError.keyNotFound: Key \'radius\' not found in keyed decoding container. Path: [0].circle. Debug description: No value associated with key CircleCodingKeys(stringValue: "radius", intValue: nil) ("radius").',
      'DecodingError.typeMismatch: expected value of type Shape. Path: [0]. Debug description: Invalid number of keys found, expected one.',
      'DecodingError.typeMismatch: expected value of type Shape. Path: [0]. Debug description: Invalid number of keys found, expected one.',
      'DecodingError.typeMismatch: expected value of type Dictionary<String, Any>. Path: [0]. Debug description: Expected to decode Dictionary<String, Any> but found a string instead.',
      'DecodingError.typeMismatch: expected value of type Double. Path: [0].circle.radius. Debug description: Expected to decode Double but found a string instead.',
      'ok',
      'DecodingError.valueNotFound: Expected value of type Dictionary<String, Any> but found null instead. Path: [0].circle. Debug description: Cannot get keyed decoding container -- found null value instead',
      'DecodingError.valueNotFound: Expected value of type Dictionary<String, Any> but found null instead. Path: [0]. Debug description: Cannot get keyed decoding container -- found null value instead',
    ].join('\n') + '\n');
  });
});

describe('Review round: ranges, parsing, copies, growth, widths (H1-H4, M1, M3-M7)', () => {
  it('H1: ranges and strides beyond 2^53 step exactly', async () => {
    expect(await ok('print(Array(9007199254740992..<9007199254740994), Array(stride(from: 9007199254740992, to: 9007199254740996, by: 2)))')).toBe('[9007199254740992, 9007199254740993] [9007199254740992, 9007199254740994]\n');
    expect(await ok('print(Array(UInt8(1)...UInt8(3)).map { type(of: $0) }, (1...3).map { $0 * 2 }, Array(stride(from: 5, through: 1, by: -2)))')).toBe('[Swift.UInt8, Swift.UInt8, Swift.UInt8] [2, 4, 6] [5, 3, 1]\n'); // metatypes in a collection print qualified (swiftc)
    const r = await run('let big = Array(0..<6000000)', { maxSteps: 100000 });
    expect(r.error?.kind).toMatch(/limit|runtime/);
  });
  it('H2: Double(String) is a linear parser with Swift\'s grammar', async () => {
    expect(await ok('print(Double("1.5e3") as Any, Double("1.") as Any, Double(".5") as Any, Double("1e") as Any, Double("+inf") as Any, Double(" 1") as Any, Double("1_0") as Any, Double("0x1p3") as Any, Double("-.5e-2") as Any, Double("1e400") as Any, Double("NaN") as Any, Double("") as Any, Double("1.5.5") as Any, Double("+") as Any, Double("-Infinity") as Any)'))
      .toBe('Optional(1500.0) Optional(1.0) Optional(0.5) nil Optional(inf) nil nil Optional(8.0) Optional(-0.005) Optional(inf) Optional(nan) nil nil nil Optional(-inf)\n');
    // 200,000 digits: a quadratic parser would need tens of billions of character
    // steps and trip the hang guard; a linear one is done in milliseconds.
    const t0 = performance.now();
    const r = await run('let s = String(repeating: "9", count: 200000) + "x"\nprint(Double(s) == nil, Double(String(repeating: "9", count: 200000))! > 1e300)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('true true\n');
    expect(r.steps).toBeLessThan(150_000); // about 69,000 today, nearly all of it the charged String(repeating:) work
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
  });
  it('H3: copyValue reports copied elements to hooks.onCopy in slices', () => {
    const calls = [];
    const prev = hooks.onCopy;
    hooks.onCopy = (delta, total) => { calls.push([delta, total]); return true; };
    try {
      const inner = new SArray(Array.from({ length: 20000 }, (_, i) => i));
      copyValue(new SArray([inner, inner]));
      // past one 4096-unit slice, so reported at least twice: the outer array (1) and
      // two inner arrays (1 each) plus 40,000 shallow scalars at an eighth each
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls.reduce((s, [d]) => s + d, 0)).toBe(1 + 2 * (1 + 20000 / 8));
      expect(calls[calls.length - 1][1]).toBe(1 + 2 * (1 + 20000 / 8));
      calls.length = 0;
      copyValue(new SArray(Array.from({ length: 100 }, (_, i) => i)));
      expect(calls).toEqual([[14, 14]]); // ceil(1 + 100 / 8)
      calls.length = 0;
      // levels 0-3 are shallow (a container costs 1); the level-4 array and the
      // level-5 scalar cost 8 each
      let nest = new SArray([1]);
      for (let i = 0; i < 4; i++) nest = new SArray([nest]);
      copyValue(nest);
      expect(calls).toEqual([[20, 20]]);
      calls.length = 0;
      // doubling with no scalar leaves at all still pays 8 per deep container
      let tree = new SArray([]);
      for (let i = 0; i < 10; i++) tree = new SArray([tree, tree]);
      copyValue(tree);
      expect(calls[calls.length - 1][1]).toBe(1 + 2 + 4 + 8 + 8 * (2 ** 11 - 16));
      hooks.onCopy = () => false;
      expect(() => copyValue(new SArray([1, 2, 3]))).toThrow(/exceeds what this in-browser playground allows/);
      calls.length = 0;
      hooks.onCopy = (d, t) => { calls.push([d, t]); return true; };
      copyValue(5);
      copyValue('abc');
      expect(calls.length).toBe(0);
    } finally {
      hooks.onCopy = prev;
    }
  });
  it('H3: exponential copies are stopped by the budget', async () => {
    // default step budget on purpose: the real limit must stop nested doubling
    const r = await run('var a: [Any] = [1]\nfor _ in 0..<40 { a = [a, a] }\nprint(a.count)');
    expect(r.error?.kind).toBe('limit');
    expect(r.stdout).toBe('');
    // the same doubling without scalar leaves (empty arrays, indirect enums,
    // dictionaries, structs) pays for its deep containers too
    for (const src of [
      'var a: [Any] = []\nfor _ in 0..<40 { a = [a, a] }\nprint(a.count)',
      'indirect enum T { case leaf; case node(T, T) }\nvar t = T.leaf\nfor _ in 0..<40 { t = .node(t, t) }\nprint("done")',
      'var d: [String: Any] = [:]\nfor _ in 0..<40 { d = ["l": d, "r": d] }\nprint(d.count)',
      'struct B { var l: [B] = []; var r: [B] = [] }\nvar b = B()\nfor _ in 0..<40 { b = B(l: [b], r: [b]) }\nprint("done")',
    ]) {
      const t0 = performance.now();
      const v = await run(src);
      expect(v.error?.kind).toBe('limit');
      expect(v.stdout).toBe('');
      expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
    }
  });
  it('H3: copying an array of small structs stays cheap', async () => {
    const r = await run('struct P { var x = 0.0; var y = 0.0; var vx = 1.0; var vy = 0.5 }\nvar ps = (0..<1000).map { _ in P() }\nfor _ in 0..<50 { ps = ps.map { var p = $0; p.x += p.vx; p.y += p.vy; return p } }\nprint(ps[0].x)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('50.0\n');
    expect(r.steps).toBeLessThan(1_000_000); // about 590,000 today
  });
  it('H4: replacingOccurrences sizes its result against the capacity budget', async () => {
    expect(await ok('import Foundation\nprint("abcabc".replacingOccurrences(of: "b", with: "XY"), "aaa".replacingOccurrences(of: "", with: "-"), "abc".replacingOccurrences(of: "x", with: "y"), "a-b".replacing("-", with: "+"))')).toBe('aXYcaXYc aaa abc a+b\n');
    const r = await run('import Foundation\nvar s = String(repeating: "a", count: 1000)\nfor _ in 0..<25 { s = s.replacingOccurrences(of: "a", with: "aa") }\nprint(s.count)');
    expect(r.error?.kind).toBe('limit');
    expect(r.stdout).toBe('');
  });
  it('M1: insert(contentsOf:) and append(contentsOf:) with the array itself', async () => {
    expect(await ok('var b = [1, 2, 3]\nb.insert(contentsOf: b, at: 1)\nb.append(contentsOf: b)\nprint(b)')).toBe('[1, 1, 2, 3, 2, 3, 1, 1, 2, 3, 2, 3]\n');
    expect(await ok('var c = [1, 2, 3]\nc[0...0] = c\nprint(c)')).toBe('[1, 2, 3, 2, 3]\n');
  });
  it('M3: UInt and UInt64 are unsigned 64-bit', async () => {
    expect(await ok('print(UInt64("18446744073709551615") as Any, UInt64(exactly: -1) as Any, UInt64.max &+ 0, UInt64.max &+ 1, UInt.max, UInt64.min, UInt("-1") as Any)')).toBe('Optional(18446744073709551615) nil 18446744073709551615 0 18446744073709551615 0 nil\n');
    expect(await ok('print(UInt64(9) &- 10, UInt64(1) << 63, UInt64.max >> 1, UInt64.max / 2, UInt64.max % 7, UInt64(3) * 5, type(of: UInt.max), UInt64.max == UInt64("18446744073709551615")!)')).toBe('18446744073709551615 9223372036854775808 9223372036854775807 9223372036854775807 1 15 UInt true\n');
    expect((await fails('let u: UInt64 = 5\nprint(u - 6)')).message).toMatch(/arithmetic overflow/);
    expect((await fails('print(Int(UInt64.max))')).message).toBe('Fatal error: Not enough bits to represent the passed value');
    expect(await ok('let u: UInt = 18446744073709551615\nlet v: UInt64? = 9223372036854775808\nlet w: [UInt64] = [18446744073709551615]\nprint(u, u &+ 1, v!, w[0] == UInt64.max)')).toBe('18446744073709551615 0 9223372036854775808 true\n');
    expect((await fails('let u: UInt = 18446744073709551616')).message).toBe("integer literal '18446744073709551616' overflows when stored into 'UInt'");
    expect((await fails('let u: UInt = -1')).message).toMatch(/negative integer '-1' overflows when stored into unsigned type 'UInt'|cannot convert/);
    expect((await fails('print(18446744073709551615)')).message).toBe("integer literal '18446744073709551615' overflows when stored into 'Int'");
  });
  it('M4: elements written into a typed array take its width', async () => {
    expect(await ok('var a: [UInt8] = []\na.append(255)\na[0] = 7\na.insert(200, at: 0)\na.append(contentsOf: [1, 2])\nprint(type(of: a[0]), a[0] &+ 100, a[1] &+ 1, a, a[3] &+ 255)')).toBe('UInt8 44 8 [200, 7, 1, 2] 1\n');
    expect(await ok('var d: [Double] = []\nd.append(1)\nprint(d, "hi".utf8.map { $0 &+ 200 }, type(of: "hi".utf8.first!))')).toBe('[1.0] [48, 49] UInt8\n');
    expect((await fails('var a: [UInt8] = [1]\na.append(300)')).message).toBe("integer literal '300' overflows when stored into 'UInt8'");
  });
  it('M5: negate() traps on the minimum value', async () => {
    expect((await fails('var x = Int8.min\nx.negate()\nprint(x)')).message).toBe('Fatal error: arithmetic overflow');
    expect((await fails('var y = Int.min\ny.negate()\nprint(y)')).message).toBe('Fatal error: arithmetic overflow');
    expect(await ok('var z = 5\nz.negate()\nvar w = Int8(-128) &+ 1\nw.negate()\nvar big = Int.max\nbig.negate()\nprint(z, w, big)')).toBe('-5 127 -9223372036854775807\n');
  });
  it('M6: JSON integers keep their spelling regardless of reviver support', async () => {
    const src = 'import Foundation\nstruct A: Codable { var id: Int }\nlet a = try JSONDecoder().decode([A].self, from: "[{\\"id\\": 9007199254740993.0}, {\\"id\\": 9007199254740993e0}, {\\"id\\": 1E2}, {\\"id\\": -0}]".data(using: .utf8)!)\nprint(a.map { $0.id })\nstruct U: Codable { var u: UInt64 }\nprint(try JSONDecoder().decode(U.self, from: "{\\"u\\": 18446744073709551615}".data(using: .utf8)!).u)';
    expect(await ok(src)).toBe('[9007199254740993, 9007199254740993, 100, 0]\n18446744073709551615\n');
    const foundation = fs.readFileSync(path.resolve('src/engine/foundation.js'), 'utf8');
    expect(foundation).toMatch(/from '\.\.\/shared\/json-numbers\.js'/);
    expect(foundation).not.toMatch(/ctx\.source|NUMBER_TEXT/);
  });
  it('M7: optional associated values decode as nil when absent', async () => {
    const src = `import Foundation
enum E: Codable { case item(x: Int?), pair(Int?), both(x: Int?, y: String) }
let es = try JSONDecoder().decode([E].self, from: "[{\\"item\\":{}},{\\"item\\":{\\"x\\":null}},{\\"item\\":{\\"x\\":3}},{\\"pair\\":{}},{\\"pair\\":{\\"_0\\":4}},{\\"both\\":{\\"y\\":\\"s\\"}}]".data(using: .utf8)!)
print(es)
print(String(data: try JSONEncoder().encode(es), encoding: .utf8)!)
do { _ = try JSONDecoder().decode([E].self, from: "[{\\"both\\":{\\"x\\":1}}]".data(using: .utf8)!) } catch { print(error) }`;
    expect(await ok(src)).toBe([
      '[main.E.item(x: nil), main.E.item(x: nil), main.E.item(x: Optional(3)), main.E.pair(nil), main.E.pair(Optional(4)), main.E.both(x: nil, y: "s")]',
      '[{"item":{}},{"item":{}},{"item":{"x":3}},{"pair":{}},{"pair":{"_0":4}},{"both":{"y":"s"}}]',
      'DecodingError.keyNotFound: Key \'y\' not found in keyed decoding container. Path: [0].both. Debug description: No value associated with key BothCodingKeys(stringValue: "y", intValue: nil) ("y").',
    ].join('\n') + '\n');
  });
});

describe('Review pass 2: description limits, encoding budgets, scans, widths', () => {
  it('H2: describe() stops at a length limit and reports progress to hooks.checkCapacity', () => {
    const big = new SArray(Array.from({ length: 10000 }, (_, i) => i));
    const cut = describeValue(big, false, { limit: 50 });
    expect(cut.startsWith('[0, 1, 2')).toBe(true);
    expect(cut.length).toBeLessThan(60);
    expect(describeValue(big).length).toBeGreaterThan(48000);
    const long = 'x'.repeat(100000);
    expect(describeValue(long, false, { limit: 300 }).length).toBe(301);
    expect(describeValue(new SArray([long]), true, { limit: 300 }).length).toBeLessThan(320);
    expect(describeValue(new SArray([1, 2]), false, { limit: 300 })).toBe('[1, 2]');
    const seen = [];
    const prev = hooks.checkCapacity;
    hooks.checkCapacity = (n) => { seen.push(n); if (n > 100000) throw new Error('too big'); };
    try {
      describeValue(big); // about 49k characters: reported in 4096-character slices
      expect(seen.length).toBeGreaterThan(5);
      expect(() => describeValue(new SArray(Array.from({ length: 50000 }, (_, i) => i)))).toThrow('too big');
    } finally {
      hooks.checkCapacity = prev;
    }
  });
  it('H3: encoding a shared object graph is charged per node', async () => {
    const graph = (depth) => `import Foundation\nclass Node: Codable { var kids: [Node]; init(_ k: [Node]) { kids = k } }\nvar n = Node([])\nfor _ in 0..<${depth} { n = Node([n, n]) }\nlet d = try JSONEncoder().encode(n)\nprint(d.count > 0)`;
    expect(await ok(graph(8))).toBe('true\n');
    const r = await run(graph(22));
    expect(r.error?.kind).toBe('limit');
    expect(r.stdout).toBe('');
  });
  it('H4: format padding and huge descriptions meet the budget', async () => {
    expect(await ok('import Foundation\nprint(String(format: "%5d|%-5d|%05.1f|%x", 42, 42, 3.14159, 255))')).toBe('   42|42   |003.1|ff\n');
    const r = await run('import Foundation\nlet s = String(format: "%20000000d", 1)\nprint(s.count)');
    expect(r.error?.kind).toBe('limit');
    const d = await run('let s = String(repeating: "x", count: 100000)\nlet a = Array(repeating: s, count: 200)\nprint(a)');
    expect(d.error?.kind).toBe('limit');
  });
  it('H5: native scans are charged by elements scanned', async () => {
    expect(await ok('let big = Array(repeating: 0, count: 10000)\nvar n = 0\nfor _ in 0..<100 { if big.contains(1) { n += 1 } }\nprint(n, big.firstIndex(of: 1) == nil, big.min()!, "abc".contains("bc"), "a,b,,c".components(separatedBy: ","))')).toBe('0 true 0 true ["a", "b", "", "c"]\n');
    const r = await run('let big = Array(repeating: 0, count: 100000)\nvar n = 0\nfor _ in 0..<2000 { if big.contains(1) { n += 1 } }\nprint(n)');
    expect(r.error?.kind).toBe('limit');
    expect(r.error?.message).toMatch(/steps/);
    const s = await run('let text = String(repeating: "a", count: 100000)\nvar n = 0\nfor _ in 0..<2000 { if text.contains("b") { n += 1 } }\nprint(n)');
    expect(s.error?.kind).toBe('limit');
  });
  it('M3: UInt64 values convert to Double and to radix strings', async () => {
    expect(await ok('print(Double(UInt64.max), String(UInt64.max, radix: 16), String(UInt64.max, radix: 2).count, Double(UInt64.max) / 2, UInt64.max / 3, Double(UInt64.max - 1) == Double(UInt64.max), Int(Double(UInt64.max) / 8))')).toBe('1.8446744073709552e+19 ffffffffffffffff 64 9.223372036854776e+18 6148914691236517205 true 2305843009213693952\n');
    expect(await ok('print(Double(Int64.min), Double(9007199254740993), String(Int64.min, radix: 2))')).toBe('-9.223372036854776e+18 9007199254740992.0 -1000000000000000000000000000000000000000000000000000000000000000\n');
    expect(await ok('print(9007199254740992.0, 9007199254740994.0, 9999999999999998.0, 1e16, 1.0e15, 4503599627370496.5)')).toBe('9007199254740992.0 9.007199254740994e+15 9.999999999999998e+15 1e+16 1000000000000000.0 4503599627370496.0\n');
  });
  it('M4: stride over a fixed-width type keeps the width', async () => {
    expect(await ok('print(Array(stride(from: UInt8(250), through: UInt8.max, by: 2)).map { $0 &+ 1 }, type(of: Array(stride(from: UInt8(1), to: UInt8(3), by: 1))[0]))')).toBe('[251, 253, 255] UInt8\n');
  });
  it('M5: range count and isEmpty are exact past 2^53', async () => {
    expect(await ok('print((9007199254740992...9007199254740993).count, ((UInt64.max - 1)...UInt64.max).count, (9007199254740992..<9007199254740994).isEmpty, (UInt64.max..<UInt64.max).isEmpty, (1...UInt8.max).count)')).toBe('2 2 false true 255\n');
    expect((await fails('print((0...UInt64.max).count)')).message).toBe('Fatal error: Distance is not representable in Int');
  });
  it('M6: a value of another width cannot be written into a typed array', async () => {
    expect((await fails('var a: [UInt8] = [0]\na.append(UInt64.max)')).message).toBe("cannot convert value of type 'UInt64' to expected argument type 'UInt8'");
    expect((await fails('var a: [Int] = [0]\na[0] = UInt8(1)')).message).toBe("cannot convert value of type 'UInt8' to expected argument type 'Int'");
    expect(await ok('var a: [UInt8] = [0]\na.append(UInt8(9))\nprint(a)')).toBe('[0, 9]\n');
  });
  it('L1: hex floats scale the mantissa by the exponent exactly', async () => {
    expect(await ok('print(Double("0x1" + String(repeating: "0", count: 300) + "p-1200") as Any, Double("0x1.8p1") as Any, Double("0x.8p0") as Any, Double("0xp3") as Any, Double("0x1p-1074") as Any, Double("0x1p1024") as Any)')).toBe('Optional(1.0) Optional(3.0) Optional(0.5) nil Optional(5e-324) Optional(inf)\n');
  });
});

describe('Codable round trips through decoded values', () => {
  it('encode(decode(encode(x))) works for a struct whose fields have only defaults', async () => {
    const src = 'import Foundation\nstruct Rec: Codable { var a = 1; var e = [1,2,3] }\nlet enc = JSONEncoder(); let dec = JSONDecoder()\nvar last = Rec()\nfor _ in 0..<3 { let data = try! enc.encode(last); last = try! dec.decode(Rec.self, from: data) }\nprint(last.a, last.e)';
    expect(await ok(src)).toBe('1 [1, 2, 3]\n');
  });
  it('a 20-field struct survives three round trips', async () => {
    const src = `import Foundation
let enc = JSONEncoder(); let dec = JSONDecoder()
enum Kind: String, Codable { case a, b }
enum Shape: Codable, Equatable { case circle(radius: Double), empty }
struct Point: Codable, Equatable { var x = 0.5; var y = 2 }
struct Big: Codable {
    var i = 1
    var d = 2.5
    var s = "s"
    var b = true
    var ints = [1, 2]
    var strs = ["a", "b"]
    var dbls = [1.5, 2.0]
    var dict = ["k": 1]
    var opt: Int? = 7
    var none: String? = nil
    var p = Point()
    var k = Kind.b
    var shape = Shape.circle(radius: 1.5)
    var date = Date(timeIntervalSinceReferenceDate: 86400)
    var bytes: [UInt8] = [1, 255]
    var u: UInt64 = 18446744073709551615
    var i8: Int8 = -5
    var nested = [[1], [2, 3]]
    var set: Set<Int> = [3]
    var pts = [Point(), Point(x: 1, y: 1)]
}
var big = Big()
for _ in 0..<3 { let data = try! enc.encode(big); big = try! dec.decode(Big.self, from: data) }
print(big.i, big.d, big.s, big.b, big.ints, big.strs, big.dbls, big.dict, big.opt as Any, big.none as Any)
print(big.p, big.k, big.shape, big.date.timeIntervalSinceReferenceDate, big.bytes, big.u, big.i8, big.nested, big.set, big.pts)
enc.outputFormatting = [.sortedKeys]
print(String(data: try! enc.encode(big), encoding: .utf8)!)`;
    expect(await ok(src)).toBe([
      '1 2.5 s true [1, 2] ["a", "b"] [1.5, 2.0] ["k": 1] Optional(7) nil',
      'Point(x: 0.5, y: 2) b circle(radius: 1.5) 86400.0 [1, 255] 18446744073709551615 -5 [[1], [2, 3]] [3] [main.Point(x: 0.5, y: 2), main.Point(x: 1.0, y: 1)]',
      '{"b":true,"bytes":[1,255],"d":2.5,"date":86400,"dbls":[1.5,2],"dict":{"k":1},"i":1,"i8":-5,"ints":[1,2],"k":"b","nested":[[1],[2,3]],"opt":7,"p":{"x":0.5,"y":2},"pts":[{"x":0.5,"y":2},{"x":1,"y":1}],"s":"s","set":[3],"shape":{"circle":{"radius":1.5}},"strs":["a","b"],"u":18446744073709551615}',
    ].join('\n') + '\n');
  });
});

describe('Review pass 3: hex floats, hashing, equality, escaping, early exits, cancellation', () => {
  it('H2/L1: hex floats validate first, keep 20 digits with a sticky bit and round like Swift', async () => {
    expect(await ok('print(Double("0x1.00000000000008001p0") as Any, Double("0x1.00000000000008p0") as Any, Double("0x1.000000000000080000000000000001p0") as Any, Double("0x" + String(repeating: "f", count: 40) + "p0") as Any, Double("0x1.fffffffffffff8p0") as Any, Double("0x1.fffffffffffff7fffp0") as Any)'))
      .toBe('Optional(1.0000000000000002) Optional(1.0) Optional(1.0000000000000002) Optional(1.461501637330903e+48) Optional(2.0) Optional(1.9999999999999998)\n');
    const t0 = performance.now();
    const r = await run('print(Double("0x" + String(repeating: "f", count: 200000) + "z") == nil, Double("0x" + String(repeating: "f", count: 1000000)) as Any, Double("0x1" + String(repeating: "0", count: 300) + "p-1200") as Any)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('true Optional(inf) Optional(1.0)\n');
    expect(r.steps).toBeLessThan(500_000); // about 225,000 today; a digit-by-digit parse of the million f's would be charged far more
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
  });
  it('H3: long strings hash to a digest, container keys are charged and capped', async () => {
    // 2,000 x 10,000-char strings as one key: no 20M-char concatenation is built
    const t0 = performance.now();
    const r = await run('var d: [[String]: Int] = [:]\nlet s = String(repeating: "x", count: 10000)\nlet key = Array(repeating: s, count: 2000)\nd[key] = 1\nprint(d.count, d[key]!)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('1 1\n');
    expect(r.steps).toBeLessThan(2_500_000); // about 1,264,000 today, almost all of it the charged hashing of the 2,000 strings
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
    expect(await ok('var d: [String: Int] = [:]\nlet a = String(repeating: "a", count: 2000)\nlet b = a + "b"\nd[a] = 1\nd[b] = 2\nvar s: Set<[String]> = [[a, b], [b, a], [a, b]]\nprint(d.count, d[a]!, d[b]!, s.count, s.contains([a, b]))')).toBe('2 1 2 2 true\n');
    const charged = [], seen = [];
    const prevCharge = hooks.charge, prevCap = hooks.checkCapacity;
    hooks.charge = (n) => charged.push(n);
    hooks.checkCapacity = (n) => seen.push(n);
    try {
      hashKey(new SArray(Array.from({ length: 100000 }, (_, i) => i)));
      expect(charged.reduce((s, n) => s + n, 0)).toBeGreaterThanOrEqual(100000 / 16);
      expect(seen.length).toBeGreaterThan(50); // reported every 4096 characters while the key grows
      expect(Math.max(...seen)).toBeGreaterThan(400000);
      expect(hashKey('y'.repeat(5000))).not.toBe(hashKey('y'.repeat(4999) + 'z'));
      expect(hashKey('y'.repeat(5000))).toBe(hashKey('y'.repeat(5000)));
    } finally {
      hooks.charge = prevCharge; hooks.checkCapacity = prevCap;
    }
  });
  it('H4: String(format:) checks the running total, not just each fragment', async () => {
    const r = await run('import Foundation\nlet s = String(format: "%10000000d%10000000d", 1, 2)\nprint(s.count)');
    expect(r.error?.kind).toBe('limit');
    expect(await ok('import Foundation\nprint(String(format: "%3d|%s|%-4d|", 7, "ab", 9))')).toBe('  7|ab|9   |\n');
  });
  it('H5: equality over collections charges through hooks.charge', async () => {
    const charged = [];
    const prev = hooks.charge;
    hooks.charge = (n) => charged.push(n);
    try {
      const a = new SArray(Array.from({ length: 100000 }, (_, i) => i)), b = new SArray(Array.from({ length: 100000 }, (_, i) => i));
      expect(equals(a, b)).toBe(true);
      expect(charged.reduce((s, n) => s + n, 0)).toBeGreaterThanOrEqual(100000 / 16);
    } finally {
      hooks.charge = prev;
    }
    expect(await ok('var a = Array(repeating: 1, count: 1000)\na.reverse()\na.shuffle()\nprint(a.count, a == Array(repeating: 1, count: 1000))')).toBe('1000 true\n');
    // always runs: equality is charged by the running interpreter's hook
    expect(typeof hooks.charge).toBe('function');
    const r = await run('let a = Array(repeating: 0, count: 100000)\nlet b = a\nvar n = 0\nfor _ in 0..<1000 { if a == b { n += 1 } }\nprint(n)');
    expect(r.error?.kind).toBe('limit');
  });
  it('H6: JSON string escaping is bounded before it is built', async () => {
    expect(await ok('import Foundation\nprint(String(data: try! JSONEncoder().encode(String(repeating: "\\u{0}", count: 3) + "a/b"), encoding: .utf8)!)')).toBe('"\\u0000\\u0000\\u0000a\\/b"\n');
    const r = await run('import Foundation\nlet d = try! JSONEncoder().encode(String(repeating: "\\u{0}", count: 4000000))\nprint(d.count)');
    expect(r.error?.kind).toBe('limit');
    expect(r.stdout).toBe('');
  });
  it('M1: early-exit searches pay only for the elements they visit', async () => {
    const src = 'let a = Array(repeating: 0, count: 10000)\nvar n = 0\nfor _ in 0..<5000 { if a.contains(0) { n += 1 }; if a.firstIndex(of: 0) == 0 { n += 1 }; if a.contains(where: { $0 == 0 }) { n += 1 }; if !a.allSatisfy({ $0 == 1 }) { n += 1 }; if a.first(where: { $0 == 0 }) != nil { n += 1 } }\nprint(n, a.lastIndex(of: 0)!, a.elementsEqual(a), a.starts(with: [0, 0]))';
    expect(await ok(src)).toBe('25000 9999 true true\n');
  });
  it('M4: range counts are exact whenever the span is large', async () => {
    expect(await ok('print((-9007199254740991...9007199254740991).count, (-4503599627370496..<4503599627370496).count, (1...3).count, (3..<3).count)')).toBe('18014398509481983 9007199254740992 3 0\n');
  });
  it('M6: Task.cancel() wakes a sleeping task so the sleep throws now', async () => {
    const src = `let t = Task { do { try await Task.sleep(for: .seconds(10)); print("slept") } catch { print("cancelled") } }
let u = Task { try? await Task.sleep(for: .seconds(1)); print("one second") }
t.cancel()
_ = await t.value
_ = await u.value`;
    expect(await ok(src)).toBe('cancelled\none second\n');
  });
});

describe('Review pass 4: incremental hashing, lazy utf8, charged scans, subnormals, generic defaults', () => {
  it('H2: container keys are checked while they grow and digested once long', async () => {
    const r = await run('var d: [[String]: Int] = [:]\nlet s = String(repeating: "x", count: 1023)\nlet key = Array(repeating: s, count: 20000)\nd[key] = 1\nprint(d.count)');
    expect(r.error?.kind).toBe('limit');
    expect(await ok('var d: [[String]: Int] = [:]\nlet s = String(repeating: "x", count: 1023)\nlet key = Array(repeating: s, count: 2000)\nd[key] = 1\nd[key + ["y"]] = 2\nprint(d.count, d[key]!, d[key + ["y"]]!)')).toBe('2 1 2\n');
    const seen = [];
    const prev = hooks.checkCapacity;
    hooks.checkCapacity = (n) => { seen.push(n); if (n > 50000) throw new Error('key too long'); };
    try {
      const parts = Array.from({ length: 3000 }, (_, i) => 'k'.repeat(30) + i);
      expect(() => hashKey(new SArray(parts))).toThrow('key too long');
      expect(Math.max(...seen)).toBeLessThan(60000);
      expect(hashKey(new SArray(parts.slice(0, 100))).length).toBeLessThan(200);
    } finally {
      hooks.checkCapacity = prev;
    }
  });
  it('H3: utf8 is a lazy view that counts without boxing and caps materialisation', async () => {
    expect(await ok('let s = "héllo\\r\\nwörld"\nprint(s.count, s.utf8.count, Array(s.utf8).count, s.utf8.first!, s.utf8.map { $0 }.last!, s.utf8.contains(195), "abc".utf8.reversed().first!, type(of: s.utf8.first!), String(decoding: s.utf8, as: UTF8.self) == s, Data(s.utf8).count)')).toBe('11 14 14 104 100 true 99 UInt8 true 14\n');
    expect(await ok('var total = 0\nfor b in "hi".utf8 { total += Int(b) }\nprint(total, [UInt8]("ok".utf8))')).toBe('209 [111, 107]\n');
    const r = await run('let big = String(repeating: "é", count: 1000000)\nprint(big.utf8.count, big.utf8.isEmpty)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('2000000 false\n');
    expect(r.steps).toBeLessThan(400000);
    const capped = await run('let big = String(repeating: "é", count: 9000000)\nprint(Array(big.utf8).count)');
    expect(capped.error?.kind).toBe('limit');
  });
  it('H4: string comparison, Data equality and segmentation are charged', async () => {
    expect(await ok('print("a" < "b", "abc" < "abd", "Z" < "a", "é" > "e", "" < "a", "apple" == "apple", "ab" < "abc", "😀" > "z")')).toBe('true true true true true true true true\n');
    const charged = [];
    const prev = hooks.charge;
    hooks.charge = (n) => charged.push(n);
    try {
      expect(compare('x'.repeat(100000), 'x'.repeat(99999) + 'y')).toBe(-1);
      expect(charged.reduce((s, n) => s + n, 0)).toBeGreaterThanOrEqual(100000 / 16);
      charged.length = 0;
      expect(graphemeCount('abc'.repeat(100000))).toBe(300000);
      expect(charged.reduce((s, n) => s + n, 0)).toBeGreaterThanOrEqual(300000 / 16);
      expect(graphemeCount('a\r\nb')).toBe(3);
      expect(charsOf('a\r\nb')).toEqual(['a', '\r\n', 'b']);
    } finally {
      hooks.charge = prev;
    }
    expect(await ok('var s = String(repeating: "a", count: 1000)\nvar n = 0\nfor _ in 0..<50 { s.append("b"); n += s.count }\nprint(n)')).toBe('51275\n');
  });
  it('H5: task-group results are retrieved in amortised constant time', async () => {
    const r = await run('let total = await withTaskGroup(of: Int.self) { g in\n    for i in 0..<3000 { g.addTask { i } }\n    var s = 0\n    for await v in g { s += v }\n    return s\n}\nprint(total)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('4498500\n');
    expect(r.steps).toBeLessThan(400000);
  });
  it('M1: subnormal hex floats round once on the mantissa', async () => {
    expect(await ok('print(Double("0x1.00000000000000001p-1075") as Any, Double("0x1p-1075") as Any, Double("0x1.8p-1075") as Any, Double("0x3p-1075") as Any, Double("0x1p-1074") as Any, Double("0x1.fffffffffffffp1023") as Any, Double("0x1.fffffffffffff8p1023") as Any, Double("0x1.00000000000008p-1022") as Any, Double("0x1.00000000000008001p-1022") as Any, Double("0x0.fffffffffffff8p-1022") as Any)'))
      .toBe('Optional(5e-324) Optional(0.0) Optional(5e-324) Optional(1e-323) Optional(5e-324) Optional(1.7976931348623157e+308) Optional(inf) Optional(2.2250738585072014e-308) Optional(2.225073858507202e-308) Optional(2.2250738585072014e-308)\n');
  });
  it('M2: defaults with generic element types decode', async () => {
    const src = 'import Foundation\nstruct R: Codable { var a = Array(repeating: [1,2], count: 2); var d = Array(repeating: ["k": 1], count: 1); var o: [Int?] = [1, nil]; var s = Array(repeating: Set([1]), count: 1) }\nlet enc = JSONEncoder()\nenc.outputFormatting = [.sortedKeys]\nlet data = try enc.encode(R())\nlet back = try JSONDecoder().decode(R.self, from: data)\nprint(back.a, back.d, back.o, back.s, String(data: data, encoding: .utf8)!)';
    expect(await ok(src)).toBe('[[1, 2], [1, 2]] [["k": 1]] [Optional(1), nil] [Set([1])] {"a":[[1,2],[1,2]],"d":[{"k":1}],"o":[1,null],"s":[[1]]}\n');
  });
});

describe('Review pass 5: lexer EOF, key hashing, Data budgets, dictionary views, integer text, task groups', () => {
  it('lexer: an unterminated \\u{ escape and a lone backtick report what swiftc reports', async () => {
    expect((await fails('let s = "\\u{41')).message).toBe("expected '}' in \\u{...} escape sequence");
    expect((await fails('let `')).message).toBe('expected pattern');
    expect((await fails('let `abc = 1\n')).message).toBe('expected pattern');
  });
  it('H2: container keys hash one child at a time and pay for their length', async () => {
    let described = 0;
    const child = () => ({ describe() { described++; return 'x'.repeat(30); } });
    const prevCap = hooks.checkCapacity, prevCharge = hooks.charge;
    hooks.checkCapacity = () => { throw new Error('first check'); };
    try {
      expect(() => hashKey(new SArray(Array.from({ length: 10000 }, child)))).toThrow('first check');
      expect(described).toBeLessThan(200); // checked after ~128 children, not after all 10,000
    } finally {
      hooks.checkCapacity = prevCap;
    }
    const charged = [];
    hooks.charge = (n) => charged.push(n);
    try {
      hashKey(new SArray(Array.from({ length: 2000 }, () => 'y'.repeat(1023))));
      expect(charged.reduce((a, n) => a + n, 0)).toBeGreaterThanOrEqual(2000 * 1025 / 64);
      // a set's table is already keyed by its elements' hashes: they are not recomputed
      const set = new SSet();
      for (let i = 0; i < 50; i++) set.add({ describe: () => { described++; return 'e' + i; } });
      const before = described;
      expect(hashKey(set)).toBe(hashKey(set));
      expect(described).toBe(before);
    } finally {
      hooks.charge = prevCharge;
    }
    // looking up a two-million-character key repeatedly now meets the step budget
    const t0 = performance.now();
    const r = await run('var d: [[String]: Int] = [:]\nlet s = String(repeating: "x", count: 1023)\nlet key = Array(repeating: s, count: 2000)\nd[key] = 1\nvar n = 0\nfor _ in 0..<300 { n += d[key]! }\nprint(n)');
    expect(r.error?.kind).toBe('limit');
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
    const small = await run('var d: [[Int]: Int] = [:]\nfor i in 0..<2000 { d[[i, i + 1, i + 2]] = i }\nvar s = 0\nfor i in 0..<2000 { s += d[[i, i + 1, i + 2]]! }\nprint(s)');
    expect(small.stdout).toBe('1999000\n');
    expect(small.steps).toBeLessThan(40_000); // about 20,000: short keys pay nothing extra
  });
  it('H3: every Data allocation is capped and charged by byte count', async () => {
    expect(await ok('import Foundation\nlet d = "héllo".data(using: .utf8)!\nlet e = try JSONEncoder().encode([1, 2])\nprint(d.count, Data("hi".utf8).count, Data([104, 105]).count, String(data: d, encoding: .utf8)!, String(decoding: [104, 105] as [UInt8], as: UTF8.self), String(data: e, encoding: .utf8)!, Data().isEmpty)'))
      .toBe('6 2 2 héllo hi [1,2] true\n');
    const base = await run('import Foundation\nlet s = String(repeating: "a", count: 1_000_000)\nprint(1000000)');
    const conv = await run('import Foundation\nlet s = String(repeating: "a", count: 1_000_000)\nlet d = Data(s.utf8)\nprint(d.count)');
    expect(conv.stdout).toBe('1000000\n');
    expect(conv.steps - base.steps).toBeGreaterThanOrEqual(1_000_000 / 16);
    const many = await run('import Foundation\nlet s = String(repeating: "a", count: 2_000_000)\nvar ds: [Data] = []\nfor _ in 0..<32 { ds.append(Data(s.utf8)) }\nprint(ds.count)');
    expect(many.error?.kind).toBe('limit');
    expect(many.stdout).toBe('');
    const huge = await run('import Foundation\nlet s = String(repeating: "é", count: 9_000_000)\nlet d = Data(s.utf8)\nprint(d.count)');
    expect(huge.error?.kind).toBe('limit');
    expect(huge.error.message).toMatch(/caps collections and strings/);
    const using = await run('import Foundation\nlet s = String(repeating: "é", count: 9_000_000)\nprint(s.data(using: .utf8)!.count)');
    expect(using.error?.kind).toBe('limit');
  });
  it('H4: keys/values count and isEmpty never allocate; views keep Swift snapshot semantics', async () => {
    const r = await run('var d: [Int: Int] = [:]\nfor i in 0..<50000 { d[i] = i }\nvar n = 0\nfor _ in 0..<1000 { n += d.keys.count + d.values.count; if d.keys.isEmpty || d.values.isEmpty { n += 1 } }\nprint(n)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('100000000\n');
    expect(r.steps).toBeLessThan(150_000); // about 103,000, nearly all of it building the dictionary
    // output checked against swiftc
    expect(await ok('var d = ["a": 1, "b": 2]\nlet k = d.keys\nlet v = d.values\nd["c"] = 3\nd["a"] = 10\nprint(k.sorted(), v.sorted(), d.keys.sorted(), d.values.sorted(), d.keys.count, d.values.isEmpty)\nd.removeAll()\nprint(d.keys.count, d.keys.isEmpty, k.count, Array(d.values))\nvar e: [String: [Int]] = ["x": [1]]\nlet ev = e.values\ne["x"]!.append(2)\nprint(ev.first!, e.values.first!, e.first!.key, e.first!.value)'))
      .toBe('["a", "b"] [1, 2] ["a", "b", "c"] [2, 3, 10] 3 false\n0 true 2 []\n[1] [1, 2] x [1, 2]\n');
    // projections that do allocate are charged by element count
    const base = await run('var d: [Int: Int] = [:]\nfor i in 0..<50000 { d[i] = i }\nprint(d.count)');
    const proj = await run('var d: [Int: Int] = [:]\nfor i in 0..<50000 { d[i] = i }\nprint(d.keys.contains(-1), Array(d).count)');
    expect(proj.stdout).toBe('false 50000\n');
    expect(proj.steps - base.steps).toBeGreaterThanOrEqual(2 * 50000 / 16);
    // a for-in over utf8 walks the bytes lazily (pass 6): breaking at once costs nothing up front
    const s0 = await run('let s = String(repeating: "é", count: 1_000_000)\nprint(0)');
    const s1 = await run('let s = String(repeating: "é", count: 1_000_000)\nvar t = 0\nfor b in s.utf8 { t += Int(b); break }\nprint(t)');
    expect(s1.stdout).toBe('195\n');
    expect(s1.steps - s0.steps).toBeLessThan(50);
  });
  it('H6: integer text is scanned and bounded before any BigInt; radix parsing matches Swift', async () => {
    // both lines checked against swiftc
    expect(await ok('print(Int("00000000000000000000000000012") as Any, Int("-0") as Any, Int("+") as Any, Int("") as Any, Int(String(repeating: "1", count: 21)) as Any, Int("-" + String(repeating: "0", count: 30) + "9223372036854775808") as Any, UInt8("0000255") as Any, UInt64("18446744073709551616") as Any, Int(" 1") as Any, Int("1 ") as Any, Int("+12") as Any, Int("١٢") as Any)'))
      .toBe('Optional(12) Optional(0) nil nil nil Optional(-9223372036854775808) Optional(255) nil nil nil Optional(12) nil\n');
    expect(await ok('print(Int("ff", radix: 16) as Any, Int("0xff", radix: 16) as Any, Int("1g", radix: 16) as Any, Int(" 12", radix: 10) as Any, Int("-80", radix: 16) as Any, Int8("-80", radix: 16) as Any, Int8("80", radix: 16) as Any, UInt64("ffffffffffffffff", radix: 16) as Any, Int("zz", radix: 36) as Any, Int("ZZ", radix: 36) as Any, Int("", radix: 2) as Any, Int("-", radix: 2) as Any, Int("1_0", radix: 10) as Any, Int(String(repeating: "0", count: 100) + "1", radix: 2) as Any, Int("+1010", radix: 2) as Any, Int("7fffffffffffffff", radix: 16) as Any, Int("8000000000000000", radix: 16) as Any, Int("-8000000000000000", radix: 16) as Any, UInt("-0", radix: 16) as Any, UInt8("-1", radix: 10) as Any)'))
      .toBe('Optional(255) nil nil nil Optional(-128) Optional(-128) nil Optional(18446744073709551615) Optional(1295) Optional(1295) nil nil nil Optional(1) Optional(10) Optional(9223372036854775807) nil Optional(-9223372036854775808) Optional(0) nil\n');
    expect((await fails('print(Int("1", radix: 37) as Any)')).message).toBe('Fatal error: Radix not in range 2...36');
    const t0 = performance.now();
    const r = await run('let s = String(repeating: "7", count: 1_000_000)\nlet z = String(repeating: "0", count: 1_000_000) + "42"\nvar n = 0\nfor _ in 0..<20 { if Int(s) == nil && UInt64(s, radix: 16) == nil { n += 1 }; n += Int(z)! }\nprint(n, Double(s)! > 1e300)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('860 true\n');
    // three million-character scans per round, each charged a step per 32 characters
    expect(r.steps).toBeGreaterThanOrEqual(60 * 1_000_000 / 32);
    expect(r.steps).toBeLessThan(2_500_000);
    expect(performance.now() - t0).toBeLessThan(10_000); // hang guard only
  });
  it('M2: task-group children that finish one at a time cost O(1) each', async () => {
    const r = await run('let total = await withTaskGroup(of: Int.self) { g in\n    for i in 0..<3000 { g.addTask { try? await Task.sleep(nanoseconds: UInt64(3000 - i) * 1000); return i } }\n    var s = 0\n    for await v in g { s += v }\n    return s\n}\nprint(total)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('4498500\n');
    expect(r.steps).toBeLessThan(100_000); // about 36,000; rescanning the pending children was about 600,000
    // checked against swiftc: completion order, Void results, errors, next() and isEmpty
    expect(await ok('let order = await withTaskGroup(of: Int.self) { g in\n    for i in 0..<5 { g.addTask { try? await Task.sleep(nanoseconds: UInt64(5 - i) * 1_000_000); return i } }\n    var out: [Int] = []\n    for await v in g { out.append(v) }\n    return out\n}\nlet n = await withTaskGroup(of: Void.self) { g in\n    for i in 0..<3 { g.addTask { _ = i } }\n    var c = 0\n    for await _ in g { c += 1 }\n    return c\n}\nlet r = await withTaskGroup(of: Void.self) { g in\n    g.addTask { }\n    let x = await g.next()\n    print(x as Any, type(of: x!))\n    return await g.next() == nil\n}\nprint(order, n, r)'))
      .toBe('Optional(()) ()\n[4, 3, 2, 1, 0] 3 true\n');
    expect(await ok('func work(_ i: Int) async throws -> Int {\n    if i == 3 { throw CancellationError() }\n    return i\n}\ndo {\n    let s = try await withThrowingTaskGroup(of: Int.self) { g in\n        for i in 0..<5 { g.addTask { try await work(i) } }\n        var total = 0\n        for try await v in g { total += v }\n        return total\n    }\n    print(s)\n} catch {\n    print("caught")\n}\nlet f = await withTaskGroup(of: Int.self) { g in\n    g.addTask { try? await Task.sleep(nanoseconds: 50_000_000); return 1 }\n    g.addTask { 2 }\n    let v = await g.next()!\n    g.cancelAll()\n    print(g.isEmpty)\n    return v\n}\nprint(f)'))
      .toBe('caught\nfalse\n2\n');
  });
});

describe('Review pass 6: key strategies, string budgets, code-unit views, literals, views, task groups, Data keys', () => {
  it('H2: snake-case key strategies are linear scans with Foundation\'s exact rules', async () => {
    // every pair checked against JSONDecoder / JSONEncoder (Swift 6.2, macOS 26)
    const from = {
      first_name: 'firstName', _leading: '_leading', trailing_: 'trailing_', __both__: '__both__', a__b: 'aB', USER_NAME: 'userName',
      user_ID: 'userId', already_camelCase: 'alreadyCamelcase', camelCase: 'camelCase', _: '_', ___: '___', '': '', a_b_c: 'aBC',
      x_1st_place: 'x1StPlace', 'hello-world_foo': 'hello-worldFoo', 'été_über': 'étéÜber', _a_b_: '_aB_', 'a b_c d': 'a bC D',
      '1_2': '12', ab_CD_ef: 'abCdEf', "a_b'c": "aB'c", 'a_b.c': 'aB.C', 'ß_ß': 'ßSs', 'a_ﬁx': 'aFix', 'a_ǆx': 'aǅx',
      'a_Ǆx': 'aǄx', 'a_ΣΑΣ': 'aΣασ', 'ΑΣ_b': 'ασB', 'a_ᾳb': 'aᾼb', 'a_ªb': 'aªB', 'a_bʰc': 'aBʰc', 'a_ⓐb': 'aⓐB',
      'a_b́c': 'aB́c', 'foo_bar-baz_qux': 'fooBar-BazQux', 'a_\u{1F600}b': 'a\u{1F600}B',
    };
    for (const [k, v] of Object.entries(from)) expect(convertFromSnakeCase(k), k).toBe(v);
    const to = {
      myProperty: 'my_property', myURLProperty: 'my_url_property', URL: 'u_rl', ABCdef: 'a_b_cdef', already_snake: 'already_snake',
      x1Y: 'x1_y', 'aÜb': 'a_üb', '': '', _aB: '_a_b', aBC: 'a_bc', aBCd: 'a_b_cd', html5Parser: 'html5_parser', 'ÄÖÜx': 'ä_ö_üx',
      a_B: 'a__b', aBC1d: 'a_bc_1d', myID2Value: 'my_id2_value', A: 'a', 'aB c': 'a_b_ c', 'aB́c': 'a_b́c',
      'aBCD́e': 'a_bc_d́e', 'aǅ': 'a_ǆ', 'aⒶb': 'aⓐb', 'aΣ': 'a_σ', 'aªB': 'aª_b',
    };
    for (const [k, v] of Object.entries(to)) expect(convertToSnakeCase(k), k).toBe(v);
    for (const k of ['_'.repeat(100000), 'A'.repeat(100000), 'a_'.repeat(50000), '_'.repeat(3000) + '\nx']) {
      expect(typeof convertFromSnakeCase(k)).toBe('string');
      expect(typeof convertToSnakeCase(k)).toBe('string');
    }
    const r = await run('import Foundation\nstruct S: Codable { var aB: Int? }\nlet key = String(repeating: "_", count: 100_000)\nlet json = "{\\"" + key + "\\": 1, \\"a_b\\": 2}"\nlet dec = JSONDecoder()\ndec.keyDecodingStrategy = .convertFromSnakeCase\nlet s = try dec.decode(S.self, from: Data(json.utf8))\nprint(s.aB as Any)');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('Optional(2)\n');
    expect(r.steps).toBeGreaterThanOrEqual(100000 / 16); // each JSON key converted once, charged by length
    expect(r.steps).toBeLessThan(80_000); // about 36,000
    // checked against swiftc, including the userID round-trip trap
    expect(await ok('import Foundation\nstruct U: Codable { var userID: Int; var myURLValue: String; var firstName: String }\nlet enc = JSONEncoder()\nenc.keyEncodingStrategy = .convertToSnakeCase\nenc.outputFormatting = [.sortedKeys]\nlet data = try enc.encode(U(userID: 1, myURLValue: "x", firstName: "Ann"))\nprint(String(data: data, encoding: .utf8)!)\nlet dec = JSONDecoder()\ndec.keyDecodingStrategy = .convertFromSnakeCase\nlet j = "{\\"user_id\\": 7, \\"my_url_value\\": \\"y\\", \\"first_name\\": \\"Bo\\"}"\ndo { let u = try dec.decode(U.self, from: Data(j.utf8)); print(u.userID, u.myURLValue, u.firstName) } catch { print(error) }\nstruct V: Codable { var userId: Int; var myUrlValue: String }\nlet v = try dec.decode(V.self, from: Data(j.utf8))\nprint(v.userId, v.myUrlValue)'))
      .toBe('{"first_name":"Ann","my_url_value":"x","user_id":1}\nDecodingError.keyNotFound: Key \'userID\' not found in keyed decoding container. Debug description: No value associated with key CodingKeys(stringValue: "userID", intValue: nil) ("userID").\n7 y\n');
    expect(await ok('import Foundation\nstruct S: Decodable { var aB: Int }\nlet dec = JSONDecoder()\ndec.keyDecodingStrategy = .convertFromSnakeCase\nfor j in ["{\\"a_b\\": 1, \\"aB\\": 2}", "{\\"aB\\": 2, \\"a_b\\": 1}", "{\\"A_B\\": 4}"] { print(try dec.decode(S.self, from: Data(j.utf8)).aB) }'))
      .toBe('1\n2\n4\n');
  });
  it('H3: string members that build text are capped and charged, with Swift\'s semantics', async () => {
    // byte-for-byte what swiftc prints
    expect(await ok('import Foundation\nprint("hello wORLD 1st o\'neil x.y \\u{FB01}x \\u{DF}-\\u{DF} mcDONALD ΣΑΣ ǆx".capitalized)\nprint("ΟΔΟΣ ΑΣ".lowercased(), "ß ŉ ﬁ".uppercased(), "İ".lowercased().unicodeScalars.count)\nprint("[" + "\\u{FEFF}\\u{85} a \\u{A0}\\u{2028}".trimmingCharacters(in: .whitespacesAndNewlines) + "]", "[" + "\\u{A0}\\t a \\u{3000}\\n".trimmingCharacters(in: .whitespaces) + "]", "[" + "\\r\\n\\u{85}\\u{2029} a \\u{B}\\u{C}\\u{2028}".trimmingCharacters(in: .newlines) + "]", "[" + "\\u{B} a".trimmingCharacters(in: .whitespaces) + "]")\nprint("abc".padding(toLength: 7, withPad: "12345", startingAt: 2), "abc".padding(toLength: 2, withPad: "x", startingAt: 0), "ab".padding(toLength: 10, withPad: "xyz", startingAt: 1), "é".padding(toLength: 3, withPad: "😀", startingAt: 0).unicodeScalars.count)\nprint(String(Array("hello").reversed()), String("héllo".reversed()))'))
      .toBe('Hello World 1St O\'neil X.Y Fix Ss-Ss Mcdonald Σασ ǅx\nοδοσ ασ SS ʼN FI 2\n[﻿\u0085 a] [a 　\n] [ a ] [\u000B a]\nabc3451 ab abyzxyzxyz 2\nolleh olléh\n');
    expect((await fails('import Foundation\nprint("abc".padding(toLength: 7, withPad: "12", startingAt: 2))')).message)
      .toBe("Terminating app due to uncaught exception 'NSInvalidArgumentException', reason: '*** -[NSTaggedPointerString stringByPaddingToLength:withString:startingAtIndex:]: out of range padIndex'");
    const pad = await run('import Foundation\nvar a: [String] = []\nfor _ in 0..<20 { a.append("x".padding(toLength: 100_000, withPad: "ab", startingAt: 0)) }\nprint(a.count)');
    expect(pad.stdout).toBe('20\n');
    expect(pad.steps).toBeGreaterThanOrEqual(20 * 100000 / 16); // was 46 steps for 61 MB
    const cap = await run('import Foundation\nlet s = String(repeating: "hello world ", count: 10_000)\nvar a: [String] = []\nfor _ in 0..<20 { a.append(s.capitalized) }\nprint(a.count)');
    expect(cap.stdout).toBe('20\n');
    expect(cap.steps).toBeGreaterThanOrEqual(20 * 120000 / 16);
    // (no string is segmented here: segmentations are cached across runs)
    const base = await run('let c = [Character](repeating: "x", count: 1_000_000)\nprint(c.count)');
    const joined = await run('let c = [Character](repeating: "x", count: 1_000_000)\nlet s = String(c)\nprint(c.count, s.isEmpty)');
    expect(joined.stdout).toBe('1000000 false\n');
    expect(joined.steps - base.steps).toBeGreaterThanOrEqual(1_000_000 / 16);
  });
  it('H4/M3: utf8 and utf16 are lazy views; a loop that breaks early pays for what it visits', async () => {
    // checked against swiftc
    expect(await ok('let s = "a😀é"\nprint("😀".utf16.count, Array("😀".utf16), type(of: s.utf16.first!), s.utf16.count, s.utf16.last!, s.utf16.map { Int($0) }, s.utf16.contains(56832))\nlet u = s.utf8\nvar n = 0\nfor b in u { n += Int(b); if n > 100 { break } }\nprint(n, type(of: u.first!), Array(u))'))
      .toBe('2 [55357, 56832] UInt16 4 233 [97, 55357, 56832, 233] true\n337 UInt8 [97, 240, 159, 152, 128, 195, 169]\n');
    const base = await run('let s = String(repeating: "é", count: 2_000_000)\nprint(195)');
    const early = await run('let s = String(repeating: "é", count: 2_000_000)\nvar t = 0\nfor b in s.utf8 { t += Int(b); break }\nprint(t)');
    expect(early.stdout).toBe('195\n');
    expect(early.steps - base.steps).toBeLessThan(50); // no up-front encoding of 4 MB
    const all = await run('let s = String(repeating: "ab", count: 100_000)\nvar t = 0\nfor u in s.utf16 { t += Int(u) }\nprint(t, s.utf16.count)');
    expect(all.stdout).toBe('19500000 200000\n');
  });
  it('H7: numeric literals are scanned without building big text, with swiftc\'s diagnostics', async () => {
    const msg = async (src) => (await fails(src)).message;
    // every message and value below is swiftc's
    expect(await msg('let x = 99_999_999_999_999_999_999')).toBe("integer literal '99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('let x = 0x1_0000_0000_0000_0000')).toBe("integer literal '18446744073709551616' overflows when stored into 'Int'");
    expect(await msg('let y = 0b11111111111111111111111111111111111111111111111111111111111111111')).toBe("integer literal '36893488147419103231' overflows when stored into 'Int'");
    expect(await msg('print(0xG1)')).toBe("'G' is not a valid hexadecimal digit (0-9, A-F) in integer literal");
    expect(await msg('print(0b102)')).toBe("'2' is not a valid binary digit (0 or 1) in integer literal");
    expect(await msg('print(0o78)')).toBe("'8' is not a valid octal digit (0-7) in integer literal");
    expect(await msg('print(0x_1F)')).toBe("'_' is not a valid hexadecimal digit (0-9, A-F) in integer literal");
    expect(await msg('print(0b)')).toBe("')' is not a valid binary digit (0 or 1) in integer literal");
    expect(await msg('print(123abc)')).toBe("'a' is not a valid digit in integer literal");
    expect(await msg('print(1e5x)')).toBe("'x' is not a valid digit in floating point exponent");
    expect(await msg('print(1e)')).toBe('expected a digit in floating point exponent');
    expect(await msg('print(1e_5)')).toBe("'_' is not a valid first character in floating point exponent");
    expect(await msg('print(0x1.8)')).toBe('hexadecimal floating point literal must end with an exponent');
    expect(await msg('print(0x.8p1)')).toBe("'.' is not a valid hexadecimal digit (0-9, A-F) in integer literal");
    expect(await msg('print(0x1.8pq)')).toBe("'q' is not a valid digit in floating point exponent");
    expect(await msg('print(0x1.Ap)')).toBe("value of type 'Int' has no member 'Ap'");
    expect(await ok('let x: UInt64 = 0xFFFF_FFFF_FFFF_FFFF\nprint(x, 0x7FFF_FFFF_FFFF_FFFF, 0b1111, 0o777, 0x1F, 0x1F.description, 1_, 1__0, 00012, 1.5e3_0, 1E3, 2.5E-1)'))
      .toBe('18446744073709551615 9223372036854775807 15 511 31 31 1 10 12 1.5e+30 1000.0 0.25\n');
    expect(await ok('print(0x1p3, 0x1.8p-2, 0xA.Bp0, 0x1P+2, 0x1.fffffffffffff8p1023, 0x1p-1075, 0x1_0p1_0, 0x1.8p1)')).toBe('8.0 0.375 10.6875 4.0 inf 0.0 16384.0 3.0\n');
    expect(await ok('print(0.1000000000000000055511151231257827021181583404541015625000000000000000001, 1.0e-325, 1e400, 5.0.description)')).toBe('0.1 0.0 inf 5.0\n');
    // a million-digit literal: one bounded scan, a short diagnostic (cut after 40 digits)
    expect(await msg('let x = ' + '7'.repeat(1_000_000))).toBe(`integer literal '${'7'.repeat(40)}...' overflows when stored into 'Int'`);
    const toks = tokenize('let x = ' + '1'.repeat(1_000_000) + '.5e-999990\nlet y = 0x' + 'f'.repeat(1_000_000));
    const [f, h] = toks.filter((t) => t.t === 'float' || t.t === 'int');
    expect(f.v).toBe(1111111111.1111112);
    expect(f.raw.length).toBeLessThan(64);
    expect(typeof h.v).toBe('bigint');
    expect(h.raw.length + (h.display || '').length).toBeLessThan(128);
    expect(await ok('print(0.' + '0'.repeat(100_000) + '1, 1.' + '0'.repeat(100_000) + '1, ' + '1'.repeat(100_000) + '.5e-99990)')).toBe('0.0 1.0 1111111111.1111112\n');
  });
  it('M1: reading keys.count or values.isEmpty never makes a later change copy a snapshot', async () => {
    const plain = await run('var d: [Int: Int] = [:]\nfor i in 0..<50000 { d[i] = i }\nprint(d.count)');
    const mixed = await run('var d: [Int: Int] = [:]\nfor i in 0..<50000 { d[i] = i; _ = d.keys.count; if d.values.isEmpty { print("x") } }\nprint(d.count)');
    expect(mixed.error).toBeNull();
    expect(mixed.stdout).toBe('50000\n');
    expect(mixed.steps).toBeLessThan(plain.steps * 3); // about 200,000 vs 100,000; it used to hit the 3,000,000 budget
    // a view still waiting in an argument list keeps the dictionary as it was (swiftc output)
    expect(await ok('var d = ["a": 1]\nprint(d.keys, d.removeValue(forKey: "a") as Any, d.keys, d.values.isEmpty)\nvar e = ["k": [1]]\nprint(e.values.count, e.keys.isEmpty, e.updateValue([2], forKey: "k")!, e.values.first!)'))
      .toBe('["a"] Optional(1) [] true\n1 false [1] [2]\n');
  });
  it('M2: a task group cancels and awaits its children before the body\'s error leaves it', async () => {
    // byte-for-byte what swiftc prints
    expect(await ok('struct Boom: Error {}\ndo {\n    try await withThrowingTaskGroup(of: Void.self) { g in\n        g.addTask {\n            do { try await Task.sleep(nanoseconds: 1_000_000_000); print("child finished") }\n            catch { print("child cancelled:", type(of: error)) }\n        }\n        g.addTask { print("quick child"); }\n        try await Task.sleep(nanoseconds: 1_000_000)\n        throw Boom()\n    }\n} catch {\n    print("parent caught", error)\n}\nlet r = await withTaskGroup(of: Int.self) { g in\n    g.addTask { do { try await Task.sleep(nanoseconds: 1_000_000_000) } catch { print("never-awaited child sees cancel:", Task.isCancelled) }; return 1 }\n    return 5\n}\nprint("non-throwing body returned", r)\ndo {\n    try await withThrowingTaskGroup(of: Int.self) { g in\n        g.addTask { throw Boom() }\n        g.addTask { do { try await Task.sleep(nanoseconds: 1_000_000_000) } catch { print("sibling cancelled") }; return 2 }\n        for try await v in g { print(v) }\n    }\n} catch { print("caught child error", error) }'))
      .toBe('quick child\nchild cancelled: CancellationError\nparent caught Boom()\nnon-throwing body returned 5\nsibling cancelled\ncaught child error Boom()\n');
    // a child's error that the body never consumed is discarded
    expect(await ok('struct Boom: Error {}\ndo {\n    let r = try await withThrowingTaskGroup(of: Int.self) { g in\n        g.addTask { throw Boom() }\n        g.addTask { try await Task.sleep(nanoseconds: 1_000_000); print("slow child done"); return 2 }\n        return 7\n    }\n    print("returned", r)\n} catch { print("caught", error) }'))
      .toBe('slow child done\nreturned 7\n');
  });
  it('M4: Data and Date values hash by their contents', async () => {
    expect(await ok('import Foundation\nvar d: [Data: Int] = [:]\nd[Data([1])] = 1\nd[Data([2])] = 2\nd[Data([1])] = 3\nlet big1 = Data(repeating: 7, count: 1000), big2 = Data(repeating: 7, count: 1001)\nlet s: Set<Data> = [Data([1, 2]), Data([1, 2]), Data(), big1, big2, Data(String(repeating: "a", count: 1000).utf8)]\nlet t1 = Date(timeIntervalSince1970: 0), t2 = Date(timeIntervalSince1970: 0.5)\nprint(d.count, d[Data([1])]!, d[Data([2])]!, s.count, Set([t1, t2, t1]).count, Set([Data("hi".utf8)]).contains(Data([104, 105])))'))
      .toBe('2 3 2 5 2 true\n');
    const charged = [];
    const prev = hooks.charge;
    hooks.charge = (n) => charged.push(n);
    try {
      const a = hashKey(new SData(new Uint8Array(100000).fill(1))), b = hashKey(new SData(new Uint8Array(100000).fill(2)));
      expect(a).not.toBe(b);
      expect(a.length).toBeLessThan(64);
      expect(charged.reduce((x, n) => x + n, 0)).toBeGreaterThanOrEqual(2 * 100000 / 64);
    } finally {
      hooks.charge = prev;
    }
  });
});

describe('Review pass 7: per-run grapheme cache, big literals in floating-point contexts', () => {
  it('the same program reports the same steps every run; cache hits within a run stay free', async () => {
    const src = 'let s = String(repeating: "héllo wörld ", count: 20000)\nvar n = 0\nfor _ in 0..<200 { n += s.count; if s.first == "h" { n += 1 } }\nprint(n, s.last!, Array(s).count)';
    const first = await run(src);
    // another run segments the same string in between: it must not lend its cache
    await run('let s = String(repeating: "héllo wörld ", count: 20000)\nprint(s.count, Array(s).count)');
    const second = await run(src);
    expect(first.stdout).toBe('48000200   240000\n');
    expect(second.stdout).toBe(first.stdout);
    expect(second.steps).toBe(first.steps);
    // the same program with one iteration: 199 more counts and firsts are cache hits
    const once = await run(src.replace('0..<200', '0..<1'));
    expect(first.steps - once.steps).toBeLessThan(5_000);
  });
  it('an integer literal past Int64 is a Double in a Double context, as swiftc decides', async () => {
    const msg = async (src) => (await fails(src)).message;
    // every output and message below is swiftc's (Swift 6.2)
    expect(await ok('import Foundation\nlet d: Double = 123456789012345678901234567890\nlet c: CGFloat = 9223372036854775807\nlet o: Double? = 99999999999999999999\nlet a: [Double] = [1, 18446744073709551616]\nlet u: Double = -9223372036854775809\nprint(d, c, o!, a, u)'))
      .toBe('1.2345678901234568e+29 9.223372036854776e+18 1e+20 [1.0, 1.8446744073709552e+19] -9.223372036854776e+18\n');
    expect(await ok('func half(_ x: Double) -> Double { x / 2 }\nstruct P { var x: Double; var y: Float }\nfunc scale(by k: Double, _ n: Int) -> Double { k * Double(n) }\nprint(half(123456789012345678901234567890), P(x: 1_000_000_000_000_000_000_000, y: 340282346638528859811704183484516925440).x, scale(by: 99999999999999999999, 2))\nprint(Double(123456789012345678901234567890), 123456789012345678901234567890 as Double, Float(99999999999999999999))\nprint(-9223372036854775809 as Double, 2.5 * 123456789012345678901234567890)'))
      .toBe('6.172839450617284e+28 1e+21 2e+20\n1.2345678901234568e+29 1.2345678901234568e+29 1e+20\n-9.223372036854776e+18 3.086419725308642e+29\n');
    expect(await ok('func h(_ x: Double = 1, y: Double) { print(x, y) }\nh(y: 99999999999999999999)\nh(-99999999999999999999, y: 1)\nprint("\\(h(y: 1e3))")\nstruct Q { var a = 0.0; var b: Double? }\nprint(Q(a: 99999999999999999999, b: -99999999999999999999))\nextension Double { func plus(_ o: Double) -> Double { self + o } }\nprint(1.0.plus(99999999999999999999))'))
      .toBe('1.0 1e+20\n-1e+20 1.0\n1.0 1000.0\n()\nQ(a: 1e+20, b: Optional(-1e+20))\n1e+20\n');
    expect(await ok('func g(_ x: UInt64) { print(x) }\ng(18446744073709551615)\nlet f: Float = 340282356779733661637539395458142568447\nprint(f > 1e38)')).toBe('18446744073709551615\ntrue\n');
    // integer contexts keep their overflow diagnostics
    expect(await msg('print(99999999999999999999)')).toBe("integer literal '99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('func g(_ x: Int) {}\ng(99999999999999999999)')).toBe("integer literal '99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('func h(_ x: Double) {}\nfunc h(_ x: Int) {}\nh(99999999999999999999)')).toBe("integer literal '99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('func f(_ x: Int8) {}\nf(99999999999999999999)')).toBe("integer literal '99999999999999999999' overflows when stored into 'Int8'");
    expect(await msg('func g(_ x: UInt64) {}\ng(18446744073709551616)')).toBe("integer literal '18446744073709551616' overflows when stored into 'UInt64'");
    expect(await msg('import Foundation\nlet c: CGFloat = 9223372036854775808')).toBe("integer literal '9223372036854775808' overflows when stored into 'CGFloat'");
    expect(await msg('let f: Float = 340282356779733661637539395458142568448')).toBe("integer literal '340282356779733661637539395458142568448' overflows when stored into 'Float'");
    expect(await msg('let d: Double = 1' + '0'.repeat(400))).toBe(`integer literal '1${'0'.repeat(39)}...' overflows when stored into 'Double'`);
    expect(await msg('let u: UInt = 18446744073709551616')).toBe("integer literal '18446744073709551616' overflows when stored into 'UInt'");
  });
});

describe('Review pass 8: Float is a 32-bit type', () => {
  // every expected output below is what swiftc 6.2 prints for the same program
  const swift = async (src, out) => expect(await ok(src)).toBe(out);
  it('prints float32 values with Swift\'s shortest round-trip digits', () => {
    const u = new Uint32Array(1), f = new Float32Array(u.buffer);
    // ties (exactly halfway at the shortest length) round to the even digit
    for (const [bits, text] of [[1247913521, '3697036.2'], [1185561504, '21789.812'], [1236220458, '1435461.2'], [1222733236, '461677.62'], [3390610613, '-2500397.2'], [3384771722, '-1568913.2'], [3389923189, '-2328541.2'], [1221818292, '433085.62'], [3367150900, '-365865.62'], [1234345354, '1201073.2'], [4134408205, '-1.2071213e+33'], [4259073181, '-3.6603495e+37'], [1641628521, '5.009751e+20'], [3243539097, '-13.279931'], [1066907213, '1.1852509'], [1128035057, '188.44899'], [4032130946, '-2.6422045e+29'], [2392899111, '-3.9626155e-30'], [517195239, '2.2422344e-20'], [3273969598, '-164.8115'], [3327317377, '-13493.376'], [1315044160, '9.478349e+08'], [3749822544, '-1.8699122e+19'], [4066366498, '-4.433383e+30'], [3293093499, '-802.47626'], [777912717, '5.0478333e-11'], [115564235, '8.5527195e-35'], [3089461671, '-3.9444913e-05'], [3683975987, '-8.388658e+16'], [2241266786, '-1.4201582e-35'], [859386402, '4.3119265e-08'], [1015725156, '0.016935535'], [3006455440, '-4.1646274e-08'], [1094078009, '11.394097'], [964846290, '0.0002486916'], [4034574577, '-3.1037933e+29'], [2763200456, '-7.766916e-17'], [1201274253, '78843.1'], [2851031514, '-1.0626543e-13'], [1151612626, '1313.7131'], [2865704141, '-3.6801673e-13'], [2969502271, '-1.855433e-09'], [2493764122, '-1.6541664e-26'], [3322564155, '-8851.558'], [2329399076, '-2.0781665e-32'], [1014890623, '0.015503048'], [463924707, '2.7616127e-22'], [2958022854, '-7.5614215e-10'], [1338737991, '6.8290186e+09'], [3333079024, '-21855.969'], [3187261581, '-0.12194929'], [3443977835, '-2.0859461e+08'], [4082143556, '-1.6524415e+31'], [1280822099, '5.6569164e+07'], [2823756405, '-1.1496545e-14'], [140839807, '6.8925694e-34'], [2489771798, '-1.1657606e-26'], [4081404303, '-1.5630713e+31'], [605647630, '3.327404e-17'], [301433092, '3.904924e-28'], [3, '4e-45'], [461373439, '2.1175822e-22'], [1090519039, '7.9999995'], [1719664639, '3.0223144e+23'], [1266679794, '16777202.0'], [976372231, '0.00068'], [987509618, '0.00168'], [992977648, '0.00268'], [997272615, '0.0036799998'], [999905967, '0.00468'], [1002053451, '0.00568'], [1004200934, '0.0066799996'], [1006348418, '0.00768'], [1007564431, '0.00868'], [1008638173, '0.00968'], [1009711914, '0.010679999'], [1010785656, '0.0116799995'], [1011859398, '0.01268'], [1012933140, '0.01368'], [1014006882, '0.01468'], [1015051096, '0.01568'], [1015587967, '0.01668'], [1016124837, '0.017679999'], [1016661708, '0.018679999'], [1017198579, '0.019679999'], [1017735450, '0.02068'], [1018272321, '0.02168'], [1018809192, '0.02268'], [1019346063, '0.02368'], [1019882934, '0.02468'], [1020419805, '0.02568'], [1020956676, '0.02668'], [1021493546, '0.027679998'], [1022030417, '0.028679999'], [1022567288, '0.029679999'], [953267992, '0.000100000005'], [799820, '1.120787e-39'], [3175520, '4.449851e-39'], [5551220, '7.778916e-39'], [7926920, '1.1107981e-38']]) {
      u[0] = bits;
      expect(formatFloat(f[0]), String(bits)).toBe(text);
    }
    expect([16777216, 16777218, 1e7, 0.0001, 0.00009999, 1e-45, 3.4028235e38, 1 / 3, -0].map((x) => formatFloat(Math.fround(x))))
      .toEqual(['16777216.0', '1.6777218e+07', '10000000.0', '0.0001', '9.999e-05', '1e-45', '3.4028235e+38', '0.33333334', '-0.0']);
    expect(new Flt(0.1).v).toBe(Math.fround(0.1));
  });
  it('computes, compares and converts in float32', async () => {
    await swift("let f: Float = 1.0 / 3.0\nprint(f)\nlet g: Float = 0.1 + 0.2\nprint(g, g == 0.3)\nprint(Float(16777217))\nlet h: Float = 3.14159265358979\nprint(h * 2)\nlet d: Double = 1 / 3\nlet e: Float = 1 / 3\nprint(d, e)\nlet x: Float = 16777217.0 + 1.0\nprint(x, type(of: x), [f, g], f.description)\nvar acc: Float = 0\nfor _ in 0..<10 { acc += 0.1 }\nprint(acc, acc == 1.0, -f, abs(-f), f < 0.5, max(f, 0.2))\n", "0.33333334\n0.3 true\n16777216.0\n6.2831855\n0.3333333333333333 0.33333334\n16777216.0 Float [0.33333334, 0.3] 0.33333334\n1.0000001 false -0.33333334 0.33333334 true 0.33333334\n");
    await swift("let d: Double = 1 / 0\nlet e: Float = 16777216.0 + 1.0 + 1.0\nlet d2: Double = 7 / 2\nlet f: Float = -1 / 3\nlet g: Double = (2 + 3) * 0.5\nlet o: Double? = 1 / 4\nlet t: Float = 0.1 * 3 - 0.3\nprint(d, e, d2, f, g, o!, t)\n", "inf 16777216.0 3.5 -0.33333334 2.5 0.25 0.0\n");
    await swift("import Foundation\nlet f: Float = 2.5\nvar g = f\ng += 0.1\ng *= 3\ng -= 1\ng /= 7\nprint(g, -g, g.rounded(.toNearestOrEven), f.squareRoot(), sqrt(f), pow(f, 3), floor(g), abs(-g), max(f, 1), min(1, f))\nprint(Float.greatestFiniteMagnitude.ulp, Float(1).ulp, Float(1).nextDown, Float(0).nextUp, Double(1).nextUp, Float.leastNormalMagnitude, Double.leastNormalMagnitude)\nprint(Float(exactly: 0.5) as Any, Float(exactly: 0.1) as Any, Float(exactly: Int64(1) << 40) as Any, Double(Float(0.1)) == 0.1, CGFloat(f) * 2)\nlet h: Float32 = 1.0 / 3.0\nlet xs: [Float] = [3, 1.5, 2]\nprint(h, type(of: h), xs.sorted(), xs.reduce(0, +), xs.map { $0 * 2 }, xs.max()!, Float(Int8(-5)), Int(Float(1e9)))\nprint(String(format: \"%.3f|%6.2f|%e\", g, f, Float(1) / 3), Float(\"0.1\")!, Float(\"nan\")!.isNaN, (f * 0.1).description)\nlet s = \"\\(f) and \\(Float(1) / 3)\"\nprint(s, Float(1) / 3 == 0.33333334, Float(0.1) + Float(0.2) == Float(0.3), 0.1 + 0.2 == 0.3)\n", "0.9714285 -0.9714285 1.0 1.5811388 1.5811388 15.625 0.0 0.9714285 2.5 1.0\n2.028241e+31 1.1920929e-07 0.99999994 1e-45 1.0000000000000002 1.1754944e-38 2.2250738585072014e-308\nOptional(0.5) nil Optional(1.0995116e+12) false 5.0\n0.33333334 Float [1.5, 2.0, 3.0] 6.5 [6.0, 3.0, 4.0] 3.0 -5.0 1000000000\n0.971|  2.50|3.333333e-01 0.1 true 0.25\n2.5 and 0.33333334 true true false\n");
  });
  it('traps on Float and Double conversions with Swift\'s wording', async () => {
    const msg = async (src) => (await fails(src)).message;
    expect(await msg('print(Int(Float.nan))')).toBe('Fatal error: Float value cannot be converted to Int because it is either infinite or NaN');
    expect(await msg('var f: Float = 1e30\nf += 1\nprint(Int(f))')).toBe('Fatal error: Float value cannot be converted to Int because the result would be greater than Int.max');
    expect(await msg('var f: Float = -1e30\nf += 1\nprint(Int(f))')).toBe('Fatal error: Float value cannot be converted to Int because the result would be less than Int.min');
    expect(await msg('var f: Float = 300\nf += 1\nprint(Int8(f))')).toBe('Fatal error: Float value cannot be converted to Int8 because the result would be greater than Int8.max');
    expect(await msg('var f: Float = -1\nf += 0\nprint(UInt(f))')).toBe('Fatal error: Float value cannot be converted to UInt because the result would be less than UInt.min');
  });
  it('encodes and decodes Float the way Foundation does', async () => {
    await swift("import Foundation\nstruct S: Codable { var a: Float; var b: Float; var c: [Float]; var d: Double }\nlet enc = JSONEncoder()\nenc.outputFormatting = [.sortedKeys]\nlet data = try enc.encode(S(a: 0.1, b: 1.0 / 3.0, c: [16777217, 1e-7, 3.4028235e38, 100], d: 0.1))\nprint(String(data: data, encoding: .utf8)!)\nlet back = try JSONDecoder().decode(S.self, from: Data(\"{\\\"a\\\": 0.1, \\\"b\\\": 0.333333343, \\\"c\\\": [1, 2.5, 1e-45], \\\"d\\\": 0.1}\".utf8))\nprint(back.a, back.b, back.c, back.d, type(of: back.a))\ndo { _ = try JSONDecoder().decode(S.self, from: Data(\"{\\\"a\\\": 1e39, \\\"b\\\": 1, \\\"c\\\": [], \\\"d\\\": 1}\".utf8)) } catch { print(error) }\nlet f: Float = 0.1\nprint(String(format: \"%f %.10f %g %e\", f, f, f, f), String(format: \"%.2f\", Float(2.675)))\nprint(Array(stride(from: Float(0), to: 1, by: 0.25)), Float(3) == 3.0)\n", "{\"a\":0.1,\"b\":0.33333334,\"c\":[16777216,1e-07,3.4028235e+38,100],\"d\":0.1}\n0.1 0.33333334 [1.0, 2.5, 1e-45] 0.1 Float\nDecodingError.dataCorrupted: Data was corrupted. Debug description: The given data was not valid JSON.. Underlying error: Error Domain=NSCocoaErrorDomain Code=3840 \"Number 1e39 is not representable in Swift.\" UserInfo={NSDebugDescription=Number 1e39 is not representable in Swift.}\n0.100000 0.1000000015 0.1 1.000000e-01 2.67\n[0.0, 0.25, 0.5, 0.75] true\n");
    await swift("import Foundation\nstruct D: Codable { var a: Double }\nstruct F: Codable { var a: Float }\nfor j in [\"{\\\"a\\\": 1e-400}\", \"{\\\"a\\\": 7.1e-46}\", \"{\\\"a\\\": 3e-46}\", \"{\\\"a\\\": 0e-50}\", \"{\\\"a\\\": -0.0}\"] {\n  do { print(try JSONDecoder().decode(D.self, from: Data(j.utf8)).a) } catch { print(\"D err\") }\n  do { print(try JSONDecoder().decode(F.self, from: Data(j.utf8)).a) } catch { print(\"F err\") }\n}\nlet enc = JSONEncoder()\ndo { _ = try enc.encode(F(a: .infinity)) } catch { print(error) }\nprint(String(data: try enc.encode([Float(-0.0), 1e-45, 123456.79]), encoding: .utf8)!)\n", "D err\nF err\n7.1e-46\n1e-45\n3e-46\nF err\n0.0\n0.0\n-0.0\n-0.0\nEncodingError.invalidValue: inf (Float). Path: a. Debug description: Unable to encode Float.inf directly in JSON.\n[-0,1e-45,123456.79]\n");
    await swift("import Foundation\nstruct F: Codable { var a: Float; var b: [Double] }\nstruct W: Codable { var f: F }\nlet enc = JSONEncoder()\nfor v in [Float.nan, -Float.infinity] { do { _ = try enc.encode(v) } catch { print(error) } }\ndo { _ = try enc.encode([1, Double.infinity]) } catch { print(error) }\ndo { _ = try enc.encode(W(f: F(a: 1, b: [2, -Double.infinity]))) } catch { print(error) }\ndo { _ = try enc.encode([\"k\": Double.nan]) } catch { print(error) }\n", "EncodingError.invalidValue: nan (Float). Debug description: Unable to encode Float.nan directly in JSON.\nEncodingError.invalidValue: -inf (Float). Debug description: Unable to encode Float.-inf directly in JSON.\nEncodingError.invalidValue: inf (Double). Path: [1]. Debug description: Unable to encode Double.inf directly in JSON.\nEncodingError.invalidValue: -inf (Double). Path: f.b[1]. Debug description: Unable to encode Double.-inf directly in JSON.\nEncodingError.invalidValue: nan (Double). Path: k. Debug description: Unable to encode Double.nan directly in JSON.\n");
  });
});

describe('Review pass 9: oversized literals typed in context, Float rounding, CGFloat', () => {
  it('a literal past Int64 in an assignment, return or one-expression body takes its Double or Float context', async () => {
    // output checked against swiftc 6.2
    expect(await ok("let x = 0.0\nvar y = 1.5\ny = 99999999999999999999\nprint(x + 99999999999999999999, y)\nvar f: Float = 1\nf = 340282346638528859811704183484516925440\nf += 99999999999999999999\nprint(f)\nfunc big() -> Double { 123456789012345678901234567890 }\nfunc neg() -> Double { return -99999999999999999999 }\nlet c: () -> Float = { 99999999999999999999 }\nprint(big(), neg(), c())\nstruct S { var v: Double { 1_000_000_000_000_000_000_000 } }\nprint(S().v, 2.5 * 99999999999999999999, 99999999999999999999 / x.nextUp)\n")).toBe("1e+20 1e+20\n3.4028235e+38\n1.2345678901234568e+29 -1e+20 1e+20\n1e+21 2.5e+20 inf\n");
    const msg = async (src) => (await fails(src)).message;
    const over = "integer literal '99999999999999999999' overflows when stored into 'Int'";
    expect(await msg('let i = 99999999999999999999')).toBe(over);
    expect(await msg('var n = 1\nn = 99999999999999999999')).toBe(over);
    expect(await msg('var n = 1\nn += 99999999999999999999')).toBe(over);
    expect(await msg('func g() -> Int { 99999999999999999999 }\nprint(g())')).toBe(over);
    expect(await msg('func h() -> Double {\n  print(1)\n  99999999999999999999\n}')).toBe(over);
    expect(await msg('print(1 + 99999999999999999999)')).toBe(over);
  });
  it('integers become Float with one rounding, never through a Double', async () => {
    // 2^60 + 2^36 + 1: via a Double it ties to even at 2^60; Swift rounds up to 2^60 + 2^37
    const big = 2n ** 60n + 2n ** 36n + 1n;
    expect(bigToFloat32(big)).toBe(2 ** 60 + 2 ** 37);
    expect(Math.fround(Number(big))).toBe(2 ** 60);
    expect(toFloat(big).v).toBe(2 ** 60 + 2 ** 37);
    expect(bigLiteralValue({ k: 'int', v: big, unresolved: { tok: { raw: String(big) } } }, 'Float')).toEqual({ value: 2 ** 60 + 2 ** 37 });
    expect(bigLiteralValue({ k: 'int', v: -(10n ** 20n), unresolved: { tok: { raw: '100000000000000000000' } } }, 'Double')).toEqual({ value: -1e20 });
    expect(bigLiteralValue({ k: 'int', v: 10n ** 20n, unresolved: { tok: { raw: '100000000000000000000' } } }, 'CGFloat').message).toBe("integer literal '100000000000000000000' overflows when stored into 'CGFloat'");
    expect(bigLiteralValue({ k: 'int', v: 2n ** 128n, unresolved: { tok: { raw: '340282366920938463463374607431768211456' } } }, 'Float').message).toMatch(/overflows when stored into 'Float'/);
    // output checked against swiftc 6.2, CGFloat values included
    expect(await ok("import CoreGraphics\nlet n = 1152921573326323713\nprint(Float(n).bitPattern, Float(UInt64.max), Float(Int.min).bitPattern, Float(bitPattern: 1065353216), Double(bitPattern: 4607182418800017408), (0.1).bitPattern, Float(0.1).bitPattern)\nprint(type(of: CGFloat(1)), CGFloat(1.5), Double(CGFloat(1.5)), type(of: Double(CGFloat(1.5))), CGFloat.pi, type(of: CGFloat.pi), CGFloat(3).squareRoot(), type(of: CGFloat(3).squareRoot()), type(of: max(CGFloat(1), 2)), CGFloat(Float(0.1)), Array(stride(from: CGFloat(0), to: 1, by: 0.5)))\n")).toBe("1568669697 1.8446744e+19 3741319168 1.0 1.0 4591870180066957722 1036831949\nCGFloat 1.5 1.5 Double 3.141592653589793 CGFloat 1.7320508075688772 CGFloat CGFloat 0.10000000149011612 [0.0, 0.5]\n");
  });
  it('CGFloat is a Double-width value with its own type; mixing follows SE-0307', () => {
    const c = new CGF(1.5), d = new (Object.getPrototypeOf(CGF))(2), f = new Flt(0.5);
    expect(floatResult(c, c, 3)).toBeInstanceOf(CGF);
    expect(floatResult(c, d, 3, false, true)).toBeInstanceOf(CGF); // c * 2.5: the literal is a CGFloat
    const mixed = floatResult(c, d, 3.5, false, false); // c + d: the CGFloat converts to Double
    expect(mixed).not.toBeInstanceOf(CGF);
    expect(mixed.v).toBe(3.5);
    expect(floatResult(c, 2, 3)).toBeInstanceOf(CGF);
    expect(floatResult(f, d, 1)).toBeInstanceOf(Flt);
    expect(typeNameOf(c)).toBe('CGFloat');
    expect(describeValue(new CGF(0.1 + 0.2))).toBe('0.30000000000000004');
  });
});

describe('Review pass 10: decimal text rounds once to Float; CGFloat description, JSON and conversions', () => {
  it('Float(String) and JSONDecoder round decimal text once; Float literals go through Double as on arm64', async () => {
    // swiftc 6.2 (arm64): literals give 1065353216 (via Double); Float(String) and JSON give 1065353217
    expect(await ok("import Foundation\nlet a: Float = 1.000000059604644775390625001\nlet b: Float = 1.000000059604644775390624999\nlet c: Float = 1.000000059604644775390625\nlet n: Float = -1.000000059604644775390625001\nvar v: Float = 0\nv = 1.000000059604644775390625001\nstruct S: Codable { var x: Float }\nlet j = try JSONDecoder().decode(S.self, from: Data(\"{\\\"x\\\": 1.000000059604644775390625001}\".utf8))\nprint(a.bitPattern, b.bitPattern, c.bitPattern, n.bitPattern, v.bitPattern, Float(\"1.000000059604644775390625001\")!.bitPattern, j.x.bitPattern, Float(1.000000059604644775390625001 as Double).bitPattern)\n")).toBe("1065353216 1065353216 1065353216 3212836864 1065353216 1065353217 1065353217 1065353216\n");
    // Swift's Float(String) bit patterns for exact float midpoints, values just above and
    // below them, and random decimals (a sample of 4,991 checked strings)
    const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
    for (const [text, bits] of [["141213576.0000000000000000000000000", 1292282872], ["40762930506940006845644800000001", 1946198024], ["5197895827455.99999999999999", 1419200343], ["-23.521273612976074218750000000000000000000000000000", 3250334610], ["-0.0000000227028928989625455869827419519424438476562500000000000000000000000000000000001", 2999125041], ["-0.0000000000000001733777379879393443478513558986264797567855566740036010742187499999999999999999999999999999999", 2772952083], ["483397422439427107159387223883776", 1975429802], ["0.0000000000000665072685780091626961407769158540759235620498657226562500000000000000000000000000000000001", 697680597], ["0.000000000000000000000000000000000000006395908045009993624347728534446623725308889374103579332847063448780366469448299682198921800591051578521728515624999999999999999999999999999999999", 4564272], ["-0.000000000000000000000001225633417615448940459829540432697565213379653492609122622525319457054138183593750000000000000000000000000000", 2545789016], ["-231507448.00000000000000000000000000000001", 3445409888], ["-10970037943603621868736158680135761919999", 4286578688], ["3781303936.000000000000000000000", 1331782174], ["0.001606238132808357477188110351562500000000000000000000000000000000001", 986876009], ["356.329544067382812499999999999999999999999999999999", 1135749678], ["-0.000872651027748361229896545410156250000000000000000000000000000", 3127165598], ["-124267755248801546240000001", 3939341681], ["-0.0000000000000000000000000000000063278679247587664779945976938004500498261642669324603105700938199262850503146182745695114135742187499999999999999999999999999999999", 2315480247], ["0.00000000000000000000000003454488926324875371705645735405722855209656105279769633398245787248015403747558593750000000000000000000000000000", 355143386], ["0.00000000016493719584564914271140878554433584213256835937500000000000000000000000000000000001", 792025522], ["0.000000000000017215937029647129102860603211411216761916875839233398437499999999999999999999999999999999", 681251135], ["-0.00000000000002395976771613116465542425714829732896760106086730957031250000000000000000000000000000", 2832715638], ["-36997438.0000000000000000000000000000000001", 3423412816], ["-438814241998346817372159999", 3954539844], ["6799897440090712050372125297467195392", 2091103130], ["0.000000000000000000011956927662299909419751717937468321606431231884926091879606246948242187500000000000000000000000000000000001", 509729832], ["0.00000000000000008353533224411740989046731842293525005516130477190017700195312499999999999999999999999999999999", 616603278], ["-27132995327394354694805520384", 4004468678], ["-0.000000000000000000000000003741191909717097920800067975035245285005635045710858932466180704068392515182495117187500000000000000000000000000000000001", 2475963442], ["-0.000000000000000004818649461765128748662236762845267890043032821267843246459960937499999999999999999999999999999999", 2729559771], ["0.00000000000000000000000000000124954800287606787772125004534578824436040451127774867853825746522034023655578494071960449218750000000000000000000000000000", 231391282], ["0.0000001982101807129765802528709173202514648437500000000000000000000000000000000001", 877974426], ["141750418811125759999", 1626727893], ["-9731173733818596338445825605632", 4076185148], ["-540231883120148393645693563043840000001", 4286578688], ["-0.00000000000000000000000000001889585163692579775837594808836783126654416117091907917346915724010614212602376937866210937499999999999999999999999999999999", 2411700335], ["0.000000000000000959472706414486861334345313423455081647261977195739746093750000000000000000000000000000", 646596172], ["0.0000015800083588146662805229425430297851562500000000000000000000000000000000001", 903090349], ["0.000000000000000000000000004228141725740033369203717770864887206312026420723659825284812541212886571884155273437499999999999999999999999999999999", 329743987], ["-0.0000056499568472645478323101997375488281250000000000000000000000000000", 3065877698], ["-0.826943784952163696289062500000000000000000000000000000000001", 3209933463], ["-0.00000060877769669787085149437189102172851562499999999999999999999999999999999", 3038997218], ["0.00000000047327899932447792252787621691823005676269531250000000000000000000000000000", 805443596], ["73721168874648371200000001", 1785982018], ["0.0000000000000000000063649304489323286188418419032867406892606254587008152157068252563476562499999999999999999999999999999999", 502298068], ["-90791579648.0000000000000000", 3517521100], ["-0.0000140753986670461017638444900512695312500000000000000000000000000000000001", 3077317985], ["-6743835037698481005240570443401789439999", 4286578688], ["240.504066467285156250000000000000000000000000000", 1131446538], ["0.00000000000000000000000000152071606557335998776616426024465550177545470917489511819553626992274075746536254882812500000000000000000000000000000000001", 317781907], ["40046830813183.99999999999", 1443999876], ["-107213850154286261993472", 3853885592], ["-6247687435576471108319243581521920000001", 4286578688], ["-0.00000000000000007727368750365429760345453713554775276861619204282760620117187499999999999999999999999999999999", 2763140693], ["26704783290099062173294347157504", 1940424680], ["0.00000000000000000000000008750298150868957652928550679379202815587768943261792742305260617285966873168945312500000000000000000000000000000000001", 366519707], ["40494010584481266202895616290324479999", 2113124071], ["-0.0000385960174753563478589057922363281250000000000000000000000000000", 3089228328], ["-276649132032.000000000000000000001", 3531658022], ["-0.0000014158551380205608438700437545776367187499999999999999999999999999999999", 3049130089], ["15093.999511718750000000000000000000000000000", 1181472768], ["2.1749163866043090820312500000000000000000000000000000000001", 1074475477], ["0.000000000000000003617929387424486006830885026497313106119690928608179092407226562499999999999999999999999999999999", 579172960], ["0.0000000000000044021909513823403656274102502266032388433814048767089843750000000000000000000000000000", 664705804], ["0.0000000000000000000000000196562744351253888492747012665484095061908722396060156256680784281343221664428710937500000000000000000000000000000000001", 348301972], ["0.000000000000000000000000000009925035841732841196054327379907372620103737463615172637032557645397901069372892379760742187499999999999999999999999999999999", 256462267], ["-0.000000000000000000000000000000000132452895439324745945939644381345098995218011891910935167896790423669450831312133232131600379943847656250000000000000000000000000000", 2268073826], ["-113713391633743788659179520000001", 4105398393], ["-0.000000000000000000000000005998926842713199928328088965502531636763436460185738852146641875151544809341430664062499999999999999999999999999999999", 2481824856], ["7263533400064.0000000000", 1423140234], ["7018.01538085937500000000000000000000000000000000001", 1172000800], ["2695809.37499999999999999999999999999999999", 1243908613], ["-0.01497318362817168235778808593750000000000000000000000000000", 3161805334], ["-0.0000000000000000000000015870162189311441482280559547547695768785619430119027128966990858316421508789062500000000000000000000000000000000001", 2549453873], ["-0.0000000000000000000000000000457690736223736603032468992129924076676135114526405150980892244660935830324888229370117187499999999999999999999999999999999", 2422739879], ["0.0000000000000000000000004170375544766197945554968425157142073453689357087625921849394217133522033691406250000000000000000000000000000", 385945886], ["0.0000000000000001968401535801894382867599508912803685234393924474716186523437500000000000000000000000000000000001", 627241206], ["0.00000000000000000000000000000000000112973727002001752841479159737610339465282200317388564649214267117307425314365332269517239183187484741210937499999999999999999999999999999999", 62928639], ["-56644642238787223552", 3762587276], ["-95270916251905043894108160000001", 4103491486], ["-23537225664746752209542184959999", 4086598256], ["27617621522210787725877203318079488", 2024420588], ["0.00000000000000000000000000002155790510797875431008614520022960598466581264270446743891440632978628855198621749877929687500000000000000000000000000000000001", 265985926], ["0.000000000000000000000000000000000000011289708914820875000098009841246246397811280402363017287574740999862052230617859294170557404868304729461669921874999999999999999999999999999999999", 8056605], ["-0.00000000000000000000000000000152996951534947369382124187121614721761707676831880441462030439936370385112240910530090332031250000000000000000000000000000", 2381856882], ["-597537952.000000000000000000000000000001", 3457054419], ["-127087529311600639999", 3772544563], ["5306284186271744", 1503055948], ["0.00000000000000000751825906315518821489054385187600360040960367769002914428710937500000000000000000000000000000000001", 587902970], ["0.0000000000000000000000000024038757490306693157612130831362933168912296173075349159375946328509598970413208007812499999999999999999999999999999999", 322860132], ["-2377113634749203205054720376832", 4059039474], ["-0.000000000000000000000111001823353111748845522995542188602474675818143623473588377237319946289062500000000000000000000000000000000001", 2600874343], ["-81701.4726562499999999999999999999999999999999", 3349123772], ["0.00000000000000000000015863843235966917502991555384100853462459035370102355955168604850769042968750000000000000000000000000000", 457164856], ["0.00000000000000008587262040039214531280536979451767365389969199895858764648437500000000000000000000000000000000001", 616956480], ["45391169699632722969718947839999", 1947155122], ["-1.3435865044593811035156250000000000000000000000000000", 3215719076], ["-8267.4565429687500000000000000000000000000000000001", 3321966036], ["-86007627.999999999999999999999999999999", 3433303017], ["0.00000000000000000000000000000000000051280858097753204505965532751529136931804313122675359036085605167953546668080377912701806053519248962402343750000000000000000000000000000", 53379054], ["42662028516289852988404531200000001", 2030270056], ["0.00000000000000000020227212308646842782112660035637174971157037361990660429000854492187499999999999999999999999999999999", 544132351], ["-4349574912.00000000000000000000", 3481378976], ["-0.00000000000000000000000000000000000013993919697381338708023964307172585345853325198993539345192773573481933441220448344211035873740911483764648437500000000000000000000000000000000001", 2185132466], ["-12320961686918922239999", 3827759852], ["24537912320.000000000000000000", 1354158682], ["0.000000000000000005994334914866854107913605315127725248203205410391092300415039062500000000000000000000000000000000001", 584918757], ["110703401815591462916587519999", 1873992155], ["-103965041857756277577618521124241408", 4188024570], ["-120912052.000000000000000000000000000000001", 3437666071], ["-0.000000000001540722790235177219742013221548404544591903686523437499999999999999999999999999999999", 2883114595], ["22274878120411520357629952", 1771267868], ["28536881390923110557983703040000001", 2024791875], ["0.0000002340796285693613754119724035263061523437499999999999999999999999999999999", 880498513], ["-0.000847086979774758219718933105468750000000000000000000000000000", 3126726412], ["-18243433382008325474481135314534400000001", 4286578688], ["-5377484567525262805560801974875586559999", 4286578688], ["0.0178212532773613929748535156250000000000000000000000000000", 1016200672], ["0.00000528027499058225657790899276733398437500000000000000000000000000000000001", 917581112], ["2774383225136192258578579455999999", 1997064612], ["-0.00000000000000000000002166745079050556255337523345258092565338015056397580337943509221076965332031250000000000000000000000000000", 2580647426], ["-291122264841449560923019673600000001", 4200613310], ["-0.000232216603762935847043991088867187499999999999999999999999999999999", 3111354155], ["0.00000000000000000008671955716205084222012437365420534085558301740093156695365905761718750000000000000000000000000000", 533512898], ["0.0000000000000000252374814938817247460516729473667396632663439959287643432617187500000000000000000000000000000000001", 602457682], ["160.8969650268554687499999999999999999999999999999999", 1126229407], ["-0.000000000000000000000000000000000000202019583197463863248253831714737382662821192870474237739003332158709350108161117987037869170308113098144531250000000000000000000000000000", 2190048454], ["-0.000000000013414389824634165293559817655477672815322875976562500000000000000000000000000000000001", 2909535499], ["-0.00000000000000000000000000000000000113337320232981955937091254744111074055966132347132933944693147516446368738840533296752255409955978393554687499999999999999999999999999999999", 2210452829], ["3301971259817984.0", 1497084418], ["206775370383360.000000000001", 1463553957], ["0.00000000000000000000000000146597372172358885396427910160131291541242548864126815644226553558837622404098510742187499999999999999999999999999999999", 317213429], ["-0.00000000000000000010801075315181389134589086788509892933518585778074339032173156738281250000000000000000000000000000", 2684291198], ["-2349751786166602956800000001", 3975345513], ["-0.000000000681056017137748881395964417606592178344726562499999999999999999999999999999999", 2956670222], ["0.00000000000000002911996867700450500890743676940530804131412878632545471191406250000000000000000000000000000", 604392138], ["0.0000000000000000000356212486878246921757561161640120994675839938281569629907608032226562500000000000000000000000000000000001", 522729331], ["0.0000001875907358339645725209265947341918945312499999999999999999999999999999999", 877227148], ["-1488439237148672.00", 3634968392], ["-0.0000000000000000000034392019119582896154566898879508668462889886541233863681554794311523437500000000000000000000000000000000001", 2642537964], ["-333954689710877573659560850017484799999", 4286266709], ["0.00000000000000000000000000000000000005990403798649838872406496976958146020029335374018207890105432421459048450418372055992222158238291740417480468750000000000000000000000000000", 27464454], ["0.0000000000070791655957386234732098273525480180978775024414062500000000000000000000000000000000001", 754520949], ["0.00004494290442380588501691818237304687499999999999999999999999999999999", 943489299], ["-0.0000000000000000000000000000000000000125697334048491651024357161714799200274260233547417718783808655661908852338437547757621359778568148612976074218750000000000000000000000000000", 2156453710], ["-0.000134045076265465468168258666992187500000000000000000000000000000000001", 3104607860], ["131124492099189852645737103359999", 1959715011], ["-0.000000000000686316482161400398531725386419566348195075988769531250000000000000000000000000000", 2873175632], ["-70069886528488488768697794560000001", 4183288677], ["-0.0000000209057846589644213963765650987625122070312499999999999999999999999999999999", 2998113358], ["4430272030343325382499893248", 1835338282], ["0.000000000000000000000000003737845413845730659781797907762209715296943240286919873938131786417216062545776367187500000000000000000000000000000000001", 328471106], ["0.0000000000000000000000656651951137113584926583215199073339379820524186470720451325178146362304687499999999999999999999999999999999", 446612681], ["-0.000000000000001493765948828567344600082300587473582709208130836486816406250000000000000000000000000000", 2799126076], ["-43687945403439118727346352753213440000001", 4286578688], ["-9014400440176413245439999", 3907951604], ["15108066570607263744", 1599187618], ["125792444.000000000000000000000000000000001", 1290792472], ["22096152.99999999999999999999999999999999", 1269339276], ["0.0000000000000000137206958697329798869913794479025170858221827074885368347167968750000000000000000000000000000", 595401256], ["0.000000000000000000000991241517003005040849363385723012204175930150995554868131875991821289062500000000000000000000000000000000001", 479578829], ["371981707078845099236306649947832319999", 2139095040], ["-18024307731463499296937082880", 3999855982], ["-0.012941679451614618301391601562500000000000000000000000000000000001", 3159624023], ["-0.00000000000000009732882042134536248936121927144426990707870572805404663085937499999999999999999999999999999999", 2766171339], ["0.000080461544712306931614875793457031250000000000000000000000000000", 950582646], ["0.00000000000000000161938528877153425774508121309791519593090924900025129318237304687500000000000000000000000000000000001", 569309862], ["0.0000000000000000002648363616942685592354491622840706455122017359826713800430297851562499999999999999999999999999999999", 547116272], ["-0.0000000000000000885290348369898388121088106395006889215437695384025573730468750000000000000000000000000000", 2764841554], ["-28632376317571560898560000001", 4005103691], ["-0.01594801712781190872192382812499999999999999999999999999999999", 3162678634], ["14048899584.0000000000000000000", 1347508300], ["20157096802037434145532572000583680000001", 2139095040], ["0.000000385903760502515069674700498580932617187499999999999999999999999999999999", 885993013], ["-0.0000000000000000000000000099326011984902136070957893216623652787947975836835290408544096862897276878356933593750000000000000000000000000000", 2487532614], ["-0.0000000000000000185990708736517343076331126860978315562533680349588394165039062500000000000000000000000000000000001", 2745928657], ["-202407875099377008639999", 3861606966], ["247295665840918733857146866816253952", 2050916984], ["0.000000000000000000000000000001307843871038431286080440727691097674252021577515146377040933245439191523473709821701049804687500000000000000000000000000000000001", 232011190], ["0.014948068652302026748657226562499999999999999999999999999999999", 1014294718], ["20730.168318e-27", 432569705], ["55339.595968e-27", 444976525], ["13446.646148e-31", 315953684], ["31603.492134e18", 1691756370], ["92229.749308e12", 1537463612], ["42722.995509e-2", 1138072943], ["5636.978535e38", 2139095040], ["72265.406573e20", 1757366514], ["52413.675164e-5", 1057369555], ["38794.310569e17", 1666338284], ["73605.349444e25", 1897178387], ["8273.110058e-1", 1146016744], ["2001.150216e19", 1686608492], ["56425.326126e-17", 723440316], ["85602.275772e24", 1871334469], ["38927.425316e-31", 328873241], ["31700.718730e-7", 995082491], ["83942.185139e-22", 588961939], ["84867.40396e-24", 533226291], ["2684.21017e31", 2024107359]]) {
      f32[0] = decimalToFloat32(text);
      expect(u32[0], text).toBe(bits);
    }
  });
  it('CGFloat prints, describes, encodes and converts like a Double with its own name', async () => {
    // swiftc 6.2 with Foundation and CoreGraphics
    expect(await ok("import Foundation\nimport CoreGraphics\nstruct P: Codable { var x: CGFloat; var y: [CGFloat]; var z: Double }\nlet enc = JSONEncoder()\nenc.outputFormatting = [.sortedKeys]\nlet data = try enc.encode(P(x: 0.1, y: [1, 2.5, 1e-7], z: 3))\nprint(String(data: data, encoding: .utf8)!)\nlet back = try JSONDecoder().decode(P.self, from: Data(\"{\\\"x\\\": 0.30000000000000004, \\\"y\\\": [1, 1e300], \\\"z\\\": 2}\".utf8))\nprint(back.x, back.y, type(of: back.x), back.x.description, \"\\(back.x)\", String(describing: back.y[0]))\ndo { _ = try enc.encode(P(x: .infinity, y: [], z: 0)) } catch { print(error) }\n")).toBe("{\"x\":0.1,\"y\":[1,2.5,1e-07],\"z\":3}\n0.30000000000000004 [1.0, 1e+300] CGFloat 0.30000000000000004 0.30000000000000004 1.0\nEncodingError.invalidValue: inf (Double). Path: x. Debug description: Unable to encode Double.inf directly in JSON.\n");
    expect((await fails('import CoreGraphics\nprint(CGFloat(1).debugDescription)')).message).toBe("value of type 'CGFloat' has no member 'debugDescription'");
    // arithmetic, conversions, SE-0307 mixing with Double, type tests, literals and reduce
    // (each program's output is swiftc 6.2's, byte for byte)
    expect(await ok("import CoreGraphics\nlet c: CGFloat = 1.5\nlet d: Double = 2\nlet w = CGFloat(3)\nprint(type(of: CGFloat(1)), CGFloat(1.5), c * 2, type(of: c * 2), c + w, type(of: c + w), [c, 2.5], type(of: [c, 2.5]))\nprint(Double(c), type(of: Double(c)), CGFloat(d), type(of: CGFloat(d)), CGFloat(Float(0.1)), Int(c), CGFloat.pi, CGFloat.greatestFiniteMagnitude, (c as Any) is Double, (c as Any) is CGFloat, c.description, -c, abs(-c), max(c, 1), c.squareRoot(), type(of: c.squareRoot()))\nlet sum = c + d\nprint(sum, type(of: sum))\nlet e: CGFloat = 0.1\nprint(e * 3, String(format: \"%.2f\", c), c == 1.5, c < w, CGFloat(Int8(5)), type(of: c.rounded()))\n")).toBe("CGFloat 1.5 3.0 CGFloat 4.5 CGFloat [1.5, 2.5] Array<CGFloat>\n1.5 Double 2.0 CGFloat 0.10000000149011612 1 3.141592653589793 1.7976931348623157e+308 false true 1.5 -1.5 1.5 1.5 1.224744871391589 CGFloat\n3.5 Double\n0.30000000000000004 1.50 true true 5.0 CGFloat\n");
    expect(await ok("import CoreGraphics\nlet c: CGFloat = 1.5\nlet d: Double = 2\nlet x = c + 1.0\nlet r: CGFloat = d\nlet q: Double = c\nlet m: CGFloat = c * d\nprint(type(of: x), r, q, type(of: q), m, type(of: m), type(of: d * c), Array(stride(from: CGFloat(0), to: 1, by: 0.5)), c > d)\n")).toBe("CGFloat 2.0 1.5 Double 3.0 CGFloat Double [0.0, 0.5] false\n");
    expect(await ok("import CoreGraphics\nlet xs: [CGFloat] = [1, 2, 3]\nlet fs: [Float] = [0.1, 0.2]\nlet ds = [0.1, 0.2]\nlet e: [CGFloat] = []\nprint(xs.reduce(0, +), type(of: xs.reduce(0, +)), fs.reduce(0, +), type(of: fs.reduce(0, +)), ds.reduce(0, +), type(of: ds.reduce(0, +)), e.reduce(0, +), type(of: e.reduce(0, +)), xs.reduce(1, *))\n")).toBe("6.0 CGFloat 0.3 Float 0.30000000000000004 Double 0.0 CGFloat 6.0\n");
    // reduce(into:), += sums, min/max/sorted and map keep [CGFloat] and [Float] element types
    expect(await ok("import CoreGraphics\nlet xs: [CGFloat] = [3, 1.5, 2]\nlet fs: [Float] = [0.3, 0.1, 0.2]\nlet r1 = xs.reduce(into: 0) { $0 += $1 }\nlet r2 = fs.reduce(into: 0) { $0 += $1 }\nvar s1: CGFloat = 0\nfor x in xs { s1 += x }\nvar s2: Float = 0\nfor f in fs { s2 = s2 + f }\nprint(r1, type(of: r1), r2, type(of: r2), s1, type(of: s1), s2, type(of: s2))\nprint(xs.min()!, type(of: xs.min()!), xs.max()!, xs.sorted(), type(of: xs.sorted()), fs.min()!, type(of: fs.max()!), fs.sorted(), type(of: fs.sorted(by: >)))\nprint(xs.reduce(0, +), type(of: fs.reduce(0) { $0 + $1 }), xs.map { $0 * 2 }, type(of: xs.map { $0 * 2 }), fs.filter { $0 > 0.15 }, xs.reduce(CGFloat(1), *), min(xs[0], xs[1]), type(of: max(fs[0], fs[1])))\n")).toBe("6.5 CGFloat 0.6 Float 6.5 CGFloat 0.6 Float\n1.5 CGFloat 3.0 [1.5, 2.0, 3.0] Array<CGFloat> 0.1 Float [0.1, 0.2, 0.3] Array<Float>\n6.5 Float [6.0, 3.0, 4.0] Array<CGFloat> [0.3, 0.2] 9.0 1.5 Float\n");
    expect(await ok("let fs: [Float] = [1, 2]\nprint(type(of: fs.map { $0 / 3 }), fs.map { $0 / 3 }, type(of: [1.5, 2].map { $0 * 2 }))\n")).toBe("Array<Float> [0.33333334, 0.6666667] Array<Double>\n");
  });
});

describe('Review pass 11: overflow diagnostics name the declared integer type', () => {
  it('uses UInt64, Int32, UInt8? ... as swiftc does', async () => {
    // every message checked against swiftc 6.2
    const into = async (src) => (await fails(src)).message.replace(/.*stored into /, '');
    expect(await into('let u: UInt64 = 18446744073709551616')).toBe("'UInt64'");
    expect(await into('let u: UInt64 = 99999999999999999999999')).toBe("'UInt64'");
    expect(await into('let u: UInt = 18446744073709551616')).toBe("'UInt'");
    expect(await into('let a: Int32 = 99999999999999999999')).toBe("'Int32'");
    expect(await into('let b: Int64 = 9223372036854775808')).toBe("'Int64'");
    expect(await into('let c: [UInt64] = [18446744073709551616]')).toBe("'UInt64'");
    expect(await into('let d: UInt8? = 99999999999999999999')).toBe("'UInt8'");
    expect(await into('let e: Int = 9223372036854775808')).toBe("'Int'");
    expect(await ok('let u: UInt64 = 18446744073709551615\nlet m: Int64 = -9223372036854775808\nprint(u, m)')).toBe('18446744073709551615 -9223372036854775808\n');
  });
  it('an integer literal above 2^53 becomes a Float with one rounding, in declarations and assignments', async () => {
    // swiftc 6.2: bit pattern 1568669697 (2^60 + 2^37), not 1568669696 via a Double
    expect(await ok("var f: Float = 0\nf = 1152921573326323713\nprint(f, f == Float(1 << 60), f.bitPattern)\nlet g: Float = 1152921573326323713\nprint(g.bitPattern, Float(bitPattern: 1065353216), Double(bitPattern: 4607182418800017408), (0.1).bitPattern, Float(0.1).bitPattern)\n")).toBe("1.1529216e+18 false 1568669697\n1568669697 1.0 1.0 4591870180066957722 1036831949\n");
  });
});

describe('Review pass 12: inferred initializers, negative literal wording, Float/CGFloat keys, qualified metatypes', () => {
  // every expected output and message is swiftc 6.2's
  it('an unannotated initializer lets a Double neighbour type an oversized literal', async () => {
    expect(await ok("let x = 2.0\nlet b = 123456789012345678901234567890 * x\nlet e = 1 + 99999999999999999999 * x\nprint(b, e)\n")).toBe("2.4691357802469136e+29 2e+20\n");
    const msg = async (src) => (await fails(src)).message;
    expect(await msg('let i = 99999999999999999999')).toBe("integer literal '99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('let n = 3\nlet i = 99999999999999999999 * n')).toBe("integer literal '99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('let i = (99999999999999999999)')).toBe("integer literal '99999999999999999999' overflows when stored into 'Int'");
  });
  it('names a negated oversized literal with its sign', async () => {
    const msg = async (src) => (await fails(src)).message;
    expect(await msg('let i = -99999999999999999999')).toBe("integer literal '-99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('print(-99999999999999999999)')).toBe("integer literal '-99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('let i = -99999999999999999999 * 2')).toBe("integer literal '-99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('let i: Int8 = -99999999999999999999')).toBe("integer literal '-99999999999999999999' overflows when stored into 'Int8'");
    expect(await msg('let u: UInt64 = -18446744073709551616')).toBe("negative integer '-18446744073709551616' overflows when stored into unsigned type 'UInt64'");
    expect(await msg('func g(_ x: Int) {}\ng(-99999999999999999999)')).toBe("integer literal '-99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('import CoreGraphics\nlet c: CGFloat = -9223372036854775809')).toBe("integer literal '-9223372036854775809' overflows when stored into 'CGFloat'");
    // the same wording where the interpreter decides (assignments, inferred neighbours)
    expect(await msg('var n = 0\nn = -99999999999999999999')).toBe("integer literal '-99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('let x = 1\nlet y = -99999999999999999999 * x')).toBe("integer literal '-99999999999999999999' overflows when stored into 'Int'");
    expect(await msg('var u: UInt64 = 0\nu = -18446744073709551616')).toBe("negative integer '-18446744073709551616' overflows when stored into unsigned type 'UInt64'");
    expect(await ok('var u: UInt64 = 0\nu = 18446744073709551615\nprint(u)')).toBe('18446744073709551615\n');
  });
  it('Float- and CGFloat-keyed dictionaries and sets look keys up in their key type', async () => {
    expect(await ok("import CoreGraphics\nlet f: Float = 0.1\nvar d: [Float: String] = [0.1: \"a\", 2: \"b\"]\nprint(d[0.1] as Any, d[f] as Any, d[2] as Any)\nd[0.1] = \"c\"\nprint(d.count, d.updateValue(\"d\", forKey: 0.1) as Any, d.removeValue(forKey: 2) as Any, d.count, d.keys.contains(0.1), d[0.1, default: \"z\"], d[0.3, default: \"z\"])\nvar s: Set<Float> = [0.1, 0.2]\nprint(s.contains(0.1), s.insert(0.1).inserted, s.remove(0.2) as Any, s.count)\nvar c: [CGFloat: Int] = [1.5: 1]\nc[1.5] = 2\nprint(c[1.5] as Any, c.count, type(of: c.keys.first!))\nlet x = 2.0\nlet b = 123456789012345678901234567890 * x\nlet e = 1 + 99999999999999999999 * x\nprint(b, e)\n")).toBe("Optional(\"a\") Optional(\"a\") Optional(\"b\")\n2 Optional(\"c\") Optional(\"b\") 1 true d z\ntrue false Optional(0.2) 1\nOptional(2) 1 CGFloat\n2.4691357802469136e+29 2e+20\n");
    expect(await ok("import CoreGraphics\nlet f: Float = 0.1\nvar d = [f: \"a\"]\nd[0.2] = \"b\"\nprint(d[0.1] as Any, d.count, d.removeValue(forKey: 0.2) as Any, d.count)\nlet u = Dictionary(uniqueKeysWithValues: [(f, 1), (Float(0.5), 2)])\nprint(u[0.5] as Any, u[0.1] as Any)\nvar s = Set([f, 0.3])\nprint(s.contains(0.1), s.contains(0.3), s.insert(0.3).inserted, s.count)\nvar counts: [Float: Int] = [:]\nfor x: Float in [0.1, 0.1, 0.2] { counts[x, default: 0] += 1 }\nprint(counts[0.1, default: 0], counts[0.2]!, counts[0.7, default: -1])\nvar g: [CGFloat: String] = [:]\ng[0.1] = \"x\"\nprint(g[0.1] as Any, g.keys.first.map { type(of: $0) } as Any)\n")).toBe("Optional(\"a\") 2 Optional(\"b\") 1\nOptional(2) Optional(1)\ntrue true false 2\n2 1 -1\nOptional(\"x\") Optional(CoreGraphics.CGFloat)\n");
    // updateValue/removeValue, Set algebra with literal operands, update(with:), merge and merging
    expect(await ok("var e: [Float: String] = [:]\ne[0.1] = \"a\"\nprint(e.updateValue(\"b\", forKey: 0.1) as Any, e[Float(0.1)]!, e.removeValue(forKey: 0.1) as Any, e.count)\nlet fs: Set<Float> = [0.1, 0.2]\nprint(fs.contains(0.1))\nvar s: Set<Float> = [0.1]\nprint(s.update(with: 0.1) as Any, s.union([0.1, 0.5]).count, s.intersection([0.1]).count, s.isSubset(of: [0.1, 0.2]), s.subtracting([0.1]).count, s.symmetricDifference([0.1, 0.3]).count, s.isDisjoint(with: [0.1]))\nvar m: [Float: Int] = [0.1: 1]\nm.merge([0.1: 5, 0.2: 2]) { $0 + $1 }\nprint(m.count, m[0.1]!, m.merging([0.1: 1]) { $0 + $1 }[0.1]!)\ns.formUnion([0.1, 0.7])\nprint(s.count, s.contains(0.7))\n")).toBe("Optional(\"a\") b Optional(\"b\") 0\ntrue\nOptional(0.1) 2 1 true 0 1 false\n2 6 7\n2 true\n");
    expect(await ok("var a = [\"x\": 1, \"y\": 2]\na.merge([\"y\": 10, \"z\": 3], uniquingKeysWith: { old, new in old + new })\nprint(a.sorted { $0.key < $1.key })\nlet b = a.merging([\"x\": 100]) { $1 }\nprint(b[\"x\"]!, a[\"x\"]!, a.merging([:]) { x, _ in x }.count)\nvar s: Set = [1, 2, 3]\nprint(s.update(with: 2) as Any, s.update(with: 9) as Any, s.count)\ns.formSymmetricDifference([3, 4])\nprint(s.sorted(), s.union([7]).sorted(), s.isSuperset(of: [1, 2]))\n")).toBe("[(key: \"x\", value: 1), (key: \"y\", value: 12), (key: \"z\", value: 3)]\n100 1 3\nOptional(2) nil 4\n[1, 2, 4, 9] [1, 2, 4, 7, 9] true\n");
  });
  it('prints metatypes inside collections with their module', async () => {
    expect(await ok("import Foundation\nimport CoreGraphics\nstruct Foo {}\nenum E { case a }\nclass K {}\nprint([Int.self], Optional(String.self) as Any, [Double.self, Float.self], (Bool.self, CGFloat.self), [Date.self, URL.self, Data.self, UUID.self], Int.self, Foo.self, [Character.self, Substring.self, Int8.self, UInt64.self])\nprint([Foo.self], [E.self], [K.self])\n")).toBe("[Swift.Int] Optional(Swift.String) [Swift.Double, Swift.Float] (Swift.Bool, CoreGraphics.CGFloat) [Foundation.Date, Foundation.URL, Foundation.Data, Foundation.UUID] Int Foo [Swift.Character, Swift.Substring, Swift.Int8, Swift.UInt64]\n[main.Foo] [main.E] [main.K]\n");
  });
});

describe('Review pass 13: String(format:) parsing, shifting charges, declared value types', () => {
  // every expected output is swiftc 6.2's (Foundation's CoreFoundation formatter)
  it('H2: String(format:) parses specs in one linear pass with CoreFoundation\'s rules', async () => {
    expect(await ok("import Foundation\nprint(String(format: \"%d|%5d|%-5d|%05d|%+d|%,d|%x|%X|%o|%%|%c\", 42, 42, 42, -42, 7, 1234567, 255, 255, 8, 65))\nprint(String(format: \"%.2f|%8.3f|%-8.1f|%e|%.3E|%g|%G|%@|%ld|%lld|%hhd|%lu\", 3.14159, 2.5, 1.25, 12345.678, 0.000123, 0.0001, 1e10, \"obj\", 5, 6, 7, 8))\nprint(String(format: \"100%% done %.1f%% %5.1f%%\", 99.5, 12.25))\n")).toBe("42|   42|42   |-0042|+7|,d|12d687|FF|377|%|\b\n3.14|   2.500|1.2     |1.234568e+04|1.230E-04|0.0001|1E+10|obj|5|6|7|8\n100% done 99.5%  12.2%\n");
    expect(await ok("import Foundation\nprint(String(format: \"[%q] [%5q] [%,5d] [%000z] [%-k] [%.2q] [%lq] [%] [a%]\", 1, 2, 3, 4, 5, 6, 7))\nprint(String(format: \"[%g] [%g] [%g] [%G] [%.3g] [%g] [%g] [%#g] [%g] [%.0g]\", 0.0001, 0.00001, 123456.0, 1e10, 3.14159, 100.0, 1e-5, 1.5, 1234567.0, 2.5))\n")).toBe("[q] [5q] [,5d] [000z] [-k] [.2q] [lq] [] [a]\n[0.0001] [1e-05] [123456] [1E+10] [3.14] [100] [1e-05] [1.50000] [1.23457e+06] [2]\n");
    expect(await ok("import Foundation\nfor f in [\"a%5\", \"a%000z\", \"a%l\", \"a%.\", \"a%-\", \"a%5q\", \"a%000zq\", \"a%zd\", \"a%\", \"a%%\", \"a%5.\", \"a%0\"] {\n    print(\"[\\(f)] -> [\\(String(format: f, 7))]\")\n}\n")).toBe("[a%5] -> [a]\n[a%000z] -> [a]\n[a%l] -> [a]\n[a%.] -> [a]\n[a%-] -> [a]\n[a%5q] -> [a]\n[a%000zq] -> [a]\n[a%zd] -> [a7]\n[a%] -> [a]\n[a%%] -> [a%]\n[a%5.] -> [a]\n[a%0] -> [a]\n");
    expect(await ok("import Foundation\nfor f in [\"a%5qb\", \"a%qb\", \"a%5q]\", \"a%q\", \"[%q\", \"%q]\", \"x%5qyz\", \"x%,dyz\", \"x%,d\", \"x%5q%d\", \"%5qb%d\", \"x%5\", \"x%5b\", \"x%5 b\"] {\n    print(\"[\\(f)] -> [\\(String(format: f, 7, 8))]\")\n}\n")).toBe("[a%5qb] -> [a5qb]\n[a%qb] -> [aqb]\n[a%5q]] -> [a5q]]\n[a%q] -> [a]\n[[%q] -> [[]\n[%q]] -> [q]]\n[x%5qyz] -> [x5qyz]\n[x%,dyz] -> [x,dyz]\n[x%,d] -> [x,d]\n[x%5q%d] -> [x5q%d]\n[%5qb%d] -> [5qb7]\n[x%5] -> [x]\n[x%5b] -> [x5b]\n[x%5 b] -> [x5 b]\n");
    expect(await ok("import Foundation\nfor f in [\"x%b\", \"x%5b\", \"x%5bc\", \"x%5w\", \"x%w\", \"x%5Q\", \"x%k\", \"x%5k\", \"x%5kc\", \"x%n\", \"x%5m\", \"x%5y\", \"x%5r\"] {\n    print(\"[\\(f)] -> [\\(String(format: f, 7, 8))]\")\n}\n")).toBe("[x%b] -> [xb]\n[x%5b] -> [x5b]\n[x%5bc] -> [x5bc]\n[x%5w] -> [x5w]\n[x%w] -> [xw]\n[x%5Q] -> [x5Q]\n[x%k] -> [xk]\n[x%5k] -> [x5k]\n[x%5kc] -> [x5kc]\n[x%n] -> [x]\n[x%5m] -> [x5m]\n[x%5y] -> [x5y]\n[x%5r] -> [x5r]\n");
    expect(await ok("import Foundation\nfor f in [\"x%5%y%d\", \"x%ny%d\", \"x%td\", \"x%jd\", \"x%Ld\", \"x%qd\", \"x%hhd\", \"x%5.%d\", \"x% d\", \"x%#x\", \"x%+5d\"] {\n    print(\"[\\(f)] -> [\\(String(format: f, 7, 8))]\")\n}\n")).toBe("[x%5%y%d] -> [x5%y7]\n[x%ny%d] -> [xy8]\n[x%td] -> [x7]\n[x%jd] -> [x7]\n[x%Ld] -> [x7]\n[x%qd] -> [x7]\n[x%hhd] -> [x7]\n[x%5.%d] -> [x5.%d]\n[x% d] -> [x 7]\n[x%#x] -> [x0x7]\n[x%+5d] -> [x   +7]\n");
    // a long run of flags before an invalid conversion: linear, charged by length
    const r = await run('import Foundation\nlet f = "%" + String(repeating: "0", count: 100_000) + "z"\nlet s = String(format: f)\nprint(s.count, s.hasPrefix("000"), s.hasSuffix("0z"))');
    expect(r.stdout).toBe('0 false false\n'); // swiftc: a spec that runs off the end prints nothing
    expect(r.steps).toBeGreaterThanOrEqual(100_000 / 16);
    expect(r.steps).toBeLessThan(60_000);
  });
  it('H3: insertions and removals that shift elements are charged by the elements moved', async () => {
    const big = await run('var a = Array(0..<1_000_000)\nfor _ in 0..<10_000 { a.removeFirst() }\nprint(a.count)');
    expect(big.error?.kind).toBe('limit'); // 10,000 shifts of ~1M elements
    const queue = await run('var q = Array(0..<1000)\nvar s = 0\nwhile !q.isEmpty { s += q.removeFirst() }\nprint(s)');
    expect(queue.stdout).toBe('499500\n');
    expect(queue.steps).toBeGreaterThanOrEqual(1000 * 999 / 2 / 16);
    expect(queue.steps).toBeLessThan(80_000);
    // remove(atOffsets:) and move(fromOffsets:toOffset:) as single passes; swiftc results
    // (the engine has no IndexSet initializer, so a Set stands in for it)
    expect(await ok("import SwiftUI\nvar a = Array(0..<10)\na.move(fromOffsets: Set([1, 3, 8]), toOffset: 5)\nprint(a)\nvar b = Array(0..<10)\nb.move(fromOffsets: Set([7, 2]), toOffset: 0)\nprint(b)\nvar c = Array(0..<10)\nc.move(fromOffsets: Set([0, 1]), toOffset: 10)\nprint(c)\nvar d = Array(0..<10)\nd.remove(atOffsets: Set([0, 4, 9]))\nprint(d)\nvar e = Array(0..<10)\ne.removeFirst(3); e.removeFirst(); e.insert(99, at: 2); e.remove(at: 0); e.removeSubrange(1..<3); e.insert(contentsOf: [7, 7], at: 1)\nprint(e)\n")).toBe("[0, 2, 4, 1, 3, 8, 5, 6, 7, 9]\n[2, 7, 0, 1, 3, 4, 5, 6, 8, 9]\n[2, 3, 4, 5, 6, 7, 8, 9, 0, 1]\n[1, 2, 3, 5, 6, 7, 8]\n[5, 7, 7, 7, 8, 9]\n");
  });
  it('M1: dictionary updates, merges and defaults store the declared value type', async () => {
    expect(await ok("import CoreGraphics\nvar d: [Int: Float] = [:]\nprint(d.updateValue(0.1, forKey: 1) as Any, type(of: d[1]!), d[1]!)\nvar c: [Int: CGFloat] = [:]\nc.updateValue(1.5, forKey: 1)\nprint(type(of: c[1]!))\nvar m: [String: Float] = [\"a\": 0.1]\nm.merge([\"a\": 0.2, \"b\": 0.3]) { _, _ in 0.3 }\nprint(m[\"a\"]!, type(of: m[\"a\"]!), m[\"b\"]!, type(of: m[\"b\"]!))\nlet mm = m.merging([\"a\": 1]) { $0 + $1 }\nprint(mm[\"a\"]!, type(of: mm[\"a\"]!))\nvar g: [String: Float] = [:]\ng[\"x\", default: 0.1] += 0.2\nprint(g[\"x\"]!, type(of: g[\"x\"]!), g[\"y\", default: 0.7], type(of: g[\"y\", default: 0.7]))\nlet r = [\"a\": 1, \"b\": 2].reduce(into: [String: Float]()) { $0[$1.key] = 0.5 }\nvar e = [String: CGFloat]()\ne[\"k\"] = 2\nprint(type(of: e[\"k\"]!))\n")).toBe("nil Float 0.1\nCGFloat\n0.3 Float 0.3 Float\n1.3 Float\n0.3 Float 0.7 Float\nCGFloat\n");
    // with the generic-arguments hook, Set<Float>() keeps its element type too
    expect(await ok("import CoreGraphics\nvar d: [Int: Float] = [:]\nprint(d.updateValue(0.1, forKey: 1) as Any, type(of: d[1]!), d[1]!)\nvar c: [Int: CGFloat] = [:]\nc.updateValue(1.5, forKey: 1)\nprint(type(of: c[1]!))\nvar m: [String: Float] = [\"a\": 0.1]\nm.merge([\"a\": 0.2, \"b\": 0.3]) { _, _ in 0.3 }\nprint(m[\"a\"]!, type(of: m[\"a\"]!), m[\"b\"]!, type(of: m[\"b\"]!))\nlet mm = m.merging([\"a\": 1]) { $0 + $1 }\nprint(mm[\"a\"]!, type(of: mm[\"a\"]!))\nvar g: [String: Float] = [:]\ng[\"x\", default: 0.1] += 0.2\nprint(g[\"x\"]!, type(of: g[\"x\"]!), g[\"y\", default: 0.7], type(of: g[\"y\", default: 0.7]))\nlet r = [\"a\": 1, \"b\": 2].reduce(into: [String: Float]()) { $0[$1.key] = 0.5 }\nprint(r.sorted { $0.key < $1.key }, type(of: r[\"a\"]!))\nvar e = [String: CGFloat]()\ne[\"k\"] = 2\nvar fs = Set<Float>()\nfs.insert(0.1)\nprint(type(of: e[\"k\"]!), fs.contains(0.1), type(of: fs.first!))\n")).toBe("nil Float 0.1\nCGFloat\n0.3 Float 0.3 Float\n1.3 Float\n0.3 Float 0.7 Float\n[(key: \"a\", value: 0.5), (key: \"b\", value: 0.5)] Float\nCGFloat true Float\n");
  });
  it('describe() counts every character once and marks a cut with "…"', async () => {
    const nums = new SArray(Array.from({ length: 100 }, (_, i) => i + 1));
    const strs = new SArray([new SArray(['abcd', 'efgh']), new SArray(['ijkl'])]);
    expect(describeValue(nums).length).toBe(392);
    expect(describeValue(nums, false, { limit: 10 })).toBe('[1, 2, 3, …');
    expect(describeValue(strs, false, { limit: 12 })).toBe('[["abcd", "e…');
    expect(describeValue(strs, false, { limit: 28 })).toBe('[["abcd", "efgh"], ["ijkl"]]'); // exactly the limit: no mark
    expect(describeValue(strs, false, { limit: 27 })).toBe('[["abcd", "efgh"], ["ijkl"]…');
    // the capacity hook sees the real length (it used to count nested strings twice)
    const seen = [];
    const prev = hooks.checkCapacity;
    hooks.checkCapacity = (n) => { seen.push(n); };
    try {
      const big = new SArray(Array.from({ length: 5000 }, () => new SArray(['abcdefgh', 'ij'])));
      const text = describeValue(big);
      expect(text.length).toBe(5000 * 20 - 2 + 2);
      expect(Math.max(...seen)).toBeLessThanOrEqual(text.length);
      expect(Math.max(...seen)).toBeGreaterThan(text.length - 4096);
    } finally {
      hooks.checkCapacity = prev;
    }
    // 12M characters of description fit under the 16,777,216 cap; one element past it stops
    const fits = await run('let a = Array(repeating: "abcdefgh", count: 1_000_000)\nlet s = String(describing: a)\nprint(s.count)');
    expect(fits.error).toBeNull();
    expect(fits.stdout).toBe('12000000\n');
    const over = await run('let a = Array(repeating: "abcdefgh", count: 1_398_102)\nlet s = String(describing: a)\nprint(s.count)');
    expect(over.error?.message).toMatch(/caps collections and strings at 16,777,216/);
  });
  it('M2: filter, mapValues, set algebra and set-derived arrays keep their element types', async () => {
    expect(await ok("import CoreGraphics\nlet fs: Set<Float> = [0.1, 0.2]\nvar f3 = fs.filter { _ in false }\nf3.insert(0.1)\nprint(type(of: f3.first!), f3.contains(0.1))\nlet d: [Float: Int] = [0.1: 1]\nvar d2 = d.filter { _ in false }\nd2[0.1] = 5\nprint(type(of: d2.keys.first!), d2[0.1]!)\nvar u2 = fs.union([0.5]).subtracting(fs.union([0.5]))\nu2.insert(0.3)\nprint(type(of: u2.first!), u2.contains(0.3))\nvar i2 = fs.intersection([0.9])\ni2.insert(0.9)\nprint(type(of: i2.first!))\nvar mv = d.mapValues { Float($0) }.filter { _ in false }\nmv[0.1] = 2\nprint(type(of: mv.keys.first!), mv[0.1]!, type(of: mv[0.1]!))\nlet sd: [String: CGFloat] = [\"a\": 1]\nvar sd2 = sd.filter { _ in false }\nsd2[\"b\"] = 2\nprint(type(of: sd2[\"b\"]!), type(of: fs.sorted()), type(of: fs.filter { _ in false }.sorted()))\n")).toBe("Float true\nFloat 5\nFloat true\nFloat\nFloat 2.0 Float\nCGFloat Array<Float> Array<Float>\n");
  });
});

describe('Review pass 14: builtin result choke point, describe charging, format, URL, typed collections', () => {
  // every expected output is swiftc 6.2's
  it('routes every builtin function value through the result choke point (source guard)', () => {
    const b = fs.readFileSync(path.resolve('src/engine/builtins.js'), 'utf8');
    const f = fs.readFileSync(path.resolve('src/engine/foundation.js'), 'utf8');
    // function values are made only by nf / bound (builtins) and nfn (foundation), and
    // each wraps its native with guardedNative; the one exempt line copies a user closure
    const made = (src) => src.split('\n').filter((l) => l.includes('new SFunc(') && !l.includes('choke-point exempt'));
    expect(made(b).map((l) => l.trim())).toEqual([
      "const nf = (name, native, extra = {}) => new SFunc({ name, native: guardedNative(native), ...extra });",
      'return new SFunc({ name, native: guardedNative(native, self), self, ...extra });',
    ]);
    expect(made(f).map((l) => l.trim())).toEqual(["const nfn = (name, native) => new SFunc({ name, native: guardedNative(native) }); // results go through the choke point"]);
    // properties, static members and initializers return values directly: guarded at dispatch
    expect(b).toMatch(/\*member\(interp, v, name, line\) { const before = interp\.steps, serial = collectionSerial\(\); return guardResult\(/);
    expect(b).toMatch(/staticMember\(interp, t, name, line\) { const serial = collectionSerial\(\); return guardResult\(/);
    expect(b).toMatch(/\*construct\(interp, t, args, line\) { const before = interp\.steps, serial = collectionSerial\(\); return guardResult\(/);
    // subscripts too: slices are guarded, single element reads stay free
    expect(b).toMatch(/\*subscriptGet\(interp, obj, args, line\) {\n\s+const before = interp\.steps, serial = collectionSerial\(\);[\s\S]{0,300}return guardResult\(interp, r, line, before, obj, args, serial\);/);
    // the guard looks inside Optionals, and every wrapped native's new receiver value
    // (mutating members) is checked against the cap
    const v = fs.readFileSync(path.resolve('src/engine/values.js'), 'utf8');
    expect(v).toMatch(/while \(v instanceof Opt\) v = v\.v;/);
    expect(v).toMatch(/checkNewSelf\(it, line\);\n\s+return guardResult\(/);
  });
  it('charges equal copies, looks inside Optionals and caps string mutation', async () => {
    // 1: String(s) builds a new string even though it equals its input
    const base = await run('let s = String(repeating: "a", count: 1_000_000)\nprint(s.count)');
    const copies = await run('let s = String(repeating: "a", count: 1_000_000)\nfor _ in 0..<20 { _ = String(s) }\nprint(s.count)');
    expect(copies.steps - base.steps).toBeGreaterThanOrEqual(20 * 1_000_000 / 64);
    // 2: Optional results are checked by what they hold; reading an element is free
    const arr = new SArray([1]);
    const fresh = new SArray(Array.from({ length: 1600 }, (_, i) => i));
    let charged = 0;
    const fake = { steps: 0, chargeBulk(n) { charged += n; }, checkCapacity() {} };
    const serial = fresh.serial - 1; // `fresh` was built during the call
    guardResult(fake, new Opt(fresh), 1, 0, arr, [], serial);
    expect(charged).toBe(100);
    charged = 0;
    guardResult(fake, new Opt(fresh), 1, 0, arr, [], fresh.serial); // existed before: an element handed out
    expect(charged).toBe(0);
    guardResult(fake, new Opt('x'.repeat(6400)), 1, 0, 'receiver text', [], serial); // a String? built by the call
    expect(charged).toBe(100);
    charged = 0;
    guardResult(fake, new Opt('x'.repeat(6400)), 1, 0, new SArray(['x'.repeat(6400)]), [], serial); // arr.first
    expect(charged).toBe(0);
    const url = await run('import Foundation\nlet u: URL? = URL(string: "https://example.com/" + String(repeating: "a", count: 1_000_000))\nvar n = 0\nfor _ in 0..<10 { n += u?.absoluteString.count ?? 0 }\nprint(n)');
    const url0 = await run('import Foundation\nlet u: URL? = URL(string: "https://example.com/" + String(repeating: "a", count: 1_000_000))\nvar n = 0\nprint(n)');
    expect(url.stdout).toBe('10000200\n');
    expect(url.steps - url0.steps).toBeGreaterThanOrEqual(10 * 1_000_000 / 64);
    // 3: in-place growth meets the cap (swiftc output for the small case)
    expect(await ok('var s = "hello"\ns.append("!")\ns.append(contentsOf: " world")\ns += "?"\ns.insert("H", at: s.startIndex)\ns.insert(contentsOf: "<<", at: s.startIndex)\ns.replaceSubrange(s.startIndex..<s.index(s.startIndex, offsetBy: 2), with: ">>")\nvar out = ""\n"abc".write(to: &out)\nprint(s, out, s.count)'))
      .toBe('>>Hhello! world? abc 16\n');
    for (const grow of ['s.insert(contentsOf: s, at: s.startIndex)', 's.append(contentsOf: s)', 's.replaceSubrange(s.startIndex..<s.startIndex, with: s)', 'var t = s\ns.write(to: &t)\ns = t']) {
      const r = await run(`var s = String(repeating: "a", count: 9_000_000)\n${grow}\nprint(s.count)`);
      expect(r.error?.message, grow).toMatch(/caps collections and strings at 16,777,216/);
    }
  });
  it('charges and sizes what builtins without their own accounting return', async () => {
    const base = await run('let a = Array(0..<100_000)\nprint(a.count)');
    for (const expr of ['a.dropFirst()', 'a.enumerated()', 'zip(a, a)', 'Array(a.reversed())']) {
      const r = await run(`let a = Array(0..<100_000)\nfor _ in 0..<5 { _ = ${expr} }\nprint(a.count)`);
      expect(r.error, expr).toBeNull();
      expect(r.steps - base.steps, expr).toBeGreaterThanOrEqual(5 * 100_000 / 16);
    }
  });
  it('H1: describe() charges per element visited and per character produced', async () => {
    const base = await run('let a = Array(0..<100_000)\nprint(a.count)');
    const r = await run('let a = Array(0..<100_000)\nfor _ in 0..<10 { _ = String(describing: a) }\nprint(a.count)');
    const text = 100_000 * 2 - 2 + 2 + Array.from({ length: 100_000 }, (_, i) => String(i).length).reduce((x, y) => x + y, 0);
    expect(r.steps - base.steps).toBeGreaterThanOrEqual(10 * (100_000 / 16 + text / 64));
    // a limited description (a trace line) charges nothing: tracing never changes steps
    const plain = await run('let a = Array(0..<300)\nprint(a.count)');
    const traced = await run('let a = Array(0..<300)\nprint(a.count)', { trace: true });
    expect(traced.steps).toBe(plain.steps);
  });
  it('H2/M5: String(format:) checks every argument and the result, with Foundation\'s flag rules', async () => {
    const big = await run('import Foundation\nlet s = String(repeating: "a", count: 10_000_000)\nlet t = String(format: "%1@%1@", s, s)\nprint(t.count)');
    expect(big.error?.message).toMatch(/caps collections and strings at 16,777,216/);
    expect(await ok("import Foundation\nprint(String(format: \"[%#08x]|[% 05d]|[%#.0f]\", 42, 7, 1.0))\n")).toBe("[0x00002a]|[ 0007]|[1.]\n");
    expect(await ok("import Foundation\nlet ispecs = [\"%#08x\", \"%#8x\", \"%-#8x\", \"%#08X\", \"%#o\", \"%#08o\", \"% 05d\", \"%+05d\", \"%-+5d\", \"% d\", \"%+ d\", \"%05d\", \"%-05d\", \"%#x\", \"%#5.3x\", \"%.3d\", \"%08.3d\", \"%.0d\", \"%u\", \"%x\", \"%lx\", \"%ld\", \"%o\", \"%hd\", \"%hhd\", \"%5.0d\", \"%-8.3x|\", \"%+.4i\", \"%lu\"]\nlet ivals = [42, -7, 0, 70000, -2147483649, 255]\nfor s in ispecs { print(s, ivals.map { String(format: \"[\\(s)]\", $0) }.joined(separator: \" \")) }\nlet fspecs = [\"%#.0f\", \"%#.0e\", \"%#g\", \"%#.3g\", \"%08.2f\", \"%+08.2f\", \"% 08.2f\", \"%-08.2f\", \"%+.0f\", \"%#08.1f\", \"% .2e\", \"%010.3e\", \"%-10.2e|\", \"%.1f\", \"%g\", \"%G\", \"%#G\", \"%+g\", \"% 012.4f\", \"%E\", \"%07.3g\", \"%f\", \"%.0f\", \"%08.2f\"]\nlet fvals = [1.0, -2.5, 0.0, 1234.5678, 1e-5, 2.5e10, -0.0, Double.nan, Double.infinity, -Double.infinity, 0.125, 99.995]\nfor s in fspecs { print(s, fvals.map { String(format: \"[\\(s)]\", $0) }.joined(separator: \" \")) }\n")).toBe("%#08x [0x00002a] [0xfffffff9] [00000000] [0x011170] [0x7fffffff] [0x0000ff]\n%#8x [    0x2a] [0xfffffff9] [       0] [ 0x11170] [0x7fffffff] [    0xff]\n%-#8x [0x2a    ] [0xfffffff9] [0       ] [0x11170 ] [0x7fffffff] [0xff    ]\n%#08X [0X00002A] [0XFFFFFFF9] [00000000] [0X011170] [0X7FFFFFFF] [0X0000FF]\n%#o [052] [037777777771] [0] [0210560] [017777777777] [0377]\n%#08o [00000052] [037777777771] [00000000] [00210560] [017777777777] [00000377]\n% 05d [ 0042] [-0007] [ 0000] [ 70000] [ 2147483647] [ 0255]\n%+05d [+0042] [-0007] [+0000] [+70000] [+2147483647] [+0255]\n%-+5d [+42  ] [-7   ] [+0   ] [+70000] [+2147483647] [+255 ]\n% d [ 42] [-7] [ 0] [ 70000] [ 2147483647] [ 255]\n%+ d [+42] [-7] [+0] [+70000] [+2147483647] [+255]\n%05d [00042] [-0007] [00000] [70000] [2147483647] [00255]\n%-05d [42   ] [-7   ] [0    ] [70000] [2147483647] [255  ]\n%#x [0x2a] [0xfffffff9] [0] [0x11170] [0x7fffffff] [0xff]\n%#5.3x [0x02a] [0xfffffff9] [  000] [0x11170] [0x7fffffff] [0x0ff]\n%.3d [042] [-007] [000] [70000] [2147483647] [255]\n%08.3d [     042] [    -007] [     000] [   70000] [2147483647] [     255]\n%.0d [42] [-7] [] [70000] [2147483647] [255]\n%u [42] [4294967289] [0] [70000] [2147483647] [255]\n%x [2a] [fffffff9] [0] [11170] [7fffffff] [ff]\n%lx [2a] [fffffffffffffff9] [0] [11170] [ffffffff7fffffff] [ff]\n%ld [42] [-7] [0] [70000] [-2147483649] [255]\n%o [52] [37777777771] [0] [210560] [17777777777] [377]\n%hd [42] [-7] [0] [4464] [-1] [255]\n%hhd [42] [-7] [0] [112] [-1] [-1]\n%5.0d [   42] [   -7] [     ] [70000] [2147483647] [  255]\n%-8.3x| [02a     |] [fffffff9|] [000     |] [11170   |] [7fffffff|] [0ff     |]\n%+.4i [+0042] [-0007] [+0000] [+70000] [+2147483647] [+0255]\n%lu [42] [18446744073709551609] [0] [70000] [18446744071562067967] [255]\n%#.0f [1.] [-2.] [0.] [1235.] [0.] [25000000000.] [-0.] [nan] [inf] [-inf] [0.] [100.]\n%#.0e [1.e+00] [-2.e+00] [0.e+00] [1.e+03] [1.e-05] [2.e+10] [-0.e+00] [nan] [inf] [-inf] [1.e-01] [1.e+02]\n%#g [1.00000] [-2.50000] [0.00000] [1234.57] [1.00000e-05] [2.50000e+10] [-0.00000] [nan] [inf] [-inf] [0.125000] [99.9950]\n%#.3g [1.00] [-2.50] [0.00] [1.23e+03] [1.00e-05] [2.50e+10] [-0.00] [nan] [inf] [-inf] [0.125] [100.]\n%08.2f [00001.00] [-0002.50] [00000.00] [01234.57] [00000.00] [25000000000.00] [-0000.00] [     nan] [     inf] [    -inf] [00000.12] [00100.00]\n%+08.2f [+0001.00] [-0002.50] [+0000.00] [+1234.57] [+0000.00] [+25000000000.00] [-0000.00] [     nan] [    +inf] [    -inf] [+0000.12] [+0100.00]\n% 08.2f [ 0001.00] [-0002.50] [ 0000.00] [ 1234.57] [ 0000.00] [ 25000000000.00] [-0000.00] [     nan] [     inf] [    -inf] [ 0000.12] [ 0100.00]\n%-08.2f [1.00    ] [-2.50   ] [0.00    ] [1234.57 ] [0.00    ] [25000000000.00] [-0.00   ] [nan     ] [inf     ] [-inf    ] [0.12    ] [100.00  ]\n%+.0f [+1] [-2] [+0] [+1235] [+0] [+25000000000] [-0] [nan] [+inf] [-inf] [+0] [+100]\n%#08.1f [000001.0] [-00002.5] [000000.0] [001234.6] [000000.0] [25000000000.0] [-00000.0] [     nan] [     inf] [    -inf] [000000.1] [000100.0]\n% .2e [ 1.00e+00] [-2.50e+00] [ 0.00e+00] [ 1.23e+03] [ 1.00e-05] [ 2.50e+10] [-0.00e+00] [nan] [ inf] [-inf] [ 1.25e-01] [ 1.00e+02]\n%010.3e [01.000e+00] [-2.500e+00] [00.000e+00] [01.235e+03] [01.000e-05] [02.500e+10] [-0.000e+00] [       nan] [       inf] [      -inf] [01.250e-01] [01.000e+02]\n%-10.2e| [1.00e+00  |] [-2.50e+00 |] [0.00e+00  |] [1.23e+03  |] [1.00e-05  |] [2.50e+10  |] [-0.00e+00 |] [nan       |] [inf       |] [-inf      |] [1.25e-01  |] [1.00e+02  |]\n%.1f [1.0] [-2.5] [0.0] [1234.6] [0.0] [25000000000.0] [-0.0] [nan] [inf] [-inf] [0.1] [100.0]\n%g [1] [-2.5] [0] [1234.57] [1e-05] [2.5e+10] [-0] [nan] [inf] [-inf] [0.125] [99.995]\n%G [1] [-2.5] [0] [1234.57] [1E-05] [2.5E+10] [-0] [NAN] [INF] [-INF] [0.125] [99.995]\n%#G [1.00000] [-2.50000] [0.00000] [1234.57] [1.00000E-05] [2.50000E+10] [-0.00000] [NAN] [INF] [-INF] [0.125000] [99.9950]\n%+g [+1] [-2.5] [+0] [+1234.57] [+1e-05] [+2.5e+10] [-0] [nan] [+inf] [-inf] [+0.125] [+99.995]\n% 012.4f [ 000001.0000] [-000002.5000] [ 000000.0000] [ 001234.5678] [ 000000.0000] [ 25000000000.0000] [-000000.0000] [         nan] [         inf] [        -inf] [ 000000.1250] [ 000099.9950]\n%E [1.000000E+00] [-2.500000E+00] [0.000000E+00] [1.234568E+03] [1.000000E-05] [2.500000E+10] [-0.000000E+00] [NAN] [INF] [-INF] [1.250000E-01] [9.999500E+01]\n%07.3g [0000001] [-0002.5] [0000000] [1.23e+03] [001e-05] [2.5e+10] [-000000] [    nan] [    inf] [   -inf] [000.125] [0000100]\n%f [1.000000] [-2.500000] [0.000000] [1234.567800] [0.000010] [25000000000.000000] [-0.000000] [nan] [inf] [-inf] [0.125000] [99.995000]\n%.0f [1] [-2] [0] [1235] [0] [25000000000] [-0] [nan] [inf] [-inf] [0] [100]\n%08.2f [00001.00] [-0002.50] [00000.00] [01234.57] [00000.00] [25000000000.00] [-0000.00] [     nan] [     inf] [    -inf] [00000.12] [00100.00]\n");
  });
  it('H5: URL appending encodes, joins and is sized like any built string', async () => {
    expect(await ok("import Foundation\nlet u = URL(string: \"https://example.com/api\")!\nlet v = URL(string: \"https://example.com/api/\")!\nlet odd = \"a b/c?d#e%f@g:h+i&j=k;l,m$n!o'p(q)r*s~t[u]v{w}x|y\\\\z\\\"\u00e9\"\nprint(u.appending(path: odd).absoluteString)\nprint(u.appending(component: odd).absoluteString)\nprint(u.appendingPathComponent(odd).absoluteString)\nprint(v.appending(path: \"x\").absoluteString, v.appendingPathComponent(\"x\").absoluteString, u.appending(path: \"/x/\").absoluteString, u.appending(path: \"\").absoluteString, v.appending(component: \"\").absoluteString)\nlet r = URL(string: \"x/y\", relativeTo: u)!\nprint(r, r.absoluteString, URL(string: \"../z\", relativeTo: v)!.absoluteString, URL(string: \"/root\", relativeTo: v)!.absoluteString, URL(string: \"https://other.org/q\", relativeTo: v)!.absoluteString)\nprint(u.appending(path: \"a\").appending(path: \"b\"), u.appendingPathComponent(\"a\").appendingPathComponent(\"b\").path)\n")).toBe("https://example.com/api/a%20b/c%3Fd%23e%25f@g:h+i&j=k;l,m$n!o'p(q)r*s~t%5Bu%5Dv%7Bw%7Dx%7Cy%5Cz%22%C3%A9\nhttps://example.com/api/a%20b%2Fc%3Fd%23e%25f@g:h+i&j=k;l,m$n!o'p(q)r*s~t%5Bu%5Dv%7Bw%7Dx%7Cy%5Cz%22%C3%A9\nhttps://example.com/api/a%20b/c%3Fd%23e%25f@g:h+i&j=k;l,m$n!o'p(q)r*s~t%5Bu%5Dv%7Bw%7Dx%7Cy%5Cz%22%C3%A9\nhttps://example.com/api/x https://example.com/api/x https://example.com/api/x/ https://example.com/api/ https://example.com/api/\nx/y -- https://example.com/api https://example.com/x/y https://example.com/z https://example.com/root https://other.org/q\nhttps://example.com/api/a/b /api/a/b\n");
    const r = await run('import Foundation\nvar u = URL(string: "https://example.com/")!\nfor _ in 0..<22 { u = u.appending(path: u.absoluteString) }\nprint(u.absoluteString.count)');
    expect(r.error?.message).toMatch(/caps collections and strings at 16,777,216/);
  });
  it('M2/M3/M4: explicit generic arguments, Double keys, shuffled and mapValues keep their types', async () => {
    expect(await ok("import CoreGraphics\nlet a = Array<Float>(repeating: 0.1, count: 2)\nlet b = Array<Float>([1, 2])\nlet c = [Float](repeating: 1, count: 1)\nlet e = Array<CGFloat>([1, 2.5])\nprint(type(of: a), a, type(of: b), b, type(of: c), type(of: e), e)\nvar sd = Set<Double>()\nsd.insert(1)\nvar dd: [Double: String] = [:]\ndd[2] = \"two\"\nlet x = sd.first!\nprint(x / 2, type(of: x), type(of: dd.keys.first!), dd[2.0]!, Set<Double>([1, 2]).contains(1.0))\nlet fl: [Float] = [1, 2, 3]\nprint(type(of: fl.shuffled()), type(of: fl.shuffled().first!))\nlet m = [\"a\": 1].mapValues { v -> Float in Float(v) }.filter { _ in false }\nvar m2 = m\nm2[\"b\"] = 2\nprint(type(of: m2[\"b\"]!), m2[\"b\"]!)\nlet em: [String: Int] = [:]\nvar m3 = em.mapValues { v -> Float in Float(v) }\nm3[\"z\"] = 3\nprint(type(of: m3[\"z\"]!))\n")).toBe("Array<Float> [0.1, 0.1] Array<Float> [1.0, 2.0] Array<Float> Array<CGFloat> [1.0, 2.5]\n0.5 Double Double two true\nArray<Float> Float\nFloat 2.0\nFloat\n");
  });
});

describe('Review pass 15: subscript slices are guarded; JSON decodes real URL and UUID values', () => {
  it('charges range slices while single element reads stay free', async () => {
    const base = await run('let s = String(repeating: "ab", count: 100_000)\nvar n = 0\nprint(n)');
    const slices = await run('let s = String(repeating: "ab", count: 100_000)\nvar n = 0\nfor _ in 0..<200 { n += s[s.startIndex..<s.endIndex].count }\nprint(n)');
    expect(slices.stdout).toBe('40000000\n');
    expect(slices.steps - base.steps).toBeGreaterThanOrEqual(200 * 200_000 / 64); // was ~53,000 in all
    const arr = await run('let a = Array(repeating: 1, count: 200_000)\nvar n = 0\nfor _ in 0..<100 { n += a[0..<200_000].count }\nprint(n)');
    expect(arr.steps).toBeGreaterThanOrEqual(100 * 200_000 / 16);
    const reads0 = await run('let a = Array(repeating: String(repeating: "x", count: 100_000), count: 3)\nvar n = 0\nprint(n)');
    const reads = await run('let a = Array(repeating: String(repeating: "x", count: 100_000), count: 3)\nvar n = 0\nfor _ in 0..<2000 { if !a[1].isEmpty { n += 1 } }\nprint(n)');
    expect(reads.stdout).toBe('2000\n');
    expect(reads.steps - reads0.steps).toBeLessThan(10_000); // loop overhead only
  });
  it('decodes URL and UUID fields into real values, validated and re-encodable (swiftc output)', async () => {
    expect(await ok("import Foundation\nstruct Feed: Codable { let link: URL; let id: UUID }\nlet json = \"{\\\"link\\\": \\\"https://example.com/a/b?q=1\\\", \\\"id\\\": \\\"e621e1f8-c36c-495a-93fc-0c247a3e6e5f\\\"}\"\nlet feed = try JSONDecoder().decode(Feed.self, from: Data(json.utf8))\nprint(feed.link.host as Any, feed.id.uuidString, feed.link, feed.link.path, feed.id)\nlet enc = JSONEncoder()\nenc.outputFormatting = [.sortedKeys]\nprint(String(data: try enc.encode(feed), encoding: .utf8)!)\nfor bad in [\"{\\\"link\\\": \\\"\\\", \\\"id\\\": \\\"e621e1f8-c36c-495a-93fc-0c247a3e6e5f\\\"}\", \"{\\\"link\\\": \\\"https://x.com\\\", \\\"id\\\": \\\"not-a-uuid\\\"}\", \"{\\\"link\\\": 5, \\\"id\\\": \\\"e621e1f8-c36c-495a-93fc-0c247a3e6e5f\\\"}\", \"{\\\"link\\\": \\\"a b\\\", \\\"id\\\": \\\"e621e1f8-c36c-495a-93fc-0c247a3e6e5f\\\"}\"] {\n    do { _ = try JSONDecoder().decode(Feed.self, from: Data(bad.utf8)); print(\"ok\") } catch { print(error) }\n}\n")).toBe("Optional(\"example.com\") E621E1F8-C36C-495A-93FC-0C247A3E6E5F https://example.com/a/b?q=1 /a/b E621E1F8-C36C-495A-93FC-0C247A3E6E5F\n{\"id\":\"E621E1F8-C36C-495A-93FC-0C247A3E6E5F\",\"link\":\"https:\\/\\/example.com\\/a\\/b?q=1\"}\nDecodingError.dataCorrupted: Data was corrupted. Path: link. Debug description: Invalid URL string.\nDecodingError.dataCorrupted: Data was corrupted. Path: id. Debug description: Attempted to decode UUID from invalid UUID string.\nDecodingError.typeMismatch: expected value of type String. Path: link. Debug description: Expected to decode String but found number instead.\nok\n");
    // URL(string:) follows Foundation: relative strings are fine and get percent-encoded
    expect(await ok("import Foundation\nfor s in [\"\", \"a b\", \"x/y\", \"http://exa mple.com\", \"://\", \"http://[bad\", \"%\", \"ht tp://x\", \"https://example.com\", \"mailto:a@b.c\", \"http://\", \"#frag\", \"?q\", \"http://x.com/%zz\", \"http://x.com:abc\", \"\u00e9\", \"http://[::1]:80/\"] {\n    let u = URL(string: s)\n    print(\"[\\(s)] -> \\(u.map { \"\\($0.absoluteString) host=\\($0.host ?? \"nil\")\" } ?? \"nil\")\")\n}\n")).toBe("[] -> nil\n[a b] -> a%20b host=nil\n[x/y] -> x/y host=nil\n[http://exa mple.com] -> nil\n[://] -> :// host=nil\n[http://[bad] -> nil\n[%] -> %25 host=nil\n[ht tp://x] -> nil\n[https://example.com] -> https://example.com host=example.com\n[mailto:a@b.c] -> mailto:a@b.c host=nil\n[http://] -> http:// host=nil\n[#frag] -> #frag host=nil\n[?q] -> ?q host=nil\n[http://x.com/%zz] -> http://x.com/%25zz host=x.com\n[http://x.com:abc] -> nil\n[\u00e9] -> %C3%A9 host=nil\n[http://[::1]:80/] -> http://[::1]:80/ host=::1\n");
  });
});

describe('Review pass 16: ??= is not an operator, long raw-string delimiters, JSON nesting depth', () => {
  it('rejects ??= the way swiftc does', async () => {
    const err = await fails('var x: Int? = nil\nx ??= 5\nprint(x as Any)');
    expect(err.message).toBe("cannot find operator '??=' in scope");
    expect(err.line).toBe(2);
  });
  it('reads raw strings with three or more # signs (swiftc output)', async () => {
    expect(await ok('print(###"hello "## "###, ####"a"###b"####)')).toBe('hello "##  a"###b\n');
    expect(await ok('let s = ###"x\\#(1)"#"###\nprint(s, s.count)')).toBe('x\\#(1)"# 8\n');
  });
  // Foundation prints the two UserInfo keys in a different order from run to run, so the
  // expected text below is swiftc's output with NSDebugDescription first, the order the engine uses.
  const nested = (line, column, index) => `DecodingError.dataCorrupted: Data was corrupted. Debug description: The given data was not valid JSON.. Underlying error: Error Domain=NSCocoaErrorDomain Code=3840 "Too many nested arrays or dictionaries around line ${line}, column ${column}." UserInfo={NSDebugDescription=Too many nested arrays or dictionaries around line ${line}, column ${column}., NSJSONSerializationErrorIndex=${index}}\n`;
  const decodeEach = (cases) => `import Foundation\nstruct A: Decodable { init(from d: Decoder) throws {} }\nlet cases = [${cases}]\nfor s in cases {\n    do { _ = try JSONDecoder().decode(A.self, from: Data(s.utf8)); print("ok") } catch { print(error) }\n}\n`;
  it('allows 512 nested containers and reports the 513th with the line, column and index swiftc gives', async () => {
    const src = decodeEach('String(repeating: "[ ", count: 513), String(repeating: "[1,", count: 513), String(repeating: "[", count: 512) + "{}" + String(repeating: "]", count: 512), String(repeating: "[", count: 512) + "[]" + String(repeating: "]", count: 512), String(repeating: "{\\"a\\":", count: 513), String(repeating: "{\\"ab\\" : ", count: 513), String(repeating: "[", count: 513) + String(repeating: "]", count: 513), String(repeating: "[", count: 512) + String(repeating: "]", count: 512), "[\\"[[[\\"]", String(repeating: "[\\n", count: 513) + String(repeating: "]", count: 513)');
    expect(await ok(src)).toBe(
      nested(1, 1026, 1026) + // the column is clamped to the last character, the index is not
      nested(1, 1539, 1538) + nested(1, 513, 512) + nested(1, 515, 514) + nested(1, 2561, 2560) +
      nested(1, 4097, 4096) + nested(1, 515, 514) + 'ok\n' + 'ok\n' + nested(514, 1, 1026));
  });
  it('does not count brackets inside strings, escaped quotes included', async () => {
    expect(await ok(decodeEach('"[\\"" + String(repeating: "[", count: 600) + "\\"]", "[\\"\\\\\\"" + String(repeating: "{", count: 600) + "\\"]"'))).toBe('ok\nok\n');
  });
  it('stops a 100,000-deep document at the 513th container instead of recursing', async () => {
    const r = await run(decodeEach('String(repeating: "[", count: 100_000) + String(repeating: "]", count: 100_000)'));
    expect(r.error).toBeNull();
    expect(r.stdout).toBe(nested(1, 515, 514));
    expect(r.steps).toBeLessThan(200_000);
  }, 10_000);
});

describe('Review pass 17: builtin values name their type; user operators stay with their own interpreter', () => {
  it('type(of:) names Foundation values, views, indices, ranges and collections (swiftc output)', async () => {
    const src = 'import Foundation\nprint(type(of: UUID()), type(of: URL(string: "a")!), type(of: Date()), type(of: Data()))\nprint(type(of: JSONDecoder()), type(of: JSONEncoder()), type(of: "ab".utf8), type(of: "ab".utf16), type(of: [1: 2].keys), type(of: [1: 2].values), type(of: "ab".startIndex))\nprint(type(of: Optional(UUID())), type(of: [Date()]), type(of: [UUID(): URL(string: "a")!]), type(of: Set([URL(string: "a")!])))\nprint(type(of: 1.0...2.0), type(of: "a"..."b"), type(of: 1..<2), type(of: Set([1.5])))\nlet u: Any = UUID()\nprint(String(describing: type(of: u)))\n';
    expect(await ok(src)).toBe('UUID URL Date Data\nJSONDecoder JSONEncoder UTF8View UTF16View Keys Values Index\nOptional<UUID> Array<Date> Dictionary<UUID, URL> Set<URL>\nClosedRange<Double> ClosedRange<String> Range<Int> Set<Double>\nUUID\n');
  });
  it('metatypes in collections and Optionals name the module of every part (swiftc output)', async () => {
    expect(await ok("import Foundation\nprint([Int8.self, UInt64.self, Character.self], [Any.self], [type(of: Set([1]))], [type(of: \"a\".utf8)], [type(of: \"a\".utf16)], [type(of: \"a\".startIndex)])\nprint([type(of: Set([UUID()]))], [type(of: [Date(): [URL(string: \"a\")!]])], [type(of: Optional(Data()))], [type(of: (1, (Date(), \"a\")))], [type(of: 1.5...2.5)])\nstruct P {}\nprint([type(of: [P()])], Optional(type(of: [\"a\": [P()]])) as Any)\n")).toBe("[Swift.Int8, Swift.UInt64, Swift.Character] [Any] [Swift.Set<Swift.Int>] [Swift.String.UTF8View] [Swift.String.UTF16View] [Swift.String.Index]\n[Swift.Set<Foundation.UUID>] [Swift.Dictionary<Foundation.Date, Swift.Array<Foundation.URL>>] [Swift.Optional<Foundation.Data>] [(Swift.Int, (Foundation.Date, Swift.String))] [Swift.ClosedRange<Swift.Double>]\n[Swift.Array<main.P>] Optional(Swift.Dictionary<Swift.String, Swift.Array<main.P>>)\n");
  });
  it('is and as? recognise UUID, URL, Date, Data, Set, Range and JSONDecoder held as Any (swiftc output)', async () => {
    expect(await ok("import Foundation\nlet xs: [Any] = [UUID(), URL(string: \"a\")!, Date(), Data([1]), Set([1]), 1..<3, JSONDecoder()]\nfor x in xs {\n    print(x is UUID, x is URL, x is Date, x is Data, x is Set<Int>, x is Range<Int>, x is JSONDecoder, x is any Hashable, x is any Equatable)\n}\nlet ids: [Any] = [UUID()]\nprint(ids.compactMap { $0 as? UUID }.count, (xs[2] as? Date) != nil)\nprint((xs[1] as? URL)?.absoluteString ?? \"nil\", xs[4] as? Set<String> == nil, (xs[5] as? Range<Int>)?.count ?? -1, xs.compactMap { $0 as? URL }.count, xs[0] is URL)\n")).toBe("true false false false false false false true true\nfalse true false false false false false true true\nfalse false true false false false false true true\nfalse false false true false false false true true\nfalse false false false true false false true true\nfalse false false false false true false true true\nfalse false false false false false true false false\n1 true\na true 2 1 false\n");
  });
  it('naming a big collection reads one element, not all of them', async () => {
    const base = await run('let s = Set(0..<100_000)\nlet d = Dictionary(uniqueKeysWithValues: (0..<100_000).map { ($0, $0) })\nprint(s.count, d.count)');
    const named = await run('let s = Set(0..<100_000)\nlet d = Dictionary(uniqueKeysWithValues: (0..<100_000).map { ($0, $0) })\nprint(s.count, d.count)\nfor _ in 0..<1000 { _ = type(of: s); _ = type(of: d) }');
    expect(named.error).toBeNull();
    expect(named.steps - base.steps).toBeLessThan(100_000); // loop overhead only
  });
  it('accepts the wrapping compound assignments &+=, &-= and &*= (swiftc output)', async () => {
    const src = 'var n = Int.max\nn &+= 1\nprint(n)\nn &-= 1\nprint(n)\nvar b: UInt8 = 250\nb &+= 10\nprint(b)\nb &*= 100\nprint(b)\nvar c: Int8 = -128\nc &-= 1\nprint(c)\nvar h = 0\nfor i in 0..<5 { h = h &* 31 &+ i; h &+= 7 }\nprint(h)\nvar big = Int.max / 2\nbig &*= 5\nprint(big)\nvar u: UInt32 = 1\nu &-= 2\nprint(u)\n';
    expect(await ok(src)).toBe('-9223372036854775808\n9223372036854775807\n4\n144\n127\n6711945\n4611686018427387899\n4294967295\n');
    expect((await fails('var d = 1.5\nd &+= 1\nprint(d)')).kind).toBe('compile');
  });
  it('a program keeps its own == and < after a second interpreter starts', async () => {
    // A suspends once, so B's interpreter is built before A compares anything. Each
    // user operator prints: one that ran in the wrong interpreter would print into B.
    const A = 'struct P: Comparable { var v: Int; static func < (l: P, r: P) -> Bool { print("A<"); return l.v > r.v }; static func == (l: P, r: P) -> Bool { print("A=="); return l.v % 10 == r.v % 10 } }\nawait Task.yield()\nprint([P(v: 5)] == [P(v: 15)], [P(v: 5)].contains(P(v: 15)), [P(v: 1), P(v: 3)].max()!.v, [P(v: 1), P(v: 3)].sorted().map { $0.v })\n';
    const B = 'struct Q: Equatable { var v: Int }\nprint(Q(v: 1) == Q(v: 1))';
    const [a, b] = await Promise.all([run(A), run(B)]);
    expect(a.error).toBeNull();
    expect(a.stdout).toBe('A==\nA==\nA<\nA<\ntrue true 1 [3, 1]\n');
    expect(b.stdout).toBe('true\n');
  }, 10_000);
});

describe('Review pass 18: Character, Substring and ArraySlice are their own types', () => {
  it('Character values: properties, case mapping, conversions, keys and ordering (swiftc output)', async () => {
    expect(await ok("let size: Character = \"L\"\nprint(size, type(of: size), [size], Optional(size) as Any)\nlet s = \"Hello, World 42\u00e9\"\nfor ch in s where ch.isLetter && ch.isUppercase { print(ch, terminator: \" \") }\nprint()\nprint(s.first!, type(of: s.first!), s.last as Any, type(of: s.last))\nprint(Array(\"abc\"), type(of: Array(\"abc\")), Set(\"aab\").count)\nlet c: Character = \"7\"\nprint(c.isNumber, c.wholeNumberValue as Any, c.asciiValue as Any, type(of: c.asciiValue!), c.isLetter, c.isWhitespace, c.isHexDigit, c.hexDigitValue as Any)\nlet a: Character = \"a\"\nprint(a.uppercased(), type(of: a.uppercased()), a.isLowercase, a.isASCII, Character(\"\u00e9\").isASCII, Character(\"\u00e9\").asciiValue as Any)\nprint(String(a), String(repeating: a, count: 3), String(repeating: \"ab\", count: 2), String([a, \"b\"]), type(of: String(a)))\nprint(a == \"a\", a < \"b\", Character(\"Z\") < Character(\"a\"), [a, \"c\", \"b\"].sorted())\nvar counts: [Character: Int] = [:]\nfor ch in \"banana\" { counts[ch, default: 0] += 1 }\nprint(counts.sorted { $0.key < $1.key })\nlet vowels: Set<Character> = [\"a\", \"e\", \"i\", \"o\", \"u\"]\nprint(\"education\".filter { vowels.contains($0) }, type(of: \"education\".filter { vowels.contains($0) }))\nprint(\"hello\".map { $0.uppercased() }, \"hello\".map { $0 }, type(of: \"hello\".map { $0 }))\nprint(s.firstIndex(of: \"W\").map { s.distance(from: s.startIndex, to: $0) } as Any, s.contains(\"W\"), s.contains(Character(\"W\")))\nlet idx = s.index(s.startIndex, offsetBy: 4)\nprint(s[idx], type(of: s[idx]))\nvar t = \"ab\"\nt.append(Character(\"c\"))\nt.append(\"de\")\nlet removed = t.removeLast()\nprint(t, removed, type(of: removed), t.removeFirst(), t)\nprint(\"a-b-c\".split(separator: \"-\"), \"a b\".contains(\" \"), Character(\" \").isWhitespace)\nprint(String(\"dlrow\".reversed()), \"abc\".reversed().map { $0 }, \"zyx\".sorted(), type(of: \"zyx\".sorted()))\nprint(\"x\".randomElement() as Any, type(of: \"x\".randomElement()))\nswitch a { case \"a\", \"e\": print(\"vowel\") default: print(\"other\") }\nprint(c.description, type(of: c.description), \"\\(a)!\", a.utf8.count, Character(\"\ud83d\ude42\").utf16.count)\nprint(\"Swift\".compactMap { $0.isUppercase ? $0 : nil }, \"a1b2\".filter(\\.isNumber))\nprint(\"hello\".first == \"h\", \"hello\".last == Character(\"o\"))\n")).toBe("L Character [\"L\"] Optional(\"L\")\nH W \nH Character Optional(\"\u00e9\") Optional<Character>\n[\"a\", \"b\", \"c\"] Array<Character> 2\ntrue Optional(7) Optional(55) UInt8 false false true Optional(7)\nA String true true false nil\na aaa abab ab String\ntrue true true [\"a\", \"b\", \"c\"]\n[(key: \"a\", value: 3), (key: \"b\", value: 1), (key: \"n\", value: 2)]\neuaio String\n[\"H\", \"E\", \"L\", \"L\", \"O\"] [\"h\", \"e\", \"l\", \"l\", \"o\"] Array<Character>\nOptional(7) true true\no Character\nabcd e Character a bcd\n[\"a\", \"b\", \"c\"] true true\nworld [\"c\", \"b\", \"a\"] [\"x\", \"y\", \"z\"] Array<Character>\nOptional(\"x\") Optional<Character>\nvowel\n7 String a! 1 2\n[\"S\"] 12\ntrue true\n");
  });
  it('Character properties follow Unicode: first-scalar whitespace, digits in every script (swiftc output)', async () => {
    expect(await ok("for t in [\"\u0663\", \"\uff17\", \"\ud835\udfd7\", \"\u09e6\", \"a\", \"\u216b\", \"\u00b9\", \"\u2070\", \"\u2173\", \"\u2473\", \"\u00bd\", \"\u216c\", \"\u217f\", \"\u216e\"] { let c = Character(t); print(c.isWholeNumber, c.wholeNumberValue as Any, c.isNumber) }\n")).toBe("true Optional(3) true\ntrue Optional(7) true\ntrue Optional(9) true\ntrue Optional(0) true\nfalse nil false\ntrue Optional(12) true\ntrue Optional(1) true\ntrue Optional(0) true\ntrue Optional(4) true\ntrue Optional(20) true\nfalse nil true\ntrue Optional(50) true\ntrue Optional(1000) true\ntrue Optional(500) true\n");
  });
  it('Substrings from split, prefix, suffix, drops and index ranges share their base string\'s indices (swiftc output)', async () => {
    expect(await ok("let sentence = \"the cat and the hat and the bat\"\nlet words = sentence.split(separator: \" \")\nprint(words, type(of: words), type(of: words[0]))\nvar counts: [String: Int] = [:]\nfor word in words { counts[String(word), default: 0] += 1 }\nprint(counts.sorted { $0.key < $1.key })\nlet line = \"data: {\\\"x\\\":1}\"\nlet payload = line.dropFirst(6)\nprint(\"Event:\", payload, type(of: payload), payload.count, payload.first!, type(of: payload.first!))\nlet s = \"Hello, World\"\nlet p = s.prefix(5), q = s.suffix(5), d = s.dropLast(7)\nprint(p, q, d, type(of: p), type(of: q), type(of: d))\nprint(p == \"Hello\", p == d, String(p) + \"!\", p.uppercased(), type(of: p.uppercased()), p.hasPrefix(\"He\"), p.lowercased())\nlet i = s.firstIndex(of: \",\")!\nlet head = s[..<i], tail = s[s.index(after: i)...]\nprint(head, tail, type(of: head), \"[\\(tail)]\")\nprint(tail.startIndex == s.index(after: i), tail[s.index(i, offsetBy: 2)], s.distance(from: s.startIndex, to: tail.startIndex))\nlet mid = s[s.index(s.startIndex, offsetBy: 2)..<s.index(s.startIndex, offsetBy: 9)]\nprint(mid, mid.dropFirst(), mid.dropFirst().dropFirst(), type(of: mid.dropFirst()), mid.prefix(3), mid.count)\nprint(mid.firstIndex(of: \"o\").map { s.distance(from: s.startIndex, to: $0) } as Any, s.distance(from: s.startIndex, to: mid.endIndex))\nprint(s[...], type(of: s[...]), s[...].count)\nprint(\"  pad \".split(separator: \" \"), \"a,,b\".split(separator: \",\", omittingEmptySubsequences: false), \"a b c\".split(separator: \" \", maxSplits: 1))\nlet sub = s.dropFirst(7)\nprint(sub.contains(\"Wor\"), sub.split(separator: \"r\"), type(of: sub.split(separator: \"r\")), sub.reversed().map { $0 }, String(sub.reversed()))\nprint(sub.filter { $0 != \"o\" }, type(of: sub.filter { $0 != \"o\" }), sub.map { $0 }, sub.sorted())\nprint(Array(sub), sub.hasSuffix(\"ld\"), sub.starts(with: \"Wo\"), sub.lowercased(), Int(\"42\".dropFirst())!, Int(Substring(\"7\")) as Any)\nvar m = s.dropFirst(7)\nm.append(\"!\")\nprint(m, type(of: m), m.startIndex == s.index(s.startIndex, offsetBy: 7))\nprint([p, q], Optional(p) as Any, \"\\(p)\", p.description, type(of: p.description), p.isEmpty, \"\".dropFirst().isEmpty)\nprint(s.prefix(while: { $0 != \",\" }), type(of: s.prefix(while: { $0 != \",\" })), s.drop(while: { $0 != \" \" }))\nprint(words.map(String.init), type(of: words.map(String.init)), words.joined(separator: \"+\"), type(of: words.joined(separator: \"+\")))\nprint(Set(words).count, words.contains(\"cat\"), words.firstIndex(of: \"and\") as Any)\nprint(sub.uppercased())\n\n")).toBe("[\"the\", \"cat\", \"and\", \"the\", \"hat\", \"and\", \"the\", \"bat\"] Array<Substring> Substring\n[(key: \"and\", value: 2), (key: \"bat\", value: 1), (key: \"cat\", value: 1), (key: \"hat\", value: 1), (key: \"the\", value: 3)]\nEvent: {\"x\":1} Substring 7 { Character\nHello World Hello Substring Substring Substring\ntrue true Hello! HELLO String true hello\nHello  World Substring [ World]\ntrue W 6\nllo, Wo lo, Wo o, Wo Substring llo 7\nOptional(4) 9\nHello, World Substring 12\n[\"pad\"] [\"a\", \"\", \"b\"] [\"a\", \"b c\"]\ntrue [\"Wo\", \"ld\"] Array<Substring> [\"d\", \"l\", \"r\", \"o\", \"W\"] dlroW\nWrld String [\"W\", \"o\", \"r\", \"l\", \"d\"] [\"W\", \"d\", \"l\", \"o\", \"r\"]\n[\"W\", \"o\", \"r\", \"l\", \"d\"] true true world 2 Optional(7)\nWorld! Substring true\n[\"Hello\", \"World\"] Optional(\"Hello\") Hello Hello String false true\nHello Substring  World\n[\"the\", \"cat\", \"and\", \"the\", \"hat\", \"and\", \"the\", \"bat\"] Array<String> the+cat+and+the+hat+and+the+bat String\n5 true Optional(2)\nWORLD\n");
  });
  it('ArraySlices keep their base indices through subscripts, slicing and mutation (swiftc output)', async () => {
    expect(await ok("let s = [10, 20, 30][1...]\nprint(s.startIndex, s[1], s, type(of: s), s.endIndex, s.indices, s.count, s.first!, s.last!)\nlet a = [1, 2, 3, 4, 5, 6]\nlet mid = a[1..<5]\nprint(mid, mid.startIndex, mid.endIndex, mid[2], mid[1...2], type(of: mid[1...2]), mid[1...2].startIndex)\nprint(a.prefix(2), a.suffix(2), a.dropFirst(), a.dropLast(4), type(of: a.dropFirst()), a.dropFirst().startIndex, a.suffix(2).startIndex)\nprint(mid.dropFirst().startIndex, mid.prefix(2), mid.firstIndex(of: 4) as Any, mid.lastIndex(of: 2) as Any, mid.index(after: 1), mid.firstIndex { $0 > 2 } as Any)\nprint(Array(mid), type(of: Array(mid)), Array(mid).startIndex, mid.map { $0 * 10 }, type(of: mid.map { $0 }), mid.filter { $0 > 2 }, type(of: mid.filter { $0 > 2 }))\nprint(mid.reduce(0, +), mid.sorted(by: >), mid.contains(3), mid.max()!, mid.enumerated().map { \"\\($0.offset):\\($0.element)\" })\nvar v = a[2...]\nv[3] = 99\nv.append(7)\nprint(v, v.startIndex, v.endIndex, a)\nprint(mid == [2, 3, 4, 5], [Array(a[..<2]), [9]], a[...], type(of: a[...]), [a[0..<1]], Optional(a[0..<1]) as Any)\nfor (i, x) in zip(mid.indices, mid) { print(i, x, terminator: \"; \") }\nprint()\nlet words = [\"a\", \"b\", \"c\"]\nprint(words[1...].joined(separator: \"-\"), words.dropFirst().first!, words.prefix(upTo: 2), words.suffix(from: 1), words.prefix(through: 0))\nprint(a.split(separator: 3), type(of: a.split(separator: 3)), a.split(separator: 3)[1].startIndex)\nvar w = a[1..<4]\nw.removeFirst()\nprint(w, w.startIndex, w.remove(at: 2), w)\nprint(mid.isEmpty, a[3..<3].isEmpty, a[3..<3].startIndex, mid.description, mid.lazy.map { $0 + 1 }.first!)\n")).toBe("1 20 [20, 30] ArraySlice<Int> 3 1..<3 2 20 30\n[2, 3, 4, 5] 1 5 3 [2, 3] ArraySlice<Int> 1\n[1, 2] [5, 6] [2, 3, 4, 5, 6] [1, 2] ArraySlice<Int> 1 4\n2 [2, 3] Optional(3) Optional(1) 2 Optional(2)\n[2, 3, 4, 5] Array<Int> 0 [20, 30, 40, 50] Array<Int> [3, 4, 5] Array<Int>\n14 [5, 4, 3, 2] true 5 [\"0:2\", \"1:3\", \"2:4\", \"3:5\"]\n[3, 99, 5, 6, 7] 2 7 [1, 2, 3, 4, 5, 6]\ntrue [[1, 2], [9]] [1, 2, 3, 4, 5, 6] ArraySlice<Int> [ArraySlice([1])] Optional(ArraySlice([1]))\n1 2; 2 3; 3 4; 4 5; \nb-c b [\"a\", \"b\"] [\"b\", \"c\"] [\"a\"]\n[ArraySlice([1, 2]), ArraySlice([4, 5, 6])] Array<ArraySlice<Int>> 3\n[3, 4] 2 3 [4]\nfalse true 3 [2, 3, 4, 5] 3\n");
  });
  it('Substring mutation, split options, slices of slices and Substring keys (swiftc output)', async () => {
    expect(await ok("for t in [\"a\", \"Z\", \"7\", \" \", \"\\n\", \"\\r\\n\", \"!\", \"+\", \"$\", \"\u00e9\", \"\u00bd\", \"\u00df\", \"\ud83d\ude42\", \"F\", \"\u0663\"] {\n    let c = Character(t)\n    print(c.isLetter, c.isNumber, c.isWholeNumber, c.isUppercase, c.isLowercase, c.isCased, c.isWhitespace, c.isNewline, c.isPunctuation, c.isSymbol, c.isMathSymbol, c.isCurrencySymbol, c.isHexDigit, c.hexDigitValue as Any, c.wholeNumberValue as Any, c.asciiValue as Any, c.isASCII, c.uppercased(), c.lowercased())\n}\nlet s = \"Hello, World\"\nvar m = s.dropFirst(2)\nlet r1 = m.removeFirst()\nprint(r1, m, m.startIndex == s.index(s.startIndex, offsetBy: 3))\nm.removeFirst(2)\nprint(m, m.startIndex == s.index(s.startIndex, offsetBy: 5), m.removeLast(), m)\nm.insert(\"!\", at: m.startIndex)\nprint(m, m.startIndex == s.index(s.startIndex, offsetBy: 5))\nm.remove(at: m.index(after: m.startIndex))\nprint(m)\nm.replaceSubrange(m.startIndex..<m.index(m.startIndex, offsetBy: 2), with: \"AB\")\nprint(m, type(of: m))\nprint(\"a--b--\".split(separator: \"-\"), \"a--b--\".split(separator: \"-\", omittingEmptySubsequences: false), \"--a\".split(separator: \"-\", maxSplits: 1, omittingEmptySubsequences: false))\nprint(\"a1b22c\".split(whereSeparator: { $0.isNumber }), \"a b  c\".split(separator: \" \", maxSplits: 1), \"\".split(separator: \",\"), \",\".split(separator: \",\", omittingEmptySubsequences: false))\nprint([1, 0, 2, 0, 0, 3].split(separator: 0), [1, 0, 2, 0, 0, 3].split(separator: 0, omittingEmptySubsequences: false), [1, 0, 2, 0, 3].split(separator: 0, maxSplits: 1), [1, 2, 3, 4].split(whereSeparator: { $0 % 2 == 0 }))\nlet a = Array(10...19)\nlet sl = a[2..<8]\nlet sl2 = sl[4...]\nprint(sl2, sl2.startIndex, sl2.dropLast().endIndex, sl.prefix(upTo: 5), sl.suffix(from: 6), sl.prefix(through: 3), sl.suffix(from: 6).startIndex)\nprint(sl.reversed(), sl.sorted(by: >), type(of: sl.sorted()), sl.firstIndex(of: 15) as Any, sl.lastIndex { $0 < 14 } as Any, sl.indices.map { $0 })\nvar d: [Substring: Int] = [:]\nfor w in \"a b a\".split(separator: \" \") { d[w, default: 0] += 1 }\nprint(d.sorted { $0.key < $1.key }, Set(\"x y x\".split(separator: \" \")).count, type(of: d))\nprint(\"abc\".dropFirst().dropFirst(), \"abc\".dropFirst().dropFirst().startIndex == \"abc\".index(\"abc\".startIndex, offsetBy: 2))\nlet w = \"racecar\"\nprint(w == String(w.reversed()), w.prefix(3) == w.suffix(3).reversed().map { String($0) }.joined(), w.prefix(0), w.suffix(100), w.dropFirst(100).isEmpty, w.dropLast(100))\nprint(String(w.prefix(1)).uppercased() + w.dropFirst(), w.prefix(1).uppercased() + w.dropFirst())\nprint(sl.count, sl.isEmpty, sl.contains(12), sl.min()!, sl.reduce(0, +), sl.map { $0 - 10 })\n")).toBe("true false false false true true false false false false false false true Optional(10) nil Optional(97) true A a\ntrue false false true false true false false false false false false false nil nil Optional(90) true Z z\nfalse true true false false false false false false false false false true Optional(7) Optional(7) Optional(55) true 7 7\nfalse false false false false false true false false false false false false nil nil Optional(32) true    \nfalse false false false false false true true false false false false false nil nil Optional(10) true \n \n\nfalse false false false false false true true false false false false false nil nil Optional(10) true \r\n \r\n\nfalse false false false false false false false true false false false false nil nil Optional(33) true ! !\nfalse false false false false false false false false true true false false nil nil Optional(43) true + +\nfalse false false false false false false false false true false true false nil nil Optional(36) true $ $\ntrue false false false true true false false false false false false false nil nil nil false \u00c9 \u00e9\nfalse true false false false false false false false false false false false nil nil nil false \u00bd \u00bd\ntrue false false false true true false false false false false false false nil nil nil false SS \u00df\nfalse false false false false false false false false true false false false nil nil nil false \ud83d\ude42 \ud83d\ude42\ntrue false false true false true false false false false false false true Optional(15) nil Optional(70) true F f\nfalse true true false false false false false false false false false false nil Optional(3) nil false \u0663 \u0663\nl lo, World true\n, World true d , Worl\n!, Worl true\n! Worl\nABWorl Substring\n[\"a\", \"b\"] [\"a\", \"\", \"b\", \"\", \"\"] [\"\", \"-a\"]\n[\"a\", \"b\", \"c\"] [\"a\", \"b  c\"] [] [\"\", \"\"]\n[ArraySlice([1]), ArraySlice([2]), ArraySlice([3])] [ArraySlice([1]), ArraySlice([2]), ArraySlice([]), ArraySlice([3])] [ArraySlice([1]), ArraySlice([2, 0, 3])] [ArraySlice([1]), ArraySlice([3])]\n[14, 15, 16, 17] 4 7 [12, 13, 14] [16, 17] [12, 13] 6\nReversedCollection<ArraySlice<Int>>(_base: ArraySlice([12, 13, 14, 15, 16, 17])) [17, 16, 15, 14, 13, 12] Array<Int> Optional(5) Optional(3) [2, 3, 4, 5, 6, 7]\n[(key: \"a\", value: 2), (key: \"b\", value: 1)] 2 Dictionary<Substring, Int>\nc true\ntrue true  racecar true \nRacecar Racecar\n6 false true 12 87 [2, 3, 4, 5, 6, 7]\n");
  });
  it('type(of:) names them, metatypes qualify them, and [...] takes the whole collection (swiftc output)', async () => {
    expect(await ok("print([type(of: Character(\"a\"))], [type(of: \"ab\".dropFirst())], [type(of: [1][0...])], [type(of: \"a b\".split(separator: \" \"))], Optional(type(of: Array(\"ab\"))) as Any)\nprint(type(of: \"ab\"[...]), \"ab\"[...], [1, 2][...], type(of: [1, 2][...]), Substring(\"xy\"), type(of: Substring(\"xy\")), Substring(\"xy\").startIndex == \"xy\".startIndex, ArraySlice([4, 5]), type(of: ArraySlice([4, 5])), ArraySlice([4, 5]).startIndex)\n")).toBe("[Swift.Character] [Swift.Substring] [Swift.ArraySlice<Swift.Int>] [Swift.Array<Swift.Substring>] Optional(Swift.Array<Swift.Character>)\nSubstring ab [1, 2] ArraySlice<Int> xy Substring true [4, 5] ArraySlice<Int> 0\n");
  });
  it('typed Character literals, and a Substring used where a String key belongs is rejected as swiftc does', async () => {
    expect(await ok("let ch: Character = \"Q\"\nprint(type(of: ch), ch.isUppercase)\nstruct S { var c: Character = \"z\"; let k: Character }\nlet s = S(k: \"k\")\nprint(type(of: s.c), type(of: s.k))\nfunc f(_ c: Character) -> String { \"\\(type(of: c))\" }\nprint(f(\"x\"))\n")).toBe("Character true\nCharacter Character\nCharacter\n");
    const err = await fails("let sentence = \"the cat the\"\nlet words = sentence.split(separator: \" \")\nvar counts: [String: Int] = [:]\nfor word in words {\n    counts[word, default: 0] += 1\n}\nprint(counts)\n");
    expect(err.message).toBe("cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'");
    expect(err.line).toBe(5);
  });
  it('initializers keep the full written element type, generic arguments and tuples included (swiftc output)', async () => {
    expect(await ok("print(type(of: [Int?]()), type(of: [String: Int?]()), type(of: Set<Int?>()), type(of: [[Int]?]()), type(of: [String: [Int]]()))\nprint(type(of: (x: 1, y: \"a\")), type(of: (1, 2.5)), type(of: [(Int, String)]()), type(of: [(a: Int, b: Int)]()), type(of: Array<Character>()), type(of: [Substring]()))\nprint(type(of: [Int?](repeating: nil, count: 2)), type(of: Dictionary<String, Int?>()))\nprint(type(of: ArraySlice<Int?>()), type(of: [[Character]]()))\n")).toBe("Array<Optional<Int>> Dictionary<String, Optional<Int>> Set<Optional<Int>> Array<Optional<Array<Int>>> Dictionary<String, Array<Int>>\n(x: Int, y: String) (Int, Double) Array<(Int, String)> Array<(a: Int, b: Int)> Array<Character> Array<Substring>\nArray<Optional<Int>> Dictionary<String, Optional<Int>>\nArraySlice<Optional<Int>> Array<Array<Character>>\n");
  });
  it('traps with the messages Swift gives for slice and substring indices', async () => {
    for (const [src, out, msg] of [
      ["let s = [10, 20, 30][1...]\nprint(s[1])\nprint(s[0])", "20\n", "Fatal error: Index out of bounds"],
      ["let m = [1, 2, 3, 4, 5, 6][1..<4]\nprint(m[0..<2])", "", "Fatal error: ArraySlice index is out of range (before startIndex)"],
      ["let m = [1, 2, 3, 4, 5, 6][1..<4]\nprint(m[2..<9])", "", "Fatal error: ArraySlice index is out of range"],
      ["var m = [1, 2, 3, 4][1...]\nm[0] = 5", "", "Fatal error: Index out of bounds"],
      ["var m = [1, 2, 3, 4, 5, 6][1..<4]\nm.remove(at: 0)", "", "Fatal error: Index out of bounds"],
      ["var m = [1, 2, 3][1...]\nm.insert(9, at: 0)", "", "Fatal error: ArraySlice index is out of range (before startIndex)"],
      ["var m = [1, 2, 3][1...]\nm.insert(9, at: 4)", "", "Fatal error: ArraySlice index is out of range"],
      ["var m = [1, 2, 3][1...]\nm.swapAt(0, 1)", "", "Fatal error: Index out of bounds"],
      ["let s = \"Hello\"\nlet sub = s.dropFirst(2)\nprint(sub[s.startIndex])", "", "Fatal error: Substring index is out of bounds"],
      ["let s = \"Hello\"\nlet sub = s.dropFirst(2)\nprint(sub[s.startIndex..<sub.endIndex])", "", "Fatal error: String index range is out of bounds"],
      ["let s = \"Hello\"\nlet sub = s.dropFirst(2)\nprint(sub.index(sub.startIndex, offsetBy: 4))", "", "Fatal error: String index is out of bounds"],
      ["let s = String(\"ab\")\nprint(Character(s))", "", "Fatal error: Can't form a Character from a String containing more than one extended grapheme cluster"],
      ["let s = String(\"\")\nprint(Character(s))", "", "Fatal error: Can't form a Character from an empty String"],
      ["print([1, 2].prefix(-1))", "", "Fatal error: Can't take a prefix of negative length from a collection"],
      ["print([1, 2].suffix(-1))", "", "Fatal error: Can't take a suffix of negative length from a collection"],
      ["print(\"ab\".dropFirst(-1))", "", "Fatal error: Can't drop a negative number of elements from a collection"],
      ["let n = 9\nprint([1, 2].prefix(upTo: n))", "", "Fatal error: Array index is out of range"],
      ["let n = 9\nprint([1, 2].suffix(from: n))", "", "Fatal error: Range requires lowerBound <= upperBound"],
      ["let s = [1, 2, 3][1...]\nprint(s.prefix(upTo: 0))", "", "Fatal error: Range requires lowerBound <= upperBound"],
    ]) {
      const r = await run(src);
      expect(r.stdout).toBe(out);
      expect(r.error && r.error.message).toBe(msg);
    }
    expect((await fails('let c = Character("7")\nprint(Int(c) as Any)')).message).toBe('no exact matches in call to initializer');
  });
  it('Characters cost what one-letter Strings cost, and splitting a long String shares them', async () => {
    const chars = await run('let c = [Character](repeating: "x", count: 1000)\nlet s = String(c)\nprint(s.count)');
    const strings = await run('let c = [String](repeating: "x", count: 1000)\nlet s = String(c)\nprint(s.count)');
    expect(chars.stdout).toBe('1000\n');
    expect(chars.steps).toBe(strings.steps);
    const r = await run('let a = Array(String(repeating: "ab", count: 100_000))\nprint(a.count, a[1] == "b", type(of: a[1]))');
    expect(r.stdout).toBe('200000 true Character\n');
    expect(r.steps).toBeLessThan(100_000);
  });
});

describe('Review pass 19: text element types in array mutations; range descriptions', () => {
  it('append, insert and Array(repeating:) refuse another text type with swiftc\'s wording for each form', async () => {
    // [source, stdout, compile error]: swiftc's output for each
    for (const [src, out, err] of [
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nfor word in words { list.append(word) }\n", null, "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlist.append(s.prefix(1))\n", null, "no exact matches in call to instance method 'append'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlist.append(words[0])\n", null, "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nchars.append(\"ab\")\n", null, "no exact matches in call to instance method 'append'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nchars.insert(t, at: 0)\n", null, "missing argument label 'contentsOf:' in call"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nsubs.insert(t, at: 0)\n", null, "cannot convert value of type 'String' to expected argument type 'Substring'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlist.insert(s.dropLast(), at: 0)\n", null, "no exact matches in call to instance method 'insert'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlist.append(contentsOf: words)\n", null, "no exact matches in call to instance method 'append'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlist.append(s.split(separator: \" \").first!)\n", null, "no exact matches in call to instance method 'append'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nfor ch in s { list.append(ch) }\n", null, "cannot convert value of type 'Character' to expected argument type 'String'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlist.append(contentsOf: \"ab\")\n", null, "no exact matches in call to instance method 'append'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlist.append(contentsOf: [words[0]])\n", null, "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected element type 'String'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlist.insert(contentsOf: words, at: 0)\n", null, "type of expression is ambiguous without a type annotation"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlet c: Character = \"z\"\nlist.insert(c, at: 0)\n", null, "cannot convert value of type 'Character' to expected argument type 'String'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nlet w = s.dropFirst()\nlet a = [String](repeating: w, count: 2)\n", null, "cannot convert value of type 'String.SubSequence' (aka 'Substring') to expected argument type 'String'"],
      ["let s = \"ab cd\"\nlet words = s.split(separator: \" \")\nvar list: [String] = []\nvar chars: [Character] = []\nvar subs: [Substring] = []\nlet t = \"xy\"\nchars.append(contentsOf: t)\nchars.append(\"a\"); subs.append(\"q\"); list.append(String(words[0])); subs.append(words[1]); chars.append(s.first!)\nprint(chars, subs, list)\n", "[\"x\", \"y\", \"a\", \"a\"] [\"q\", \"cd\"] [\"ab\"]\n", null],
    ]) {
      const r = await run(src);
      if (err) expect(r.error && r.error.message).toBe(err);
      else { expect(r.error).toBeNull(); expect(r.stdout).toBe(out); }
    }
  });
  it('collection initializers and annotations take function element types, named as type(of:) names them (swiftc output)', async () => {
    expect(await ok("var ops = [Int: (Int) -> Int]()\nops[1] = { $0 * 2 }\nvar handlers = [(String) -> Void]()\nhandlers.append { print(\"got\", $0) }\nlet tasks = [String: () async throws -> Int]()\nprint(type(of: ops), type(of: handlers), type(of: tasks), ops[1]!(21), ops.count, tasks.isEmpty)\nfor h in handlers { h(\"x\") }\nlet d: [Int: (Int) -> Int] = [:]\nvar hs: [(String) -> Void] = []\nhs.append { _ in }\nlet g = Array<(Int) -> Int>()\nlet k = Dictionary<String, (Int, Int) -> Bool>()\nlet opt = [((Int) -> Int)?]()\nlet nested = [[(Int) -> String]]()\nlet tup = [(Int, (Int) -> Int)]()\nlet s = Set<Int>()\nprint(type(of: d), type(of: hs), type(of: g), type(of: k), type(of: opt), type(of: nested), type(of: tup), type(of: s), hs.count)\nlet inout1 = [(inout Int) -> Void]()\nlet esc = [@Sendable (Int) -> Int]()\nlet thr = [() throws -> Void]()\nprint(type(of: inout1), type(of: esc), type(of: thr))\n")).toBe("Dictionary<Int, (Int) -> Int> Array<(String) -> ()> Dictionary<String, () async throws -> Int> 42 1 true\ngot x\nDictionary<Int, (Int) -> Int> Array<(String) -> ()> Array<(Int) -> Int> Dictionary<String, (Int, Int) -> Bool> Array<Optional<(Int) -> Int>> Array<Array<(Int) -> String>> Array<(Int, (Int) -> Int)> Set<Int> 1\nArray<(inout Int) -> ()> Array<@Sendable (Int) -> Int> Array<() throws -> ()>\n");
    expect(await ok("var actions: [String: () -> Void] = [:]\nactions[\"hi\"] = { print(\"hello\") }\nactions[\"hi\"]?()\nlet fs: [(Int) -> Int] = [{ $0 + 1 }, { $0 * 2 }]\nprint(fs.map { $0(3) }, type(of: fs), type(of: actions))\nlet ok = [{ (x: Int) -> Int in x * 10 }]\nprint(ok[0](5), [{ (x: Int) -> Int in x }][0](7), ok.count)\nlet m = [String: (Double) -> Double]()\nprint(m, m.isEmpty)\nvar table = [String: (Int, Int) -> Int]()\ntable[\"+\"] = (+)\ntable[\"max\"] = max\nprint(table[\"+\"]!(2, 3), table[\"max\"]!(2, 9), table.keys.sorted())\nlet pairs = [(String, (Int) -> Bool)]()\nprint(pairs.count, type(of: pairs))\n")).toBe("hello\n[4, 6] Array<(Int) -> Int> Dictionary<String, () -> ()>\n50 7 1\n[:] true\n5 9 [\"+\", \"max\"]\n0 Array<(String, (Int) -> Bool)>\n");
  });
  it('a function type is no Set element or Dictionary key: swiftc\'s Hashable error, the type spelled as written', async () => {
    for (const [src, msg] of [
      ['let s = Set<(Int) -> Int>()', "type '(Int) -> Int' does not conform to protocol 'Hashable'"],
      ['let d = [(Int) -> Int: Int]()', "type '(Int) -> Int' does not conform to protocol 'Hashable'"],
      ['let d = Dictionary<() -> Void, Int>()', "type '() -> Void' does not conform to protocol 'Hashable'"],
      ['let s = Set<(String) async throws -> Void>()', "type '(String) async throws -> Void' does not conform to protocol 'Hashable'"],
    ]) expect((await fails(src)).message).toBe(msg);
  });
  it('reversed() is a ReversedCollection over arrays, slices, strings, substrings and ranges (swiftc output)', async () => {
    expect(await ok("let a = [1, 2, 3]\nprint(a.reversed(), type(of: a.reversed()))\nprint([a.reversed()], Optional(a.reversed()) as Any)\nprint(\"abc\".reversed(), type(of: \"abc\".reversed()), \"abc\".dropFirst().reversed(), type(of: \"abc\".dropFirst().reversed()))\nprint(a[1...].reversed(), type(of: a[1...].reversed()))\nprint((1...3).reversed(), type(of: (1...3).reversed()), (0..<3).reversed(), type(of: (0..<3).reversed()))\nprint(Array(a.reversed()), a.reversed().map { $0 * 2 }, a.reversed().first!, a.reversed().count, a.reversed()[a.reversed().startIndex])\nfor x in a.reversed() { print(x, terminator: \" \") }\nprint()\nfor i in (0..<3).reversed() { print(i, terminator: \" \") }\nprint()\nlet r: [Int] = a.reversed()\nvar b = Array(a.reversed())\nb.append(0)\nprint(r, b, String(\"hey\".reversed()), a.reversed().reduce(0, +), a.reversed().contains(2))\nprint(Set([1]).reversed(), type(of: Set([1]).reversed()), [\"k\": 1].reversed().count)\nprint(a.reversed().reversed(), type(of: a.reversed().reversed()), a.reversed().sorted(), a.reversed().filter { $0 > 1 }, a.reversed().enumerated().map { $0.offset })\nprint(a.reversed().last!, a.reversed().isEmpty, a.reversed().min()!)\n")).toBe("ReversedCollection<Array<Int>>(_base: [1, 2, 3]) ReversedCollection<Array<Int>>\n[Swift.ReversedCollection<Swift.Array<Swift.Int>>(_base: [1, 2, 3])] Optional(Swift.ReversedCollection<Swift.Array<Swift.Int>>(_base: [1, 2, 3]))\nReversedCollection<String>(_base: \"abc\") ReversedCollection<String> ReversedCollection<Substring>(_base: \"bc\") ReversedCollection<Substring>\nReversedCollection<ArraySlice<Int>>(_base: ArraySlice([2, 3])) ReversedCollection<ArraySlice<Int>>\nReversedCollection<ClosedRange<Int>>(_base: ClosedRange(1...3)) ReversedCollection<ClosedRange<Int>> ReversedCollection<Range<Int>>(_base: Range(0..<3)) ReversedCollection<Range<Int>>\n[3, 2, 1] [6, 4, 2] 3 3 3\n3 2 1 \n2 1 0 \n[3, 2, 1] [3, 2, 1, 0] yeh 6 true\n[1] Array<Int> 1\n[1, 2, 3] Array<Int> [1, 2, 3] [3, 2] [0, 1, 2]\n1 false 1\n");
  });
  it('reversed() becomes an Array wherever an Array is declared, and stays reversed elsewhere (swiftc output)', async () => {
    expect(await ok("let a = [1, 2, 3]\nfunc f(_ x: [Int]) -> [Int] { x.sorted().reversed() }\nlet r: [Int] = a.reversed()\nvar b = [0]\nb = a.reversed()\nb.append(9)\nfunc g(_ xs: [Int]) -> String { \"\\(xs)\" }\nstruct S { var v: [Int] }\nfunc h<T>(_ x: [T]) -> [T] { x.suffix(2).reversed() }\nlet r2: [Int] = a.isEmpty ? a : a.reversed()\nlet t = a.reversed()\nlet u = [a.reversed()]\nlet chars: [Character] = \"abc\".reversed()\nvar names = [\"x\"]\nnames = [\"p\", \"q\"].reversed()\nprint(f(a), r, b, g(a.reversed()), S(v: a.reversed()).v, h([\"a\", \"b\", \"c\"]), r2, type(of: t), type(of: u), chars, names)\nprint(type(of: f(a)), type(of: h([1, 2])), type(of: S(v: a.reversed()).v))\n")).toBe("[3, 2, 1] [3, 2, 1] [3, 2, 1, 9] [3, 2, 1] [3, 2, 1] [\"c\", \"b\"] [3, 2, 1] ReversedCollection<Array<Int>> Array<ReversedCollection<Array<Int>>> [\"c\", \"b\", \"a\"] [\"q\", \"p\"]\nArray<Int> Array<Int> Array<Int>\n");
  });
  it('a ReversedCollection is read-only, as in swiftc', async () => {
    expect((await fails('var r = [1, 2].reversed()\nr.append(3)')).message).toBe("value of type 'ReversedCollection<[Int]>' has no member 'append'");
    expect((await fails('var r = "ab".reversed()\nr.removeAll()')).message).toBe("value of type 'ReversedCollection<String>' has no member 'removeAll'");
    expect((await fails('var r = [3, 1].reversed()\nr.sort()')).message).toBe("value of type 'ReversedCollection<[Int]>' has no member 'sort'");
  });
  it('a written type value prints, compares and hashes by its full name: [Int].self, Int?.self, (Int, String).self (swiftc output)', async () => {
    // swiftc names the module after the file; the engine's module is main
    expect(await ok("struct Box<T> { var v: T }\nprint([Int].self, [String: Int].self, Array<Int>.self, [Int?].self, [(Int) -> Int].self)\nprint(Set<Int>.self, Optional<String>.self, (Int, String).self, [Box<Int>].self, Box<Int>.self, Int.self)\nprint([[Int].self, [String].self], [Box<Int>.self], Optional([Int].self) as Any, [(Int, String).self])\nprint([Int].self == [String].self, [Int].self == Array<Int>.self)\nprint(Int?.self, [Int?.self], String?.self == Optional<String>.self)\n")).toBe("Array<Int> Dictionary<String, Int> Array<Int> Array<Optional<Int>> Array<(Int) -> Int>\nSet<Int> Optional<String> (Int, String) Array<Box<Int>> Box<Int> Int\n[Swift.Array<Swift.Int>, Swift.Array<Swift.String>] [main.Box<Swift.Int>] Optional(Swift.Array<Swift.Int>) [(Swift.Int, Swift.String)]\nfalse true\nOptional<Int> [Swift.Optional<Swift.Int>] true\n");
    expect(await ok('print(Set([[Int].self, [String].self, Array<Int>.self].map { "\\($0)" }).count)')).toBe('2\n');
  });
  it('[Int]?.self, ((Int) -> Int).self, Int??.self and (Int, String)?.self parse as types (swiftc output)', async () => {
    expect(await ok("print([Int]?.self, ((Int) -> Int).self, [String: Int]?.self, Int??.self, ((Int, String) -> Bool).self, (() -> Void).self)\nprint([[Int]?.self], [((Int) -> Int).self], Optional(((Int) -> Int).self) as Any)\nprint([Int]?.self == Optional<[Int]>.self, ((Int) -> Int).self == ((Int) -> String).self)\nlet t = [Int].self\nprint(t, type(of: t), [Int].self, [String: Int].self, Set<Int>.self, [Int].self == [String].self)\n")).toBe("Optional<Array<Int>> (Int) -> Int Optional<Dictionary<String, Int>> Optional<Optional<Int>> (Int, String) -> Bool () -> ()\n[Swift.Optional<Swift.Array<Swift.Int>>] [(Swift.Int) -> Swift.Int] Optional((Swift.Int) -> Swift.Int)\ntrue false\nArray<Int> Array<Int>.Type Array<Int> Dictionary<String, Int> Set<Int> false\n");
    expect(await ok("print((Int, String)?.self, [(Int, String)?.self])\nlet x: Int? = 3\nprint(x?.description as Any)\n")).toBe("Optional<(Int, String)> [Swift.Optional<(Swift.Int, Swift.String)>]\nOptional(\"3\")\n");
  });
  it('ranges print as Swift prints them inside collections and Optionals, partial ranges named by kind (swiftc output)', async () => {
    expect(await ok("print([1...3, 4...5], Optional(1..<3) as Any, [0..<2], [(1...2).reversed()])\nlet r = 1...3\nprint(r, [r], (r, 1))\n")).toBe("[ClosedRange(1...3), ClosedRange(4...5)] Optional(Range(1..<3)) [Range(0..<2)] [Swift.ReversedCollection<Swift.ClosedRange<Swift.Int>>(_base: ClosedRange(1...2))]\n1...3 [ClosedRange(1...3)] (ClosedRange(1...3), 1)\n");
    expect(await ok("print([1...], [..<3], [...3], [1.0...2.5], [\"a\"...\"c\"], Optional(1...) as Any)\nprint(type(of: 1...), type(of: ..<3), type(of: ...3))\n")).toBe("[Swift.PartialRangeFrom<Swift.Int>(lowerBound: 1)] [Swift.PartialRangeUpTo<Swift.Int>(upperBound: 3)] [Swift.PartialRangeThrough<Swift.Int>(upperBound: 3)] [ClosedRange(1.0...2.5)] [ClosedRange(\"a\"...\"c\")] Optional(Swift.PartialRangeFrom<Swift.Int>(lowerBound: 1))\nPartialRangeFrom<Int> PartialRangeUpTo<Int> PartialRangeThrough<Int>\n");
  });
});

describe('Review pass 20: instances of generic types are named with their arguments', () => {
  // The interpreter gives an instance of Box<T> whose arguments it knows a specialized
  // type record: Object.create(base) with display 'Box<Int>' and genericBase base.
  const specialize = (base, display) => Object.assign(Object.create(base), { genericBase: base, display });
  const fake = { protocols: new Set(), staticMethods: new Map(), superclass: null, interp: null }; // as much of a TypeInfo as values.js and operator lookup read
  const box = { ...fake, name: 'Box', storedOrder: ['v'] };
  const res = { ...fake, name: 'Res', caseOrder: ['ok', 'none'], cases: new Map() };
  const node = { ...fake, name: 'Node', storedOrder: ['value'] };
  it('prints Box<Int>(v: 1), and main.Box<Swift.Int>(v: 1) inside a collection or Optional (swiftc output)', () => {
    const b = new SStruct(specialize(box, 'Box<Int>'), new Map([['v', 1]]));
    const nested = new SStruct(specialize(box, 'Box<Box<Bool>>'), new Map([['v', new SStruct(specialize(box, 'Box<Bool>'), new Map([['v', true]]))]]));
    expect([describeValue(b), typeNameOf(b), diagTypeName(b), describeValue(nested)].join(' ')).toBe('Box<Int>(v: 1) Box<Int> Box<Int> Box<Box<Bool>>(v: main.Box<Swift.Bool>(v: true))');
    expect([describeValue(new SArray([b])), describeValue(new Opt(b)), describeValue(new SArray([nested]))].join(' '))
      .toBe('[main.Box<Swift.Int>(v: 1)] Optional(main.Box<Swift.Int>(v: 1)) [main.Box<main.Box<Swift.Bool>>(v: main.Box<Swift.Bool>(v: true))]');
  });
  it('enums keep their plain case at top level; classes print their qualified type (swiftc output)', () => {
    const e = new SEnum(specialize(res, 'Res<Int>'), 'ok', [1], [null]);
    const n = new SObject(specialize(node, 'Node<Int>'));
    expect([describeValue(e), describeValue(new SArray([e])), typeNameOf(e), describeValue(n), describeValue(new SArray([n])), typeNameOf(n)].join(' '))
      .toBe('ok(1) [main.Res<Swift.Int>.ok(1)] Res<Int> main.Node<Swift.Int> [main.Node<Swift.Int>] Node<Int>');
  });
  it('end to end: inferred and explicit arguments name structs, enums and classes (swiftc output, its module renamed main)', async () => {
    expect(await ok("struct Box<T> { var v: T }\nstruct Pair<A, B> { var a: A; var b: B }\nstruct Stack<Element> { var items: [Element] = [] }\nenum Res<T> { case ok(T); case none }\nclass Node<T> { var value: T; init(_ v: T) { value = v } }\nstruct Plain { var x = 1 }\nlet b = Box(v: 1)\nprint(b, type(of: b), Box(v: \"a\"), Pair(a: 1.5, b: [1]), Stack<String>(items: [\"a\"]), Box(v: Box(v: true)))\nprint([b], Optional(b) as Any, [Pair(a: 1, b: \"x\")], [Box(v: Box(v: 2))])\nprint(Res.ok(\"a\"), Res<Int>.none, [Res.ok(1)], type(of: Res.ok(1)), [type(of: b)])\nlet n = Node(3)\nprint(n, [n], type(of: n), Plain(), [Plain()])\nextension Box: Equatable where T: Equatable {}\nprint(Box(v: 1) == Box(v: 1), Box(v: 1) == Box(v: 2), String(describing: b), String(reflecting: b), \"\\(b)\")\n")).toBe("Box<Int>(v: 1) Box<Int> Box<String>(v: \"a\") Pair<Double, Array<Int>>(a: 1.5, b: [1]) Stack<String>(items: [\"a\"]) Box<Box<Bool>>(v: main.Box<Swift.Bool>(v: true))\n[main.Box<Swift.Int>(v: 1)] Optional(main.Box<Swift.Int>(v: 1)) [main.Pair<Swift.Int, Swift.String>(a: 1, b: \"x\")] [main.Box<main.Box<Swift.Int>>(v: main.Box<Swift.Int>(v: 2))]\nok(\"a\") none [main.Res<Swift.Int>.ok(1)] Res<Int> [main.Box<Swift.Int>]\nmain.Node<Swift.Int> [main.Node<Swift.Int>] Node<Int> Plain(x: 1) [main.Plain(x: 1)]\ntrue false Box<Int>(v: 1) main.Box<Swift.Int>(v: 1) Box<Int>(v: 1)\n");
  });
  it('a specialized instance equals and hashes like one of its base type', () => {
    const b = new SStruct(specialize(box, 'Box<Int>'), new Map([['v', 1]]));
    const plain = new SStruct(box, new Map([['v', 1]]));
    expect(equals(b, plain)).toBe(true);
    expect(hashKey(b)).toBe(hashKey(plain));
    expect(equals(new SEnum(specialize(res, 'Res<Int>'), 'none', [], []), new SEnum(res, 'none', [], []))).toBe(true);
  });
});

describe('Review 15: Codable keys, canonical equivalence, generic and inherited Codable', () => {
  // swiftc 6.2 output for each program (its module, named after the file, renamed main)
  it("1: Int keys decode as Ints; review example", async () => {
    expect(await ok("import Foundation\nlet data = Data(\"{\\\"1\\\":\\\"one\\\"}\".utf8)\nlet names = try JSONDecoder().decode([Int: String].self, from: data)\nprint(names[1] ?? \"missing\")\nprint(type(of: names.keys.first!))\n")).toBe("one\nInt\n");
  });
  it("1, 7: String, Int and CodingKeyRepresentable keys use a JSON object, every other key type an alternating array, both ways, with Foundation's errors", async () => {
    expect(await ok("import Foundation\nenum Day: String, Codable { case monday, tuesday }\nenum DayK: String, Codable, CodingKeyRepresentable { case monday }\nenum NumK: Int, Codable, CodingKeyRepresentable { case one = 1 }\nfunc show<T: Encodable>(_ v: T) { let e = JSONEncoder(); e.outputFormatting = [.sortedKeys]; print(String(data: try! e.encode(v), encoding: .utf8)!) }\nshow([1: \"a\", 2: \"b\"]); show([Int8(1): \"a\"]); show([UInt8(3): \"a\"]); show([1.5: \"a\"]); show([true: \"a\"])\nshow([Day.monday: \"Work\"]); show([DayK.monday: \"Work\"]); show([NumK.one: \"x\"]); show([\"k\": [1: true]]); show([Day: Int]()); show([Int: Int]())\nfunc dec<T: Decodable>(_ t: T.Type, _ s: String) { do { print(try JSONDecoder().decode(t, from: Data(s.utf8))) } catch { print(error) } }\ndec([Int: String].self, \"{\\\"1\\\":\\\"one\\\"}\")\ndec([Int: String].self, \"{\\\"a\\\":\\\"one\\\"}\")\ndec([Int: String].self, \"{\\\"1.5\\\":\\\"one\\\"}\")\ndec([Int: String].self, \"{\\\"+1\\\":\\\"one\\\"}\")\ndec([Int: String].self, \"{\\\"99999999999999999999\\\":\\\"x\\\"}\")\ndec([Int8: String].self, \"{\\\"1\\\":\\\"one\\\"}\")\ndec([Int8: String].self, \"[1,\\\"one\\\"]\")\ndec([Day: String].self, \"[\\\"monday\\\",\\\"Work\\\"]\")\ndec([Day: String].self, \"{\\\"monday\\\":\\\"Work\\\"}\")\ndec([DayK: String].self, \"{\\\"monday\\\":\\\"Work\\\"}\")\ndec([DayK: String].self, \"{\\\"friday\\\":\\\"Work\\\"}\")\ndec([NumK: String].self, \"{\\\"1\\\":\\\"x\\\"}\")\ndec([Double: String].self, \"[1.5,\\\"a\\\"]\")\ndec([Day: String].self, \"[\\\"monday\\\"]\")\ndec([Day: String].self, \"[\\\"friday\\\",\\\"x\\\"]\")\ndec([Day: Int].self, \"null\")\ndec([Int: Int].self, \"{\\\"1\\\":\\\"x\\\"}\")\ndec([String: [Day: Int]].self, \"{\\\"k\\\":{\\\"monday\\\":1}}\")\nlet names = try JSONDecoder().decode([Int: String].self, from: Data(\"{\\\"1\\\":\\\"one\\\"}\".utf8))\nprint(names[1] ?? \"missing\", type(of: names.keys.first!), type(of: names))\n")).toBe("{\"1\":\"a\",\"2\":\"b\"}\n[1,\"a\"]\n[3,\"a\"]\n[1.5,\"a\"]\n[true,\"a\"]\n[\"monday\",\"Work\"]\n{\"monday\":\"Work\"}\n{\"1\":\"x\"}\n{\"k\":{\"1\":true}}\n[]\n{}\n[1: \"one\"]\nDecodingError.typeMismatch: expected value of type Int. Path: a. Debug description: Expected Int key but found String key instead.\nDecodingError.typeMismatch: expected value of type Int. Path: `1.5`. Debug description: Expected Int key but found String key instead.\n[1: \"one\"]\nDecodingError.typeMismatch: expected value of type Int. Path: 99999999999999999999. Debug description: Expected Int key but found String key instead.\nDecodingError.typeMismatch: expected value of type Array<Any>. Debug description: Expected to decode Array<Any> but found a dictionary instead.\n[1: \"one\"]\n[main.Day.monday: \"Work\"]\nDecodingError.typeMismatch: expected value of type Array<Any>. Debug description: Expected to decode Array<Any> but found a dictionary instead.\n[main.DayK.monday: \"Work\"]\nDecodingError.dataCorrupted: Data was corrupted. Path: friday. Debug description: Could not convert key to type DayK\n[main.NumK.one: \"x\"]\n[1.5: \"a\"]\nDecodingError.dataCorrupted: Data was corrupted. Debug description: Expected collection of key-value pairs; encountered odd-length array instead.\nDecodingError.dataCorrupted: Data was corrupted. Path: [0]. Debug description: Cannot initialize Day from invalid String value friday\nDecodingError.valueNotFound: Expected value of type Array<Any> but found null instead. Debug description: Cannot get unkeyed decoding container -- found null value instead\nDecodingError.typeMismatch: expected value of type Int. Path: [1]. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Array<Any>. Path: k. Debug description: Expected to decode Array<Any> but found a dictionary instead.\none Int Dictionary<Int, String>\n");
  });
  it("a coding path quotes a key with a dot or backtick in backticks", async () => {
    expect(await ok("import Foundation\nfunc dec<T: Decodable>(_ t: T.Type, _ s: String) { do { print(try JSONDecoder().decode(t, from: Data(s.utf8))) } catch { print(error) } }\nfor k in [\"a.b\", \"a b\", \"a-b\", \"1a\", \"\", \"\u00e9\", \"a_b\", \"1.5\", \"x.y.z\", \"`q`\"] {\n  dec([String: Int].self, \"{\\\"\\(k)\\\":\\\"v\\\"}\")\n}\n")).toBe("DecodingError.typeMismatch: expected value of type Int. Path: `a.b`. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: a b. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: a-b. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: 1a. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: . Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: \u00e9. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: a_b. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: `1.5`. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: `x.y.z`. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: `\\`q\\``. Debug description: Expected to decode Int but found a string instead.\n");
  });
  it("3: String and Character equality, ordering and hashing follow canonical equivalence; review example", async () => {
    expect(await ok("let composed = \"\\u{E9}\"\nlet decomposed = \"e\\u{301}\"\nprint(composed == decomposed)\nprint(Set([composed, decomposed]).count)\nlet a: Character = \"\\u{E9}\"\nlet b: Character = \"e\\u{301}\"\nprint(a == b)\n")).toBe("true\n1\ntrue\n");
  });
  it("3: so do hasPrefix, hasSuffix, contains, firstIndex, split and replacingOccurrences", async () => {
    expect(await ok("import Foundation\nlet c = \"\\u{E9}\", d = \"e\\u{301}\"\nprint(c == d, c < d, d < c, [d, c, \"e\", \"f\"].sorted().count, Set([c, d]).count, [c: 1][d] ?? 0)\nprint(\"caf\\u{E9}\" == \"cafe\\u{301}\", \"cafe\\u{301}\".count, (\"x\" + d).hasSuffix(c), (d + \"x\").hasPrefix(c), (\"a\" + d).contains(c))\nprint([\"a\": 1, c: 2].keys.contains(d), Set([Character(c), Character(d)]).count, Character(c) == Character(d))\nprint(\"\\u{212B}\" == \"\\u{C5}\", \"\\u{1100}\\u{1161}\" == \"\\u{AC00}\", d.firstIndex(of: Character(c)) != nil, (\"x\" + d).split(separator: Character(c)).count)\nswitch d { case c: print(\"matched\") default: print(\"no\") }\nprint((\"a\" + d + \"b\").replacingOccurrences(of: c, with: \"E\") , d.unicodeScalars.count, c.unicodeScalars.count, d.utf8.count)\n")).toBe("true false false 4 1 1\ntrue 4 true true true\ntrue 1 true\ntrue true true 1\nmatched\naEb 2 1 3\n");
  });
  it("5: Box<Int> and other generic Codable types decode with their arguments substituted; review example", async () => {
    expect(await ok("import Foundation\nstruct Box<T: Codable>: Codable { var value: T }\nlet b = try JSONDecoder().decode(\n    Box<Int>.self, from: Data(\"{\\\"value\\\":3}\".utf8)\n)\nprint(b.value, type(of: b))\n")).toBe("3 Box<Int>\n");
  });
  it("5: generic structs, arrays, optionals, dictionaries, nesting and enums decode and encode", async () => {
    expect(await ok("import Foundation\nstruct Box<T: Codable>: Codable { var value: T }\nstruct Page<Item: Codable>: Codable { var items: [Item]; var next: Item?; var meta: [String: Item] }\nstruct Pair<A: Codable, B: Codable>: Codable { var a: A; var b: B }\nenum Res<T: Codable>: Codable { case ok(T); case none }\nlet b = try JSONDecoder().decode(Box<Int>.self, from: Data(\"{\\\"value\\\":3}\".utf8))\nprint(b.value, type(of: b), b)\nlet p = try JSONDecoder().decode(Page<String>.self, from: Data(\"{\\\"items\\\":[\\\"a\\\",\\\"b\\\"],\\\"meta\\\":{\\\"k\\\":\\\"v\\\"}}\".utf8))\nprint(p, type(of: p))\nlet q = try JSONDecoder().decode(Pair<Double, [Bool]>.self, from: Data(\"{\\\"a\\\":1,\\\"b\\\":[true]}\".utf8))\nprint(q)\nlet nested = try JSONDecoder().decode(Box<Box<String>>.self, from: Data(\"{\\\"value\\\":{\\\"value\\\":\\\"x\\\"}}\".utf8))\nprint(nested, type(of: nested))\nlet r = try JSONDecoder().decode(Res<Int>.self, from: Data(\"{\\\"ok\\\":{\\\"_0\\\":5}}\".utf8))\nprint(r, type(of: r))\nlet e = JSONEncoder(); e.outputFormatting = [.sortedKeys]\nprint(String(data: try e.encode(Box(value: 2.5)), encoding: .utf8)!, String(data: try e.encode(p), encoding: .utf8)!, String(data: try e.encode(Res.ok(\"z\")), encoding: .utf8)!)\nlet arr = try JSONDecoder().decode([Box<Int>].self, from: Data(\"[{\\\"value\\\":1},{\\\"value\\\":2}]\".utf8))\nprint(arr, type(of: arr))\ndo { _ = try JSONDecoder().decode(Box<Int>.self, from: Data(\"{\\\"value\\\":\\\"x\\\"}\".utf8)) } catch { print(error) }\n")).toBe("3 Box<Int> Box<Int>(value: 3)\nPage<String>(items: [\"a\", \"b\"], next: nil, meta: [\"k\": \"v\"]) Page<String>\nPair<Double, Array<Bool>>(a: 1.0, b: [true])\nBox<Box<String>>(value: main.Box<Swift.String>(value: \"x\")) Box<Box<String>>\nok(5) Res<Int>\n{\"value\":2.5} {\"items\":[\"a\",\"b\"],\"meta\":{\"k\":\"v\"}} {\"ok\":{\"_0\":\"z\"}}\n[main.Box<Swift.Int>(value: 1), main.Box<Swift.Int>(value: 2)] Array<Box<Int>>\nDecodingError.typeMismatch: expected value of type Int. Path: value. Debug description: Expected to decode Int but found a string instead.\n");
  });
  it("6: an enum's own encode(to:) is used, raw-value enums included; review example", async () => {
    expect(await ok("import Foundation\nenum Status: String, Codable {\n    case ready\n    func encode(to encoder: Encoder) throws {\n        var c = encoder.singleValueContainer()\n        try c.encode(\"READY\")\n    }\n}\nlet data = try JSONEncoder().encode(Status.ready)\nprint(String(data: data, encoding: .utf8)!)\n")).toBe("\"READY\"\n");
  });
  it("7: review example", async () => {
    expect(await ok("import Foundation\nenum Day: String, Codable { case monday }\nlet data = try JSONEncoder().encode([Day.monday: \"Work\"])\nprint(String(data: data, encoding: .utf8)!)\n")).toBe("[\"monday\",\"Work\"]\n");
  });
  it("8: a subclass uses its Codable superclass's encoding; review example", async () => {
    expect(await ok("import Foundation\nclass Base: Codable { var a = 1 }\nclass Child: Base { var b = 2 }\nlet encoder = JSONEncoder()\nencoder.outputFormatting = [.sortedKeys]\nprint(String(data: try encoder.encode(Child()), encoding: .utf8)!)\n")).toBe("{\"a\":1}\n");
  });
  it("6: an enum's own init(from:) decodes it, init(rawValue:) still available inside; super.encode(to:) in an override", async () => {
    expect(await ok("import Foundation\nenum Status: String, Codable {\n    case ready, done\n    func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); try c.encode(rawValue.uppercased()) }\n    init(from decoder: Decoder) throws { let c = try decoder.singleValueContainer(); self = Status(rawValue: try c.decode(String.self).lowercased()) ?? .done }\n}\nenum Shape: Codable {\n    case circle(Double), square\n    func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); switch self { case .circle(let r): try c.encode(\"c\\(r)\"); case .square: try c.encode(\"sq\") } }\n    init(from decoder: Decoder) throws { let s = try decoder.singleValueContainer().decode(String.self); self = s == \"sq\" ? .square : .circle(Double(s.dropFirst())!) }\n}\nlet e = JSONEncoder()\nprint(String(data: try e.encode(Status.ready), encoding: .utf8)!, String(data: try e.encode([Status.ready, .done]), encoding: .utf8)!, String(data: try e.encode(Shape.circle(2)), encoding: .utf8)!, String(data: try e.encode([Shape.square]), encoding: .utf8)!)\nprint(try JSONDecoder().decode(Status.self, from: Data(\"\\\"READY\\\"\".utf8)), try JSONDecoder().decode([Status].self, from: Data(\"[\\\"DONE\\\",\\\"x\\\"]\".utf8)), try JSONDecoder().decode(Shape.self, from: Data(\"\\\"c1.5\\\"\".utf8)))\nclass Base: Codable { var a = 1 }\nclass Child: Base { var b = 2 }\nclass Kid: Base {\n    var c = 3\n    override func encode(to encoder: Encoder) throws { try super.encode(to: encoder); var k = encoder.container(keyedBy: K.self); try k.encode(c, forKey: .c) }\n    enum K: String, CodingKey { case c }\n}\nlet s = JSONEncoder(); s.outputFormatting = [.sortedKeys]\nprint(String(data: try s.encode(Child()), encoding: .utf8)!, String(data: try s.encode(Kid()), encoding: .utf8)!, String(data: try s.encode([Child()]), encoding: .utf8)!)\nlet ch = try JSONDecoder().decode(Child.self, from: Data(\"{\\\"a\\\":5,\\\"b\\\":9}\".utf8))\nprint(ch.a, ch.b, type(of: ch))\nclass G { var g = 0; init() {} }\nclass B2: G, Codable { var x = 1 }\nprint(String(data: try s.encode(B2()), encoding: .utf8)!)\n")).toBe("\"READY\" [\"READY\",\"DONE\"] \"c2.0\" [\"sq\"]\nready [main.Status.done, main.Status.done] circle(1.5)\n{\"a\":1} {\"a\":1,\"c\":3} [{\"a\":1}]\n5 2 Child\n{\"x\":1}\n");
  });
  it("8: an override's super.encode(to:) and a subclass init(from:) calling super.init(from:) use the synthesized implementation", async () => {
    expect(await ok("import Foundation\nclass Base: Codable { var a = 1 }\nclass Kid: Base {\n    var c = 3\n    enum K: String, CodingKey { case c }\n    override init() { super.init() }\n    required init(from decoder: Decoder) throws {\n        let k = try decoder.container(keyedBy: K.self)\n        c = try k.decode(Int.self, forKey: .c)\n        try super.init(from: decoder)\n    }\n    override func encode(to encoder: Encoder) throws { try super.encode(to: encoder); var k = encoder.container(keyedBy: K.self); try k.encode(c, forKey: .c) }\n}\nlet e = JSONEncoder(); e.outputFormatting = [.sortedKeys]\nprint(String(data: try e.encode(Kid()), encoding: .utf8)!)\nlet k = try JSONDecoder().decode(Kid.self, from: Data(\"{\\\"a\\\":7,\\\"c\\\":9}\".utf8))\nprint(k.a, k.c, type(of: k))\ndo { _ = try JSONDecoder().decode(Kid.self, from: Data(\"{\\\"c\\\":9}\".utf8)) } catch { print(error) }\n")).toBe("{\"a\":1,\"c\":3}\n7 9 Kid\nDecodingError.keyNotFound: Key 'a' not found in keyed decoding container. Debug description: No value associated with key CodingKeys(stringValue: \"a\", intValue: nil) (\"a\").\n");
  });
  it("enum initializers that assign self give the case", async () => {
    expect(await ok("enum Shape {\n    case circle(Double), square\n    init(code: String) { self = code == \"sq\" ? .square : .circle(1.5) }\n}\nenum Status: String {\n    case ready, done\n    init(flag: Bool) { self = flag ? .ready : .done }\n}\nprint(Shape(code: \"sq\"), Shape(code: \"c\"), Status(flag: true), [Status(flag: false)])\n")).toBe("square circle(1.5) ready [main.Status.done]\n");
  });
  it("6, 8: custom enum encoding, inherited class encoding and decoding, a Codable class over a plain superclass", async () => {
    expect(await ok("import Foundation\nenum Status: String, Codable {\n    case ready, done\n    func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); try c.encode(rawValue.uppercased()) }\n    init(from decoder: Decoder) throws { let c = try decoder.singleValueContainer(); self = try c.decode(String.self) == \"READY\" ? .ready : .done }\n}\nenum Shape: Codable {\n    case circle(Double), square\n    func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); switch self { case .circle(let r): try c.encode(\"c\\(r)\"); case .square: try c.encode(\"sq\") } }\n    init(from decoder: Decoder) throws { let s = try decoder.singleValueContainer().decode(String.self); self = s == \"sq\" ? .square : .circle(Double(s.dropFirst())!) }\n}\nlet e = JSONEncoder()\nprint(String(data: try e.encode(Status.ready), encoding: .utf8)!, String(data: try e.encode([Status.ready, .done]), encoding: .utf8)!, String(data: try e.encode(Shape.circle(2)), encoding: .utf8)!, String(data: try e.encode([Shape.square]), encoding: .utf8)!)\nclass Base: Codable { var a = 1 }\nclass Child: Base { var b = 2 }\nlet s = JSONEncoder(); s.outputFormatting = [.sortedKeys]\nprint(String(data: try s.encode(Child()), encoding: .utf8)!, String(data: try s.encode([Child()]), encoding: .utf8)!)\nlet ch = try JSONDecoder().decode(Child.self, from: Data(\"{\\\"a\\\":5,\\\"b\\\":9}\".utf8))\nprint(ch.a, ch.b, type(of: ch))\nclass G { var g = 0; init() {} }\nclass B2: G, Codable { var x = 1 }\nprint(String(data: try s.encode(B2()), encoding: .utf8)!)\n")).toBe("\"READY\" [\"READY\",\"DONE\"] \"c2.0\" [\"sq\"]\n{\"a\":1} [{\"a\":1}]\n5 2 Child\n{\"x\":1}\n");
  });
});

describe('parser records where bodies close; builtins expose the synthesized Codable hooks', () => {
  it('endLine is the line of the closing brace of every function, initializer, subscript, accessor and closure body', () => {
    const p = parse('func find(_ yes: Bool) -> Int? {\n  if yes { return 1 }\n}\nstruct S {\n  var v: Int {\n    get {\n      1\n    }\n    set { }\n  }\n  var w: Int {\n    2\n  }\n  subscript(i: Int) -> Int {\n    i\n  }\n  init() {\n  }\n}\nlet f = { (x: Int) -> Int in\n  x\n}');
    const [fn, s, c] = p.body;
    expect([fn.endLine, fn.body.endLine]).toEqual([3, 3]);
    const members = s.decl ? s.decl.members : s.members;
    const acc = (m) => (m.accessors || (m.bindings && m.bindings[0].accessors));
    expect([acc(members[0]).get.endLine, acc(members[0]).set.endLine, acc(members[1]).get.endLine]).toEqual([8, 9, 13]);
    expect([members[2].endLine, members[3].endLine, c.bindings[0].init.endLine]).toEqual([16, 18, 22]);
  });
  it('a parameter declared @escaping is marked escaping, alone or with other attributes', () => {
    const p = parse('func run(_ c: @escaping () -> Void, _ d: @escaping @Sendable (Int) -> Int, e: () -> Void, f: inout Int) {}\nclass K { init(handler: @escaping (String) -> Void) {} }');
    expect(p.body[0].params.map((x) => !!x.escaping)).toEqual([true, true, false, false]);
    const k = p.body[1];
    expect((k.decl ? k.decl.members : k.members)[0].params[0].escaping).toBe(true);
  });
  it('createBuiltins offers encodeSynthesized and decodeSynthesizedInto as generators', async () => {
    const { createBuiltins } = await import('../../src/engine/builtins.js');
    const b = createBuiltins();
    expect(typeof b.encodeSynthesized).toBe('function');
    expect(typeof b.decodeSynthesizedInto).toBe('function');
    expect(Object.prototype.toString.call(b.encodeSynthesized)).toBe('[object GeneratorFunction]');
  });
});

describe('Review 16: Codable containers, Task.result, waitForAll, element types', () => {
  // swiftc 6.2 output for each program (its module, named after the file, renamed main)
  it("3: keyed containers in a custom encode(to:) and init(from:) follow the key strategies", async () => {
    expect(await ok("import Foundation\nstruct User: Codable {\n    var firstName: String\n    var homeURL: String\n    enum CodingKeys: String, CodingKey { case firstName, homeURL }\n    init(firstName: String) { self.firstName = firstName; homeURL = \"x\" }\n    init(from decoder: Decoder) throws {\n        let c = try decoder.container(keyedBy: CodingKeys.self)\n        firstName = try c.decode(String.self, forKey: .firstName)\n        homeURL = try c.decodeIfPresent(String.self, forKey: .homeURL) ?? \"none\"\n        print(c.contains(.firstName), c.allKeys.map(\\.stringValue))\n    }\n    func encode(to encoder: Encoder) throws {\n        var c = encoder.container(keyedBy: CodingKeys.self)\n        try c.encode(firstName, forKey: .firstName)\n        try c.encode(homeURL, forKey: .homeURL)\n    }\n}\nlet e = JSONEncoder()\ne.keyEncodingStrategy = .convertToSnakeCase\ne.outputFormatting = [.sortedKeys]\nprint(String(data: try e.encode(User(firstName: \"Ada\")), encoding: .utf8)!)\nlet d = JSONDecoder()\nd.keyDecodingStrategy = .convertFromSnakeCase\nlet u = try d.decode(User.self, from: Data(\"{\\\"first_name\\\":\\\"Ada\\\",\\\"home_url\\\":\\\"h\\\"}\".utf8))\nprint(u.firstName, u.homeURL)\ndo { _ = try d.decode(User.self, from: Data(\"{\\\"firstName\\\":\\\"Ada\\\"}\".utf8)) } catch { print(error) }\n")).toBe("{\"first_name\":\"Ada\",\"home_url\":\"x\"}\ntrue [\"firstName\"]\nAda none\ntrue [\"firstName\"]\n");
  });
  it("snake-case decoding errors name the coding key in their path", async () => {
    expect(await ok("import Foundation\nstruct A: Codable { var firstName: Int }\nstruct B: Decodable {\n    var firstName: Int\n    enum CodingKeys: String, CodingKey { case firstName }\n    init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); firstName = try c.decode(Int.self, forKey: .firstName) }\n}\nlet d = JSONDecoder(); d.keyDecodingStrategy = .convertFromSnakeCase\nfor s in [\"{\\\"first_name\\\":\\\"x\\\"}\", \"{\\\"other\\\":1}\"] {\n    do { _ = try d.decode(A.self, from: Data(s.utf8)) } catch { print(error) }\n    do { _ = try d.decode(B.self, from: Data(s.utf8)) } catch { print(error) }\n}\n")).toBe("DecodingError.typeMismatch: expected value of type Int. Path: firstName. Debug description: Expected to decode Int but found a string instead.\nDecodingError.typeMismatch: expected value of type Int. Path: firstName. Debug description: Expected to decode Int but found a string instead.\nDecodingError.keyNotFound: Key 'firstName' not found in keyed decoding container. Debug description: No value associated with key CodingKeys(stringValue: \"firstName\", intValue: nil) (\"firstName\").\nDecodingError.keyNotFound: Key 'firstName' not found in keyed decoding container. Debug description: No value associated with key CodingKeys(stringValue: \"firstName\", intValue: nil) (\"firstName\").\n");
  });
  it("6: allKeys holds the CodingKeys values the JSON object has, unknown keys left out; keys print as CodingKeys(stringValue:intValue:)", async () => {
    expect(await ok("import Foundation\nstruct User: Decodable {\n    enum CodingKeys: String, CodingKey { case name, age = \"years\" }\n    init(from decoder: Decoder) throws {\n        let c = try decoder.container(keyedBy: CodingKeys.self)\n        print(c.allKeys.count, type(of: c.allKeys), c.allKeys.map(\\.stringValue).sorted(), c.allKeys.map { $0.intValue as Any }.count, c.allKeys.contains(.name), c.allKeys.contains(.age))\n        for k in c.allKeys.sorted(by: { $0.stringValue < $1.stringValue }) { print(k, k.stringValue, k == .age) }\n    }\n}\n_ = try JSONDecoder().decode(User.self, from: Data(\"{\\\"name\\\":\\\"Ada\\\",\\\"extra\\\":1,\\\"years\\\":3}\".utf8))\n")).toBe("2 Array<CodingKeys> [\"name\", \"years\"] 2 true true\nCodingKeys(stringValue: \"name\", intValue: nil) name false\nCodingKeys(stringValue: \"years\", intValue: nil) years true\n");
  });
  it("7: nested keyed and unkeyed containers refuse null, numbers, arrays and missing keys with Foundation's errors", async () => {
    expect(await ok("import Foundation\nstruct User: Decodable {\n    enum CodingKeys: String, CodingKey { case profile, list }\n    enum P: String, CodingKey { case x }\n    init(from decoder: Decoder) throws {\n        let c = try decoder.container(keyedBy: CodingKeys.self)\n        let n = try c.nestedContainer(keyedBy: P.self, forKey: .profile)\n        print(\"accepted\", try n.decode(Int.self, forKey: .x))\n    }\n}\nfor s in [\"{\\\"profile\\\":42}\", \"{\\\"profile\\\":null}\", \"{\\\"profile\\\":[1]}\", \"{\\\"profile\\\":{\\\"x\\\":5}}\", \"{}\"] {\n    do { _ = try JSONDecoder().decode(User.self, from: Data(s.utf8)) } catch { print(error) }\n}\nstruct U2: Decodable {\n    enum CodingKeys: String, CodingKey { case list }\n    init(from decoder: Decoder) throws {\n        let c = try decoder.container(keyedBy: CodingKeys.self)\n        var u = try c.nestedUnkeyedContainer(forKey: .list)\n        print(\"list\", u.count as Any, try u.decode(Int.self))\n    }\n}\nfor s in [\"{\\\"list\\\":[7]}\", \"{\\\"list\\\":42}\", \"{\\\"list\\\":null}\", \"{}\"] {\n    do { _ = try JSONDecoder().decode(U2.self, from: Data(s.utf8)) } catch { print(error) }\n}\n")).toBe("DecodingError.typeMismatch: expected value of type Dictionary<String, Any>. Path: profile. Debug description: Expected to decode Dictionary<String, Any> but found number instead.\nDecodingError.valueNotFound: Expected value of type Dictionary<String, Any> but found null instead. Path: profile. Debug description: Cannot get keyed decoding container -- found null value instead\nDecodingError.typeMismatch: expected value of type Dictionary<String, Any>. Path: profile. Debug description: Expected to decode Dictionary<String, Any> but found an array instead.\naccepted 5\nDecodingError.keyNotFound: Key 'profile' not found in keyed decoding container. Debug description: No value associated with key CodingKeys(stringValue: \"profile\", intValue: nil) (\"profile\").\nlist Optional(1) 7\nDecodingError.typeMismatch: expected value of type Array<Any>. Path: list. Debug description: Expected to decode Array<Any> but found number instead.\nDecodingError.valueNotFound: Expected value of type Array<Any> but found null instead. Path: list. Debug description: Cannot get unkeyed decoding container -- found null value instead\nDecodingError.keyNotFound: Key 'list' not found in keyed decoding container. Debug description: No value associated with key CodingKeys(stringValue: \"list\", intValue: nil) (\"list\").\n");
  });
  it("unkeyed containers decode and encode in order: count, isAtEnd, currentIndex, decodeNil, decodeIfPresent, the end; superDecoder; CodingKey members", async () => {
    expect(await ok("import Foundation\nstruct L: Decodable {\n    var xs: [Int] = []\n    init(from decoder: Decoder) throws {\n        var u = try decoder.unkeyedContainer()\n        print(u.count as Any, u.isAtEnd, u.currentIndex)\n        while !u.isAtEnd {\n            if try u.decodeNil() { xs.append(-1); continue }\n            xs.append(try u.decode(Int.self))\n        }\n        print(u.currentIndex, u.isAtEnd)\n        do { _ = try u.decode(Int.self) } catch { print(error) }\n        print(try u.decodeIfPresent(Int.self) as Any)\n    }\n}\nfor s in [\"[1,null,3]\", \"[]\", \"{\\\"a\\\":1}\", \"null\", \"[\\\"x\\\"]\"] {\n    do { print(try JSONDecoder().decode(L.self, from: Data(s.utf8)).xs) } catch { print(error) }\n}\nstruct Pt: Codable {\n    var x: Int, y: Int\n    init(x: Int, y: Int) { self.x = x; self.y = y }\n    init(from decoder: Decoder) throws { var u = try decoder.unkeyedContainer(); x = try u.decode(Int.self); y = try u.decode(Int.self) }\n    func encode(to encoder: Encoder) throws { var u = encoder.unkeyedContainer(); try u.encode(x); try u.encode(y); print(u.count) }\n}\nprint(String(data: try JSONEncoder().encode([Pt(x: 1, y: 2)]), encoding: .utf8)!, try JSONDecoder().decode([Pt].self, from: Data(\"[[3,4]]\".utf8)).map { $0.x + $0.y })\nenum K: Int, CodingKey { case a = 1, b }\nenum S: String, CodingKey { case name, age = \"years\" }\nprint(K.a, [K.b], S.age, [S.name], K.a.stringValue, K.a.intValue as Any, S.age.stringValue, S.age.intValue as Any)\nstruct Sup: Decodable {\n    enum CodingKeys: String, CodingKey { case base }\n    init(from decoder: Decoder) throws {\n        let c = try decoder.container(keyedBy: CodingKeys.self)\n        let s1 = try c.superDecoder()\n        let s2 = try c.superDecoder(forKey: .base)\n        print(s1.codingPath.map(\\.stringValue), s2.codingPath.map(\\.stringValue), try s2.singleValueContainer().decode(Int.self))\n        do { _ = try s1.singleValueContainer().decode(Int.self) } catch { print(error) }\n    }\n}\n_ = try JSONDecoder().decode(Sup.self, from: Data(\"{\\\"base\\\":5}\".utf8))\n")).toBe("Optional(3) false 0\n3 true\nDecodingError.valueNotFound: Expected value of type Int but found null instead. Path: [3]. Debug description: Unkeyed container is at end.\nnil\n[1, -1, 3]\nOptional(0) true 0\n0 true\nDecodingError.valueNotFound: Expected value of type Int but found null instead. Path: [0]. Debug description: Unkeyed container is at end.\nnil\n[]\nDecodingError.typeMismatch: expected value of type Array<Any>. Debug description: Expected to decode Array<Any> but found a dictionary instead.\nDecodingError.valueNotFound: Expected value of type Array<Any> but found null instead. Debug description: Cannot get unkeyed decoding container -- found null value instead\nOptional(1) false 0\nDecodingError.typeMismatch: expected value of type Int. Path: [0]. Debug description: Expected to decode Int but found a string instead.\n2\n[[1,2]] [7]\nK(stringValue: \"a\", intValue: 1) [K(stringValue: \"b\", intValue: 2)] S(stringValue: \"years\", intValue: nil) [S(stringValue: \"name\", intValue: nil)] a Optional(1) years nil\n[\"super\"] [\"base\"] 5\nDecodingError.valueNotFound: Expected value of type Int but found null instead. Path: super. Debug description: Cannot get value of type Int -- found null value instead\n");
  });
  it("CodingKey cases print as Swift prints them; numbers that take their type from the element type are appended", async () => {
    expect(await ok("import Foundation\nstruct Person: Codable { var name: String; var age: Int\n  static func show() { print(CodingKeys.age, [CodingKeys.name], CodingKeys.age.stringValue, CodingKeys.name.intValue as Any) } }\nstruct Q: Codable { var a: Int; enum CodingKeys: String, CodingKey { case a } }\nenum PlainK: CodingKey { case one }\nPerson.show()\nprint(Q.CodingKeys.a, Q.CodingKeys.a.rawValue, PlainK.one)\nvar fs: [Float] = []\nfs.append(1.0 / 3.0); fs.append(max(1, 2)); fs.append(true ? 1 : 2); fs.append(-2)\nvar ds: [Double] = []\nds.append(max(1, 2)); ds.append(abs(-3)); ds.append([1, 2].reduce(0, +))\nprint(fs, ds)\n")).toBe("CodingKeys(stringValue: \"age\", intValue: nil) [CodingKeys(stringValue: \"name\", intValue: nil)] age nil\nCodingKeys(stringValue: \"a\", intValue: nil) a PlainK(stringValue: \"one\", intValue: nil)\n[0.33333334, 2.0, 1.0, -2.0] [2.0, 3.0, 3.0]\n");
  });
  it("8: Task.result is a Result, never throwing; value still throws", async () => {
    expect(await ok("enum Failure: Error { case broken }\nlet task = Task { 42 }\nprint(await task.result)\nlet bad = Task { () throws -> Int in throw Failure.broken }\nlet r = await bad.result\nprint(r)\nswitch r { case .success(let v): print(\"ok\", v); case .failure(let e): print(\"failed\", e) }\ndo { print(try await bad.value) } catch { print(\"value threw\", error) }\n")).toBe("success(42)\nfailure(main.Failure.broken)\nfailed broken\nvalue threw broken\n");
  });
  it("9: waitForAll consumes every result and rethrows the first child error", async () => {
    expect(await ok("enum Failure: Error { case broken }\nawait withTaskGroup(of: Int.self) { group in\n    group.addTask { 1 }\n    group.addTask { 2 }\n    await group.waitForAll()\n    print(group.isEmpty)\n    print(await group.next() as Any)\n}\ndo {\n    try await withThrowingTaskGroup(of: Int.self) { group in\n        group.addTask { throw Failure.broken }\n        await Task.yield()\n        try await group.waitForAll()\n        print(\"no error\")\n    }\n} catch { print(\"caught\", error) }\ndo {\n    try await withThrowingTaskGroup(of: Int.self) { group in\n        group.addTask { 5 }\n        group.addTask { throw Failure.broken }\n        try await group.waitForAll()\n        print(\"no error\")\n    }\n} catch { print(\"caught2\", error) }\nlet n = await withTaskGroup(of: Int.self) { group -> Int in\n    for i in 1...3 { group.addTask { i } }\n    await group.waitForAll()\n    var s = 0\n    for await v in group { s += v }\n    return s\n}\nprint(n)\n")).toBe("true\nnil\ncaught broken\ncaught2 broken\n0\n");
  });
  it('1: append, insert, append(contentsOf:) and Array(repeating:) refuse an element of another type with swiftc\'s wording', async () => {
    for (const [src, out, err] of [
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(\"three\")\n", null, "cannot convert value of type 'String' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(s)\n", null, "cannot convert value of type 'String' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(1.5)\n", null, "cannot convert value of type 'Double' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(f)\n", null, "cannot convert value of type 'Double' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nnames.append(1)\n", null, "cannot convert value of type 'Int' to expected argument type 'String'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nnames.append(n)\n", null, "cannot convert value of type 'Int' to expected argument type 'String'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.insert(\"x\", at: 0)\n", null, "cannot convert value of type 'String' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.insert(s, at: 0)\n", null, "cannot convert value of type 'String' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(contentsOf: [\"a\"])\n", null, "cannot convert value of type 'String' to expected element type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(contentsOf: names)\n", null, "no exact matches in call to instance method 'append'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nds.append(n)\n", null, "cannot convert value of type 'Int' to expected argument type 'Double'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nds.append(1)\nprint(ds)\n", "[1.5, 1.0]\n", null],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(true)\n", null, "cannot convert value of type 'Bool' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(nil)\n", null, "'nil' is not compatible with expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(Optional(1))\n", null, "cannot convert value of type 'Optional<Int>' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvalues.append(contentsOf: [3, 4])\nvalues.append(-5)\nds.append(contentsOf: [2, 3.5])\nprint(values, ds)\n", "[1, 2, 3, 4, -5] [1.5, 2.0, 3.5]\n", null],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvar fl: [Float] = []\nfl.append(1)\nfl.append(2.5)\nprint(fl)\n", "[1.0, 2.5]\n", null],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nimport CoreGraphics\nvar cg: [CGFloat] = []\ncg.append(f)\nprint(cg)\n", "[2.5]\n", null],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nlet a = [Int](repeating: \"x\", count: 2)\n", null, "cannot convert value of type 'String' to expected argument type 'Int'"],
      ["var values = [1, 2]\nvar names = [\"a\"]\nvar ds: [Double] = [1.5]\nlet s = \"x\"\nlet n = 3\nlet f = 2.5\nvar u8: [UInt8] = []\nu8.append(7)\nprint(u8)\n", "[7]\n", null],
    ]) {
      const r = await run(src);
      if (err) expect(r.error && r.error.message).toBe(err);
      else { expect(r.error).toBeNull(); expect(r.stdout).toBe(out); }
    }
  });
});

describe('dead code is gone (finding 10)', () => {
  it('builtins and parser contain no disabled branches or duplicate case labels', () => {
    const b = fs.readFileSync(path.resolve('src/engine/builtins.js'), 'utf8');
    expect(b).not.toMatch(/case '\w+' \+ ''/);
    expect(b).not.toMatch(/'count' \+ 'Where'/);
    expect(b).not.toMatch(/&& false\)/);
    const p = fs.readFileSync(path.resolve('src/engine/parser.js'), 'utf8');
    expect(p).not.toMatch(/&& false\)/);
    expect(p).not.toMatch(/_savedNT/);
  });
  it('labeled arguments with keyword labels still parse', async () => {
    expect(await ok('func f(in x: Int, default y: Int) -> Int { x + y }\nprint(f(in: 1, default: 2))')).toBe('3\n');
  });
});
