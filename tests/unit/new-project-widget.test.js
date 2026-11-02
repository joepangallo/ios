// @vitest-environment jsdom
// The new-project walkthrough (Module 1, Anatomy of a SwiftUI App): Xcode's
// name transforms, the files each option set produces, and the whole flow from
// the Welcome window to a running app, including the detours students are
// invited to try (a wrong template, Team None on a real iPhone, SwiftData).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import widget, { bundleName, swiftName, validOrg, projectFiles } from '../../src/widgets/ecosystem-new-project.js';

const base = { name: 'HelloWorld', ui: 'SwiftUI', lang: 'Swift', testing: 'None', storage: 'None' };

describe('Xcode name transforms', () => {
  it('turns a product name into the bundle identifier suffix the way Xcode does', () => {
    expect(bundleName('HelloWorld')).toBe('HelloWorld');
    expect(bundleName('Trail Notes')).toBe('Trail-Notes');
    expect(bundleName('  Café & Co ')).toBe('Caf----Co');
    expect(bundleName('my.app-2')).toBe('my.app-2');
  });

  it('turns a product name into a Swift identifier for type names', () => {
    expect(swiftName('Trail Notes')).toBe('Trail_Notes');
    expect(swiftName('2048 Clone')).toBe('_2048_Clone');
    expect(swiftName('my-app')).toBe('my_app');
  });

  it('accepts only reverse-DNS organization identifiers', () => {
    for (const ok of ['com.example', 'com.sam-rivera', 'edu.school.cs', ' com.x ']) expect(validOrg(ok), ok).toBe(true);
    for (const bad of ['', 'com', 'com.', '.com', 'com..x', 'com.my name', 'com.x/y']) expect(validOrg(bad), bad).toBe(false);
  });
});

describe('the files a new project starts with', () => {
  it('matches the SwiftUI App template', () => {
    expect(projectFiles(base)).toEqual({ files: ['HelloWorldApp.swift', 'ContentView.swift', 'Assets.xcassets'], tests: [] });
  });

  it('names the App file with the Swift identifier and adds test folders for a testing system', () => {
    const { files, tests } = projectFiles({ ...base, name: 'Trail Notes', testing: 'Swift Testing' });
    expect(files[0]).toBe('Trail_NotesApp.swift');
    expect(tests).toEqual(['Trail NotesTests/', 'Trail NotesUITests/']);
  });

  it('adds the storage files for SwiftData and Core Data', () => {
    expect(projectFiles({ ...base, storage: 'SwiftData' }).files).toContain('Item.swift');
    expect(projectFiles({ ...base, storage: 'Core Data' }).files).toEqual(expect.arrayContaining(['Persistence.swift', 'HelloWorld.xcdatamodeld']));
  });

  it('switches to the UIKit files for Storyboard and Objective-C', () => {
    const sb = projectFiles({ ...base, ui: 'Storyboard' }).files;
    expect(sb).toEqual(expect.arrayContaining(['AppDelegate.swift', 'SceneDelegate.swift', 'ViewController.swift', 'Main.storyboard', 'LaunchScreen.storyboard', 'Info.plist']));
    expect(sb).not.toContain('ContentView.swift');
    const objc = projectFiles({ ...base, ui: 'Storyboard', lang: 'Objective-C' }).files;
    expect(objc).toEqual(expect.arrayContaining(['ViewController.h', 'ViewController.m', 'main.m']));
    expect(objc.some((f) => f.endsWith('.swift'))).toBe(false);
  });
});

