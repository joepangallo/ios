// The JSON decoding lab: students edit JSON and watch what JSONDecoder does
// with it. The decoder below mirrors Swift 6.2's JSONDecoder for one small
// struct, including the exact DecodingError text Swift prints.

import { esc, highlightSwift, JSON_MAX_DEPTH, jsonDepthError } from './services-kit.js';

const SAMPLES = [
  { id: 'valid', label: 'Valid' },
  { id: 'missing', label: 'Missing key', text: '{\n  "title": "Swift Basics",\n  "isAvailable": true\n}' },
  { id: 'wrongtype', label: 'Wrong type', text: '{\n  "title": "Swift Basics",\n  "pageCount": "320",\n  "isAvailable": true\n}' },
  { id: 'null', label: 'null value', text: '{\n  "title": "Swift Basics",\n  "pageCount": null,\n  "isAvailable": true\n}' },
  { id: 'broken', label: 'Broken JSON', text: '{\n  "title": "Swift Basics",\n  "pageCount": 320,\n  "isAvailable": true\n' },
  { id: 'extra', label: 'Extra key (ignored)', text: '{\n  "title": "Swift Basics",\n  "pageCount": 320,\n  "isAvailable": true,\n  "language": "en",\n  "rating": 4.5\n}' },
  { id: 'snake', label: 'snake_case key', text: '{\n  "title": "Swift Basics",\n  "page_count": 320,\n  "isAvailable": true\n}' },
  { id: 'decimal', label: 'Decimal for Int (3.5)', text: '{\n  "title": "Swift Basics",\n  "pageCount": 3.5,\n  "isAvailable": true\n}' },
  { id: 'array', label: 'Array', text: '[\n  { "title": "Swift Basics", "pageCount": 320,\n    "isAvailable": true },\n  { "title": "Saving Data", "isAvailable": false }\n]' },
];

const LOC_MISSING = 'The data couldn’t be read because it is missing.';
const LOC_FORMAT = 'The data couldn’t be read because it isn’t in the correct format.';
const INT_MAX = 9223372036854775807n;
const INT_MIN = -9223372036854775808n;

