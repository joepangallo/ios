// Delete-rule simulator for a one-to-many SwiftData relationship:
// Folder.notes <-> Note.folder. Students pick a deleteRule, delete a folder,
// and see what happens to its notes (.nullify, .cascade, .deny, .noAction).
const W = 'data-cascade-sim';

const RULES = {
  nullify: { what: 'The default. Delete the folder; its notes stay, with folder set to nil.', short: 'Notes stay; their folder becomes nil. The default.' },
  cascade: { what: 'Delete the folder and every note in it.', short: 'Notes are deleted with the folder.' },
  deny: { what: 'Refuse to delete the folder while it still has notes.', short: 'Delete is refused while any notes remain.' },
  noAction: { what: 'Delete the folder and do nothing to its notes.', short: 'Notes keep pointing at the deleted folder.' },
};
const ORDER = ['nullify', 'cascade', 'deny', 'noAction'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function initialState() {
  return {
    folders: [
      { id: 'work', name: 'Work', ghost: false },
      { id: 'personal', name: 'Personal', ghost: false },
    ],
    notes: [
      { id: 'n1', text: 'Draft agenda', folder: 'work', dangling: false },
      { id: 'n2', text: 'Check budget', folder: 'work', dangling: false },
      { id: 'n3', text: 'Call the vet', folder: 'personal', dangling: false },
    ],
  };
}

export default {
  name: 'data-cascade-sim',
  css: `
.w-${W} { height: 100%; box-sizing: border-box; container-type: inline-size; overflow: hidden; font: 14px/1.45 var(--font-ui); color: var(--ink); }
.w-${W} *, .w-${W} *::before, .w-${W} *::after { box-sizing: border-box; }
.w-${W} .cs { height: 100%; display: grid; gap: 10px; padding: 12px; grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "rule" "code" "board" "result"; }
.w-${W} .lbl { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); margin: 0; }
.w-${W} .rule { grid-area: rule; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.w-${W} .seg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; background: var(--panel-2);
  border: 1px solid var(--line); border-radius: var(--r-md); padding: 3px; }
.w-${W} .seg button { background: transparent; border: 0; border-radius: var(--r-sm); padding: 5px 4px; cursor: pointer;
  font: 600 12.5px var(--font-code); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${W} .seg button:hover { color: var(--ink); }
.w-${W} .seg button[aria-checked="true"] { background: var(--panel); color: var(--accent-ink); box-shadow: 0 1px 2px rgba(0,0,0,.14); }
.w-${W} .what { margin: 0; font: 500 12.5px/1.35 var(--font-ui); color: var(--ink-2); min-height: 17px; }
.w-${W} :is(button):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${W} pre { grid-area: code; margin: 0; font: 500 12px/1.5 var(--font-code); background: var(--code-bg); color: var(--ink);
  border: 1px solid var(--line); border-radius: var(--r-md); padding: 6px 10px; white-space: pre; overflow: hidden; }
.w-${W} pre .attr { color: var(--attr); } .w-${W} pre .kw { color: var(--kw); font-weight: 600; }
.w-${W} pre .type { color: var(--type); } .w-${W} pre .hl { color: var(--accent-ink); font-weight: 700; background: var(--accent-soft); border-radius: 3px; padding: 0 2px; }
.w-${W} .board { grid-area: board; min-height: 0; overflow: auto; display: grid; gap: 8px; align-content: start;
  grid-template-columns: repeat(2, minmax(0, 1fr)); }
.w-${W} .folder, .w-${W} .unfiled { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 7px 8px; min-width: 0; }
.w-${W} .unfiled { grid-column: 1 / -1; border-style: dashed; background: transparent; }
.w-${W} .fhead { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; min-width: 0; }
.w-${W} .fhead .ic { color: var(--link); display: inline-flex; flex: none; }
.w-${W} .fhead .nm { font: 600 14px var(--font-display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${W} .fhead .ct { font: 500 12px var(--font-ui); color: var(--ink-3); white-space: nowrap; flex: 1; }
.w-${W} .btn { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 3px 8px; cursor: pointer;
  font: 600 12.5px var(--font-ui); color: var(--ink); white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
.w-${W} .btn:hover { background: var(--panel-3); }
.w-${W} .btn.del { color: var(--bad); }
.w-${W} .btn.small { padding: 1px 6px; font-size: 11.5px; font-weight: 600; color: var(--ink-2); }
.w-${W} ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.w-${W} li.note { display: flex; align-items: center; gap: 6px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm);
  padding: 3px 4px 3px 7px; min-width: 0; font-size: 13px; }
.w-${W} li.note { flex-wrap: wrap; row-gap: 0; }
.w-${W} li.note .tx { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${W} li.note .ref { flex: 1 0 100%; font: 500 11px var(--font-code); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${W} li.note.dangling { background: var(--warn-soft); border-color: var(--warn); }
.w-${W} li.note.dangling .ref { color: var(--warn); font-weight: 600; }
.w-${W} .empty { font: 500 12.5px var(--font-ui); color: var(--ink-3); margin: 0; padding: 2px 0; }
.w-${W} .folder.ghost { background: transparent; border: 1.5px dashed var(--bad); }
.w-${W} .folder.ghost .nm { color: var(--bad); text-decoration: line-through; }
.w-${W} .folder.ghost .ct { color: var(--bad); }
.w-${W} .folder.refused { border-color: var(--bad); box-shadow: 0 0 0 2px var(--bad-soft); }
.w-${W} .folder.shake { animation: ${W}-shake .32s ease; }
@keyframes ${W}-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
.w-${W} .result { grid-area: result; display: flex; gap: 8px; align-items: flex-start; background: var(--panel-2); border: 1px solid var(--line);
  border-radius: var(--r-md); padding: 7px 8px 7px 10px; min-width: 0; }
.w-${W} .result p { margin: 0; flex: 1; font: 500 13px/1.4 var(--font-ui); color: var(--ink); min-width: 0; }
.w-${W} .result.ok { border-color: var(--ok); background: var(--ok-soft); }
.w-${W} .result.bad { border-color: var(--bad); background: var(--bad-soft); }
.w-${W} .result.warn { border-color: var(--warn); background: var(--warn-soft); }
.w-${W} .result code { font: 600 12px var(--font-code); }
.w-${W} .glance { display: none; grid-area: glance; margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; align-self: start; }
.w-${W} .glance li { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--line); font: 500 12.5px/1.35 var(--font-ui); color: var(--ink-2); }
.w-${W} .glance li:last-child { border-bottom: 0; }
.w-${W} .glance code { font: 600 12px var(--font-code); color: var(--ink); }
.w-${W} .glance li.on { background: var(--accent-soft); color: var(--ink); }
.w-${W} .glance li.on code { color: var(--accent-ink); }
@container (min-width: 701px) {
  .w-${W} .cs { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); grid-template-rows: auto auto auto minmax(0, 1fr);
    grid-template-areas: "rule board" "code board" "result board" "glance board"; gap: 12px 16px; padding: 18px; align-content: start; }
  .w-${W} .glance { display: block; }
  .w-${W} .result { align-self: start; }
  .w-${W} .board { grid-template-columns: minmax(0, 1fr); }
  .w-${W} .board .folder { padding: 9px 10px; }
  .w-${W} pre { font-size: 13px; padding: 8px 12px; }
}
@container (max-width: 700px) {
  .w-${W} .folder .btn.del { padding: 3px 6px; }
  .w-${W} .folder .btn.del .bt { display: none; }
}
@container (max-width: 400px) {
  .w-${W} .folder .btn.del .bt { display: inline; }
  .w-${W} .seg { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .w-${W} .board { grid-template-columns: minmax(0, 1fr); }
  .w-${W} pre { font-size: 11.5px; }
}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${W}`);
    const reduced = !!ctx.reducedMotion;
    const icon = (n, s = 16) => (ctx.icon ? ctx.icon(n, s) : '');
    let rule = ORDER.includes(props && props.rule) ? props.rule : 'nullify';
    let state = initialState();
    let refused = null;
    let shakeTimer = null;

    el.innerHTML = `
<div class="cs">
  <div class="rule">
    <p class="lbl" id="${W}-rule-label">Delete rule on Folder.notes</p>
    <div class="seg" role="radiogroup" aria-labelledby="${W}-rule-label">
      ${ORDER.map((r) => `<button type="button" role="radio" id="${W}-rule-${r}" data-rule="${r}" aria-checked="false">.${r}</button>`).join('')}
    </div>
    <p class="what" id="${W}-what"></p>
  </div>
  <pre id="${W}-code" aria-label="Relationship declaration"></pre>
  <div class="board" id="${W}-board" aria-label="Folders and notes"></div>
  <ul class="glance" id="${W}-glance" aria-label="Delete rules at a glance">
    ${ORDER.map((r) => `<li data-r="${r}"><code>.${r}</code><span>${RULES[r].short}</span></li>`).join('')}
  </ul>
  <div class="result" id="${W}-result-box">
    <p id="${W}-result" role="status" aria-live="polite"></p>
    <button type="button" class="btn" id="${W}-reset" aria-label="Reset folders and notes">${icon('arrow.clockwise', 14)} Reset</button>
  </div>
</div>`;

    const $ = (id) => el.querySelector(`#${W}-${id}`);
    const board = $('board');
    const resultBox = $('result-box');
    const radios = ORDER.map((r) => $(`rule-${r}`));

    function say(html, tone = '') {
      $('result').innerHTML = html;
      resultBox.className = `result ${tone}`;
    }

    function renderRule() {
      radios.forEach((b) => {
        const on = b.dataset.rule === rule;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      $('what').textContent = RULES[rule].what;
      el.querySelectorAll('.glance li').forEach((li) => li.classList.toggle('on', li.dataset.r === rule));
      $('code').innerHTML =
        `<span class="attr">@Relationship</span>(deleteRule: <span class="hl">.${rule}</span>,\n` +
        `              inverse: \\<span class="type">Note</span>.folder)\n` +
        `<span class="kw">var</span> notes: [<span class="type">Note</span>]`;
    }

    const notesIn = (fid) => state.notes.filter((n) => n.folder === fid);

    function noteItem(n) {
      const ref = n.dangling ? 'folder \u2192 (deleted)' : n.folder ? '' : 'folder == nil';
      const unfile = n.folder
        ? `<button type="button" class="btn small" id="${W}-unfile-${n.id}" data-unfile="${n.id}" aria-label="Unfile ${esc(n.text)}: set folder to nil">Unfile</button>`
        : '';
      return `<li class="note ${n.dangling ? 'dangling' : ''}">
        <span class="tx">${esc(n.text)}</span>${unfile}${ref ? `<span class="ref" title="${n.dangling ? 'Still points at a deleted Folder object' : 'folder is nil'}">${ref}</span>` : ''}</li>`;
    }

    function render() {
      const parts = [];
      for (const f of state.folders) {
        const ns = notesIn(f.id);
        if (f.ghost) {
          if (!ns.length) continue;
          parts.push(`<section class="folder ghost" aria-label="${esc(f.name)}, deleted">
            <div class="fhead"><span class="ic">${icon('folder', 16)}</span><span class="nm">${esc(f.name)}</span>
            <span class="ct">deleted object</span></div>
            <ul>${ns.map(noteItem).join('')}</ul></section>`);
          continue;
        }
        parts.push(`<section class="folder ${refused === f.id ? 'refused' : ''}" id="${W}-folder-${f.id}" aria-label="Folder ${esc(f.name)}">
          <div class="fhead"><span class="ic">${icon('folder', 16)}</span><span class="nm">${esc(f.name)}</span>
          <span class="ct">${plural(ns.length, 'note')}</span>
          <button type="button" class="btn del" id="${W}-delete-${f.id}" data-delete="${f.id}" aria-label="Delete folder ${esc(f.name)}">${icon('trash', 14)}<span class="bt"> Delete</span></button></div>
          ${ns.length ? `<ul>${ns.map(noteItem).join('')}</ul>` : '<p class="empty">No notes</p>'}</section>`);
      }
      const loose = state.notes.filter((n) => n.folder === null);
      parts.push(`<section class="unfiled" aria-label="Unfiled notes">
        <div class="fhead"><span class="ic">${icon('tray', 16)}</span><span class="nm">Unfiled</span><span class="ct">folder == nil</span></div>
        ${loose.length ? `<ul>${loose.map(noteItem).join('')}</ul>` : '<p class="empty">No unfiled notes</p>'}</section>`);
      board.innerHTML = parts.join('');
    }

    function deleteFolder(fid) {
      const f = state.folders.find((x) => x.id === fid && !x.ghost);
      if (!f) return;
      const ns = notesIn(fid);
      const name = esc(f.name);
      refused = null;
      if (rule === 'deny' && ns.length) {
        refused = fid;
        render();
        say(`<code>context.save()</code> throws a validation error: "${name}" still has ${plural(ns.length, 'note')} and the rule is <code>.deny</code>, so the deletion is rolled back and nothing changes.`, 'bad');
        if (!reduced) {
          const card = $(`folder-${fid}`);
          if (card) { card.classList.add('shake'); clearTimeout(shakeTimer); shakeTimer = setTimeout(() => card.classList.remove('shake'), 360); }
        }
        const again = $(`delete-${fid}`);
        if (again) again.focus();
        return;
      }
      if (rule === 'deny') {
        state.folders = state.folders.filter((x) => x !== f);
        say(`"${name}" had no notes, so <code>.deny</code> allowed the delete. Deny refuses only while the relationship is not empty.`, 'ok');
      } else if (rule === 'nullify') {
        state.folders = state.folders.filter((x) => x !== f);
        ns.forEach((n) => { n.folder = null; });
        say(ns.length
          ? `Deleted "${name}". With <code>.nullify</code>, its ${plural(ns.length, 'note')} stayed and each note's folder became nil, so they moved to Unfiled.`
          : `Deleted "${name}". It had no notes, so nothing else changed.`, 'ok');
      } else if (rule === 'cascade') {
        state.folders = state.folders.filter((x) => x !== f);
        state.notes = state.notes.filter((n) => n.folder !== fid);
        say(ns.length
          ? `Deleted "${name}" and, with <code>.cascade</code>, its ${plural(ns.length, 'note')} too. Nothing is left pointing at the deleted folder.`
          : `Deleted "${name}". It had no notes, so the cascade removed nothing else.`, 'ok');
      } else {
        f.ghost = true;
        ns.forEach((n) => { n.dangling = true; });
        say(ns.length
          ? `Deleted "${name}". With <code>.noAction</code>, SwiftData left its ${plural(ns.length, 'note')} untouched: they still point at a deleted folder. That dangling reference can crash or show stale data, which is why this rule is rarely what you want.`
          : `Deleted "${name}". It had no notes, so no references were left dangling this time.`, ns.length ? 'warn' : 'ok');
      }
      render();
      const next = board.querySelector('button[data-delete]') || $('reset');
      next.focus();
    }

    function unfile(nid) {
      const n = state.notes.find((x) => x.id === nid);
      if (!n || !n.folder) return;
      const f = state.folders.find((x) => x.id === n.folder);
      const fname = f ? esc(f.name) : 'the folder';
      refused = null;
      if (n.dangling) {
        n.folder = null; n.dangling = false;
        say(`You repaired the dangling reference by hand: <code>note.folder = nil</code>. With <code>.nullify</code>, SwiftData does this for you.`, 'ok');
      } else {
        n.folder = null;
        say(`<code>note.folder = nil</code>: "${esc(n.text)}" left "${fname}", and SwiftData also removed it from <code>${fname}.notes</code>, the inverse side.`, '');
      }
      render();
      const next = board.querySelector('button[data-unfile]') || board.querySelector('button[data-delete]') || $('reset');
      next.focus();
    }

    function setRule(r, focus) {
      rule = r;
      refused = null;
      renderRule();
      render();
      say(`Rule is now <code>.${r}</code>. Delete a folder to see what happens to its notes.`, '');
      if (focus) $(`rule-${r}`).focus();
    }

    function reset() {
      state = initialState();
      refused = null;
      render();
      say(`Reset: Work has 2 notes, Personal has 1. Rule is <code>.${rule}</code>.`, '');
    }

    const onClick = (e) => {
      const d = e.target.closest('button[data-delete]');
      if (d) return deleteFolder(d.dataset.delete);
      const u = e.target.closest('button[data-unfile]');
      if (u) return unfile(u.dataset.unfile);
      const r = e.target.closest('button[data-rule]');
      if (r) return setRule(r.dataset.rule);
      if (e.target.closest(`#${W}-reset`)) reset();
    };
    const onKey = (e) => {
      const r = e.target.closest('button[data-rule]');
      if (!r) return;
      const i = ORDER.indexOf(r.dataset.rule);
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % ORDER.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i + ORDER.length - 1) % ORDER.length;
      if (j >= 0) { e.preventDefault(); setRule(ORDER[j], true); }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);

    renderRule();
    render();
    say('Pick a rule, then delete a folder. Watch what happens to the notes inside it.', '');

    return {
      destroy() {
        clearTimeout(shakeTimer);
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${W}`);
      },
    };
  },
};
