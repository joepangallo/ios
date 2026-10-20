// HTTP request builder: sends real requests to free, no-key practice APIs
// and shows the raw request, the response (status, readable headers, timing,
// body) and the equivalent Swift URLRequest code.

const NAME = 'networking-http-builder';
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

const ENDPOINTS = [
  { key: 'todo', label: 'One to-do (JSONPlaceholder)', url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET',
    body: '{\n  "title": "Water the plants",\n  "completed": true,\n  "userId": 1\n}' },
  { key: 'create', label: 'Create a to-do (JSONPlaceholder)', url: 'https://jsonplaceholder.typicode.com/todos', method: 'POST',
    body: '{\n  "title": "Buy milk",\n  "completed": false,\n  "userId": 1\n}' },
  { key: 'list', label: 'First three to-dos', url: 'https://jsonplaceholder.typicode.com/todos?_limit=3', method: 'GET', body: '' },
  { key: 'missing', label: 'A to-do that does not exist', url: 'https://jsonplaceholder.typicode.com/todos/999', method: 'GET', body: '' },
  { key: 'echo', label: 'Echo my request (httpbin)', url: 'https://httpbin.org/anything', method: 'PATCH',
    body: '{\n  "completed": true\n}' },
  { key: 'bearer', label: 'Needs a token (httpbin)', url: 'https://httpbin.org/bearer', method: 'GET', body: '' },
  { key: 'down', label: 'A server that is down (httpbin)', url: 'https://httpbin.org/status/503', method: 'GET', body: '' },
  { key: 'weather', label: 'Weather in Tokyo (Open-Meteo)', url: 'https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,wind_speed_10m', method: 'GET', body: '' },
];

const STATUS_TEXT = {
  200: 'OK', 201: 'Created', 204: 'No Content', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized',
  403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Content',
  429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
};
const STATUS_MEANING = {
  200: 'The request worked; the body holds the result.',
  201: 'A new resource was created. The body usually returns it, including its new id.',
  204: 'Success with an intentionally empty body.',
  400: 'The server could not understand the request. Check the URL and the body.',
  401: 'Missing or invalid credentials. Send a valid Authorization header, or sign the user in again.',
  403: 'You are known but not allowed to do this.',
  404: 'Nothing lives at this URL. URLSession does not throw for this; your status check must.',
  405: 'This URL exists but does not accept this method.',
  429: 'Too many requests. Wait for the time in Retry-After before trying again.',
  500: 'The server crashed while handling the request.',
  503: 'The server is overloaded or down. Retry later, with backoff.',
};
const FAMILY = { 2: ['ok', 'Success'], 3: ['warn', 'Redirection'], 4: ['bad', 'Client error'], 5: ['bad', 'Server error'] };