// ---------------------------------------------------------------------------
// A strict JSON parser that reports errors the way Swift's JSON scanner does.
// Like Foundation it refuses more than 512 nested arrays and objects, with
// JSONDecoder's message and byte index; that also keeps this recursive parser
// far from the JavaScript stack limit.
function parseJSON(text) {
  const n = text.length;
  let i = 0;
  let depth = 0;
  const fail = (msg, idx) => { const e = new Error(msg); e.idx = idx; throw e; };
  const loc = (idx) => {
    let line = 1, last = -1;
    for (let k = 0; k <= idx && k < n; k++) if (text[k] === '\n') { line++; last = k; }
    return `around line ${line}, column ${idx - last}.`;
  };
  const eof = () => fail('Unexpected end of file', -1);
  const unexpected = (where) => {
    if (i >= n) eof();
    fail(`Unexpected character '${text[i]}'${where ? ' ' + where : ''} ${loc(i)}`, i);
  };
  const ws = () => { while (i < n && ' \t\n\r'.includes(text[i])) i++; };
  // Called with i on the opening bracket or brace.
  const enter = () => {
    if (depth >= JSON_MAX_DEPTH) { const deep = jsonDepthError(text, i); fail(deep.message, deep.index); }
    depth++;
    i++;
  };

  function value() {
    ws();
    if (i >= n) eof();
    const c = text[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return { t: 'string', v: string() };
    if (c === '-' || (c >= '0' && c <= '9')) return number();
    for (const [word, node] of [['true', { t: 'bool', v: true }], ['false', { t: 'bool', v: false }], ['null', { t: 'null' }]]) {
      if (text.startsWith(word, i)) { i += word.length; return node; }
      // The text ends partway through the word: only then is the (short) rest copied.
      if (n - i < word.length && word.startsWith(text.slice(i))) eof();
    }
    return unexpected('');
  }
  function object() {
    enter();
    const keys = [];
    const map = new Map();
    ws();
    if (text[i] === '}') { i++; depth--; return { t: 'object', keys, map }; }
    for (;;) {
      ws();
      if (i >= n) eof();
      if (text[i] !== '"') unexpected('');
      const k = string();
      ws();
      if (i >= n) eof();
      if (text[i] !== ':') unexpected('in object');
      i++;
      const v = value();
      if (!map.has(k)) keys.push(k);
      map.set(k, v);
      ws();
      if (i >= n) eof();
      if (text[i] === ',') {
        i++; ws();
        if (text[i] === '}') { i++; break; } // Swift's scanner accepts a trailing comma
        continue;
      }
      if (text[i] === '}') { i++; break; }
      unexpected('in object');
    }
    depth--;
    return { t: 'object', keys, map };
  }
  function array() {
    enter();
    const items = [];
    ws();
    if (text[i] === ']') { i++; depth--; return { t: 'array', items }; }
    for (;;) {
      items.push(value());
      ws();
      if (i >= n) eof();
      if (text[i] === ',') {
        i++; ws();
        if (text[i] === ']') { i++; break; }
        continue;
      }
      if (text[i] === ']') { i++; break; }
      unexpected('in array');
    }
    depth--;
    return { t: 'array', items };
  }
  function string() {
    i++;
    let out = '';
    for (;;) {
      if (i >= n) eof();
      const c = text[i];
      if (c === '"') { i++; return out; }
      if (c.charCodeAt(0) < 0x20) fail(`Unescaped control character '0x${c.charCodeAt(0).toString(16)}' ${loc(i)}`, i);
      if (c === '\\') {
        i++;
        if (i >= n) eof();
        const e = text[i];
        const simple = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (e in simple) { out += simple[e]; i++; continue; }
        if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) {
          out += String.fromCharCode(parseInt(text.slice(i + 1, i + 5), 16));
          i += 5;
          continue;
        }
        fail(`Invalid escape sequence ${loc(i)}`, i);
      }
      out += c;
      i++;
    }
  }
  function number() {
    const start = i;
    if (text[i] === '-') i++;
    if (i >= n) eof();
    if (text[i] === '0') {
      i++;
      if (i < n && text[i] >= '0' && text[i] <= '9') fail(`Number with leading zero ${loc(i)}`, i);
    } else if (text[i] >= '1' && text[i] <= '9') {
      while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    } else unexpected('');
    if (text[i] === '.') {
      i++;
      if (!(text[i] >= '0' && text[i] <= '9')) unexpected('');
      while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!(text[i] >= '0' && text[i] <= '9')) unexpected('');
      while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    }
    const raw = text.slice(start, i);
    return { t: 'number', raw, v: Number(raw) };
  }

  try {
    const v = value();
    ws();
    if (i < n) fail(`Unexpected character '${text[i]}' after top-level value ${loc(i)}`, i);
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, message: e.message, idx: e.idx };
  }
}

// ---------------------------------------------------------------------------
// The decoder for: struct Book: Codable { title: String; pageCount: Int(?); isAvailable: Bool }
const FOUND = { string: 'a string', number: 'number', bool: 'bool', object: 'a dictionary', array: 'an array', null: 'null' };

function pathText(parts) {
  return parts.map((p, k) => (p.startsWith('[') ? p : (k ? '.' + p : p))).join('');
}

function intFrom(node) {
  // Returns { ok, value } or { ok: false } when Swift cannot represent it as Int.
  if (/^-?\d+$/.test(node.raw)) {
    const big = BigInt(node.raw);
    if (big > INT_MAX || big < INT_MIN) return { ok: false };
    return { ok: true, value: big.toString() };
  }
  if (!Number.isInteger(node.v) || Math.abs(node.v) > 9.2e18) return { ok: false };
  return { ok: true, value: String(Object.is(node.v, -0) ? 0 : node.v) };
}

