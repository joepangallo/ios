import { describe, it, expect } from 'vitest';
import { run } from '../../src/engine/index.js';
import { equals, compare } from '../../src/engine/values.js';

async function expectOutput(source, stdout) {
  const result = await run(source);
  expect(result.error).toBeNull();
  expect(result.stdout).toBe(stdout);
}

describe('review: inout argument validation', () => {
  it('rejects a missing ampersand before an inout body executes', async () => {
    const result = await run(`func update(_ value: inout Int) { value = 7 }
var value = 1
update(value)
print(value)`);
    expect(result.error?.kind).toBe('compile');
    expect(result.error?.message).toContain("requires explicit '&'");
    expect(result.stdout).toBe('');
  });

  it('does not allow an omitted ampersand to mutate a let struct', async () => {
    const result = await run(`struct Point { var x = 1 }
func update(_ point: inout Point) { point.x = 7 }
let point = Point()
update(point)
print(point.x)`);
    expect(result.error?.kind).toBe('compile');
    expect(result.error?.message).toContain("requires explicit '&'");
    expect(result.stdout).toBe('');
  });

  it('rejects explicit references to immutable values', async () => {
    const result = await run(`func update(_ value: inout Int) { value = 7 }
let value = 1
update(&value)`);
    expect(result.error?.kind).toBe('compile');
    expect(result.error?.message).toContain("'let' constant");
  });

  it('rejects an ampersand for an ordinary value parameter', async () => {
    const result = await run(`func consume(_ value: Int) { print(value) }
var value = 1
consume(&value)`);
    expect(result.error?.kind).toBe('compile');
    expect(result.error?.message).toBe("'&' used with non-inout argument of type 'Int'");
  });

  it('writes valid inout scalars and structs back without changing earlier copies', async () => {
    await expectOutput(`struct Point { var x = 1 }
func update(_ point: inout Point, _ count: inout Int) {
    point.x = 7
    count += 1
}
var point = Point()
let original = point
var count = 0
update(&point, &count)
print(point.x, original.x, count)`, '7 1 1\n');
  });

  it('writes valid inout values back when the body throws', async () => {
    await expectOutput(`enum Failure: Error { case expected }
func update(_ value: inout Int) throws { value = 7; throw Failure.expected }
var value = 1
do { try update(&value) } catch {}
print(value)`, '7\n');
  });
});

describe('review: ARC without an explicit destructor', () => {
  it('clears weak captures when the last strong reference is removed', async () => {
    await expectOutput(`class Model {}
var model: Model? = Model()
let inspect = { [weak model] in print(model == nil) }
inspect()
model = nil
inspect()`, 'false\ntrue\n');
  });

  it('keeps a weak capture valid while another strong owner exists', async () => {
    await expectOutput(`class Model {}
var model: Model? = Model()
var other = model
let inspect = { [weak model] in print(model == nil) }
model = nil
inspect()
other = nil
inspect()`, 'false\ntrue\n');
  });

  it('clears weak properties on classes without deinit', async () => {
    await expectOutput(`class Model {}
class Owner { weak var model: Model? }
var model: Model? = Model()
let owner = Owner()
owner.model = model
model = nil
print(owner.model == nil)`, 'true\n');
  });
});

describe('review: releasing objects retained by closures', () => {
  const make = `class Model { deinit { print("freed") } }
func make() -> () -> Void {
    let model = Model()
    return { print(model) }
}`;

  it('releases the last closure capture when an optional closure is cleared', async () => {
    await expectOutput(`${make}
var callback: (() -> Void)? = make()
callback = nil
print("end")`, 'freed\nend\n');
  });

  it('keeps captures alive until all closure owners release them', async () => {
    await expectOutput(`${make}
var first: (() -> Void)? = make()
var second = first
first = nil
print("alive")
second = nil
print("end")`, 'alive\nfreed\nend\n');
  });

  it('traverses closures contained in discarded arrays', async () => {
    await expectOutput(`${make}
var callbacks = [make()]
callbacks = []
print("end")`, 'freed\nend\n');
  });

  it('releases bound methods that retained their receiver', async () => {
    await expectOutput(`class Model {
    func action() {}
    deinit { print("freed") }
}
func make() -> () -> Void { let model = Model(); return model.action }
var callback: (() -> Void)? = make()
callback = nil
print("end")`, 'freed\nend\n');
  });

  it('preserves strong closure cycles and releases weak closure captures', async () => {
    for (const [capture, expected] of [['model', 'end\n'], ['weak model', 'freed\nend\n']]) {
      await expectOutput(`class Model {
    var callback: (() -> Void)?
    deinit { print("freed") }
}
var model: Model? = Model()
model!.callback = { [${capture}] in print(model != nil) }
model = nil
print("end")`, expected);
    }
  });
});

describe('review: exact integer comparison', () => {
  it('distinguishes adjacent large and negative Int values', async () => {
    await expectOutput(`let lower = 9007199254740992
let upper = 9007199254740993
print(lower == upper, lower < upper, upper > lower)
print(-lower == -upper, -upper < -lower)
print(Int.max == Int.max - 1, Int.max > Int.max - 1)`, 'false true true\nfalse true\nfalse true\n');
  });

  it('sorts and searches integers across both numeric representations', async () => {
    await expectOutput(`let values = [9007199254740993, 1, 9007199254740992, -9007199254740993, -9007199254740992]
print(values.sorted())
print([9007199254740992].contains(9007199254740993))`, '[-9007199254740993, -9007199254740992, 1, 9007199254740992, 9007199254740993]\nfalse\n');
  });

  it('compares equivalent Number and BigInt integer representations exactly', () => {
    expect(equals(1, 1n)).toBe(true);
    expect(compare(1, 1n)).toBe(0);
    expect(equals(9007199254740992, 9007199254740993n)).toBe(false);
    expect(compare(9007199254740992, 9007199254740993n)).toBe(-1);
    expect(compare(9007199254740993n, 9007199254740992)).toBe(1);
  });
});