function offlineSample(endpoint, method, headers) {
  const auth = headers.some((h) => h.name.toLowerCase() === 'authorization' && /^bearer\s+\S+/i.test(h.value));
  const json = { 'content-type': 'application/json; charset=utf-8' };
  switch (endpoint.key) {
    case 'create': return method === 'POST'
      ? { status: 201, headers: { ...json, location: 'https://jsonplaceholder.typicode.com/todos/201' }, text: '{\n  "title": "Buy milk",\n  "completed": false,\n  "userId": 1,\n  "id": 201\n}' }
      : { status: 404, headers: json, text: '{}' };
    case 'missing': return { status: 404, headers: json, text: '{}' };
    case 'bearer': return auth ? { status: 200, headers: json, text: '{\n  "authenticated": true,\n  "token": "demo-token"\n}' } : { status: 401, headers: {}, text: '' };
    case 'down': return { status: 503, headers: {}, text: '' };
    case 'echo': return { status: 200, headers: json, text: `{\n  "method": "${method}",\n  "url": "https://httpbin.org/anything"\n}` };
    case 'list': return { status: 200, headers: json, text: '[\n  { "userId": 1, "id": 1, "title": "delectus aut autem", "completed": false },\n  { "userId": 1, "id": 2, "title": "quis ut nam facilis et officia qui", "completed": false },\n  { "userId": 1, "id": 3, "title": "fugiat veniam minus", "completed": false }\n]' };
    case 'weather': return { status: 200, headers: json, text: '{\n  "latitude": 35.7,\n  "longitude": 139.6875,\n  "current": { "time": "2026-10-20T14:15", "temperature_2m": 18.4, "wind_speed_10m": 9.7 }\n}' };
    default: return method === 'DELETE' ? { status: 200, headers: json, text: '{}' }
      : { status: 200, headers: json, text: '{\n  "userId": 1,\n  "id": 1,\n  "title": "delectus aut autem",\n  "completed": false\n}' };
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const KW = new Set(['let', 'var', 'func', 'if', 'else', 'guard', 'try', 'await', 'return', 'import', 'struct', 'class', 'enum', 'case', 'switch', 'as', 'throw', 'throws', 'async', 'in', 'do', 'catch', 'for', 'while', 'self', 'nil', 'true', 'false']);
// Minimal Swift highlighter for generated snippets (strings, comments, keywords, types, numbers).
function highlightSwift(code) {
  let inBlock = false;
  return code.split('\n').map((line) => {
    if (inBlock) {
      if (/^\s*"""#?/.test(line)) { inBlock = false; return line.replace(/^(\s*)("""#?)(.*)$/, (_, a, b, c) => `${a}<span class="t-str">${esc(b)}</span>${highlightLine(c)}`); }
      return `<span class="t-str">${esc(line)}</span>`;
    }
    const open = line.indexOf('"""');
    if (open >= 0 && line.indexOf('"""', open + 3) < 0) {
      inBlock = true;
      const start = line[open - 1] === '#' ? open - 1 : open;
      return highlightLine(line.slice(0, start)) + `<span class="t-str">${esc(line.slice(start))}</span>`;
    }
    return highlightLine(line);
  }).join('\n');
}
function highlightLine(line) {
  let out = '';
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)|([\s\S])/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[1]) out += `<span class="t-cmt">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="t-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="t-num">${m[3]}</span>`;
    else if (m[4]) out += KW.has(m[4]) ? `<span class="t-kw">${m[4]}</span>` : /^[A-Z]/.test(m[4]) ? `<span class="t-type">${m[4]}</span>` : m[4];
    else out += esc(m[5]);
  }
  return out;
}

function swiftString(s) { return JSON.stringify(s); }

