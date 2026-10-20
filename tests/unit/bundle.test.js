import { it, expect } from 'vitest';
import { build } from 'esbuild';
import { testResultProblems } from '../../tools/check-test-results.mjs';

it('unwraps #require optionals after production minification', async () => {
  const bundle = await build({
    entryPoints: ['src/engine/index.js'],
    bundle: true, write: false, minify: true, format: 'esm', target: 'es2022', logLevel: 'silent',
  });
  const engine = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const result = await engine.runTests(`import Testing
@Test func unwrapsValues() throws {
    let count: Int? = 3
    let each: Double? = 30
    let off: Bool? = false
    let n = try #require(count)
    let amount = try #require(each)
    let enabled = try #require(off)
    #expect(n * 2 == 6)
    #expect(amount * 3 == 90)
    #expect(!enabled)
}`);
  expect(testResultProblems(result, 1)).toEqual([]);
});
