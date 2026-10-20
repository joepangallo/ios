import { describe, it, expect } from 'vitest';
import { runTests } from '../../src/engine/index.js';
import { testResultProblems } from '../../tools/check-test-results.mjs';

describe('course test acceptance checks', () => {
  it('accepts all cases of a passing parameterized test', async () => {
    const result = await runTests('import Testing\n@Test(arguments: [1, 2, 3]) func positive(_ n: Int) { #expect(n > 0) }');
    expect(testResultProblems(result, 3)).toEqual([]);
  });

  it('rejects a failed assertion even though the test built', async () => {
    const result = await runTests('import Testing\n@Test func broken() { #expect(1 == 2) }');
    expect(result.error).toBeNull();
    expect(testResultProblems(result, 1)).toEqual(['broken(): Expectation failed: 1 == 2']);
  });

  it('rejects a failed requirement even though the test built', async () => {
    const result = await runTests('import Testing\n@Test func required() throws { let x: Int? = nil; let y = try #require(x) }');
    expect(result.error).toBeNull();
    expect(testResultProblems(result, 1)).toEqual(['required(): Requirement failed: x']);
  });

  it('rejects a missing @Test annotation', async () => {
    const result = await runTests('import Testing\nfunc unchecked() { #expect(false) }');
    expect(result.error).toBeNull();
    expect(testResultProblems(result, 1)).toEqual(['Expected 1 tests, got 0']);
  });

  it('rejects a lost parameterized test case', async () => {
    const result = await runTests('import Testing\n@Test(arguments: [1, 2]) func positive(_ n: Int) { #expect(n > 0) }');
    expect(testResultProblems(result, 3)).toEqual(['Expected 3 tests, got 2']);
  });

  it('rejects a compile error', async () => {
    const result = await runTests('import Testing\nlet x: Int = "wrong"');
    expect(testResultProblems(result, 1).some((p) => p.startsWith('Build failed:'))).toBe(true);
  });
});
