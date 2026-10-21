// JSON decoder lab: edit real JSON and a Codable model side by side; the lab
// decodes it with the same rules as Foundation's JSONDecoder and reports the
// decoded value or the exact DecodingError case, coding path and message.
// Every rule and message below was checked against Swift 6.2 on macOS 26.

import { JSONNumber, parseJSONNumbers, swiftIntFromJSON } from '../shared/json-numbers.js';
import { esc, el, on, idScope, highlightSwift, JSON_MAX_DEPTH, jsonDepthError } from './services-kit.js';

const NAME = 'networking-json-decoder';
const BASE_TYPES = ['String', 'Int', 'Double', 'Bool'];
// A document up to this size decodes on every keystroke; a larger one waits
// until typing pauses for DECODE_DELAY_MS, so a pasted megabyte of JSON is
// parsed once per pause instead of once per key.
const LARGE_TEXT = 20000;
const DECODE_DELAY_MS = 150;

const TODO_FIELDS = [
  { name: 'userId', type: 'Int' }, { name: 'id', type: 'Int' },
  { name: 'title', type: 'String' }, { name: 'completed', type: 'Bool' },
];
const PRESETS = {
  todo: {
    label: 'To-do', url: 'https://jsonplaceholder.typicode.com/todos/1', root: 'Todo', decodeAs: 'single',
    structs: { Todo: TODO_FIELDS },
    sample: { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
  },
  todos: {
    label: 'To-do list', url: 'https://jsonplaceholder.typicode.com/todos?_limit=3', root: 'Todo', decodeAs: 'array',
    structs: { Todo: TODO_FIELDS },
    sample: [
      { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
      { userId: 1, id: 2, title: 'quis ut nam facilis et officia qui', completed: false },
      { userId: 1, id: 3, title: 'fugiat veniam minus', completed: false },
    ],
  },
  user: {
    label: 'User', url: 'https://jsonplaceholder.typicode.com/users/1', root: 'User', decodeAs: 'single',
    structs: {
      User: [{ name: 'id', type: 'Int' }, { name: 'name', type: 'String' }, { name: 'email', type: 'String' }, { name: 'address', type: 'Address' }],
      Address: [{ name: 'street', type: 'String' }, { name: 'city', type: 'String' }, { name: 'zipcode', type: 'String' }],
    },
    sample: {
      id: 1, name: 'Leanne Graham', username: 'Bret', email: 'Sincere@april.biz',
      address: { street: 'Kulas Light', suite: 'Apt. 556', city: 'Gwenborough', zipcode: '92998-3874', geo: { lat: '-37.3159', lng: '81.1496' } },
      phone: '1-770-736-8031 x56442', website: 'hildegard.org',
    },
  },
  weather: {
    label: 'Weather', url: 'https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,wind_speed_10m',
    root: 'Forecast', decodeAs: 'single',
    structs: {
      Forecast: [{ name: 'latitude', type: 'Double' }, { name: 'current', type: 'Current' }],
      Current: [{ name: 'time', type: 'String' }, { name: 'temperature', type: 'Double', key: 'temperature_2m' }, { name: 'windSpeed', type: 'Double', key: 'wind_speed_10m' }],
    },
    sample: {
      latitude: 35.7, longitude: 139.6875, generationtime_ms: 0.03, utc_offset_seconds: 0, timezone: 'GMT',
      current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: '°C', wind_speed_10m: 'km/h' },
      current: { time: '2026-10-20T14:15', interval: 900, temperature_2m: 18.4, wind_speed_10m: 9.7 },
    },
  },
};

// Foundation's convertFromSnakeCase in one linear pass (no backtracking regex), the
// same algorithm as the engine's src/engine/foundation.js: leading and trailing
// underscores are kept; the rest splits on runs of underscores; a single word is left
// as it is (it may already be camelCase); otherwise the first word is lowercased
// and each later word capitalized like NSString.capitalized ("user_ID" -> "userId").
// An underscore followed by a combining mark is part of one character, not a separator.
const EXTEND = /[\p{M}\u200D\uFE00-\uFE0F\u{1F3FB}-\u{1F3FF}]/u;
const LU = /\p{Lu}/u, LL = /\p{Ll}/u, LT = /\p{Lt}/u;
// Unicode 4 case-ignorable characters, which capitalization skips over.
const CASE_IGNORABLE = /[\p{Mn}\p{Me}\p{Cf}\p{Lm}\p{Sk}'\u00AD\u2019]/u;
// Titlecase where it differs from toUpperCase(): SpecialCasing titles and digraphs.
const TITLE = new Map([
  ['\u00DF', 'Ss'], ['\uFB00', 'Ff'], ['\uFB01', 'Fi'], ['\uFB02', 'Fl'], ['\uFB03', 'Ffi'], ['\uFB04', 'Ffl'], ['\uFB05', 'St'], ['\uFB06', 'St'],
  ['\u0587', '\u0535\u0582'], ['\uFB13', '\u0544\u0576'], ['\uFB14', '\u0544\u0565'], ['\uFB15', '\u0544\u056B'], ['\uFB16', '\u054E\u0576'], ['\uFB17', '\u0544\u056D'],
  ['\u01C6', '\u01C5'], ['\u01C9', '\u01C8'], ['\u01CC', '\u01CB'], ['\u01F3', '\u01F2'],
  ['\u1FB3', '\u1FBC'], ['\u1FC3', '\u1FCC'], ['\u1FF3', '\u1FFC'],
  ['\u1FB2', '\u1FBA\u0345'], ['\u1FB4', '\u0386\u0345'], ['\u1FB7', '\u0391\u0342\u0345'], ['\u1FC2', '\u1FCA\u0345'], ['\u1FC4', '\u0389\u0345'],
  ['\u1FC7', '\u0397\u0342\u0345'], ['\u1FF2', '\u1FFA\u0345'], ['\u1FF4', '\u038F\u0345'], ['\u1FF7', '\u03A9\u0342\u0345'],
]);
for (const base of [0x1F80, 0x1F90, 0x1FA0]) for (let i = 0; i < 8; i++) TITLE.set(String.fromCharCode(base + i), String.fromCharCode(base + 8 + i));
function lowerScalars(s) {
  let out = '';
  for (const ch of s) out += ch.toLowerCase(); // per scalar: no final-sigma context
  return out;
}
function capitalizeWord(w) {
  let out = '', cased = false;
  for (const ch of w) {
    const lu = LU.test(ch), ll = !lu && LL.test(ch), lt = !lu && !ll && LT.test(ch);
    if (cased) out += lu || lt ? ch.toLowerCase() : ch;
    else out += ll ? (TITLE.get(ch) ?? ch.toUpperCase()) : ch;
    if (!CASE_IGNORABLE.test(ch)) cased = lu || ll || lt;
  }
  return out;
}
function convertFromSnakeCase(key) {
  const n = key.length;
  const sep = (i) => key.charCodeAt(i) === 95 && !(i + 1 < n && key.charCodeAt(i + 1) >= 0x300 && EXTEND.test(String.fromCodePoint(key.codePointAt(i + 1))));
  let start = 0;
  while (start < n && sep(start)) start++;
  if (start === n) return key;
  let end = n;
  while (end > start && sep(end - 1)) end--;
  const words = [];
  for (let i = start; i < end;) {
    let j = i;
    while (j < end && !sep(j)) j++;
    words.push(key.slice(i, j));
    while (j < end && sep(j)) j++;
    i = j;
  }
  if (words.length === 1) return key;
  let out = key.slice(0, start) + lowerScalars(words[0]);
  for (let w = 1; w < words.length; w++) out += capitalizeWord(words[w]);
  return out + key.slice(end);
}

class DecodeError extends Error {
  constructor(info) { super(info.debug); Object.assign(this, info); }
}

const kindOf = (v) => (v === null ? 'null' : v instanceof JSONNumber ? 'number' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'dictionary' : typeof v === 'string' ? 'string' : 'bool');
const PHRASE = { string: 'a string', number: 'number', bool: 'bool', dictionary: 'a dictionary', array: 'an array', null: 'null' };
const DICT = 'Dictionary<String, Any>';

function decodeJSON(model, value, opts) {
  const structs = model.structs;
  const decodeValue = (type, optional, v, path) => {
    if (v === null) {
      if (optional) return { nil: true };
      if (type === 'Bool') throw new DecodeError({ kind: 'typeMismatch', type: 'Bool', path, debug: 'Expected to decode Bool but found null instead.' });
      if (BASE_TYPES.includes(type)) throw new DecodeError({ kind: 'valueNotFound', type, path, debug: `Cannot get value of type ${type} -- found null value instead` });
      throw new DecodeError({ kind: 'valueNotFound', type: DICT, path, debug: 'Cannot get keyed decoding container -- found null value instead' });
    }
    const k = kindOf(v);
    const mismatch = (t) => new DecodeError({ kind: 'typeMismatch', type: t, path, found: k, debug: `Expected to decode ${t} but found ${PHRASE[k]} instead.` });
    const unrepresentable = (type) => new DecodeError({ kind: 'dataCorrupted', path: [], number: v.raw, numberType: type,
      debug: 'The given data was not valid JSON.', underlying: `Number ${v.raw} is not representable in Swift.` });
    const wrap = (x) => (optional ? { some: x } : x);
    switch (type) {
      case 'String': if (k !== 'string') throw mismatch('String'); return wrap({ str: v });
      case 'Bool': if (k !== 'bool') throw mismatch('Bool'); return wrap({ raw: String(v) });
      case 'Double': {
        if (k !== 'number') throw mismatch('Double');
        const number = Number(v.raw);
        if (!Number.isFinite(number) || (number === 0 && /[1-9]/.test(v.raw.split(/[eE]/)[0]))) throw unrepresentable('Double');
        return wrap({ raw: Object.is(number, -0) ? '-0.0' : Number.isInteger(number) && Math.abs(number) < 1e16 ? `${number}.0` : String(number) });
      }
      case 'Int': {
        if (k !== 'number') throw mismatch('Int');
        const integer = swiftIntFromJSON(v.raw);
        if (integer === null) throw unrepresentable('Int');
        return wrap({ raw: integer });
      }
      default: {
        if (k !== 'dictionary') throw mismatch(DICT);
        return wrap(decodeStruct(type, v, path));
      }
    }
  };
  const decodeStruct = (name, obj, path) => {
    const fields = [];
    // each JSON key converted once; the first one that converts to a coding key wins
    let converted = null;
    if (opts.snake) {
      converted = new Map();
      for (const k of Object.keys(obj)) { const c = convertFromSnakeCase(k); if (!converted.has(c)) converted.set(c, k); }
    }
    for (const prop of structs[name] || []) {
      const codingKey = (prop.key || '').trim() || prop.name;
      let jsonKey = null;
      if (converted) jsonKey = converted.get(codingKey) ?? null;
      else if (Object.prototype.hasOwnProperty.call(obj, codingKey)) jsonKey = codingKey;
      if (jsonKey === null) {
        if (prop.optional) { fields.push([prop.name, { nil: true }]); continue; }
        throw new DecodeError({ kind: 'keyNotFound', key: codingKey, prop: prop.name, propType: prop.type, path,
          debug: `No value associated with key CodingKeys(stringValue: "${codingKey}", intValue: nil) ("${codingKey}").` });
      }
      fields.push([prop.name, decodeValue(prop.type, !!prop.optional, obj[jsonKey], path.concat(codingKey))]);
    }
    return { struct: name, fields };
  };
  if (opts.decodeAs === 'array') {
    if (kindOf(value) !== 'array') {
      if (value === null) throw new DecodeError({ kind: 'valueNotFound', type: 'Array<Any>', path: [], debug: 'Cannot get unkeyed decoding container -- found null value instead' });
      throw new DecodeError({ kind: 'typeMismatch', type: 'Array<Any>', path: [], found: kindOf(value), debug: `Expected to decode Array<Any> but found ${PHRASE[kindOf(value)]} instead.` });
    }
    return { array: value.map((v, i) => decodeValue(model.root, false, v, [`Index ${i}`])) };
  }
  return decodeValue(model.root, false, value, []);
}

// How print() shows a decoded value. With a `limit`, building stops as soon
// as the text is longer than that, so a 50,000-element array costs no more
// than the part that is shown; the result is then a prefix of the full text.
function swiftDescription(v, limit = Infinity) {
  let out = '';
  const STOP = {};
  const put = (text) => { out += text; if (out.length > limit) throw STOP; };
  const walk = (x) => {
    if (x.nil) return put('nil');
    if ('some' in x) { put('Optional('); walk(x.some); return put(')'); }
    // Only the first limit + 1 characters of a long string can ever be shown.
    if ('str' in x) return put(JSON.stringify(x.str.length > limit ? x.str.slice(0, limit + 1) : x.str));
    if ('raw' in x) return put(x.raw);
    if (x.array) {
      put('[');
      x.array.forEach((item, i) => { if (i) put(', '); walk(item); });
      return put(']');
    }
    put(`${x.struct}(`);
    x.fields.forEach(([k, f], i) => { put(`${i ? ', ' : ''}${k}: `); walk(f); });
    return put(')');
  };
  try { walk(v); } catch (e) { if (e !== STOP) throw e; }
  return out;
}

// JSONDecoder tolerates trailing commas; the browser's JSON.parse does not.
function stripTrailingCommas(text) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { out += c; if (c === '\\') { out += text[++i] ?? ''; } else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += c;
  }
  return out;
}

// Foundation's JSON scanner refuses more than 512 nested arrays and objects.
// The number-preserving parser recurses once per level, so deeper input is
// stopped here, with JSONDecoder's message, before it can overflow the stack.
function nestingError(text) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '[' || c === '{') {
      if (++depth > JSON_MAX_DEPTH) return jsonDepthError(text, i).message;
    } else if ((c === ']' || c === '}') && depth > 0) depth--;
  }
  return null;
}

