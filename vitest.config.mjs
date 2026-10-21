import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/generated/**', 'src/content/**'],
      reporter: ['text-summary', 'json-summary'],
      // Only the engine has a hard floor, checked file by file. Widget and app
      // shell coverage is reported but does not gate.
      thresholds: { perFile: true, 'src/engine/**/*.js': { lines: 80 } },
    },
  },
  // esbuild inlines .wasm imports as bytes in the real build; here the module reads the file at import time
  // so src/app/runtime.js can instantiate the real WebAssembly core under test.
  plugins: [{ name: 'wasm-binary', transform(code, id) { if (id.endsWith('.wasm')) return { code: `import fs from 'node:fs'; export default new Uint8Array(fs.readFileSync(${JSON.stringify(id)}))` }; return null; } }],
});