function swiftCode(method, url, headers, body) {
  const lines = [];
  lines.push(`let url = URL(string: ${swiftString(url)})!`);
  lines.push('var request = URLRequest(url: url)');
  if (method !== 'GET') lines.push(`request.httpMethod = ${swiftString(method)}`);
  for (const h of headers) {
    if (!h.name.trim()) continue;
    lines.push(`request.setValue(${swiftString(h.value)},`);
    lines.push(`                 forHTTPHeaderField: ${swiftString(h.name.trim())})`);
  }
  if (BODY_METHODS.has(method) && body.trim()) {
    const raw = body.includes('\\') || body.includes('"""');
    lines.push(`request.httpBody = Data(${raw ? '#"""' : '"""'}`);
    body.split('\n').forEach((l) => lines.push(`    ${l}`));
    lines.push(`    ${raw ? '"""#' : '"""'}.utf8)`);
  }
  lines.push('');
  lines.push('let (data, response) =');
  lines.push('    try await URLSession.shared.data(for: request)');
  lines.push('if let http = response as? HTTPURLResponse {');
  lines.push('    print(http.statusCode)');
  lines.push('}');
  lines.push('print(String(decoding: data, as: UTF8.self))');
  return lines.join('\n');
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

export default {
  name: 'networking-http-builder',
  css: `
.w-${NAME} { container-type: size; container-name: nhb; height: 100%; font-family: var(--font-ui); color: var(--ink); }
.w-${NAME} .nhb { box-sizing: border-box; height: 100%; padding: 14px; display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.25fr); gap: 14px; min-height: 0; }
.w-${NAME} .nhb-form { display: flex; flex-direction: column; gap: 8px; min-height: 0; min-width: 0; }
.w-${NAME} .nhb-label { display: block; font: 700 11px/1.2 var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); margin: 0 0 3px; }
.w-${NAME} select, .w-${NAME} input[type="text"], .w-${NAME} textarea { box-sizing: border-box; width: 100%; font: 13px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; min-width: 0; }
.w-${NAME} textarea, .w-${NAME} .nhb-h input { font-family: var(--font-code); font-size: 12.5px; }
.w-${NAME} select:focus-visible, .w-${NAME} input:focus-visible, .w-${NAME} textarea:focus-visible, .w-${NAME} button:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.w-${NAME} .nhb-row { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 8px; align-items: end; }
.w-${NAME} .nhb-url { font: 12px/1.4 var(--font-code); color: var(--ink-2); background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; word-break: break-all; margin: 0; max-height: 3.2em; overflow: hidden; }
.w-${NAME} .nhb-headers { display: flex; flex-direction: column; gap: 4px; max-height: 108px; overflow: auto; }
.w-${NAME} .nhb-h { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr) 28px; gap: 4px; }
.w-${NAME} .nhb-h input { padding: 5px 6px; }
.w-${NAME} .nhb-x { border: 1px solid var(--line); background: var(--panel); color: var(--ink-3); border-radius: var(--r-sm); cursor: pointer; display: grid; place-items: center; padding: 0; }
.w-${NAME} .nhb-x:hover { color: var(--bad); }
.w-${NAME} .nhb-hbtns { display: flex; gap: 6px; flex-wrap: wrap; }
.w-${NAME} .nhb-small { border: 1px solid var(--line); background: var(--panel-2); color: var(--ink-2); font: 600 12px var(--font-ui); padding: 4px 8px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .nhb-small:hover { color: var(--ink); }
.w-${NAME} .nhb-body { flex: 1; min-height: 52px; display: flex; flex-direction: column; }
.w-${NAME} .nhb-body textarea { flex: 1; min-height: 40px; resize: none; }
.w-${NAME} .nhb-body textarea:disabled { background: var(--panel-2); color: var(--ink-3); }
.w-${NAME} .nhb-hint { font-size: 11.5px; color: var(--ink-3); min-height: 1.3em; margin: 2px 0 0; }
.w-${NAME} .nhb-hint.bad { color: var(--bad); }
.w-${NAME} .nhb-send { border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); font: 700 14px var(--font-ui); padding: 9px; border-radius: var(--r-sm); cursor: pointer; }
.w-${NAME} .nhb-send:disabled { opacity: .55; cursor: default; }
.w-${NAME} .nhb-out { display: flex; flex-direction: column; min-height: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--code-bg); overflow: hidden; }
.w-${NAME} .nhb-tabs { display: flex; border-bottom: 1px solid var(--line); background: var(--panel-2); }
.w-${NAME} .nhb-tab { flex: 1; border: 0; background: transparent; color: var(--ink-2); font: 600 13px var(--font-ui); padding: 9px 6px; cursor: pointer; border-bottom: 2px solid transparent; }
.w-${NAME} .nhb-tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); background: var(--code-bg); }
.w-${NAME} .nhb-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 10px; border-bottom: 1px solid var(--line); font-size: 12.5px; color: var(--ink-2); }
.w-${NAME} .nhb-code { display: inline-flex; align-items: center; gap: 6px; font: 700 13px var(--font-code); padding: 3px 8px; border-radius: 999px; }
.w-${NAME} .nhb-code.ok { background: var(--ok-soft); color: var(--ok); }
.w-${NAME} .nhb-code.warn { background: var(--warn-soft); color: var(--warn); }
.w-${NAME} .nhb-code.bad { background: var(--bad-soft); color: var(--bad); }
.w-${NAME} .nhb-tag { font: 700 10.5px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; padding: 2px 6px; border-radius: 4px; background: var(--warn-soft); color: var(--warn); }
.w-${NAME} .nhb-meaning { flex-basis: 100%; color: var(--ink-2); }
.w-${NAME} pre { margin: 0; flex: 1; min-height: 0; overflow: auto; padding: 10px 12px; font: 12.5px/1.5 var(--font-code); color: var(--ink); white-space: pre; tab-size: 4; }
.w-${NAME} .nhb-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.w-${NAME} .nhb-panel[hidden] { display: none; }
.w-${NAME} .nhb-note { margin: 0; padding: 6px 10px; font-size: 11.5px; color: var(--ink-3); border-top: 1px solid var(--line); background: var(--panel-2); }
.w-${NAME} .t-kw { color: var(--kw); font-weight: 600; } .w-${NAME} .t-str { color: var(--str); } .w-${NAME} .t-num { color: var(--num); }
.w-${NAME} .t-type { color: var(--type); } .w-${NAME} .t-cmt { color: var(--cmt); } .w-${NAME} .t-head { color: var(--type); } .w-${NAME} .t-dim { color: var(--ink-3); }
@container nhb (max-width: 620px) {
  .w-${NAME} .nhb { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(220px, 1fr); padding: 10px; gap: 10px; overflow: auto; }
  .w-${NAME} .nhb-body { flex: none; }
  .w-${NAME} .nhb-body textarea { height: 74px; flex: none; }
  .w-${NAME} pre { font-size: 11.5px; }
}
`,
  mount(root, props = {}, ctx) {
    root.classList.add(`w-${NAME}`);
    const id = (s) => `${NAME}-${s}`;
    const state = {
      endpoint: ENDPOINTS[0], method: 'GET', body: ENDPOINTS[0].body,
      headers: [{ name: 'Accept', value: 'application/json' }], tab: 'request', busy: false, last: null,
    };

    const endpointSel = el('select', { id: id('endpoint') }, ...ENDPOINTS.map((e) => el('option', { value: e.key, text: e.label })));
    const methodSel = el('select', { id: id('method') }, ...METHODS.map((m) => el('option', { value: m, text: m })));
    const urlBox = el('p', { class: 'nhb-url', id: id('url') });
    const headerList = el('div', { class: 'nhb-headers', id: id('headers') });
    const addHeaderBtn = el('button', { type: 'button', class: 'nhb-small', id: id('add-header'), text: 'Add header' });
    const addAuthBtn = el('button', { type: 'button', class: 'nhb-small', id: id('add-auth'), text: 'Add Authorization' });
    const addCtBtn = el('button', { type: 'button', class: 'nhb-small', id: id('add-ct'), text: 'Add Content-Type' });
    const headerHint = el('p', { class: 'nhb-hint', id: id('header-hint') });
    const bodyArea = el('textarea', { id: id('body'), spellcheck: 'false', 'aria-describedby': id('body-hint') });
    const bodyHint = el('p', { class: 'nhb-hint', id: id('body-hint') });
    const sendBtn = el('button', { type: 'button', class: 'nhb-send', id: id('send'), text: 'Send request' });

    const form = el('div', { class: 'nhb-form' },
      el('div', {}, el('label', { class: 'nhb-label', for: id('endpoint'), text: 'Endpoint' }), endpointSel),
      el('div', { class: 'nhb-row' },
        el('div', {}, el('label', { class: 'nhb-label', for: id('method'), text: 'Method' }), methodSel),
        el('div', {}, el('span', { class: 'nhb-label', text: 'URL' }), urlBox)),
      el('div', {}, el('span', { class: 'nhb-label', id: id('headers-label'), text: 'Headers' }), headerList,
        el('div', { class: 'nhb-hbtns' }, addHeaderBtn, addAuthBtn, addCtBtn), headerHint),
      el('div', { class: 'nhb-body' }, el('label', { class: 'nhb-label', for: id('body'), text: 'JSON body' }), bodyArea, bodyHint),
      sendBtn);

    const tabs = ['request', 'response', 'swift'].map((t) => el('button', {
      type: 'button', role: 'tab', class: 'nhb-tab', id: id(`tab-${t}`), 'aria-controls': id(`panel-${t}`),
      text: t === 'request' ? 'Raw request' : t === 'response' ? 'Response' : 'Swift code',
    }));
    const reqPre = el('pre', { id: id('raw'), tabindex: '0', 'aria-label': 'Raw HTTP request' });
    const statusBar = el('div', { class: 'nhb-status', id: id('status'), 'aria-live': 'polite' });
    const resPre = el('pre', { id: id('response-body'), tabindex: '0', 'aria-label': 'Response headers and body' });
    const swiftPre = el('pre', { id: id('swift'), tabindex: '0', 'aria-label': 'Equivalent Swift code' });
    const panels = {
      request: el('div', { class: 'nhb-panel', role: 'tabpanel', id: id('panel-request'), 'aria-labelledby': id('tab-request') }, reqPre,
        el('p', { class: 'nhb-note', text: 'Shown in HTTP/1.1 text form. Over HTTP/2 or HTTP/3 the same fields travel as binary frames, and the client adds headers such as User-Agent.' })),
      response: el('div', { class: 'nhb-panel', role: 'tabpanel', id: id('panel-response'), 'aria-labelledby': id('tab-response') }, statusBar, resPre,
        el('p', { class: 'nhb-note', text: 'A browser lets this page read only a few response headers (a rule called CORS). URLSession in your app sees all of them.' })),
      swift: el('div', { class: 'nhb-panel', role: 'tabpanel', id: id('panel-swift'), 'aria-labelledby': id('tab-swift') }, swiftPre,
        el('p', { class: 'nhb-note', text: 'The same request with URLSession. Run it inside an async function.' })),
    };
    const out = el('div', { class: 'nhb-out' }, el('div', { class: 'nhb-tabs', role: 'tablist', 'aria-label': 'Request details' }, ...tabs), ...Object.values(panels));
    root.append(el('div', { class: 'nhb' }, form, out));

    const validName = (n) => /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(n);
    const MANAGED = ['host', 'content-length', 'connection', 'user-agent', 'accept-encoding'];

    function renderHeaders() {
      headerList.replaceChildren(...state.headers.map((h, i) => {
        const name = el('input', { type: 'text', id: id(`hname-${i}`), value: h.name, 'aria-label': `Header ${i + 1} name`, placeholder: 'Name', spellcheck: 'false' });
        const value = el('input', { type: 'text', id: id(`hvalue-${i}`), value: h.value, 'aria-label': `Header ${i + 1} value`, placeholder: 'Value', spellcheck: 'false' });
        const x = el('button', { type: 'button', class: 'nhb-x', id: id(`hremove-${i}`), 'aria-label': `Remove header ${h.name || i + 1}` });
        x.innerHTML = ctx.icon('xmark', 14);
        name.addEventListener('input', () => { h.name = name.value; update(); });
        value.addEventListener('input', () => { h.value = value.value; update(); });
        x.addEventListener('click', () => { state.headers.splice(i, 1); renderHeaders(); update(); });
        return el('div', { class: 'nhb-h' }, name, value, x);
      }));
    }

    function problems() {
      const p = [];
      for (const h of state.headers) {
        if (!h.name.trim()) continue;
        if (!validName(h.name.trim())) p.push(`"${h.name}" is not a valid header name.`);
        if (/[\r\n]/.test(h.value)) p.push('Header values cannot contain line breaks.');
      }
      return p;
    }

    function bodyState() {
      if (!BODY_METHODS.has(state.method)) return { ok: true, used: false };
      if (!state.body.trim()) return { ok: true, used: false };
      try { JSON.parse(state.body); return { ok: true, used: true }; } catch (e) { return { ok: false, used: true, msg: e.message }; }
    }

    function rawRequest() {
      const u = new URL(state.endpoint.url);
      const bs = bodyState();
      const lines = [`${state.method} ${u.pathname}${u.search} HTTP/1.1`, `Host: ${u.host}`];
      for (const h of state.headers) if (h.name.trim()) lines.push(`${h.name.trim()}: ${h.value}`);
      if (bs.used) lines.push(`Content-Length: ${new TextEncoder().encode(state.body).length}`);
      lines.push('');
      if (bs.used) lines.push(state.body);
      return lines;
    }

    function update() {
      endpointSel.value = state.endpoint.key;
      methodSel.value = state.method;
      urlBox.textContent = state.endpoint.url;
      const takesBody = BODY_METHODS.has(state.method);
      bodyArea.disabled = !takesBody;
      bodyArea.placeholder = takesBody ? '{ }' : 'No body for this method';
      const shown = takesBody ? state.body : '';
      if (bodyArea.value !== shown) bodyArea.value = shown;
      const bs = bodyState();
      bodyHint.className = 'nhb-hint' + (bs.ok ? '' : ' bad');
      bodyHint.textContent = !takesBody ? `${state.method} requests carry no body.` : bs.ok ? (bs.used ? 'Valid JSON.' : 'Empty body.') : `Not valid JSON: ${bs.msg}`;
      const hasCT = state.headers.some((h) => h.name.trim().toLowerCase() === 'content-type');
      addCtBtn.hidden = !(takesBody && !hasCT);
      addAuthBtn.hidden = state.headers.some((h) => h.name.trim().toLowerCase() === 'authorization');
      const probs = problems();
      const managed = state.headers.find((h) => MANAGED.includes(h.name.trim().toLowerCase()));
      headerHint.className = 'nhb-hint' + (probs.length ? ' bad' : '');
      headerHint.textContent = probs[0] || (managed ? `${managed.name.trim()} is managed by URLSession and by browsers; it will not be sent as typed.` : (takesBody && bs.used && !hasCT ? 'Sending a body? Add Content-Type so the server knows it is JSON.' : ''));
      sendBtn.disabled = state.busy || probs.length > 0 || !bs.ok;
      sendBtn.textContent = state.busy ? 'Sending...' : `Send ${state.method} request`;
      reqPre.innerHTML = rawRequest().map((l, i) => {
        if (i === 0) return `<span class="t-kw">${esc(l)}</span>`;
        const c = l.indexOf(': ');
        return c > 0 && !l.startsWith('{') && !l.startsWith(' ') && !l.startsWith('}') && !l.startsWith('[') ? `<span class="t-head">${esc(l.slice(0, c))}</span>: ${esc(l.slice(c + 2))}` : esc(l);
      }).join('\n');
      const headersForSwift = state.headers.filter((h) => h.name.trim());
      swiftPre.innerHTML = highlightSwift(swiftCode(state.method, state.endpoint.url, headersForSwift, bs.used && bs.ok ? state.body : ''));
      tabs.forEach((t) => {
        const key = t.id.replace(id('tab-'), '');
        t.setAttribute('aria-selected', String(key === state.tab));
        t.tabIndex = key === state.tab ? 0 : -1;
        panels[key].hidden = key !== state.tab;
      });
      renderResponse();
    }

    function renderResponse() {
      const r = state.last;
      if (!r) {
        statusBar.replaceChildren(el('span', { text: 'No response yet. Choose an endpoint and send the request.' }));
        resPre.textContent = '';
        return;
      }
      const fam = FAMILY[String(r.status)[0]] || ['warn', 'Other'];
      const text = r.statusText || STATUS_TEXT[r.status] || '';
      const kids = [];
      if (r.sample) kids.push(el('span', { class: 'nhb-tag', text: 'Offline sample' }));
      kids.push(el('span', { class: `nhb-code ${fam[0]}`, id: id('status-code'), text: `${r.status} ${text}`.trim() }));
      kids.push(el('span', { text: `${fam[1]}${r.ms != null ? ` in ${r.ms} ms` : ''}` }));
      kids.push(el('span', { class: 'nhb-meaning', text: r.sample ? 'The network was unavailable, so this is a stored example of the reply.' : (STATUS_MEANING[r.status] || '') }));
      statusBar.replaceChildren(...kids);
      const head = Object.entries(r.headers || {}).map(([k, v]) => `<span class="t-head">${esc(k)}</span>: ${esc(v)}`);
      let body = r.text || '';
      try { body = JSON.stringify(JSON.parse(body), null, 2); } catch { /* not JSON */ }
      if (body.length > 4000) body = body.slice(0, 4000) + '\n... (truncated)';
      resPre.innerHTML = (head.length ? head.join('\n') : '<span class="t-dim">(no readable headers)</span>') + '\n\n' + (body ? esc(body) : '<span class="t-dim">(empty body)</span>');
    }

    async function send() {
      if (state.busy) return;
      const bs = bodyState();
      const headers = {};
      for (const h of state.headers) if (h.name.trim() && !MANAGED.includes(h.name.trim().toLowerCase())) headers[h.name.trim()] = h.value;
      state.busy = true;
      update();
      try {
        const res = await ctx.fetchJSON(state.endpoint.url, { method: state.method, headers, body: bs.used ? state.body : undefined, timeoutMs: 10000 });
        state.last = { status: res.status, statusText: res.statusText, headers: res.headers, text: res.text, ms: res.ms };
      } catch {
        const s = offlineSample(state.endpoint, state.method, state.headers);
        state.last = { ...s, statusText: STATUS_TEXT[s.status], ms: null, sample: true };
      } finally {
        state.busy = false;
        state.tab = 'response';
        update();
      }
    }

    function selectTab(key, focus) {
      state.tab = key;
      update();
      if (focus) tabs.find((t) => t.id === id(`tab-${key}`)).focus();
    }

    const on = (node, ev, fn) => { node.addEventListener(ev, fn); return () => node.removeEventListener(ev, fn); };
    const offs = [
      on(endpointSel, 'change', () => {
        state.endpoint = ENDPOINTS.find((e) => e.key === endpointSel.value);
        state.method = state.endpoint.method;
        state.body = state.endpoint.body;
        if (BODY_METHODS.has(state.method) && !state.headers.some((h) => h.name.toLowerCase() === 'content-type')) state.headers.push({ name: 'Content-Type', value: 'application/json' });
        state.last = null;
        state.tab = 'request';
        renderHeaders();
        update();
      }),
      on(methodSel, 'change', () => {
        state.method = methodSel.value;
        if (BODY_METHODS.has(state.method) && !state.body.trim()) state.body = state.endpoint.body || '{\n  "completed": true\n}';
        update();
      }),
      on(bodyArea, 'input', () => { state.body = bodyArea.value; update(); }),
      on(addHeaderBtn, 'click', () => { state.headers.push({ name: '', value: '' }); renderHeaders(); update(); headerList.querySelector(`#${id(`hname-${state.headers.length - 1}`)}`)?.focus(); }),
      on(addAuthBtn, 'click', () => { state.headers.push({ name: 'Authorization', value: 'Bearer demo-token' }); renderHeaders(); update(); }),
      on(addCtBtn, 'click', () => { state.headers.push({ name: 'Content-Type', value: 'application/json' }); renderHeaders(); update(); }),
      on(sendBtn, 'click', send),
      ...tabs.map((t) => on(t, 'click', () => selectTab(t.id.replace(id('tab-'), ''), false))),
      ...tabs.map((t, i) => on(t, 'keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next.id.replace(id('tab-'), ''), true);
      })),
    ];
    renderHeaders();
    update();
    return { destroy() { offs.forEach((off) => off()); root.replaceChildren(); root.classList.remove(`w-${NAME}`); } };
  },
};
