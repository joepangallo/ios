// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import weather from '../../src/widgets/networking-weather-live.js';
import decoder from '../../src/widgets/networking-json-decoder.js';

const mounted = [];
function mount(widget, ctx = {}, props = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const controller = widget.mount(root, props, { icon: () => '', reducedMotion: true, ...ctx });
  mounted.push(() => { controller.destroy(); root.remove(); });
  return root;
}
afterEach(() => {
  mounted.splice(0).forEach((destroy) => destroy());
  vi.useRealTimers();
});

function change(element, value) {
  if (element.type === 'checkbox') element.checked = value;
  else element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
function editJSON(root, text) {
  const input = root.querySelector('textarea');
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return root.querySelector('#networking-json-decoder-result');
}
const todo = (number) => `{"userId":${number},"id":1,"title":"A number: 9007199254740993, escaped quote: \\"","completed":false}`;
const reply = (temperature, ms = 100) => ({
  ok: true, status: 200, ms,
  text: JSON.stringify({ current: { temperature_2m: temperature, wind_speed_10m: 4, time: '2026-10-20T00:00' } }),
});

describe('live weather request state', () => {
  it('keeps a pending response paired with its city, then allows a new city request', async () => {
    vi.useFakeTimers();
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const fetchJSON = vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(reply(12));
    const root = mount(weather, { fetchJSON });
    const city = root.querySelector('select');
    const offline = root.querySelector('#networking-weather-live-offline');
    const invalid = root.querySelector('#networking-weather-live-bad');
    const fetch = root.querySelector('#networking-weather-live-fetch');
    fetch.click();
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchJSON).toHaveBeenCalledTimes(1);
    expect(fetchJSON.mock.calls[0][0]).toContain('latitude=35.68&longitude=139.69');
    expect([city.disabled, offline.disabled, invalid.disabled]).toEqual([true, true, true]);
    // Even a dispatched change cannot relabel or alter an in-flight request.
    change(city, 'london');
    change(offline, true);
    change(invalid, true);
    expect(city.value).toBe('tokyo');
    expect(offline.checked).toBe(false);
    expect(invalid.checked).toBe(false);

    finish(reply(29, 1000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(root.querySelector('.nwl-city').textContent).toBe('Tokyo');
    expect(root.querySelector('.nwl-temp').textContent).toBe('29.0 °C');
    expect([city.disabled, offline.disabled, invalid.disabled, fetch.disabled]).toEqual([false, false, false, false]);

    change(city, 'london');
    expect(root.querySelector('.nwl-state').textContent).toContain('.idle');
    fetch.click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchJSON.mock.calls[1][0]).toContain('latitude=51.51&longitude=-0.13');
    expect(root.querySelector('.nwl-city').textContent).toBe('London');
    expect(root.querySelector('.nwl-temp').textContent).toBe('12.0 °C');
    expect(root.querySelector('.nwl-note').textContent).toContain('1000 ms to 100 ms');
    expect(root.querySelector('.nwl-note').textContent).toContain('elapsed time alone does not identify the cause');
  });

  it('unlocks request controls after the simulated offline failure', async () => {
    vi.useFakeTimers();
    const fetchJSON = vi.fn();
    const root = mount(weather, { fetchJSON });
    change(root.querySelector('#networking-weather-live-offline'), true);
    root.querySelector('#networking-weather-live-fetch').click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(root.querySelector('.nwl-state').textContent).toContain('.failed');
    expect([...root.querySelectorAll('select, input')].every((control) => !control.disabled)).toBe(true);
  });
});

describe('JSON decoder numeric fidelity', () => {
  // Expected values were checked with Foundation JSONDecoder on Swift 6.4.1.
  it.each([
    ['9007199254740993', '9007199254740993'],
    ['9223372036854775807', '9223372036854775807'],
    ['-9223372036854775808', '-9223372036854775808'],
    ['9.007199254740993e15', '9007199254740993'],
    ['9007199254740993.0', '9007199254740993'],
    ['9223372036854775000.0', '9223372036854775000'],
    ['9007199254740993.123', '9007199254740993'],
    ['18446744073709551615e-3', '18446744073709551'],
    ['10000000000000000.0000000000000000000000000000000000000000001', '10000000000000000'],
    ['12e2', '1200'],
    ['120e-1', '12'],
    ['-0', '0'],
    ['0e999999999999', '0'],
    ['1e-9999', '0'],
  ])('decodes %s as the exact Swift Int %s', (literal, expected) => {
    const result = editJSON(mount(decoder), todo(literal));
    expect(result.classList.contains('ok')).toBe(true);
    expect(result.textContent).toContain(`userId: ${expected}, id: 1`);
    expect(result.textContent).toContain('A number: 9007199254740993');
    expect(result.textContent).toContain('completed: false');
  });

  it.each([
    '9223372036854775808', '-9223372036854775809',
    '9.223372036854775808e18', '9223372036854775807.0',
    '-9223372036854775808.0', '1e400', '3.5', '35e-1',
    '9007199254740993.1234', '18446744073709551616e-3',
    '9007199254740991.99999999999999999999999999999999999999',
    '9007199254740992.99999999999999999999999999999999999999',
    '10000000000000000.99999999999999999999999999999999999999',
  ])('reports an unrepresentable Int for %s', (literal) => {
    const result = editJSON(mount(decoder), todo(literal));
    expect(result.classList.contains('bad')).toBe(true);
    expect(result.textContent).toContain('DecodingError.dataCorrupted');
    expect(result.textContent).toContain(`Number ${literal} is not representable in Swift.`);
    expect(result.textContent).toContain('64-bit Int');
  });

  it.each(['"9007199254740993"', 'true', '[]', '{}'])('does not coerce %s to an Int', (literal) => {
    const result = editJSON(mount(decoder), todo(literal));
    expect(result.textContent).toContain('DecodingError.typeMismatch');
    expect(result.textContent).toContain('["userId"]');
  });

  it('preserves numeric tokens inside arrays alongside strings, booleans and optional nulls', () => {
    const root = mount(decoder, {}, { preset: 'todos' });
    change(root.querySelector('#networking-json-decoder-opt-Todo-0'), true);
    const result = editJSON(root, `[${todo('9007199254740993')}, ${todo('null')},]`);
    expect(result.classList.contains('ok')).toBe(true);
    expect(result.textContent).toContain('Todo(userId: Optional(9007199254740993), id: 1');
    expect(result.textContent).toContain('Todo(userId: nil, id: 1');
  });

  it('retains Double decoding and rejects Double overflow or underflow', () => {
    const root = mount(decoder);
    change(root.querySelector('#networking-json-decoder-type-Todo-0'), 'Double');
    expect(editJSON(root, todo('12.5e1')).textContent).toContain('userId: 125.0');
    expect(editJSON(root, todo('-0.0')).textContent).toContain('userId: -0.0');
    for (const literal of ['1e400', '1e-400']) {
      const result = editJSON(root, todo(literal));
      expect(result.textContent).toContain('DecodingError.dataCorrupted');
      expect(result.textContent).toContain(`Number ${literal} is not representable in Swift.`);
    }
  });

  it('uses the original response text when loading live JSON', async () => {
    const text = todo('9007199254740993');
    const root = mount(decoder, { fetchJSON: vi.fn().mockResolvedValue({ ok: true, ms: 5, text, json: JSON.parse(text) }) });
    root.querySelector('#networking-json-decoder-live').click();
    await Promise.resolve();
    expect(root.querySelector('textarea').value).toBe(text);
    expect(root.querySelector('#networking-json-decoder-result').textContent).toContain('userId: 9007199254740993,');
  });
});