function parseJSON(text) {
  const tooDeep = nestingError(text);
  if (tooDeep) return { ok: false, detail: tooDeep };
  try { return { ok: true, value: parseJSONNumbers(text) }; } catch (e1) {
    try { return { ok: true, value: parseJSONNumbers(stripTrailingCommas(text)) }; } catch { return { ok: false, detail: text.trim() ? e1.message : 'Unexpected end of file' }; }
  }
}

function swiftModelCode(model, opts) {
  const names = [model.root, ...Object.keys(model.structs).filter((n) => n !== model.root)];
  const out = [];
  for (const sName of names) {
    const props = model.structs[sName];
    out.push(`struct ${sName}: Decodable {`);
    for (const p of props) out.push(`    let ${p.name || '_'}: ${p.type}${p.optional ? '?' : ''}`);
    if (props.some((p) => (p.key || '').trim() && p.key.trim() !== p.name)) {
      out.push('');
      out.push('    enum CodingKeys: String, CodingKey {');
      for (const p of props) out.push((p.key || '').trim() && p.key.trim() !== p.name ? `        case ${p.name} = ${JSON.stringify(p.key.trim())}` : `        case ${p.name}`);
      out.push('    }');
    }
    out.push('}');
    out.push('');
  }
  out.push('let decoder = JSONDecoder()');
  if (opts.snake) out.push('decoder.keyDecodingStrategy = .convertFromSnakeCase');
  out.push(`let value = try decoder.decode(${opts.decodeAs === 'array' ? `[${model.root}]` : model.root}.self,`);
  out.push('                               from: data)');
  return out.join('\n');
}

