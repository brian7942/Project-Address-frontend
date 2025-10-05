import { NextRequest, NextResponse } from "next/server";

// 빌드/개발 캐시가 간섭하지 않도록 강제 동적 처리
export const dynamic = "force-dynamic";
// export const runtime = "edge";

/**
 * 간단한 건물 목업 생성기
 * - 기본 중심: 라오스 비엔티안 (cx, cy)
 * - ?bbox=minLon,minLat,maxLon,maxLat
 * - ?count=500 (기본 500, 최대 5000)
 * - ?dx,?dy,?gapX,?gapY (도 단위)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const bboxParam = url.searchParams.get("bbox");
    const countParam = url.searchParams.get("count");
    const dxParam = url.searchParams.get("dx");
    const dyParam = url.searchParams.get("dy");
    const gapXParam = url.searchParams.get("gapX");
    const gapYParam = url.searchParams.get("gapY");

    // 기본 중심/범위
    let cx = 102.6;
    let cy = 17.97;
    let minLon = cx - 0.01,
      minLat = cy - 0.01,
      maxLon = cx + 0.01,
      maxLat = cy + 0.01;

    if (bboxParam) {
      const p = bboxParam.split(",").map((v) => Number(v.trim()));
      if (p.length === 4 && p.every((n) => Number.isFinite(n)) && p[0] < p[2] && p[1] < p[3]) {
        [minLon, minLat, maxLon, maxLat] = p as [number, number, number, number];
        cx = (minLon + maxLon) / 2;
        cy = (minLat + maxLat) / 2;
      } else {
        return NextResponse.json(
          { error: "Invalid bbox. Use 'minLon,minLat,maxLon,maxLat' with min < max." },
          { status: 400 }
        );
      }
    }

    // 그리드 스텝/간격 (도 단위)
    const dx = clampFinite(Number(dxParam), 0.00005, 0.01) ?? 0.00035;
    const dy = clampFinite(Number(dyParam), 0.00005, 0.01) ?? 0.00028;
    const gapX = clampFinite(Number(gapXParam), 0.0, 0.02) ?? 0.00018;
    const gapY = clampFinite(Number(gapYParam), 0.0, 0.02) ?? 0.00015;

    // 개수 제한
    const DEFAULT_MAX = 500;
    const HARD_CAP = 5000;
    const maxCountRaw = clampInt(Number(countParam), 1, HARD_CAP); // number | undefined
    const maxCount: number = maxCountRaw ?? DEFAULT_MAX; // <-- 여기서 타입 확정

    // 너무 작은 bbox 방어: 한 칸이라도 생성
    if (maxLon - minLon < dx || maxLat - minLat < dy) {
      const features = [polygonFeature(1, cx - dx / 2, cy - dy / 2, dx, dy)];
      return jsonNoStore({
        type: "FeatureCollection",
        features,
        meta: {
          source: "mock-buildings",
          bbox: [minLon, minLat, maxLon, maxLat],
          count: features.length,
          params: { dx, dy, gapX, gapY, maxCount }, // maxCount는 number 확정
        },
      });
    }

    // 격자 생성
    const features: any[] = [];
    let idSeq = 1;
    const eps = 1e-12;

    for (let lon = minLon; lon + dx <= maxLon + eps; lon += dx + gapX) {
      for (let lat = minLat; lat + dy <= maxLat + eps; lat += dy + gapY) {
        features.push(polygonFeature(idSeq, lon, lat, dx, dy));
        if (features.length >= maxCount) break;
        idSeq++;
      }
      if (features.length >= maxCount) break;
    }

    return jsonNoStore({
      type: "FeatureCollection",
      features,
      meta: {
        source: "mock-buildings",
        bbox: [minLon, minLat, maxLon, maxLat],
        count: features.length,
        params: { dx, dy, gapX, gapY, maxCount }, // number 타입
      },
    });
  } catch (err: any) {
    console.error("[mock/buildings] error:", err);
    return NextResponse.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

// ---------- 유틸 ----------

function polygonFeature(id: number, lon: number, lat: number, dx: number, dy: number) {
  const poly = [
    [lon, lat],
    [lon + dx, lat],
    [lon + dx, lat + dy],
    [lon, lat + dy],
    [lon, lat],
  ];
  return {
    type: "Feature",
    properties: {
      id: `b-${id}`,
      name: `Building ${id}`,
      kind: "building",
      level: 0,
    },
    geometry: { type: "Polygon", coordinates: [poly] },
  };
}

function clampFinite(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, min), max);
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return undefined;
  const i = Math.trunc(n);
  return Math.min(Math.max(i, min), max);
}

function jsonNoStore(payload: unknown) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