describe('walking through the model', () => {
  let host;
  let ctl;
  const $ = (s) => host.querySelector(s);
  const $$ = (s) => [...host.querySelectorAll(s)];
  const button = (text) => $$('button').find((b) => b.textContent.trim() === text);
  const tipText = () => $('.np-info [aria-live]').textContent;
  const type = (label, value) => {
    const input = $$('input[type="text"]').find((i) => i.dataset.field === label);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const choose = (field, value) => {
    const sel = $(`select[data-field="${field}"]`) || $(`#${field}`);
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const toOptions = () => {
    button('Create New Project...').click();
    button('Next').click();
  };
  const toRun = (name = 'HelloWorld', org = 'com.example') => {
    toOptions();
    type('name', name);
    type('org', org);
    button('Next').click();
    button('Create').click();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.append(host);
    ctl = widget.mount(host, {}, { reducedMotion: false });
  });
  afterEach(() => {
    // jsdom's own focus() and blur() schedule timers, so leaks are checked in a
    // dedicated test below; here, anything still pending must not touch the host.
    ctl.destroy();
    vi.runAllTimers();
    expect(host.childNodes.length).toBe(0);
    expect(host.className).toBe('');
    host.remove();
    vi.useRealTimers();
  });

  it('cancels a build in progress when it is destroyed', () => {
    toRun();
    $('button[aria-label="Run"]').click();
    expect(vi.getTimerCount()).toBe(1);
    ctl.destroy();
    expect(vi.getTimerCount()).toBe(0);
    ctl = { destroy() {} };
  });

  it('starts at the Welcome window with later steps locked', () => {
    expect($('.np-info h3').textContent).toBe('Open Xcode and start a project');
    const chips = $$('.np-stages button');
    expect(chips.map((b) => b.disabled)).toEqual([false, true, true, true, true]);
    button('Clone Git Repository...').click();
    expect(tipText()).toMatch(/Copies a project/);
    expect($('.np-info h3').textContent).toBe('Open Xcode and start a project');
  });

  it('only continues past the template chooser with iOS > App', () => {
    button('Create New Project...').click();
    expect($('[role="tab"][aria-selected="true"]').textContent).toBe('iOS');
    $$('[role="tab"]').find((t) => t.textContent === 'macOS').click();
    $$('.tile').find((t) => t.textContent === 'Command Line Tool').click();
    expect($('.tile[aria-pressed="true"]').textContent).toBe('Command Line Tool');
    button('Next').click();
    expect(tipText()).toMatch(/continues with/);
    expect($('.sheet-title')).toBeNull();
    $$('[role="tab"]').find((t) => t.textContent === 'iOS').click();
    const app = $$('.tile').find((t) => t.textContent === 'App');
    app.click();
    app.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect($('.sheet-title').textContent).toMatch(/Choose options/);
  });

  it('keeps Next off until both names are valid and shows the bundle identifier as you type', () => {
    toOptions();
    const next = () => button('Next');
    expect(next().disabled).toBe(true);
    type('name', 'Trail Notes');
    expect($('[data-field="bundle"]').textContent).toBe('com.yourname.Trail-Notes');
    type('org', 'com');
    expect(next().disabled).toBe(true);
    expect($('input[data-field="org"]').getAttribute('aria-invalid')).toBe('true');
    type('org', 'com.samrivera');
    expect($('[data-field="bundle"]').textContent).toBe('com.samrivera.Trail-Notes');
    expect(host.textContent).toContain('App struct: Trail_NotesApp');
    expect(next().disabled).toBe(false);
  });

  it('explains the focused field and tracks the course choices', () => {
    toOptions();
    $('select[data-field="testing"]').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tipText()).toMatch(/Testing System/);
    expect($$('.np-check li.match')).toHaveLength(3);
    choose('testing', 'Swift Testing');
    expect($$('.np-check li.match')).toHaveLength(4);
  });

  it('applies the option rules: Objective-C means Storyboard, and SwiftData needs SwiftUI', () => {
    toOptions();
    choose('testing', 'Swift Testing');
    choose('storage', 'SwiftData');
    expect($('input[type="checkbox"]').disabled).toBe(false);
    choose('lang', 'Objective-C');
    expect($('select[data-field="ui"]').value).toBe('Storyboard');
    expect($('select[data-field="ui"] option[value="SwiftUI"]').disabled).toBe(true);
    expect($('select[data-field="testing"]').value).toBe('XCTest');
    expect($('select[data-field="storage"]').value).toBe('None');
    expect($('select[data-field="storage"] option[value="SwiftData"]').disabled).toBe(true);
    expect($('input[type="checkbox"]').disabled).toBe(true);
  });

  it('adds a Personal Team when the student chooses Add Account', () => {
    toOptions();
    choose('team', 'add');
    expect($('select[data-field="team"]').value).toBe('personal');
    expect($('select[data-field="team"] option[value="personal"]').textContent).toBe('Your Name (Personal Team)');
  });

  it('shows what the save panel will create, with and without Git', () => {
    toOptions();
    type('name', 'TrailNotes');
    type('org', 'com.example');
    choose('testing', 'Swift Testing');
    button('Next').click();
    const tree = () => $('.tree').textContent;
    expect(tree()).toContain('TrailNotes.xcodeproj');
    expect(tree()).toContain('TrailNotesUITests/');
    expect(tree()).toContain('.git/');
    const git = $('input[type="checkbox"]');
    git.checked = false;
    git.dispatchEvent(new Event('change', { bubbles: true }));
    expect(tree()).not.toContain('.git/');
    expect(tipText()).toMatch(/git init/);
    const where = $('select');
    where.value = 'Desktop';
    where.dispatchEvent(new Event('change', { bubbles: true }));
    expect(tree()).toMatch(/^\s*Desktop\//);
    expect(tipText()).toMatch(/iCloud Drive/);
  });

  it('builds and runs the template in the Simulator', () => {
    toRun();
    expect($('.nav li.on').textContent).toBe('ContentView.swift');
    expect($('.code').textContent).toContain('Text("Hello, world!")');
    $('button[aria-label="Run"]').click();
    expect($('.activity').textContent).toMatch(/Building HelloWorld/);
    vi.advanceTimersByTime(700);
    expect($('.activity').textContent).toMatch(/Signing and installing/);
    vi.advanceTimersByTime(600);
    expect($('.activity').textContent).toMatch(/Running HelloWorld/);
    expect($('.sim .phone').textContent).toContain('Hello, world!');
    expect(tipText()).toMatch(/It runs/);
    $('button[aria-label="Stop"]').click();
    expect($('.console').textContent).toContain('killed');
  });

  it('stops at signing on a real iPhone with Team None, then runs once a team is chosen', () => {
    toRun('TrailNotes');
    const dest = $('select[aria-label="Run destination"]');
    dest.value = 'device';
    dest.dispatchEvent(new Event('change', { bubbles: true }));
    $('button[aria-label="Run"]').click();
    vi.advanceTimersByTime(700);
    expect($('.console').textContent).toContain('Signing for "TrailNotes" requires a development team. Select a development team in the Signing & Capabilities editor.');
    expect(tipText()).toMatch(/Signing needs a team/);
    button('Choose my Personal Team').click();
    $('button[aria-label="Run"]').click();
    vi.advanceTimersByTime(1300);
    expect($('.activity').textContent).toMatch(/on My iPhone/);
    expect(tipText()).toMatch(/Developer Mode/);
  });

  it('runs the SwiftData template with a working Add Item button, then starts over', () => {
    toOptions();
    type('name', 'Log');
    type('org', 'com.example');
    choose('storage', 'SwiftData');
    button('Next').click();
    button('Create').click();
    expect($$('.nav li').map((l) => l.textContent)).toContain('Item.swift');
    expect($('.code').textContent).toContain('@Query private var items: [Item]');
    $('button[aria-label="Run"]').click();
    vi.advanceTimersByTime(1300);
    $('button[aria-label="Add Item"]').click();
    $('button[aria-label="Add Item"]').click();
    expect($$('.phone .rows li')).toHaveLength(2);
    button('Start over').click();
    expect($('.np-info h3').textContent).toBe('Open Xcode and start a project');
    expect($$('.np-stages button').filter((b) => !b.disabled)).toHaveLength(1);
  });

  it('sends a student whose name was cleared back to Options instead of the save panel', () => {
    toRun();
    $$('.np-stages button')[2].click();
    type('name', '   ');
    $$('.np-stages button')[3].click();
    expect($('.sheet-title')).not.toBeNull();
  });

  it('treats typed names as text, never as markup', () => {
    toOptions();
    type('name', '<img src=x onerror=alert(1)>');
    type('org', 'com.example');
    button('Next').click();
    expect($('.tree img')).toBeNull();
    expect($('.tree').textContent).toContain('<img src=x onerror=alert(1)>.xcodeproj');
    button('Create').click();
    expect(host.querySelector('img')).toBeNull();
  });
});
