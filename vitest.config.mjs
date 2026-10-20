import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    testTimeout: 60000,
    coverage: { provider: 'v8', include: ['src/engine/**/*.js', 'src/app/highlight.js', 'src/app/glossary.js', 'src/app/compiler.js'], reporter: ['text-summary'] },
  },
  plugins: [{ name: 'wasm-binary', transform(code, id) { if (id.endsWith('.wasm')) return { code: 'export default new Uint8Array(0)' }; return null; } }],
});
