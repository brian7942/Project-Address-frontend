#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Agent, ProxyAgent } from 'undici';

const targets = [
  { iso3: 'LAO', out: 'laos_provinces.geojson', cc: 'LA' },
  { iso3: 'KHM', out: 'cambodia_provinces.geojson', cc: 'KH' },
];

// ---- CLI args ----
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
let subset = targets;
if (args.country) {
  const m = { LA: 'LAO', KH: 'KHM', LAO: 'LAO', KHM: 'KHM' };
  const want = m[args.country.toUpperCase()];
  subset = targets.filter(t => t.iso3 === want);
  if (!subset.length) {
    console.error('Invalid --country (use LA|KH)');
    process.exit(1);
  }
}
const outdir = args.outdir || 'public/data';
await fs.mkdir(outdir, { recursive: true });

// ---- timeouts & retries ----
const CONNECT_TIMEOUT = Number(args.connectTimeout ?? 30000);   // 30s
const DEADLINE = Number(args.deadline ?? 120000);               // 120s
const RETRIES = Number(args.retries ?? 5);                      // 5회 재시도(백오프)
const BACKOFF_BASE = Number(args.backoffBase ?? 1000);          // 1s

// ---- dispatcher (proxy 지원) ----
let dispatcher = new Agent({ connect: { timeout: CONNECT_TIMEOUT } });
if (args.proxy) {
  dispatcher = new ProxyAgent(args.proxy);
  console.log(`Using proxy: ${args.proxy}`);
}

// ---- 유틸 ----
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), DEADLINE);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, dispatcher });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchJSON(url, label) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      process.stdout.write(`${label ?? 'GET'}: ${url} ... `);
      const r = await fetchWithTimeout(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      console.log('OK');
      return await r.json();
    } catch (e) {
      lastErr = e;
      const wait = BACKOFF_BASE * Math.pow(2, i); // 1s,2s,4s,8s,16s...
      console.log(`\n  -> failed (${e.message}). retry ${i + 1}/${RETRIES} in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function downloadGeoJSON(url, outfile) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      console.log(`Downloading: ${url}`);
      const r = await fetchWithTimeout(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      await fs.writeFile(outfile, JSON.stringify(data));
      console.log(`✔ Saved: ${outfile}`);
      return;
    } catch (e) {
      lastErr = e;
      const wait = BACKOFF_BASE * Math.pow(2, i);
      console.log(`  -> failed (${e.message}). retry ${i + 1}/${RETRIES} in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

// ---- 메인 로직 ----
for (const t of subset) {
  const metaUrl = `https://www.geoboundaries.org/api/current/gbOpen/${t.iso3}/ADM1/`;
  const meta = await fetchJSON(metaUrl, 'Fetch meta');

  const dl = meta.gjDownloadURL || meta.simplifiedGeometryGeoJSON;
  if (!dl) {
    console.error('No download URL in meta (gjDownloadURL/simplifiedGeometryGeoJSON not found).');
    process.exit(1);
  }

  const tmp = path.join(outdir, `__tmp_${t.out}`);
  await downloadGeoJSON(dl, tmp);

  // 속성 매핑 보강
  const raw = JSON.parse(await fs.readFile(tmp, 'utf8'));
  if (Array.isArray(raw.features)) {
    for (const f of raw.features) {
      const p = f.properties ?? {};
      f.properties = {
        ...p,
        id: String(p.shapeID ?? p.shapeISO ?? f.id ?? ''),
        name: String(p.shapeName ?? p.NAME_1 ?? p.en_name ?? p.name ?? ''),
        country: t.cc,
      };
    }
  }
  const outfile = path.join(outdir, t.out);
  await fs.writeFile(outfile, JSON.stringify(raw));
  await fs.rm(tmp, { force: true });
  console.log(`✔ Finalized: ${outfile}`);
}

console.log('Done.');
