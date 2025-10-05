#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCES = {
  LA: [
    // main 브랜치 raw
    'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1.geojson',
    'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1_simplified.geojson',
    // media (Git LFS 실제 파일)
    'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1.geojson',
    'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1_simplified.geojson',
    // jsDelivr CDN
    'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@main/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1.geojson',
    'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@main/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1_simplified.geojson',
    // 과거 커밋 백업
    'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1.geojson',
    'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1_simplified.geojson',
    'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@9469f09/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1.geojson',
    'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@9469f09/releaseData/gbOpen/LAO/ADM1/geoBoundaries-LAO-ADM1_simplified.geojson',
  ],
  KH: [
    'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1.geojson',
    'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1_simplified.geojson',
    'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1.geojson',
    'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1_simplified.geojson',
    'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@main/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1.geojson',
    'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@main/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1_simplified.geojson',
    'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1.geojson',
    'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1_simplified.geojson',
    'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@9469f09/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1.geojson',
    'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@9469f09/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1_simplified.geojson',
  ],
};

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v='true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const targets = (args.country ? [args.country] : ['LA','KH']).map(c => c.toUpperCase());
const outdir = args.outdir || 'public/data';
await fs.mkdir(outdir, { recursive: true });

const DEADLINE = Number(args.deadline ?? 120000);
const RETRIES  = Number(args.retries  ?? 5);
const BACKOFF  = Number(args.backoff  ?? 1000);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function withDeadline(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DEADLINE);
  try { return await fetch(url, { signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

function isLFSPointer(text) {
  return /^version https:\/\/git-lfs\.github\.com\/spec\/v1/m.test(text);
}
function tryParseJSON(text) {
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try { return JSON.parse(t); } catch { return null; }
}

async function tryDownload(urls, outfile) {
  let lastErr = null;
  for (const url of urls) {
    for (let i=0; i<=RETRIES; i++) {
      try {
        process.stdout.write(`GET ${url} ... `);
        const r = await withDeadline(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = await r.text();
        if (isLFSPointer(body)) {
          console.log('LFS pointer detected; trying next source');
          throw new Error('LFS pointer');
        }
        const json = tryParseJSON(body);
        if (!json) throw new Error('Not JSON');
        await fs.writeFile(outfile, JSON.stringify(json));
        console.log('OK');
        return true;
      } catch (e) {
        lastErr = e;
        const wait = BACKOFF * (2**i);
        console.log(`failed (${e.message}), retry in ${wait}ms`);
        await sleep(wait);
      }
    }
  }
  console.error(`All sources failed. Last error: ${lastErr?.message}`);
  return false;
}

function normalizeProps(feature, cc) {
  const p = feature.properties ?? {};
  feature.properties = {
    ...p,
    id: String(p.shapeID ?? p.shapeISO ?? feature.id ?? ''),
    name: String(p.shapeName ?? p.NAME_1 ?? p.en_name ?? p.name ?? ''),
    country: cc,
  };
}

for (const cc of targets) {
  const urls = SOURCES[cc];
  const tmp = path.join(outdir, `__tmp_${cc}.geojson`);
  const ok = await tryDownload(urls, tmp);
  if (!ok) { process.exitCode = 1; continue; }

  const raw = JSON.parse(await fs.readFile(tmp, 'utf8'));
  if (Array.isArray(raw.features)) raw.features.forEach(f => normalizeProps(f, cc));
  const outfile = path.join(outdir, cc === 'LA' ? 'laos_provinces.geojson' : 'cambodia_provinces.geojson');
  await fs.writeFile(outfile, JSON.stringify(raw));
  await fs.rm(tmp, { force: true });
  console.log(`✔ Saved ${outfile}`);
}

console.log('Done.');
