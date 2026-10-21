// Keep JSON number spellings until the destination Swift type is known.
// JSON.parse alone would round Int values outside JavaScript's safe range.
export class JSONNumber {
  constructor(raw) { this.raw = raw; }
}

// Foundation's JSONDecoder refuses JSON nested more than 512 arrays or objects deep.
// Checked first, in one linear pass, so nothing recursive ever sees deeper input. The
// position follows swift-foundation's JSONScanner (checked against Swift 6.2): at the
// 513th container an object reports its '{', an array the character two past its '['
// (its line and column clamped to the last character, the index as is).
export const MAX_JSON_DEPTH = 512;
export class JSONDepthError extends Error {
  constructor(text, index) {
    // the line and column are clamped to the last character; the index is not
    const at = Math.min(index, text.length - 1), before = text.slice(0, at);
    const line = before.split('\n').length, column = at - before.lastIndexOf('\n');
    super(`Too many nested arrays or dictionaries around line ${line}, column ${column}.`);
    this.index = index;
  }
}
function checkDepth(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 34) { // a string: skip it, escapes included
      for (i++; i < text.length && text.charCodeAt(i) !== 34; i++) if (text.charCodeAt(i) === 92) i++;
    } else if (c === 91 || c === 123) {
      if (depth >= MAX_JSON_DEPTH) throw new JSONDepthError(text, c === 123 ? i : i + 2);
      depth++;
    } else if (c === 93 || c === 125) depth--;
  }
}

export function parseJSONNumbers(text) {
  checkDepth(text);
  // Let the browser validate the complete grammar and report syntax errors.
  JSON.parse(text);
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,]/g);
  let i = 0;
  function value() {
    const token = tokens[i++];
    if (token === '{') {
      const object = Object.create(null);
      while (tokens[i] !== '}') {
        const key = JSON.parse(tokens[i++]);
        i++; // colon
        const child = value();
        // Foundation's keyed container keeps the first duplicate JSON key.
        if (!Object.hasOwn(object, key)) object[key] = child;
        if (tokens[i] === ',') i++;
      }
      i++;
      return object;
    }
    if (token === '[') {
      const array = [];
      while (tokens[i] !== ']') {
        array.push(value());
        if (tokens[i] === ',') i++;
      }
      i++;
      return array;
    }
    if (/^-?\d/.test(token)) return new JSONNumber(token);
    return JSON.parse(token);
  }
  return value();
}

const INT_MAX = 9223372036854775807n;
const INT_MIN = -9223372036854775808n;
const UINT_MAX = 18446744073709551615n;
const DECIMAL_MAX = (1n << 128n) - 1n;

export function swiftIntFromJSON(raw) {
  if (/^-?\d+$/.test(raw)) {
    const value = BigInt(raw);
    return value >= INT_MIN && value <= INT_MAX ? value.toString() : null;
  }

  // Foundation 6.2 first checks that the Double conversion is representable,
  // then reparses large decimal/exponent forms to avoid rounding their digits.
  // https://github.com/swiftlang/swift-foundation/blob/swift-6.2-RELEASE/Sources/FoundationEssentials/JSON/JSONDecoder.swift
  const number = Number(raw);
  if (!Number.isInteger(number)) return null;
  const rounded = BigInt(number);
  if (rounded < INT_MIN || rounded > INT_MAX) return null;
  if (Math.abs(number) < 2 ** 53) return rounded.toString();

  const [, sign, whole, fraction = '', exponent = '0'] = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  // Decimal has a bounded 128-bit coefficient and an 8-bit exponent. Its
  // scanner discards digits after the coefficient fills, then compacts zeros.
  // Reproduce that bound before Decimal-to-Int's UInt64 coefficient check;
  // truncating an arbitrary-size fraction directly would accept invalid data.
  let coefficient = 0n;
  let scale = 0;
  let full = false;
  for (const digit of whole) {
    const next = coefficient * 10n + BigInt(digit);
    if (full || next > DECIMAL_MAX) {
      full = true;
      if (++scale > 127) return null;
    } else coefficient = next;
  }
  for (const digit of fraction) {
    if (full) continue;
    const next = coefficient * 10n + BigInt(digit);
    if (next > DECIMAL_MAX) full = true;
    else {
      coefficient = next;
      if (--scale < -128) return null;
    }
  }
  const power = Number(exponent);
  if (Math.abs(power) > 254) return null;
  scale += power;
  if (scale < -128 || scale > 127) return null;
  while (coefficient !== 0n && coefficient % 10n === 0n && scale < 127) {
    coefficient /= 10n;
    scale++;
  }
  if (coefficient > UINT_MAX) return null;
  // The Foundation 6.2 Decimal-to-Int slow path truncates fractional digits.
  const magnitude = scale >= 0 ? coefficient * 10n ** BigInt(scale) : coefficient / 10n ** BigInt(-scale);
  if (magnitude > INT_MAX) return null;
  return (sign === '-' ? -magnitude : magnitude).toString();
}