function corrupted(raw) {
  const msg = `Number ${raw} is not representable in Swift.`;
  return {
    kind: 'dataCorrupted', path: [],
    text: `DecodingError.dataCorrupted: Data was corrupted. Debug description: The given data was not valid JSON.. Underlying error: Error Domain=NSCocoaErrorDomain Code=3840 "${msg}" UserInfo={NSDebugDescription=${msg}}`,
    localized: LOC_FORMAT,
    hint: `Int holds whole numbers only. Send ${Math.trunc(Number(raw)) || 0}, or declare the property as Double.`,
  };
}

function mismatch(type, path, node, keyName) {
  const found = FOUND[node.t];
  const p = pathText(path);
  let hint = `"${keyName}" holds ${found === 'number' ? 'a number' : found === 'bool' ? 'a Boolean' : found} but the property is ${type}. Fix the JSON or change the property's type.`;
  if (type === 'Int' && node.t === 'string') hint = `Remove the quotes: 320 is a number, but "320" is a string.`;
  if (type === 'Bool' && node.t === 'null') hint = `"${keyName}" is null. A Bool property needs true or false; make it Bool? if null is allowed.`;
  return {
    kind: 'typeMismatch', path,
    text: `DecodingError.typeMismatch: expected value of type ${type}. ${p ? `Path: ${p}. ` : ''}Debug description: Expected to decode ${type} but found ${found} instead.`,
    localized: LOC_FORMAT, hint,
  };
}

function notFound(type, path, keyName) {
  const p = pathText(path);
  return {
    kind: 'valueNotFound', path,
    text: `DecodingError.valueNotFound: Expected value of type ${type} but found null instead. ${p ? `Path: ${p}. ` : ''}Debug description: Cannot get value of type ${type} -- found null value instead`,
    localized: LOC_MISSING,
    hint: `"${keyName}" is null. Make the property optional (${type}?) so null decodes as nil.`,
  };
}

function containerError(want, path, node) {
  const p = pathText(path);
  const keyed = want.startsWith('Dictionary');
  if (node.t === 'null') {
    return {
      kind: 'valueNotFound', path,
      text: `DecodingError.valueNotFound: Expected value of type ${want} but found null instead. ${p ? `Path: ${p}. ` : ''}Debug description: Cannot get ${keyed ? 'keyed' : 'unkeyed'} decoding container -- found null value instead`,
      localized: LOC_MISSING,
      hint: keyed ? 'Swift expected a JSON object { } here but found null.' : 'Swift expected a JSON array [ ] here but found null.',
    };
  }
  let hint = keyed ? 'Swift expected a JSON object { } here.' : 'Swift expected a JSON array [ ] here.';
  if (keyed && node.t === 'array' && !path.length) hint = 'The JSON is an array, but the code asks for one Book. Turn on "Decode an array" to ask for [Book].self.';
  if (!keyed && node.t === 'object') hint = 'The JSON is a single object, but the code asks for [Book].self. Turn off "Decode an array", or wrap the object in [ ].';
  return {
    kind: 'typeMismatch', path,
    text: `DecodingError.typeMismatch: expected value of type ${want}. ${p ? `Path: ${p}. ` : ''}Debug description: Expected to decode ${want} but found ${FOUND[node.t]} instead.`,
    localized: LOC_FORMAT, hint,
  };
}

function swiftString(s) {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20 || c === 0x7f) out += `\\u{${c.toString(16)}}`;
    else out += ch;
  }
  return out + '"';
}

function keysFor(opts) {
  return [
    { prop: 'title', type: 'String', key: 'title', optional: false },
    { prop: 'pageCount', type: 'Int', key: opts.codingKeys ? 'page_count' : 'pageCount', optional: opts.optional },
    { prop: 'isAvailable', type: 'Bool', key: 'isAvailable', optional: false },
  ];
}

