import fs from 'node:fs';
import path from 'node:path';

const workerPath = path.join(process.cwd(), '.open-next', 'worker.js');

if (!fs.existsSync(workerPath)) {
  console.error(`[patch-worker-cache] Not found: ${workerPath}. Run \"opennextjs-cloudflare build\" first.`);
  process.exit(1);
}

let src = fs.readFileSync(workerPath, 'utf8');

if (src.includes('OPENNEXT_STATIC_CACHE_PATCH')) {
  console.log('[patch-worker-cache] Patch already applied.');
  process.exit(0);
}

const needle = 'const url = new URL(request.url);';
const idx = src.indexOf(needle);
if (idx === -1) {
  console.error('[patch-worker-cache] Could not find insertion point in worker.js');
  process.exit(1);
}

const insert = `const url = new URL(request.url);
            // OPENNEXT_STATIC_CACHE_PATCH: force long-lived caching for Next.js build assets
            // Without this, some deployments return Cache-Control: max-age=0 for /_next/static/*,
            // causing slow repeat loads.
            if (url.pathname.startsWith("/_next/static/")) {
                const assetResp = await env.ASSETS.fetch(request);
                const headers = new Headers(assetResp.headers);
                headers.set("Cache-Control", "public, max-age=31536000, immutable");
                return new Response(assetResp.body, {
                    status: assetResp.status,
                    statusText: assetResp.statusText,
                    headers,
                });
            }`;

src = src.replace(needle, insert);
fs.writeFileSync(workerPath, src, 'utf8');
console.log('[patch-worker-cache] Applied static cache patch to .open-next/worker.js');
