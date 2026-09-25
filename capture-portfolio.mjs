import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('./index.html', 'utf8');
const urls = [...html.matchAll(/url:'([^']+)'/g)].map(m => m[1]);
if (!urls.length) { console.error('No portfolio URLs found in index.html'); process.exit(1); }

function slugify(url) {
  return url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);
}

const outDir = './assets/portfolio';
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function writeManifest() {
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(results, null, 2));
}

// Hard safety net: never let the whole script hang forever.
const HARD_DEADLINE_MS = 8 * 60 * 1000;
const hardTimer = setTimeout(() => {
  console.log('\nHARD DEADLINE HIT — writing partial manifest and exiting.');
  writeManifest();
  process.exit(1);
}, HARD_DEADLINE_MS);
hardTimer.unref?.();

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => { t = setTimeout(() => reject(new Error('watchdog-timeout:' + label)), ms); });
  return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(t)), timeout]);
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function captureOne(url, viewport, filePath) {
  const page = await browser.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  try {
    await withTimeout(page.setViewport(viewport), 5000, 'viewport');
    await withTimeout(page.goto(url, { waitUntil: 'load', timeout: 15000 }), 18000, 'goto');
    await new Promise(r => setTimeout(r, 500));
    await withTimeout(page.screenshot({ path: filePath, type: 'jpeg', quality: 68 }), 10000, 'screenshot');
    return true;
  } finally {
    withTimeout(page.close(), 5000, 'close').catch(() => {});
  }
}

async function capture(url) {
  const slug = slugify(url);
  let okDesktop = false, okMobile = false, err = '';
  try {
    okDesktop = await captureOne(url, { width: 1280, height: 800 }, path.join(outDir, `${slug}-desktop.jpg`));
  } catch (e) { err += 'desktop:' + e.message.split('\n')[0] + ' '; }
  try {
    okMobile = await captureOne(url, { width: 390, height: 844, isMobile: true, hasTouch: true }, path.join(outDir, `${slug}-mobile.jpg`));
  } catch (e) { err += 'mobile:' + e.message.split('\n')[0]; }
  console.log(okDesktop || okMobile ? 'OK   ' : 'FAIL ', slug, `[d:${okDesktop} m:${okMobile}]`, err);
  results.push({ url, slug, desktop: okDesktop, mobile: okMobile, error: err || undefined });
}

const CONCURRENCY = 4;
let idx = 0;
async function worker() {
  while (idx < urls.length) {
    const url = urls[idx++];
    await capture(url);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await withTimeout(browser.close(), 8000, 'browser-close').catch(() => {});

clearTimeout(hardTimer);
writeManifest();
const okCount = results.filter(r => r.desktop || r.mobile).length;
console.log(`\nDone: ${okCount}/${urls.length} sites captured (at least one viewport).`);
process.exit(0);
