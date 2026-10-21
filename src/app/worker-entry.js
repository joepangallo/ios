// Entry point of the run worker. tools/build.mjs bundles this file (the
// console engine and Swift Testing runner, no page code) into its own script
// and embeds it in the page; src/app/run-worker.js starts it from a Blob URL.
import { run, runTests } from '../engine/index.js';
import { serveRuns } from './worker-host.js';

serveRuns(self, { run, runTests });