const highlight = (code) => highlightSwift(code, { prefix: 't-' });

const clonePreset = (p) => ({ root: p.root, structs: Object.fromEntries(Object.entries(p.structs).map(([k, v]) => [k, v.map((f) => ({ optional: false, key: '', ...f }))])) });

export default {
  name: 'networking-json-decoder',
  // Pure decoding logic, exposed for verification against the real JSONDecoder.
  internals: { convertFromSnakeCase, decodeJSON, swiftDescription, swiftModelCode, parseJSON },
  css: `
.w-${NAME} { container-type: size; container-name: njd; height: 100%; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .njd { box-sizing: border-box; height: 100%; padding: 12px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr); grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px 14px; }
.w-${NAME} .njd-bar { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.w-${NAME} .njd-seg { display: inline-flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .njd-seg button { border: 0; background: transparent; color: var(--ink-2); font: 600 12.5px/1 var(--font-ui); padding: 7px 11px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .njd-seg button[aria-checked="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} .njd-btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 600 12.5px var(--font-ui); padding: 6px 11px; border-radius: var(--r-sm); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.w-${NAME} .njd-btn:disabled { opacity: .6; }
.w-${NAME} .njd-source { font-size: 12px; color: var(--ink-3); }
.w-${NAME} .njd-tag { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; padding: 2px 6px; border-radius: 4px; background: var(--warn-soft); color: var(--warn); margin-right: 4px; }
.w-${NAME} button:focus-visible, .w-${NAME} input:focus-visible, .w-${NAME} select:focus-visible, .w-${NAME} textarea:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.w-${NAME} .njd-col { display: flex; flex-direction: column; gap: 6px; min-height: 0; min-width: 0; }
.w-${NAME} .njd-label { font: 700 11px/1.2 var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); margin: 0; }
.w-${NAME} textarea { flex: 1; min-height: 0; resize: none; box-sizing: border-box; width: 100%; font: 12.5px/1.5 var(--font-code); color: var(--ink); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 10px; tab-size: 2; }
.w-${NAME} .njd-opts { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12.5px; color: var(--ink-2); align-items: center; }
.w-${NAME} .njd-opts label { display: inline-flex; gap: 6px; align-items: center; }
.w-${NAME} select, .w-${NAME} input[type="text"] { font: 12.5px var(--font-code); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 6px; min-width: 0; box-sizing: border-box; }
.w-${NAME} .njd-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); }
.w-${NAME} .njd-tab { border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--ink-2); font: 600 12.5px var(--font-ui); padding: 6px 10px; cursor: pointer; }
.w-${NAME} .njd-tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }
.w-${NAME} .njd-panel { flex: 1; min-height: 0; overflow: auto; }
.w-${NAME} .njd-panel[hidden] { display: none; }
.w-${NAME} .njd-struct { margin-bottom: 8px; }
.w-${NAME} .njd-shead { display: flex; justify-content: space-between; align-items: center; font: 600 12.5px var(--font-code); color: var(--ink-2); margin: 2px 0 4px; }
.w-${NAME} .njd-shead b { color: var(--type); }
.w-${NAME} .njd-rowh, .w-${NAME} .njd-prow { display: grid; grid-template-columns: minmax(0, 1fr) 96px 34px minmax(0, 1fr) 26px; gap: 4px; align-items: center; }
.w-${NAME} .njd-rowh { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); padding: 0 2px 2px; }
.w-${NAME} .njd-prow { margin-bottom: 3px; }
.w-${NAME} .njd-opt { display: grid; place-items: center; }
.w-${NAME} .njd-opt input { width: 16px; height: 16px; accent-color: var(--accent); margin: 0; }
.w-${NAME} .njd-x { border: 1px solid var(--line); background: var(--panel); color: var(--ink-3); border-radius: var(--r-sm); height: 26px; cursor: pointer; display: grid; place-items: center; padding: 0; }
.w-${NAME} .njd-x:hover { color: var(--bad); }
.w-${NAME} .njd-add { border: 0; background: transparent; color: var(--link); font: 600 12px var(--font-ui); cursor: pointer; padding: 2px 4px; }
.w-${NAME} pre { margin: 0; font: 12.5px/1.5 var(--font-code); white-space: pre; padding: 8px 10px; background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); min-height: 100%; box-sizing: border-box; }
.w-${NAME} .t-kw { color: var(--kw); font-weight: 600; } .w-${NAME} .t-str { color: var(--str); } .w-${NAME} .t-num { color: var(--num); } .w-${NAME} .t-type { color: var(--type); }
.w-${NAME} .njd-result { grid-column: 1 / -1; border-radius: var(--r-md); padding: 9px 12px; border: 1px solid var(--line); display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; font-size: 13px; max-height: 128px; overflow: auto; }
.w-${NAME} .njd-result.ok { background: var(--ok-soft); border-color: transparent; }
.w-${NAME} .njd-result.bad { background: var(--bad-soft); border-color: transparent; }
.w-${NAME} .njd-result .k { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); padding-top: 2px; }
.w-${NAME} .njd-result .v { font-family: var(--font-code); font-size: 12.5px; word-break: break-word; }
.w-${NAME} .njd-result .case { font-weight: 700; color: var(--bad); }
.w-${NAME} .njd-result.ok .case { color: var(--ok); }
.w-${NAME} .njd-result .hint { font-family: var(--font-ui); font-size: 12.5px; color: var(--ink); }
@container njd (max-width: 620px) {
  .w-${NAME} .njd { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 170px minmax(0, 1fr) auto; padding: 10px; gap: 8px; }
  .w-${NAME} .njd-rowh, .w-${NAME} .njd-prow { grid-template-columns: minmax(0, 1fr) 82px 30px minmax(0, 0.9fr) 24px; }
  .w-${NAME} .njd-result { grid-template-columns: minmax(0, 1fr); max-height: 150px; }
  .w-${NAME} .njd-result .k { padding-top: 4px; }
}
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    const id = idScope(NAME);
    const state = { preset: 'todo', model: clonePreset(PRESETS.todo), decodeAs: 'single', snake: false, tab: 'model', text: '', source: null, busy: false };

    const segBtns = Object.entries(PRESETS).map(([key, p]) => el('button', { type: 'button', role: 'radio', id: id(`preset-${key}`), 'aria-checked': 'false', text: p.label }));
    const seg = el('div', { class: 'njd-seg', role: 'radiogroup', 'aria-label': 'Example response' }, ...segBtns);
    const liveBtn = el('button', { type: 'button', class: 'njd-btn', id: id('live'), text: 'Load live response' });
    const resetBtn = el('button', { type: 'button', class: 'njd-btn', id: id('reset'), text: 'Reset' });
    const source = el('span', { class: 'njd-source', id: id('source'), 'aria-live': 'polite' });
    const bar = el('div', { class: 'njd-bar' }, seg, liveBtn, resetBtn, source);

    const textarea = el('textarea', { id: id('json'), spellcheck: 'false', 'aria-label': 'JSON response text' });
    const left = el('div', { class: 'njd-col' }, el('label', { class: 'njd-label', for: id('json'), text: 'JSON from the server (editable)' }), textarea);

    const decodeAsSel = el('select', { id: id('decode-as') });
    const strategySel = el('select', { id: id('strategy') }, el('option', { value: 'default', text: '.useDefaultKeys' }), el('option', { value: 'snake', text: '.convertFromSnakeCase' }));
    const opts = el('div', { class: 'njd-opts' },
      el('label', { for: id('decode-as') }, 'Decode', decodeAsSel),
      el('label', { for: id('strategy') }, 'Keys', strategySel));
    const tabModel = el('button', { type: 'button', role: 'tab', class: 'njd-tab', id: id('tab-model'), 'aria-controls': id('panel-model'), text: 'Model editor' });
    const tabSwift = el('button', { type: 'button', role: 'tab', class: 'njd-tab', id: id('tab-swift'), 'aria-controls': id('panel-swift'), text: 'Swift code' });
    const modelPanel = el('div', { class: 'njd-panel', role: 'tabpanel', id: id('panel-model'), 'aria-labelledby': id('tab-model') });
    const swiftPre = el('pre', { id: id('swift'), tabindex: '0' });
    const swiftPanel = el('div', { class: 'njd-panel', role: 'tabpanel', id: id('panel-swift'), 'aria-labelledby': id('tab-swift') }, swiftPre);
    const right = el('div', { class: 'njd-col' }, opts, el('div', { class: 'njd-tabs', role: 'tablist', 'aria-label': 'Model' }, tabModel, tabSwift), modelPanel, swiftPanel);

    const result = el('div', { class: 'njd-result', id: id('result'), role: 'status', 'aria-live': 'polite' });
    root.append(el('div', { class: 'njd' }, bar, left, right, result));

    function typeOptions(structName) {
      return [...BASE_TYPES, ...Object.keys(state.model.structs).filter((n) => n !== structName && n !== state.model.root)];
    }

    function renderModel() {
      const blocks = [];
      const names = [state.model.root, ...Object.keys(state.model.structs).filter((n) => n !== state.model.root)];
      for (const sName of names) {
        const props = state.model.structs[sName];
        const add = el('button', { type: 'button', class: 'njd-add', id: id(`add-${sName}`), text: '+ property' });
        add.addEventListener('click', () => { props.push({ name: 'newField', type: 'String', optional: false, key: '' }); renderModel(); update(); });
        const rows = props.map((p, i) => {
          const pid = `${sName}-${i}`;
          const nameIn = el('input', { type: 'text', id: id(`name-${pid}`), value: p.name, 'aria-label': `${sName} property ${i + 1} name`, spellcheck: 'false' });
          const typeSel = el('select', { id: id(`type-${pid}`), 'aria-label': `${p.name} type` }, ...typeOptions(sName).map((t) => el('option', { value: t, text: t })));
          typeSel.value = p.type;
          const opt = el('input', { type: 'checkbox', id: id(`opt-${pid}`), 'aria-label': `${p.name} is optional` });
          opt.checked = !!p.optional;
          const keyIn = el('input', { type: 'text', id: id(`key-${pid}`), value: p.key || '', placeholder: p.name, 'aria-label': `${p.name} JSON key`, spellcheck: 'false' });
          const x = el('button', { type: 'button', class: 'njd-x', id: id(`remove-${pid}`), 'aria-label': `Remove ${p.name}` });
          x.innerHTML = ctx.icon('xmark', 13);
          nameIn.addEventListener('input', () => { p.name = nameIn.value.trim(); keyIn.placeholder = p.name; decodeSoon(); });
          typeSel.addEventListener('change', () => { p.type = typeSel.value; update(); });
          opt.addEventListener('change', () => { p.optional = opt.checked; update(); });
          keyIn.addEventListener('input', () => { p.key = keyIn.value; decodeSoon(); });
          x.addEventListener('click', () => { props.splice(i, 1); renderModel(); update(); });
          return el('div', { class: 'njd-prow' }, nameIn, typeSel, el('span', { class: 'njd-opt' }, opt), keyIn, x);
        });
        blocks.push(el('div', { class: 'njd-struct' },
          el('div', { class: 'njd-shead' }, el('span', {}, 'struct ', el('b', { text: sName })), add),
          el('div', { class: 'njd-rowh', 'aria-hidden': 'true' }, el('span', { text: 'Property' }), el('span', { text: 'Type' }), el('span', { text: 'Opt' }), el('span', { text: 'JSON key' }), el('span')),
          ...rows));
      }
      modelPanel.replaceChildren(...blocks);
    }

    function hintFor(err) {
      const pathStr = err.path && err.path.length ? err.path.join(' > ') : 'the top level';
      switch (err.kind) {
        case 'keyNotFound': return `No key "${err.key}" exists ${err.path.length ? `inside ${err.path.join(' > ')}` : 'at the top level'}. Make ${err.prop} optional (${err.propType}?) if the server may leave it out, map it to the right key, or check the key strategy.`;
        case 'typeMismatch':
          if (err.path.length === 0 && err.type === DICT && err.found === 'array') return `The JSON is an array. Decode [${state.model.root}].self instead of ${state.model.root}.self.`;
          if (err.path.length === 0 && err.type === 'Array<Any>') return `The JSON is a single object. Decode ${state.model.root}.self instead of an array.`;
          return `The value at ${pathStr} is ${PHRASE[err.found] || 'something else'}, but the model expects ${err.type === DICT ? 'an object' : err.type}. Change the property type, or fix the JSON.`;
        case 'valueNotFound': return `The value at ${pathStr} is null, but the property is not optional. Mark it optional to accept null.`;
        default: return err.number !== undefined
          ? err.numberType === 'Double'
            ? `${err.number} is outside Double's representable range. Use a value within its supported range.`
            : `${err.number} cannot be represented as a 64-bit Int. Use a whole number from -9223372036854775808 through 9223372036854775807, or Double for fractional values.`
          : 'The text is not valid JSON, so decoding never started. Check quotes, commas and brackets.';
      }
    }

    function decodeNow() {
      const parsed = parseJSON(state.text);
      const row = (k, v, cls = 'v') => [el('span', { class: 'k', text: k }), el('span', { class: cls }, ...(Array.isArray(v) ? v : [v]))];
      if (!parsed.ok) {
        result.className = 'njd-result bad';
        result.replaceChildren(
          ...row('Thrown', 'DecodingError.dataCorrupted', 'v case'), ...row('codingPath', '[]'),
          ...row('Message', 'The given data was not valid JSON.'),
          ...row('Parser', `${parsed.detail} (as reported by this page's JSON parser)`),
          ...row('Fix', hintFor({ kind: 'dataCorrupted', path: [] }), 'v hint'));
        return;
      }
      try {
        const value = decodeJSON(state.model, parsed.value, { decodeAs: state.decodeAs, snake: state.snake });
        const text = swiftDescription(value, 600);
        result.className = 'njd-result ok';
        result.replaceChildren(...row('Decoded', state.decodeAs === 'array' ? `[${state.model.root}] with ${value.array.length} element${value.array.length === 1 ? '' : 's'}` : state.model.root, 'v case'),
          ...row('Value', text.length > 600 ? text.slice(0, 600) + '...' : text));
      } catch (err) {
        if (!(err instanceof DecodeError)) throw err;
        result.className = 'njd-result bad';
        const kids = [...row('Thrown', `DecodingError.${err.kind}`, 'v case')];
        if (err.kind === 'keyNotFound') kids.push(...row('Key', `"${err.key}"`));
        if (err.type) kids.push(...row('Type', err.type));
        kids.push(...row('codingPath', JSON.stringify(err.path)), ...row('Message', err.debug));
        if (err.underlying) kids.push(...row('Underlying', err.underlying));
        kids.push(...row('Fix', hintFor(err), 'v hint'));
        result.replaceChildren(...kids);
      }
    }

    function update() {
      segBtns.forEach((b) => b.setAttribute('aria-checked', String(b.id === id(`preset-${state.preset}`))));
      decodeAsSel.replaceChildren(el('option', { value: 'single', text: `${state.model.root}.self` }), el('option', { value: 'array', text: `[${state.model.root}].self` }));
      decodeAsSel.value = state.decodeAs;
      strategySel.value = state.snake ? 'snake' : 'default';
      [[tabModel, modelPanel, 'model'], [tabSwift, swiftPanel, 'swift']].forEach(([t, p, k]) => {
        t.setAttribute('aria-selected', String(state.tab === k)); t.tabIndex = state.tab === k ? 0 : -1; p.hidden = state.tab !== k;
      });
      swiftPre.innerHTML = highlight(swiftModelCode(state.model, { decodeAs: state.decodeAs, snake: state.snake }));
      const src = state.source;
      if (src?.sample) source.replaceChildren(el('span', { class: 'njd-tag', text: 'Offline sample' }), 'Network unavailable; showing a stored copy of the real response.');
      else if (src?.live) source.textContent = `Live from ${new URL(PRESETS[state.preset].url).host}, ${src.ms} ms${src.edited ? ', edited' : ''}`;
      else source.textContent = src?.edited ? 'Captured response, edited' : 'Captured copy of the real response';
      liveBtn.disabled = state.busy;
      liveBtn.textContent = state.busy ? 'Loading...' : 'Load live response';
      decodeNow();
    }

    function loadPreset(key) {
      const p = PRESETS[key];
      state.preset = key;
      state.model = clonePreset(p);
      state.decodeAs = p.decodeAs;
      state.snake = false;
      state.text = JSON.stringify(p.sample, null, 2);
      state.source = null;
      textarea.value = state.text;
      renderModel();
      update();
    }

    async function loadLive() {
      if (state.busy) return;
      state.busy = true;
      update();
      const key = state.preset;
      try {
        const res = await ctx.fetchJSON(PRESETS[key].url, { timeoutMs: 8000 });
        if (!res.ok || !parseJSON(res.text).ok) throw new Error('bad reply');
        if (state.preset !== key) return;
        state.text = res.text;
        state.source = { live: true, ms: res.ms };
      } catch {
        if (state.preset !== key) return;
        state.text = JSON.stringify(PRESETS[key].sample, null, 2);
        state.source = { sample: true };
      } finally {
        state.busy = false;
        textarea.value = state.text;
        update();
      }
    }

    let decodeTimer = 0;
    function decodeSoon() {
      clearTimeout(decodeTimer);
      decodeTimer = 0;
      if (state.text.length <= LARGE_TEXT) update();
      else decodeTimer = setTimeout(() => { decodeTimer = 0; update(); }, DECODE_DELAY_MS);
    }

    const offs = [
      ...segBtns.map((b) => on(b, 'click', () => loadPreset(b.id.replace(id('preset-'), '')))),
      on(seg, 'keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const keys = Object.keys(PRESETS);
        const next = keys[(keys.indexOf(state.preset) + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
        loadPreset(next);
        document.getElementById(id(`preset-${next}`))?.focus();
      }),
      on(liveBtn, 'click', loadLive),
      on(resetBtn, 'click', () => loadPreset(state.preset)),
      on(textarea, 'input', () => { state.text = textarea.value; state.source = { ...(state.source || {}), edited: true }; decodeSoon(); }),
      on(decodeAsSel, 'change', () => { state.decodeAs = decodeAsSel.value; update(); }),
      on(strategySel, 'change', () => { state.snake = strategySel.value === 'snake'; update(); }),
      on(tabModel, 'click', () => { state.tab = 'model'; update(); }),
      on(tabSwift, 'click', () => { state.tab = 'swift'; update(); }),
      ...[tabModel, tabSwift].map((t) => on(t, 'keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        state.tab = state.tab === 'model' ? 'swift' : 'model';
        update();
        (state.tab === 'model' ? tabModel : tabSwift).focus();
      })),
    ];
    loadPreset(props.preset && PRESETS[props.preset] ? props.preset : 'todo');
    return { destroy() { clearTimeout(decodeTimer); offs.forEach((off) => off()); root.replaceChildren(); root.classList.remove(`w-${NAME}`); } };
  },
};
