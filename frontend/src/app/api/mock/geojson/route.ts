import { NextResponse } from "next/server";

// 라오스(Vientiane) 근처 중심점
const CX = 102.6;   // lon
const CY = 17.97;   // lat

function rect(lon: number, lat: number, dx: number, dy: number) {
  return [
    [lon - dx, lat - dy],
    [lon + dx, lat - dy],
    [lon + dx, lat + dy],
    [lon - dx, lat + dy],
    [lon - dx, lat - dy],
  ];
}

export async function GET() {
  const features: any[] = [
    // === 폴리곤: 비엔티안 코어/북/남 ===
    {
      type: "Feature",
      properties: { id: "vte-core", name: "Vientiane Core", type: "admin", level: 3 },
      geometry: { type: "Polygon", coordinates: [rect(CX, CY, 0.12, 0.10)] },
    },
    {
      type: "Feature",
      properties: { id: "vte-north", name: "Vientiane North", type: "admin", level: 3 },
      geometry: { type: "Polygon", coordinates: [rect(CX, CY + 0.13, 0.20, 0.12)] },
    },
    {
      type: "Feature",
      properties: { id: "vte-south", name: "Vientiane South", type: "admin", level: 3 },
      geometry: { type: "Polygon", coordinates: [rect(CX, CY - 0.13, 0.18, 0.12)] },
    },

    // === 멀티폴리곤: 보호구역 목업 ===
    {
      type: "Feature",
      properties: { id: "pa-mp-1", name: "Protected Area MP", type: "park" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [rect(CX + 0.10, CY + 0.28, 0.08, 0.06)],
          [rect(CX - 0.10, CY + 0.38, 0.07, 0.05)],
        ],
      },
    },

    // === 라인스트링: 메콩강(일부 구간) ===
    {
      type: "Feature",
      properties: { id: "mekong-vte", name: "Mekong (Vientiane segment)", type: "river" },
      geometry: {
        type: "LineString",
        coordinates: [
          [102.50, 17.85],
          [102.55, 17.90],
          [102.60, 17.95],
          [102.65, 18.00],
          [102.70, 18.05],
        ],
      },
    },

    // === 멀티라인: 국도 13 (목업) ===
    {
      type: "Feature",
      properties: { id: "r13", name: "Route 13 (mock)", type: "road" },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [102.41, 18.00],
            [102.52, 17.94],
            [102.60, 17.90],
          ],
          [
            [102.60, 17.90],
            [102.68, 17.80],
            [102.72, 17.72],
          ],
        ],
      },
    },

    // === 포인트: 주요 도시 ===
    {
      type: "Feature",
      properties: { id: "city-vte", name: "Vientiane", type: "city", pop_class: "A" },
      geometry: { type: "Point", coordinates: [102.600, 17.975] },
    },
    {
      type: "Feature",
      properties: { id: "city-lpb", name: "Luang Prabang", type: "city", pop_class: "B" },
      geometry: { type: "Point", coordinates: [102.135, 19.885] },
    },
    {
      type: "Feature",
      properties: { id: "city-svk", name: "Savannakhet", type: "city", pop_class: "B" },
      geometry: { type: "Point", coordinates: [104.750, 16.556] },
    },
    {
      type: "Feature",
      properties: { id: "city-pkz", name: "Pakse", type: "city", pop_class: "B" },
      geometry: { type: "Point", coordinates: [105.817, 15.117] },
    },
    {
      type: "Feature",
      properties: { id: "city-phonsavan", name: "Phonsavan", type: "city", pop_class: "C" },
      geometry: { type: "Point", coordinates: [103.216, 19.450] },
    },

    // === 멀티포인트: POI 묶음 ===
    {
      type: "Feature",
      properties: { id: "poi-mp", name: "VTE POIs", type: "poi" },
      geometry: {
        type: "MultiPoint",
        coordinates: [
          [102.605, 17.980],
          [102.615, 17.990],
          [102.590, 17.965],
        ],
      },
    },
  ];

  const fc = { type: "FeatureCollection", features };
  return NextResponse.json(fc, { headers: { "Cache-Control": "no-store" } });
}
