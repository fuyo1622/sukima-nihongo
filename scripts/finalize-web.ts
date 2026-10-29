/**
 * Finishes the web build in dist/ after `expo export -p web` (see `npm run build:web`, which Vercel runs):
 * stamps the service worker with this build's version and registers it in the page, so the Home Screen app
 * opens offline, and tells the app its build (src/lib/webApp.web.ts), so after an update it can say the
 * progress was kept. The dev server serves public/ unchanged and never registers the worker.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(__dirname, '..', 'dist');
const version = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12) || Date.now().toString(36);

const swFile = join(DIST, 'sw.js');
writeFileSync(swFile, readFileSync(swFile, 'utf8').replace('__BUILD__', version));

const indexFile = join(DIST, 'index.html');
const html = readFileSync(indexFile, 'utf8');
const scripts = [
  `<script>window.__SUKIMA_BUILD__ = '${version}';</script>`,
  `<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));</script>`,
].join('');
if (!html.includes('__SUKIMA_BUILD__')) writeFileSync(indexFile, html.replace('</head>', `${scripts}</head>`));

console.log(`Web build ready in dist/ (version ${version}).`);
