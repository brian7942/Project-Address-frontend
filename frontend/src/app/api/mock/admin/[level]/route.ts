import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, ctx: { params: { level: string } }) {
  const { searchParams } = new URL(req.url);
  const bboxParam = searchParams.get("bbox"); // "minLon,minLat,maxLon,maxLat"
  const level = Number(ctx.params.level ?? 0);

  let cx = 126.978, cy = 37.5665; // 기본: 서울시청 근처
  if (bboxParam) {
    const parts = bboxParam.split(",").map((s) => Number(s));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const [minLon, minLat, maxLon, maxLat] = parts;
      cx = (minLon + maxLon) / 2;
      cy = (minLat + maxLat) / 2;
    }
  }

  // level에 따라 크기 살짝 변경 (순수 목업)
  const delta = Math.max(0.005, 0.02 - level * 0.003);

  const poly = [
    [cx - delta, cy - delta],
    [cx + delta, cy - delta],
    [cx + delta, cy + delta],
    [cx - delta, cy + delta],
    [cx - delta, cy - delta],
  ];

  const fc = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          id: `admin-l${level}`,
          name: `Mock Admin L${level}`,
          level,
        },
        geometry: { type: "Polygon", coordinates: [poly] },
      },
      {
        type: "Feature",
        properties: {
          id: `poi-l${level}`,
          name: `Mock POI L${level}`,
          level,
          type: "point",
        },
        geometry: { type: "Point", coordinates: [cx, cy] },
      },
    ],
  };

  return NextResponse.json(fc, { headers: { "Cache-Control": "no-store" } });
}
