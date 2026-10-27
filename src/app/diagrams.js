// Deterministic diagram drivers for worked examples (adapter: 'diagram').
// Each driver renders one scene from the frame's `diagram` state object — no
// timers, no randomness: show(frame) always draws exactly that state. The
// scenes are modelled on the course's own widgets (build pipeline, request
// journey, lifecycle, release pipeline) so the vocabulary matches.
// A driver is { name, mount(el, ctx) -> { show(frame, { animate }), destroy() } }.
import { esc } from './highlight.js';
import { icon } from './icons.js';

function flow(stages, at, failed = -1, extra = '') {
  const items = stages.map((s, i) => {
    const cls = i === failed ? 'failed' : i < at ? 'done' : i === at ? 'active' : 'todo';
    const mark = i === failed ? icon('xmark.circle.fill', 14) : i < at ? icon('checkmark.circle.fill', 14) : `<span class="dg-dot">${i + 1}</span>`;
    return `<li class="dg-stage ${cls}"><span class="dg-mark">${mark}</span><span class="dg-stage-label">${esc(s)}</span></li>`;
  }).join('<li class="dg-arrow" aria-hidden="true">→</li>');
  return `<ol class="dg-flow">${items}</ol>${extra}`;
}

function note(p) { return p ? `<p class="dg-note">${esc(p)}</p>` : ''; }

function phone(inner, caption) {
  return `<div class="dg-phone" role="img" aria-label="${esc(caption || 'Phone diagram')}"><div class="dg-screen">${inner}</div></div>`;
}

function make(render) {
  return {
    mount(el) {
      let last = '';
      return {
        show(frame) {
          const html = render(frame.diagram || {});
          if (html === last) return;
          last = html;
          el.innerHTML = html;
        },
        destroy() { el.innerHTML = ''; },
      };
    },
  };
}

const pipeline = {
  name: 'pipeline',
  ...make((d) => `<div class="dg">
    ${flow(['Plan', 'Swift compiler', 'LLVM', 'Link', 'Install', 'Launch'], d.at ?? 0, d.failed ?? -1)}
    ${d.dest ? `<p class="dg-note">Destination: ${esc(d.dest)}</p>` : ''}
    ${note(d.note)}
  </div>`),
};

const lifecycle = {
  name: 'lifecycle',
  ...make((d) => {
    const phases = ['Not running', 'Inactive', 'Active', 'Background', 'Suspended'];
    const cur = phases.indexOf(d.phase || 'Not running');
    const inner = `<div class="dg-app-icon">${icon('swift', 26)}</div><p class="dg-phone-phase">${esc(d.phase || 'Not running')}</p>${d.memory ? `<p class="dg-phone-sub">In memory: ${esc(d.memory)}</p>` : ''}${d.disk ? `<p class="dg-phone-sub">On disk: ${esc(d.disk)}</p>` : ''}`;
    return `<div class="dg dg-row">${phone(inner, `App state: ${d.phase || 'Not running'}`)}
      <ol class="dg-phases">${phases.map((p, i) => `<li class="${i === cur ? 'on' : i < cur ? 'seen' : ''}">${esc(p)}</li>`).join('')}</ol>
    </div>${note(d.note)}`;
  }),
};

const requestJourney = {
  name: 'request-journey',
  ...make((d) => `<div class="dg">
    ${flow(['URL', 'Request', 'Transport', 'Response', 'Decode', 'UI update'], d.at ?? 0, d.failed ? (d.at ?? 0) : -1)}
    ${d.detail ? `<p class="dg-detail">${esc(d.detail)}</p>` : ''}
    ${note(d.note)}
  </div>`),
};

const release = {
  name: 'release',
  ...make((d) => `<div class="dg">
    ${flow(['Build', 'Signing', 'Archive', 'Validation', 'Distribution'], d.at ?? 0, d.failed ?? -1)}
    ${note(d.note)}
  </div>`),
};

const serviceOperation = {
  name: 'service-operation',
  ...make((d) => {
    const phases = ['Idle', 'Requested', 'In progress', 'Delivered', 'Cancelled', 'Failed'];
    const cur = Math.max(0, phases.indexOf(d.phase || 'Idle'));
    const endBad = d.phase === 'Cancelled' || d.phase === 'Failed';
    return `<div class="dg">
      ${flow(phases.slice(0, 4), Math.min(cur, 3), endBad ? 3 : -1)}
      <p class="dg-op-state ${endBad ? 'bad' : ''}">State: <strong>${esc(d.phase || 'Idle')}</strong></p>
      ${d.detail ? `<p class="dg-detail">${esc(d.detail)}</p>` : ''}
      ${note(d.note)}
    </div>`;
  }),
};

