// Runs a .swift file with the in-browser engine from the command line.
// Usage: node tools/swiftlite.mjs file.swift [--trace]
import fs from 'node:fs';
import { run } from '../src/engine/index.js';
const file = process.argv[2];
const r = await run(fs.readFileSync(file, 'utf8'), { trace: process.argv.includes('--trace') });
process.stdout.write(r.stdout);
if (r.error) { console.error(`[line ${r.error.line}] ${r.error.message} (${r.error.kind})`); process.exitCode = 1; }
