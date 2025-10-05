// src/lib/address.ts
// 주소 생성 규칙(MVP): 타일 Morton + geometry 해시 (Leaflet 의존 제거)

import type { Feature, Geometry, GeoJsonProperties, Position } from "geojson";

export type F = Feature<Geometry, GeoJsonProperties>;
export type AdminForm = { country: string; state: string; city: string; village: string };

// --- GeoJSON bbox & 중심점 계산 (Leaflet 없이) ---
type BBox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

function bboxFromCoords(coords: Position[] | Position[][] | Position[][][] | Position[][][][]): BBox | null {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  function visit(node: any) {
    if (!node) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      const lon = node[0] as number;
      const lat = node[1] as number;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    // 배열이면 재귀 방문
    if (Array.isArray(node)) for (const c of node) visit(c);
  }

  visit(coords);
  if (minLon === Infinity) return null;
  return [minLon, minLat, maxLon, maxLat];
}

function centroidOfGeometry(g: Geometry): { lon: number; lat: number } | null {
  switch (g.type) {
    case "Point": {
      const [lon, lat] = g.coordinates as [number, number];
      return Number.isFinite(lon) && Number.isFinite(lat) ? { lon, lat } : null;
    }
    case "MultiPoint":
    case "LineString":
    case "MultiLineString":
    case "Polygon":
    case "MultiPolygon":
    case "GeometryCollection": {
      const bbox = g.type === "GeometryCollection"
        ? bboxFromCoords(g.geometries.map(gg => (gg as any).coordinates) as any)
        : bboxFromCoords((g as any).coordinates);
      if (!bbox) return null;
      const [minLon, minLat, maxLon, maxLat] = bbox;
      return { lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2 };
    }
    default:
      return null;
  }
}

// --- 타일/모튼/해시 ---
function lonLatToTile(lon: number, lat: number, z: number) {
  const n = Math.pow(2, z);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}
function part1by1(n: number) {
  n &= 0x0000ffff; n = (n ^ (n << 8)) & 0x00ff00ff;
  n = (n ^ (n << 4)) & 0x0f0f0f0f; n = (n ^ (n << 2)) & 0x33333333;
  n = (n ^ (n << 1)) & 0x55555555; return n;
}
function morton(x: number, y: number) { return (part1by1(y) << 1) | part1by1(x); }
function djb2(str: string) { let h = 5381; for (let i=0;i<str.length;i++) h=((h<<5)+h)+str.charCodeAt(i); return h>>>0; }

// --- 주소 생성 ---
export function buildAddressString(f: F, admin: AdminForm) {
  if (!f?.geometry) return null;

  const c = centroidOfGeometry(f.geometry);
  if (!c) return null;

  const { x, y } = lonLatToTile(c.lon, c.lat, 17);
  const blockNo = (morton(x, y) % 100000) + 1;
  const buildingNo = (djb2(JSON.stringify(f.geometry)) % 1000) + 1;

  const addr = `${admin.country}-${admin.state}-${admin.city}-${admin.village}-${blockNo}.${buildingNo}`;
  return { addr, blockNo, buildingNo };
}