const permission = {
  name: 'permission',
  ...make((d) => {
    const status = d.status || 'notDetermined';
    const prompt = status === 'prompt'
      ? `<div class="dg-prompt"><p><strong>${esc(d.app || 'Trailhead')}</strong> wants to use your ${esc((d.feature || 'location').toLowerCase())}.</p><p class="dg-prompt-btns"><span class="dg-pbtn">Allow Once</span><span class="dg-pbtn primary">Allow While Using</span><span class="dg-pbtn">Don’t Allow</span></p></div>`
      : '';
    const badge = { notDetermined: 'Not determined — the app has not asked yet', granted: 'Authorized — the service may run', denied: 'Denied — the app must recover gracefully', prompt: 'The system prompt is showing' }[status];
    return `<div class="dg">${phone(`${prompt}<p class="dg-phone-phase">${esc(d.feature || 'Location')}</p><p class="dg-phone-sub">${esc(badge)}</p>`, `Permission state: ${status}`)}${note(d.note)}</div>`;
  }),
};

const widgetTimeline = {
  name: 'widget-timeline',
  ...make((d) => {
    const entries = d.entries || [];
    return `<div class="dg">
      <p class="dg-detail">Reload policy: <strong>${esc(d.policy || 'atEnd')}</strong></p>
      <ol class="dg-timeline">${entries.map((e, i) => `<li class="${i === d.current ? 'on' : i < (d.current ?? -1) ? 'seen' : ''}"><span class="dg-when">${esc(e.when)}</span><span>${esc(e.title)}</span></li>`).join('')}</ol>
      ${note(d.note)}
    </div>`;
  }),
};

const swiftdata = {
  name: 'swiftdata',
  ...make((d) => {
    const box = (title, lines) => `<div class="dg-model"><h5>${esc(title)}</h5>${(lines || []).map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
    return `<div class="dg">
      <div class="dg-models">${box(d.leftTitle || 'Model A', d.left)}<div class="dg-link" aria-hidden="true">⇄<span>${esc(d.link || 'relationship')}</span></div>${box(d.rightTitle || 'Model B', d.right)}</div>
      ${d.records ? `<p class="dg-detail">${d.saved ? 'Saved in the store: ' : 'In memory only: '}${d.records.map(esc).join(' · ') || '(none)'}</p>` : ''}
      ${note(d.note)}
    </div>`;
  }),
};

const frameBudget = {
  name: 'frame-budget',
  ...make((d) => {
    const budget = d.budget || 16.7;
    const segs = d.segments || [];
    const total = segs.reduce((s, x) => s + x.ms, 0);
    const bars = segs.map((s) => {
      const w = Math.min(100, (s.ms / budget) * 100);
      return `<div class="dg-seg-row"><span class="dg-seg-label">${esc(s.label)}</span><span class="dg-seg-track"><span class="dg-seg ${s.ms > budget ? 'over' : ''}" style="width:${w}%"></span></span><span class="dg-seg-ms">${s.ms.toFixed(1)} ms</span></div>`;
    }).join('');
    return `<div class="dg">${bars}
      <p class="dg-detail">Total ${total.toFixed(1)} ms of a ${budget.toFixed(1)} ms frame budget — ${total <= budget ? 'the frame ships on time.' : 'over budget: frames drop.'}</p>
      ${note(d.note)}</div>`;
  }),
};

const voiceover = {
  name: 'voiceover',
  ...make((d) => {
    const items = d.items || [];
    return `<div class="dg">
      <ol class="dg-vo">${items.map((it, i) => `<li class="${i === d.focus ? 'on' : ''}"><span class="dg-vo-n">${i + 1}</span><span class="dg-vo-label">${esc(it.label)}</span>${it.note ? `<span class="dg-vo-note">${esc(it.note)}</span>` : ''}</li>`).join('')}</ol>
      ${note(d.note)}</div>`;
  }),
};

const valueReference = {
  name: 'value-reference',
  ...make((d) => {
    const box = (title, lines, changed) => `<div class="dg-model ${changed ? 'changed' : ''}"><h5>${esc(title)}</h5>${(lines || []).map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
    return `<div class="dg">
      <div class="dg-models">${box(d.aTitle || 'First value', d.a, d.changed === 'a')}
        ${d.heap ? `<div class="dg-link" aria-hidden="true">${d.shared ? '⇉ both point to' : '→'}</div>${box(d.heapTitle || 'Heap object', d.heap, d.changed === 'heap')}` : `<div class="dg-link" aria-hidden="true">✂ separate copies</div>${box(d.bTitle || 'Second value', d.b, d.changed === 'b')}`}
      </div>
      ${note(d.note)}</div>`;
  }),
};

export const DIAGRAM_DRIVERS = [pipeline, lifecycle, requestJourney, release, serviceOperation, permission, widgetTimeline, swiftdata, frameBudget, voiceover, valueReference];
export const diagramDrivers = Object.fromEntries(DIAGRAM_DRIVERS.map((d) => [d.name, d]));
