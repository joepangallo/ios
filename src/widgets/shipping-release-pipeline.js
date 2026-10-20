// Release pipeline lab: ship Study Buddy 1.2.1 through eleven ordered stages.
// Each stage asks one realistic release decision; a wrong choice shows what
// actually happens (rejected upload, broken feature, reviewer message) and
// lets the student retry. Locked stages explain what breaks if skipped.

const NAME = 'shipping-release-pipeline';
let uid = 0;

const STAGES = [
  {
    title: 'Bundle ID',
    context: 'Study Buddy needs an App ID. Its bundle ID is a permanent, worldwide-unique name in reverse-DNS style.',
    question: 'Which bundle ID should the app record use?',
    options: [
      { text: 'com.example.StudyBuddy', code: true, ok: true, say: 'Reverse-DNS, unique, and free of versions or temporary words, so it can stay the same for the life of the app.' },
      { text: 'Study Buddy', code: true, say: 'Rejected: bundle IDs may contain only letters, numbers, hyphens and periods. Spaces are not allowed.' },
      { text: 'com.example.studybuddy.v2', code: true, say: 'Valid, but the version is now baked into an identity you can never change after the first upload. Version 3 would still say v2.' },
    ],
    skip: 'Without a registered bundle ID there is no App ID, so Xcode cannot create a provisioning profile and App Store Connect has nothing to attach builds to.',
  },
  {
    title: 'Signing',
    context: '"Automatically manage signing" is on. Xcode needs a team that is allowed to distribute apps.',
    question: 'Which team can upload Study Buddy to TestFlight and the App Store?',
    options: [
      { text: 'Personal Team (a free Apple Account)', say: 'A free personal team can run the app on your own devices, but it cannot distribute through TestFlight or the App Store.' },
      { text: 'Your Apple Developer Program team', ok: true, say: 'Membership lets Xcode create an Apple Distribution certificate and an App Store provisioning profile. Adding the App Groups capability for the widget updates the App ID, and automatic signing regenerates the profile.' },
      { text: 'No team; App Store Connect signs it later', say: 'App Store Connect does not sign apps. iOS refuses to install code it cannot trace to a developer, and Xcode will not upload it.' },
    ],
    skip: 'An unsigned build cannot be uploaded or installed: iOS runs only code signed by a known developer.',
  },
  {
    title: 'Version and build',
    context: 'The App Store has Study Buddy 1.2 (build 41). You are shipping a crash fix.',
    question: 'Which version (CFBundleShortVersionString) and build (CFBundleVersion)?',
    options: [
      { text: '1.2 (41)', code: true, say: 'Upload rejected: build 41 was already uploaded for version 1.2. Each upload needs a build number not used before for that version.' },
      { text: '1.1 (42)', code: true, say: 'Rejected: a new release must have a higher version than the one already on the App Store (1.2).' },
      { text: '1.2.1 (42)', code: true, ok: true, say: 'A higher version for users and a fresh build number for this upload. In Xcode these are MARKETING_VERSION and CURRENT_PROJECT_VERSION.' },
    ],
    skip: 'Reusing a version and build pair makes App Store Connect reject the upload before anyone can test it.',
  },
  {
    title: 'Privacy',
    context: 'Study Buddy asks for location while in use and saves settings with UserDefaults.',
    question: 'What must the build include?',
    options: [
      { text: 'Nothing extra: the permission alert explains itself', say: 'Without NSLocationWhenInUseUsageDescription in Info.plist, iOS never shows the location prompt, so the feature silently fails, and the upload can be flagged ITMS-90683 Missing purpose string.' },
      { text: 'A location purpose string only', say: 'Close. The upload is then flagged ITMS-91053 Missing API declaration: UserDefaults is a required-reason API that must be declared in PrivacyInfo.xcprivacy.' },
      { text: 'A purpose string, plus a privacy manifest declaring UserDefaults with reason CA92.1', ok: true, say: 'Both are in place. In App Store Connect, also answer the App Privacy questions (the privacy nutrition label) and add a privacy policy URL.' },
    ],
    skip: 'Missing privacy declarations stop the upload or the review, and a missing purpose string breaks location for every user.',
  },
  {
    title: 'Archive',
    context: 'Everything is configured. Time to build the exact binary you will ship.',
    question: 'How do you produce it?',
    options: [
      { text: 'Run it on your iPhone with Command-R and upload that', say: 'Run builds the Debug configuration: unoptimized, and including debug-only code such as the staging server. That build cannot be uploaded.' },
      { text: 'Product > Archive, with "Any iOS Device" as the destination', ok: true, say: 'Archive builds the Release configuration for real devices, keeps the dSYM files that symbolicate crash reports, and opens the Organizer.' },
      { text: 'Export the simulator build', say: 'Simulator builds are compiled for the simulator on your Mac, not for iPhone hardware, and cannot be distributed.' },
    ],
    skip: 'Without an archive there is no Release build, no dSYMs for crash reports, and nothing to distribute.',
  },
  {
    title: 'Upload',
    context: 'In the Organizer you choose Distribute App, then App Store Connect. A question about encryption appears.',
    question: 'Study Buddy uses encryption only through HTTPS in URLSession. What do you do?',
    options: [
      { text: 'Declare exempt encryption: set ITSAppUsesNonExemptEncryption to NO in Info.plist', ok: true, say: 'HTTPS provided by the system is exempt. With the key in Info.plist you are not asked again for each build. After processing, build 42 appears in App Store Connect.' },
      { text: 'Leave the question unanswered', say: 'The build waits in App Store Connect marked Missing Compliance and cannot be tested in TestFlight until you answer.' },
      { text: 'Switch the API to plain HTTP to avoid the question', say: 'App Transport Security blocks plain HTTP by default, and sending study data unencrypted would be a privacy failure. Never weaken security to skip paperwork.' },
    ],
    skip: 'No upload means no TestFlight, no review and no release.',
  },
  {
    title: 'TestFlight',
    context: 'Build 42 has processed. Five classmates who are not on your App Store Connect team want to try it.',
    question: 'How do you get the build to them?',
    options: [
      { text: 'Add them as internal testers', say: 'Internal testers must be members of your App Store Connect team (up to 100 people). Classmates are external testers.' },
      { text: 'Create an external group with their emails or a public link, and submit for Beta App Review', ok: true, say: 'External testing reaches up to 10,000 people. The first build of a version gets a Beta App Review. Builds expire after 90 days, and testers send feedback with screenshots from the TestFlight app.' },
      { text: 'Email them the app file', say: 'App Store builds install only through TestFlight or the App Store; their iPhones refuse the file.' },
    ],
    skip: 'Skipping beta testing means real users find the crashes first, in their App Store reviews.',
  },
  {
    title: 'Store listing',
    context: 'TestFlight feedback is fixed. Now the product page in App Store Connect. Sign-in for syncing is optional.',
    question: 'Which listing is ready to submit?',
    options: [
      { text: 'Screenshots from a design mockup that shows features still in progress', say: 'Rejected under guideline 2.3 Accurate Metadata: screenshots must show the app as it really is.' },
      { text: 'Real screenshots, but placeholder text in the description for now', say: 'Placeholder content is a classic guideline 2.1 App Completeness rejection.' },
      { text: 'Real screenshots, description, keywords, support and privacy policy URLs, age rating, and a demo account in App Review Information', ok: true, say: 'Complete and honest. The demo account lets the reviewer reach every screen behind the optional sign-in.' },
    ],
    skip: 'App Store Connect will not accept a submission without required metadata, and incomplete pages get rejected.',
  },
  {
    title: 'App Review',
    context: 'A reply arrives: "Guideline 2.1, App Completeness. The app crashed when we tapped Spots on iPad."',
    question: 'What is the best response?',
    options: [
      { text: 'Reply that Study Buddy is meant for iPhone and resubmit the same build', say: 'iPhone apps also run on iPad, and reviewers test there. The same build crashes the same way and is rejected again.' },
      { text: 'Appeal to the App Review Board right away', say: 'Appeals are for disagreements about how a guideline applies. A crash is a real bug: fix it.' },
      { text: 'Reproduce it in an iPad simulator, fix it, upload build 43, test it in TestFlight and resubmit', ok: true, say: 'A new build that fixes the real bug is the path to approval. Other common rejections: 2.3 Accurate Metadata, 4.2 Minimum Functionality (a repackaged website), and 5.1.1 Data Collection (users who can create an account must be able to delete it in the app).' },
    ],
    skip: 'Every App Store build goes through App Review. There is no way around it, only through it.',
  },
  {
    title: 'Release',
    context: 'Build 43 is approved. About 40,000 students use Study Buddy.',
    question: 'How should 1.2.1 reach them?',
    options: [
      { text: 'Release to everyone the moment it is approved', say: 'Allowed, but risky: if the fix contains a new bug, every user gets it the same day. A gradual rollout limits the damage.' },
      { text: 'Phased release over seven days', ok: true, say: 'Automatic updates reach 1%, 2%, 5%, 10%, 20%, 50%, then 100% of users. You can pause if crash reports spike (up to 30 days in total), and anyone can still update by hand.' },
      { text: 'Hold it until the end of the term', say: 'Students keep crashing on 1.2 in the meantime. A tested fix should ship.' },
    ],
    skip: 'An approved build does nothing until you release it.',
  },
  {
    title: 'Monitor and maintain',
    context: 'Day 2 of the rollout. Xcode\'s Organizer shows a new crash in SpotsView affecting 0.4% of sessions.',
    question: 'What do you do?',
    options: [
      { text: 'Ignore it: 0.4% is small', say: 'Across 40,000 students that is hundreds of crashes a week, and crashes drive one-star reviews.' },
      { text: 'Pause the phased release, read the symbolicated crash, fix it and ship 1.2.2 (44)', ok: true, say: 'Pausing stops the rollout while you fix the bug. The archive\'s dSYMs turn the crash into a file and line number. Request an expedited review only for critical bugs.' },
      { text: 'Remove the app from sale', say: 'Far too drastic for one crash, and it blocks new students from downloading the app.' },
    ],
    skip: 'Shipping starts the maintenance phase. Without crash reports, ratings and feedback, you learn about bugs from one-star reviews.',
  },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default {
  name: 'shipping-release-pipeline',
  css: `
.w-shipping-release-pipeline { display:flex; flex-direction:column; height:100%; box-sizing:border-box; padding:14px 16px; gap:10px; color:var(--ink); font:13px/1.45 var(--font-ui); min-width:0; }
.w-shipping-release-pipeline * { box-sizing:border-box; }
.w-shipping-release-pipeline .rp-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.w-shipping-release-pipeline .rp-title { margin:0; font:600 16px/1.25 var(--font-display); }
.w-shipping-release-pipeline .rp-sub { margin:2px 0 0; color:var(--ink-2); font-size:12.5px; }
.w-shipping-release-pipeline .rp-progress { display:flex; align-items:center; gap:10px; font-size:12px; color:var(--ink-2); font-weight:600; }
.w-shipping-release-pipeline .rp-bar { width:150px; height:8px; border-radius:999px; background:var(--panel-3); overflow:hidden; }
.w-shipping-release-pipeline .rp-bar i { display:block; height:100%; background:var(--ok); border-radius:999px; transition:width .35s ease; }
.w-shipping-release-pipeline .rp-main { flex:1; min-height:0; display:grid; grid-template-columns:220px minmax(0,1fr); gap:12px; }
.w-shipping-release-pipeline .rp-rail { list-style:none; margin:0; padding:6px; display:flex; flex-direction:column; gap:2px; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); overflow:auto; min-height:0; }
.w-shipping-release-pipeline .rp-rail button { width:100%; display:flex; align-items:center; gap:8px; padding:5px 8px; border:1px solid transparent; border-radius:var(--r-sm); background:none; color:var(--ink-2); font:500 12.5px var(--font-ui); text-align:left; cursor:pointer; }
.w-shipping-release-pipeline .rp-rail button:hover { background:var(--panel-3); }
.w-shipping-release-pipeline .rp-rail button:focus-visible { outline:2px solid var(--focus); outline-offset:1px; }
.w-shipping-release-pipeline .rp-rail button[aria-current="step"] { background:var(--panel); border-color:var(--line); color:var(--ink); font-weight:700; box-shadow:var(--shadow); }
.w-shipping-release-pipeline .rp-num { flex:none; width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font:700 11px var(--font-ui); background:var(--panel-3); color:var(--ink-2); }
.w-shipping-release-pipeline .rp-num svg { width:13px; height:13px; }
.w-shipping-release-pipeline .done .rp-num { background:var(--ok); color:var(--on-accent); }
.w-shipping-release-pipeline .current .rp-num { background:var(--accent); color:var(--on-accent); }
.w-shipping-release-pipeline .locked { opacity:.62; }
.w-shipping-release-pipeline .locked .rp-num { background:transparent; border:1px dashed var(--ink-3); }
.w-shipping-release-pipeline .rp-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.w-shipping-release-pipeline .rp-detail { min-width:0; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:8px; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:12px 14px; }
.w-shipping-release-pipeline .rp-eyebrow { margin:0; font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); }
.w-shipping-release-pipeline .rp-stage { margin:0; font:600 15px/1.25 var(--font-display); }
.w-shipping-release-pipeline .rp-context { margin:0; color:var(--ink-2); }
.w-shipping-release-pipeline .rp-q { margin:2px 0 0; font-weight:700; }
.w-shipping-release-pipeline .rp-options { display:flex; flex-direction:column; gap:6px; }
.w-shipping-release-pipeline .rp-opt { display:flex; align-items:flex-start; gap:9px; width:100%; text-align:left; padding:7px 10px; border-radius:var(--r-sm); border:1px solid var(--line); background:var(--panel); color:var(--ink); font:500 12.5px/1.4 var(--font-ui); cursor:pointer; }
.w-shipping-release-pipeline .rp-opt:hover { border-color:var(--ink-3); }
.w-shipping-release-pipeline .rp-opt:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-release-pipeline .rp-opt .rp-dot { flex:none; width:16px; height:16px; margin-top:1px; border-radius:50%; border:1.5px solid var(--ink-3); display:grid; place-items:center; }
.w-shipping-release-pipeline .rp-opt .rp-dot svg { width:11px; height:11px; }
.w-shipping-release-pipeline .rp-opt code { font:600 12px var(--font-code); }
.w-shipping-release-pipeline .rp-opt.wrong { border-color:var(--bad); background:var(--bad-soft); }
.w-shipping-release-pipeline .rp-opt.wrong .rp-dot { border-color:var(--bad); background:var(--bad); color:var(--on-accent); }
.w-shipping-release-pipeline .rp-opt.right { border-color:var(--ok); background:var(--ok-soft); }
.w-shipping-release-pipeline .rp-opt.right .rp-dot { border-color:var(--ok); background:var(--ok); color:var(--on-accent); }
.w-shipping-release-pipeline .rp-opt:disabled { cursor:default; }
.w-shipping-release-pipeline .rp-opt:disabled:not(.right):not(.wrong) { opacity:.55; }
.w-shipping-release-pipeline .rp-feedback { margin:0; padding:8px 11px; border-radius:var(--r-sm); border:1px solid var(--line); font-size:12.5px; line-height:1.45; }
.w-shipping-release-pipeline .rp-feedback:empty { display:none; }
.w-shipping-release-pipeline .rp-feedback.bad { border-color:var(--bad); background:var(--bad-soft); }
.w-shipping-release-pipeline .rp-feedback.ok { border-color:var(--ok); background:var(--ok-soft); }
.w-shipping-release-pipeline .rp-feedback.warn { border-color:var(--warn); background:var(--warn-soft); }
.w-shipping-release-pipeline .rp-feedback b { font-weight:700; }
.w-shipping-release-pipeline .rp-actions { display:flex; gap:8px; flex-wrap:wrap; }
.w-shipping-release-pipeline .rp-btn { font:600 12.5px var(--font-ui); color:var(--ink); background:var(--panel); border:1px solid var(--line); border-radius:var(--r-sm); padding:6px 12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.w-shipping-release-pipeline .rp-btn.primary { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
.w-shipping-release-pipeline .rp-btn:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-release-pipeline .rp-summary { margin:0; padding:0; list-style:none; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:4px 14px; font-size:12px; color:var(--ink-2); }
.w-shipping-release-pipeline .rp-summary li { display:flex; gap:6px; align-items:flex-start; }
.w-shipping-release-pipeline .rp-summary svg { flex:none; color:var(--ok); margin-top:2px; }
.w-shipping-release-pipeline.still * { transition:none !important; }
@media (max-width:560px) {
  .w-shipping-release-pipeline .rp-main { grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr); }
  .w-shipping-release-pipeline .rp-rail { flex-direction:row; overflow-x:auto; padding:5px; }
  .w-shipping-release-pipeline .rp-rail li { flex:none; }
  .w-shipping-release-pipeline .rp-rail button { padding:4px; width:auto; }
  .w-shipping-release-pipeline .rp-name { display:none; }
  .w-shipping-release-pipeline .rp-bar { width:90px; }
  .w-shipping-release-pipeline .rp-sub { display:none; }
  .w-shipping-release-pipeline .rp-summary { grid-template-columns:minmax(0,1fr); }
}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    if (ctx && ctx.reducedMotion) el.classList.add('still');
    ++uid;
    const icon = (name, size = 14) => (ctx && ctx.icon ? ctx.icon(name, size) : '');
    // progress = number of stages completed; view = stage index on screen.
    const state = { progress: 0, view: 0, picked: {}, finished: false };

    el.innerHTML = `
      <div class="rp-head">
        <div>
          <p class="rp-title">Ship Study Buddy 1.2.1</p>
          <p class="rp-sub">One decision per stage. A wrong choice shows what really happens; try again.</p>
        </div>
        <div class="rp-progress"><span id="${NAME}-count"></span><span class="rp-bar" aria-hidden="true"><i id="${NAME}-bar"></i></span></div>
      </div>
      <div class="rp-main">
        <ol class="rp-rail" id="${NAME}-rail" aria-label="Release stages"></ol>
        <section class="rp-detail" id="${NAME}-detail" aria-live="polite"></section>
      </div>`;

    const $ = (sel) => el.querySelector(sel);
    const rail = $(`#${NAME}-rail`);
    const detail = $(`#${NAME}-detail`);

    function renderRail() {
      rail.innerHTML = STAGES.map((s, i) => {
        const status = i < state.progress ? 'done' : i === state.progress && !state.finished ? 'current' : 'locked';
        const mark = status === 'done' ? icon('checkmark', 13) : status === 'locked' ? icon('lock', 12) : String(i + 1);
        const label = `Stage ${i + 1}, ${s.title}, ${status === 'done' ? 'complete' : status === 'current' ? 'current' : 'locked'}`;
        return `<li class="${status}"><button type="button" id="${NAME}-stage-${i}" data-stage="${i}" aria-label="${esc(label)}"${i === state.view && !state.finished ? ' aria-current="step"' : ''}><span class="rp-num">${mark}</span><span class="rp-name">${esc(s.title)}</span></button></li>`;
      }).join('');
      $(`#${NAME}-count`).textContent = state.finished ? 'Released' : `${state.progress} of ${STAGES.length} stages`;
      $(`#${NAME}-bar`).style.width = `${(state.progress / STAGES.length) * 100}%`;
    }

    function optionHTML(s, i, oi, pickedRight) {
      const o = s.options[oi];
      const tried = (state.picked[i] || []).includes(oi);
      const cls = tried ? (o.ok ? 'right' : 'wrong') : '';
      const mark = tried ? icon(o.ok ? 'checkmark' : 'xmark', 11) : '';
      const text = o.code ? `<code>${esc(o.text)}</code>` : esc(o.text);
      return `<button type="button" class="rp-opt ${cls}" id="${NAME}-opt-${i}-${oi}" data-opt="${oi}"${pickedRight ? ' disabled' : ''}><span class="rp-dot" aria-hidden="true">${mark}</span><span>${text}</span></button>`;
    }

    function renderDetail() {
      if (state.finished) {
        detail.innerHTML = `
          <p class="rp-eyebrow">Released</p>
          <p class="rp-stage">Study Buddy 1.2.1 is rolling out</p>
          <p class="rp-context">You took one fix through the whole pipeline. Each stage exists because skipping it breaks something later.</p>
          <ul class="rp-summary">${STAGES.map((s) => `<li>${icon('checkmark.circle.fill', 13)}<span>${esc(s.title)}</span></li>`).join('')}</ul>
          <p class="rp-feedback ok"><b>Next:</b> keep watching the Organizer and ratings. Shipping starts the maintenance phase of the life cycle.</p>
          <div class="rp-actions"><button type="button" class="rp-btn" id="${NAME}-restart">${icon('arrow.clockwise', 13)}Start over</button></div>`;
        return;
      }
      const i = state.view;
      const s = STAGES[i];
      if (i > state.progress) {
        detail.innerHTML = `
          <p class="rp-eyebrow">Stage ${i + 1} · locked</p>
          <p class="rp-stage">${esc(s.title)}</p>
          <p class="rp-feedback warn"><b>What breaks if you skip this:</b> ${esc(s.skip)}</p>
          <p class="rp-context">Stages unlock in order, because each one depends on the result of the one before.</p>
          <div class="rp-actions"><button type="button" class="rp-btn primary" id="${NAME}-back">Back to stage ${state.progress + 1}: ${esc(STAGES[state.progress].title)}</button></div>`;
        return;
      }
      const picks = state.picked[i] || [];
      const rightPicked = picks.some((oi) => s.options[oi].ok);
      const last = picks.length ? s.options[picks[picks.length - 1]] : null;
      let feedback = '';
      if (last) feedback = last.ok ? `<p class="rp-feedback ok"><b>Right.</b> ${esc(last.say)}</p>` : `<p class="rp-feedback bad"><b>What happens:</b> ${esc(last.say)} Try another option.</p>`;
      const done = i < state.progress;
      detail.innerHTML = `
        <p class="rp-eyebrow">Stage ${i + 1} of ${STAGES.length}${done ? ' · complete' : ''}</p>
        <p class="rp-stage">${esc(s.title)}</p>
        <p class="rp-context">${esc(s.context)}</p>
        <p class="rp-q" id="${NAME}-q-${i}">${esc(s.question)}</p>
        <div class="rp-options" role="group" aria-labelledby="${NAME}-q-${i}">${s.options.map((_, oi) => optionHTML(s, i, oi, rightPicked)).join('')}</div>
        ${feedback}
        ${rightPicked ? `<div class="rp-actions">${i === state.progress - 1 && state.progress < STAGES.length ? `<button type="button" class="rp-btn primary" id="${NAME}-next">Next stage: ${esc(STAGES[state.progress].title)} ${icon('arrow.right', 13)}</button>` : ''}${state.progress === STAGES.length ? `<button type="button" class="rp-btn primary" id="${NAME}-finish">Release ${icon('arrow.right', 13)}</button>` : ''}</div>` : ''}`;
    }

    function render() { renderRail(); renderDetail(); }

    function focusDetail() {
      const target = detail.querySelector('.rp-btn.primary, .rp-opt:not(:disabled)');
      if (target) target.focus({ preventScroll: true });
    }

    function choose(oi) {
      const i = state.view;
      const s = STAGES[i];
      const picks = state.picked[i] || (state.picked[i] = []);
      if (picks.some((x) => s.options[x].ok)) return;
      if (!picks.includes(oi)) picks.push(oi);
      else { picks.splice(picks.indexOf(oi), 1); picks.push(oi); }
      if (s.options[oi].ok && i === state.progress) state.progress += 1;
      render();
      const btn = $(`#${NAME}-next`) || $(`#${NAME}-finish`);
      if (btn) btn.focus({ preventScroll: true });
    }

    const onClick = (e) => {
      const stageBtn = e.target.closest('[data-stage]');
      if (stageBtn) {
        state.finished = false;
        state.view = Number(stageBtn.dataset.stage);
        render();
        return;
      }
      const opt = e.target.closest('[data-opt]');
      if (opt && !opt.disabled) { choose(Number(opt.dataset.opt)); return; }
      const id = e.target.closest('button')?.id;
      if (id === `${NAME}-next`) { state.view = state.progress; render(); focusDetail(); }
      if (id === `${NAME}-back`) { state.view = state.progress; render(); focusDetail(); }
      if (id === `${NAME}-finish`) { state.finished = true; render(); }
      if (id === `${NAME}-restart`) { state.progress = 0; state.view = 0; state.picked = {}; state.finished = false; render(); focusDetail(); }
    };
    el.addEventListener('click', onClick);
    render();

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'still');
      },
    };
  },
};