function decodeBook(node, path, opts) {
  const fields = keysFor(opts);
  const values = {};
  for (const f of fields) {
    const v = node.map.get(f.key);
    const p = [...path, f.key];
    if (v === undefined) {
      if (f.optional) { values[f.prop] = null; continue; }
      const pp = pathText(path);
      let hint = `The JSON has no "${f.key}" key. Add it, make the property optional, or map another name with CodingKeys.`;
      if (f.prop === 'pageCount' && !opts.codingKeys && node.map.has('page_count')) hint = 'The JSON calls it "page_count". Turn on CodingKeys to map pageCount to that name.';
      if (f.prop === 'pageCount' && opts.codingKeys && node.map.has('pageCount')) hint = 'With CodingKeys, Swift looks only for "page_count"; the "pageCount" key is now ignored.';
      return {
        error: {
          kind: 'keyNotFound', path,
          text: `DecodingError.keyNotFound: Key '${f.key}' not found in keyed decoding container. ${pp ? `Path: ${pp}. ` : ''}Debug description: No value associated with key CodingKeys(stringValue: "${f.key}", intValue: nil) ("${f.key}").`,
          localized: LOC_MISSING, hint,
        },
      };
    }
    if (f.type === 'String') {
      if (v.t === 'string') { values[f.prop] = swiftString(v.v); continue; }
      if (v.t === 'null') return { error: notFound('String', p, f.key) };
      return { error: mismatch('String', p, v, f.key) };
    }
    if (f.type === 'Int') {
      if (v.t === 'null') {
        if (f.optional) { values[f.prop] = null; continue; }
        return { error: notFound('Int', p, f.key) };
      }
      if (v.t !== 'number') return { error: mismatch('Int', p, v, f.key) };
      const r = intFrom(v);
      if (!r.ok) return { error: corrupted(v.raw) };
      values[f.prop] = r.value;
      continue;
    }
    if (v.t === 'bool') { values[f.prop] = String(v.v); continue; }
    return { error: mismatch('Bool', p, v, f.key) };
  }
  const page = values.pageCount === null ? 'nil' : opts.optional ? `Optional(${values.pageCount})` : values.pageCount;
  return { text: `Book(title: ${values.title}, pageCount: ${page}, isAvailable: ${values.isAvailable})` };
}

function decode(text, opts) {
  const parsed = parseJSON(text);
  if (!parsed.ok) {
    const info = parsed.idx >= 0 ? `UserInfo={NSDebugDescription=${parsed.message}, NSJSONSerializationErrorIndex=${parsed.idx}}` : `UserInfo={NSDebugDescription=${parsed.message}}`;
    const where = parsed.message.match(/line (\d+), column (\d+)/);
    return {
      root: null,
      error: {
        kind: 'dataCorrupted', path: [],
        text: `DecodingError.dataCorrupted: Data was corrupted. Debug description: The given data was not valid JSON.. Underlying error: Error Domain=NSCocoaErrorDomain Code=3840 "${parsed.message}" ${info}`,
        localized: LOC_FORMAT,
        hint: parsed.message.startsWith('Unexpected end')
          ? 'The JSON stops early. Look for a missing closing brace }, bracket ], or quote.'
          : `This is not valid JSON${where ? ` near line ${where[1]}` : ''}. JSON needs double-quoted keys and strings, and commas between items.`,
      },
    };
  }
  const root = parsed.value;
  if (!opts.array) {
    if (root.t !== 'object') return { root, error: containerError('Dictionary<String, Any>', [], root) };
    const r = decodeBook(root, [], opts);
    return { root, focus: root, error: r.error, output: r.text };
  }
  if (root.t !== 'array') return { root, error: containerError('Array<Any>', [], root) };
  const parts = [];
  for (let k = 0; k < root.items.length; k++) {
    const item = root.items[k];
    if (item.t !== 'object') return { root, focusIndex: k, error: containerError('Dictionary<String, Any>', [`[${k}]`], item) };
    const r = decodeBook(item, [`[${k}]`], opts);
    if (r.error) return { root, focus: item, focusIndex: k, error: r.error };
    parts.push('Trailhead.' + r.text);
  }
  return { root, focus: root.items.find((x) => x.t === 'object') || null, focusIndex: 0, output: `[${parts.join(', ')}]` };
}

