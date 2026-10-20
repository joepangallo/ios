// JSON decoder lab: edit real JSON and a Codable model side by side; the lab
// decodes it with the same rules as Foundation's JSONDecoder and reports the
// decoded value or the exact DecodingError case, coding path and message.
// Every rule and message below was checked against Swift 6.2 on macOS 26.

const NAME = 'networking-json-decoder';
const BASE_TYPES = ['String', 'Int', 'Double', 'Bool'];

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

// Foundation's convertFromSnakeCase: keep leading and trailing underscores,
// lowercase the first word, capitalize each later run of letters.
function convertFromSnakeCase(key) {
  const m = /^(_*)(.*?)(_*)$/.exec(key);
  if (!m[2]) return key;
  const words = m[2].split('_').filter(Boolean);
  if (words.length === 1) return key;
  const cap = (w) => w.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  return m[1] + words[0].toLowerCase() + words.slice(1).map(cap).join('') + m[3];
}

class DecodeError extends Error {
  constructor(info) { super(info.debug); Object.assign(this, info); }
}

const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'dictionary' : typeof v === 'string' ? 'string' : typeof v === 'number' ? 'number' : 'bool');
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
    const wrap = (x) => (optional ? { some: x } : x);
    switch (type) {
      case 'String': if (k !== 'string') throw mismatch('String'); return wrap({ str: v });
      case 'Bool': if (k !== 'bool') throw mismatch('Bool'); return wrap({ raw: String(v) });
      case 'Double': if (k !== 'number') throw mismatch('Double'); return wrap({ raw: Number.isInteger(v) && Math.abs(v) < 1e16 ? `${v}.0` : String(v) });
      case 'Int':
        if (k !== 'number') throw mismatch('Int');
        if (!Number.isInteger(v) || Math.abs(v) > 9223372036854775807) {
          throw new DecodeError({ kind: 'dataCorrupted', path: [], number: v, debug: 'The given data was not valid JSON.', underlying: `Number ${v} is not representable in Swift.` });
        }
        return wrap({ raw: String(v) });
      default: {
        if (k !== 'dictionary') throw mismatch(DICT);
        return wrap(decodeStruct(type, v, path));
      }
    }
  };
  const decodeStruct = (name, obj, path) => {
    const fields = [];
    for (const prop of structs[name] || []) {
      const codingKey = (prop.key || '').trim() || prop.name;
      let jsonKey = null;
      if (opts.snake) jsonKey = Object.keys(obj).find((k) => convertFromSnakeCase(k) === codingKey) ?? null;
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

function swiftDescription(v) {
  if (v.nil) return 'nil';
  if ('some' in v) return `Optional(${swiftDescription(v.some)})`;
  if ('str' in v) return JSON.stringify(v.str);
  if ('raw' in v) return v.raw;
  if (v.array) return `[${v.array.map(swiftDescription).join(', ')}]`;
  return `${v.struct}(${v.fields.map(([k, x]) => `${k}: ${swiftDescription(x)}`).join(', ')})`;
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

function parseJSON(text) {
  try { return { ok: true, value: JSON.parse(text) }; } catch (e1) {
    try { return { ok: true, value: JSON.parse(stripTrailingCommas(text)) }; } catch { return { ok: false, detail: text.trim() ? e1.message : 'Unexpected end of file' }; }
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

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function highlight(code) {
  return code.split('\n').map((line) => {
    let out = '';
    const re = /("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)|([\s\S])/g;
    let m;
    while ((m = re.exec(line))) {
      if (m[1]) out += `<span class="t-str">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="t-num">${m[2]}</span>`;
      else if (m[3]) out += ['let', 'var', 'struct', 'enum', 'case', 'try', 'self'].includes(m[3]) ? `<span class="t-kw">${m[3]}</span>` : /^[A-Z]/.test(m[3]) ? `<span class="t-type">${m[3]}</span>` : m[3];
      else out += esc(m[4]);
    }
    return out;
  }).join('\n');
}

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
}

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
    const id = (s) => `${NAME}-${s}`;
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
          nameIn.addEventListener('input', () => { p.name = nameIn.value.trim(); keyIn.placeholder = p.name; update(); });
          typeSel.addEventListener('change', () => { p.type = typeSel.value; update(); });
          opt.addEventListener('change', () => { p.optional = opt.checked; update(); });
          keyIn.addEventListener('input', () => { p.key = keyIn.value; update(); });
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
        default: return err.number !== undefined ? `${err.number} has a fractional part, which Int cannot hold. Use Double for this property.` : 'The text is not valid JSON, so decoding never started. Check quotes, commas and brackets.';
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
        const text = swiftDescription(value);
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
        if (!res.ok || res.json === null) throw new Error('bad reply');
        if (state.preset !== key) return;
        state.text = JSON.stringify(res.json, null, 2);
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

    const on = (node, ev, fn) => { node.addEventListener(ev, fn); return () => node.removeEventListener(ev, fn); };
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
      on(textarea, 'input', () => { state.text = textarea.value; state.source = { ...(state.source || {}), edited: true }; update(); }),
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
    return { destroy() { offs.forEach((off) => off()); root.replaceChildren(); root.classList.remove(`w-${NAME}`); } };
  },
};
