// Combines screenshots into contact sheets for quick visual review.
// Usage: node tools/contact-sheet.mjs <dir-with-pngs> <out-dir> [perSheet=12] [cols=4]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const [dir, out, per = '12', cols = '4'] = process.argv.slice(2);
const imgs = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
for (let k = 0; k < imgs.length; k += Number(per)) {
  const chunk = imgs.slice(k, k + Number(per));
  const html = `<style>body{margin:0;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;background:#333;font:11px sans-serif;color:#fff}figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 4px}</style>` +
    chunk.map((f) => `<figure><img src="${pathToFileURL(path.join(dir, f)).href}"><figcaption>${f}</figcaption></figure>`).join('');
  const file = path.join(out, `sheet-${k}.html`);
  fs.writeFileSync(file, html);
  await p.goto(pathToFileURL(file).href);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(out, `sheet-${String(k).padStart(3, '0')}.png`), fullPage: true });
}
await b.close();
console.log('sheets in', out);