// ---------------------------------------------------------------------------
// Swift code shown on the right, rebuilt from the toggles.
function codeLines(opts) {
  const lines = [
    { t: 'struct Book: Codable {' },
    { t: '    var title: String' },
    { t: `    var pageCount: Int${opts.optional ? '?' : ''}`, mark: opts.optional },
    { t: '    var isAvailable: Bool' },
  ];
  if (opts.codingKeys) {
    lines.push(
      { t: '', mark: true },
      { t: '    enum CodingKeys: String, CodingKey {', mark: true },
      { t: '        case title, isAvailable', mark: true },
      { t: '        case pageCount = "page_count"', mark: true },
      { t: '    }', mark: true },
    );
  }
  lines.push({ t: '}' }, { t: '' });
  if (opts.array) {
    lines.push(
      { t: 'let books = try JSONDecoder()', mark: true, decode: true },
      { t: '    .decode([Book].self, from: data)', mark: true },
      { t: 'print(books)', mark: true },
    );
  } else {
    lines.push(
      { t: 'let book = try JSONDecoder()', decode: true },
      { t: '    .decode(Book.self, from: data)' },
      { t: 'print(book)' },
    );
  }
  return lines;
}

const highlight = (line) => highlightSwift(line, { prefix: '' });

function nodePreview(node) {
  if (node.t === 'string') return swiftString(node.v).length > 22 ? swiftString(node.v).slice(0, 20) + '…"' : swiftString(node.v);
  if (node.t === 'number') return node.raw;
  if (node.t === 'bool') return String(node.v);
  if (node.t === 'null') return 'null';
  return node.t === 'object' ? '{ … }' : '[ … ]';
}

// Status of each Swift property against one JSON object, independent of the
// first failure, so students see every problem at once.
function mapping(node, opts) {
  return keysFor(opts).map((f) => {
    const v = node.map.get(f.key);
    if (v === undefined) return { f, cls: f.optional ? 'ok' : 'bad', text: f.optional ? 'missing → nil' : 'missing' };
    if (v.t === 'null') {
      if (f.type === 'Int' && f.optional) return { f, cls: 'ok', text: 'null → nil' };
      return { f, cls: 'bad', text: 'null' };
    }
    const want = { String: 'string', Int: 'number', Bool: 'bool' }[f.type];
    if (v.t !== want) return { f, cls: 'bad', text: `wrong type: ${FOUND[v.t]}` };
    if (f.type === 'Int' && !intFrom(v).ok) return { f, cls: 'bad', text: `${v.raw} is not an Int` };
    return { f, cls: 'ok', text: nodePreview(v) };
  });
}

export default {
  name: 'data-json-lab',
  css: `
.w-data-json-lab { height: 100%; box-sizing: border-box; container-type: inline-size; overflow: hidden; font: 14px/1.45 var(--font-ui); color: var(--ink); }
.w-data-json-lab * { box-sizing: border-box; }
.w-data-json-lab .inner { height: 100%; display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 14px; padding: 14px; }
.w-data-json-lab .pane { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; }
.w-data-json-lab .lbl { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
.w-data-json-lab .lbl-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.w-data-json-lab .lbl-row .sub { font-size: 12px; color: var(--ink-3); }
.w-data-json-lab .samples { display: flex; flex-wrap: wrap; gap: 5px; }
.w-data-json-lab button { font: 600 12px var(--font-ui); color: var(--ink); background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 8px; cursor: pointer; }
.w-data-json-lab button:hover { background: var(--panel-3); }
.w-data-json-lab button[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-ink); }
.w-data-json-lab button:focus-visible, .w-data-json-lab textarea:focus-visible, .w-data-json-lab input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-data-json-lab textarea { flex: 1; min-height: 120px; resize: none; width: 100%; font: 12.5px/1.5 var(--font-code); color: var(--ink); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; tab-size: 2; }
.w-data-json-lab .map { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 10px; display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 3px 8px; }
.w-data-json-lab .map > .lbl, .w-data-json-lab .map > .ignored { grid-column: 1 / -1; }
.w-data-json-lab .map-row { display: contents; font-size: 12.5px; }
.w-data-json-lab .map-row code { font: 12px var(--font-code); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.w-data-json-lab .map-row .arrow { color: var(--ink-3); font-size: 12px; }
.w-data-json-lab .chip { justify-self: start; font: 600 11.5px var(--font-ui); border-radius: 999px; padding: 1px 8px; white-space: nowrap; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
.w-data-json-lab .chip.ok { background: var(--ok-soft); color: var(--ok); }
.w-data-json-lab .chip.bad { background: var(--bad-soft); color: var(--bad); }
.w-data-json-lab .ignored { font-size: 12px; color: var(--ink-3); margin-top: 2px; }
.w-data-json-lab .ignored code { font: 12px var(--font-code); color: var(--ink-2); }
.w-data-json-lab .toggles { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.w-data-json-lab .toggles label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.w-data-json-lab .toggles input { accent-color: var(--accent); width: 15px; height: 15px; margin: 0; }
.w-data-json-lab .toggles code { font: 12px var(--font-code); }
.w-data-json-lab pre.code { margin: 0; font: 12px/1.45 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 0; overflow: hidden; }
.w-data-json-lab pre.code .ln { display: flex; align-items: center; gap: 8px; padding: 0 12px 0 10px; border-left: 3px solid transparent; min-height: 17.4px; white-space: pre-wrap; }
.w-data-json-lab pre.code .ln.mark { border-left-color: var(--accent); background: var(--code-line); }
.w-data-json-lab pre.code .ln .txt { flex: 1; min-width: 0; }
.w-data-json-lab pre.code .tag { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .05em; border-radius: 4px; padding: 0 6px; }
.w-data-json-lab pre.code .tag.ok { background: var(--ok-soft); color: var(--ok); }
.w-data-json-lab pre.code .tag.bad { background: var(--bad-soft); color: var(--bad); }
.w-data-json-lab .kw { color: var(--kw); } .w-data-json-lab .str { color: var(--str); } .w-data-json-lab .type { color: var(--type); } .w-data-json-lab .fn { color: var(--fn); }
.w-data-json-lab .result { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.w-data-json-lab .result.ok { border-color: var(--ok); }
.w-data-json-lab .result.bad { border-color: var(--bad); }
.w-data-json-lab .status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font: 600 15px var(--font-display); }
.w-data-json-lab .status .badge { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .06em; border-radius: 999px; padding: 2px 9px; }
.w-data-json-lab .result.ok .badge { background: var(--ok-soft); color: var(--ok); }
.w-data-json-lab .result.bad .badge { background: var(--bad-soft); color: var(--bad); }
.w-data-json-lab .out { margin: 0; font: 12px/1.45 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 9px; white-space: pre-wrap; word-break: break-word; color: var(--ink); }
.w-data-json-lab .kv { font-size: 12.5px; color: var(--ink-2); }
.w-data-json-lab .kv code { font: 12px var(--font-code); color: var(--ink); }
.w-data-json-lab .hint { display: flex; gap: 6px; align-items: flex-start; font-size: 13px; color: var(--ink); background: var(--warn-soft); border-radius: var(--r-sm); padding: 6px 9px; }
.w-data-json-lab .hint svg { flex: none; color: var(--warn); margin-top: 1px; }
.w-data-json-lab .note { font-size: 12px; color: var(--ink-3); }
@container (max-width: 700px) {
  .w-data-json-lab .inner { display: flex; flex-direction: column; overflow: auto; height: 100%; padding: 12px; gap: 8px; }
  .w-data-json-lab .pane { display: contents; }
  .w-data-json-lab .lbl-row { order: 1; }
  .w-data-json-lab .samples { order: 2; }
  .w-data-json-lab textarea { order: 3; }
  .w-data-json-lab .toggles { order: 4; }
  .w-data-json-lab .result { order: 5; }
  .w-data-json-lab pre.code { order: 6; }
  .w-data-json-lab .map { order: 7; }
  .w-data-json-lab textarea { flex: none; height: 170px; }
  .w-data-json-lab .result { flex: none; overflow: visible; }
}
`,
  mount(el, props, ctx) {
    el.classList.add('w-data-json-lab');
    const opts = { optional: false, codingKeys: false, array: false };
    el.innerHTML = `
      <div class="inner">
        <div class="pane">
          <div class="lbl-row"><span class="lbl">JSON from the server</span><span class="sub">Edit it freely</span></div>
          <div class="samples" role="group" aria-label="Load a sample">
            ${SAMPLES.map((s) => `<button type="button" id="data-json-lab-sample-${s.id}" data-sample="${s.id}" aria-pressed="false">${esc(s.label)}</button>`).join('')}
          </div>
          <textarea id="data-json-lab-input" aria-label="JSON text to decode" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
          <div class="map" id="data-json-lab-map" aria-label="How each Swift property finds its JSON key"></div>
        </div>
        <div class="pane">
          <div class="toggles" role="group" aria-label="Change the Swift struct">
            <label for="data-json-lab-opt-optional"><input type="checkbox" id="data-json-lab-opt-optional"> Make pageCount optional: <code>Int?</code></label>
            <label for="data-json-lab-opt-codingkeys"><input type="checkbox" id="data-json-lab-opt-codingkeys"> Add CodingKeys: <code>pageCount = "page_count"</code></label>
            <label for="data-json-lab-opt-array"><input type="checkbox" id="data-json-lab-opt-array"> Decode an array: <code>[Book].self</code></label>
          </div>
          <pre class="code" id="data-json-lab-code" aria-label="Swift code being run"></pre>
          <div class="result" id="data-json-lab-result" aria-live="polite"></div>
        </div>
      </div>`;

    const input = el.querySelector('#data-json-lab-input');
    const codeEl = el.querySelector('#data-json-lab-code');
    const resultEl = el.querySelector('#data-json-lab-result');
    const mapEl = el.querySelector('#data-json-lab-map');
    const sampleBtns = [...el.querySelectorAll('[data-sample]')];
    let timer = null;

    const validText = () => {
      const k = opts.codingKeys ? 'page_count' : 'pageCount';
      if (opts.array) return `[\n  { "title": "Swift Basics", "${k}": 320,\n    "isAvailable": true },\n  { "title": "Saving Data", "${k}": 288,\n    "isAvailable": false }\n]`;
      return `{\n  "title": "Swift Basics",\n  "${k}": 320,\n  "isAvailable": true\n}`;
    };

    function render() {
      const r = decode(input.value, opts);
      const lines = codeLines(opts);
      codeEl.innerHTML = lines.map((l) => {
        const tag = l.decode ? (r.error ? '<span class="tag bad">throws</span>' : '<span class="tag ok">returns</span>') : '';
        return `<div class="ln${l.mark ? ' mark' : ''}"><span class="txt">${highlight(l.t) || ' '}</span>${tag}</div>`;
      }).join('');

      // Mapping strip: which JSON key each property reads, and what it found.
      const focus = r.focus && r.focus.t === 'object' ? r.focus : null;
      let mapHtml = `<div class="lbl">Swift property ← JSON key${opts.array && focus ? ` (element [${r.focusIndex ?? 0}])` : ''}</div>`;
      if (focus) {
        mapHtml += mapping(focus, opts).map((m) => `<div class="map-row"><code>${m.f.prop}</code><span class="arrow">←</span><code>"${m.f.key}"</code><span class="chip ${m.cls}">${esc(m.text)}</span></div>`).join('');
        const used = new Set(keysFor(opts).map((f) => f.key));
        const extra = focus.keys.filter((k) => !used.has(k));
        mapHtml += `<div class="ignored">${extra.length ? `Ignored keys (no matching property): ${extra.map((k) => `<code>"${esc(k)}"</code>`).join(', ')}` : 'No extra keys. Unknown keys would simply be ignored.'}</div>`;
      } else {
        mapHtml += `<div class="ignored">${r.root ? 'The top level is not the shape the code asks for, so no keys are read.' : 'Not valid JSON yet, so no keys can be matched.'}</div>`;
      }
      mapEl.innerHTML = mapHtml;

      const call = opts.array ? 'print(books)' : 'print(book)';
      if (!r.error) {
        resultEl.className = 'result ok';
        resultEl.innerHTML = `
          <div class="status"><span class="badge">Decoded</span><span>decode returned ${opts.array ? `[Book] with ${r.root.items.length} element${r.root.items.length === 1 ? '' : 's'}` : 'a Book'}</span></div>
          <div class="kv"><code>${call}</code> shows:</div>
          <pre class="out" id="data-json-lab-output">${esc(r.output)}</pre>
          ${opts.array ? '<div class="note">Inside an array, Swift prints each struct with its module name; this app module is called Trailhead.</div>' : ''}
          ${opts.optional ? '<div class="note">An optional property prints as Optional(value), or nil when the key was missing or null.</div>' : ''}`;
      } else {
        const e = r.error;
        resultEl.className = 'result bad';
        resultEl.innerHTML = `
          <div class="status"><span class="badge">Threw</span><span>DecodingError.${e.kind}</span></div>
          <div class="kv"><code>print(error)</code> shows:</div>
          <pre class="out" id="data-json-lab-output">${esc(e.text)}</pre>
          <div class="kv"><code>error.localizedDescription</code>: “${esc(e.localized)}”</div>
          <div class="hint">${ctx.icon('info.circle', 16)}<span>${esc(e.hint)}</span></div>`;
      }
    }

    function load(id) {
      const s = SAMPLES.find((x) => x.id === id);
      input.value = s.text ?? validText();
      sampleBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sample === id)));
      render();
    }

    const onSample = (e) => {
      const b = e.target.closest('[data-sample]');
      if (b) load(b.dataset.sample);
    };
    const onInput = () => {
      sampleBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      clearTimeout(timer);
      timer = setTimeout(render, 250);
    };
    const onToggle = (e) => {
      const map = { 'data-json-lab-opt-optional': 'optional', 'data-json-lab-opt-codingkeys': 'codingKeys', 'data-json-lab-opt-array': 'array' };
      const k = map[e.target.id];
      if (!k) return;
      opts[k] = e.target.checked;
      render();
    };
    const samplesEl = el.querySelector('.samples');
    const togglesEl = el.querySelector('.toggles');
    samplesEl.addEventListener('click', onSample);
    input.addEventListener('input', onInput);
    togglesEl.addEventListener('change', onToggle);

    load('valid');

    return {
      destroy() {
        clearTimeout(timer);
        samplesEl.removeEventListener('click', onSample);
        input.removeEventListener('input', onInput);
        togglesEl.removeEventListener('change', onToggle);
        el.innerHTML = '';
        el.classList.remove('w-data-json-lab');
      },
    };
  },
};
