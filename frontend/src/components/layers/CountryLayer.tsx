"use client";

import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, GeoJsonProperties } from "geojson";
import type { PathOptions } from "leaflet";

type G = GeoJSON.Polygon | GeoJSON.MultiPolygon;
type ISO3 = "LAO" | "KHM";

const LOCAL_ISO_URL: Record<ISO3, string> = {
  LAO: "/data/laos_country.geojson",
  KHM: "/data/cambodia_country.geojson",
};

const BASE_PADDING = 24;           // 공통 패딩(px) - 줌 계산에 사용
const MAX_COUNTRY_ZOOM = 7;        // 국가 보기 상한 줌
const LAO_BIAS_RATIO: number = 0.01; // ← number로 넓힘(리터럴 경고 방지)

function normIso(p: any, fallback: ISO3) {
  return (p?.iso as ISO3) ?? (p?.ISO_A3 as ISO3) ?? (p?.ADM0_A3 as ISO3) ?? fallback;
}
function normName(p: any, fallback: string) {
  return (p?.name as string) ?? (p?.ADMIN as string) ?? (p?.NAME as string) ?? fallback;
}

async function fetchJSON(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

async function loadAdm0One(iso: ISO3): Promise<Feature<G, GeoJsonProperties>[]> {
  // 1) 로컬 단일 국가 파일
  for (const url of [LOCAL_ISO_URL[iso]]) {
    try {
      const j = (await fetchJSON(url)) as FeatureCollection<G, any>;
      const feats = (j.features ?? []).map((f) => ({
        ...f,
        properties: { ...f.properties, iso: normIso(f.properties, iso), name: normName(f.properties, iso === "LAO" ? "Laos" : "Cambodia") },
      })) as Feature<G, GeoJsonProperties>[];
      if (feats.length) return feats;
    } catch {}
  }

  // 2) 로컬 countries.geojson에서 필터
  try {
    const j = (await fetchJSON("/data/countries.geojson")) as FeatureCollection<G, any>;
    const feats = (j.features ?? [])
      .filter((f) => {
        const p = f.properties ?? {};
        const code = p.iso_a3 ?? p.ADM0_A3 ?? p.ISO_A3;
        return String(code) === iso;
      })
      .map((f) => ({
        ...f,
        properties: { ...f.properties, iso, name: normName(f.properties, iso === "LAO" ? "Laos" : "Cambodia") },
      })) as Feature<G, GeoJsonProperties>[];
    if (feats.length) return feats;
  } catch {}

  // 3) jsDelivr (geoBoundaries ADM0)
  try {
    const url = `https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@main/releaseData/gbOpen/${iso}/ADM0/geoBoundaries-${iso}-ADM0.geojson`;
    const j = (await fetchJSON(url)) as FeatureCollection<G, any>;
    const feats = (j.features ?? []).map((f) => ({
      ...f,
      properties: { ...f.properties, iso, name: normName(f.properties, iso === "LAO" ? "Laos" : "Cambodia") },
    })) as Feature<G, GeoJsonProperties>[];
    if (feats.length) return feats;
  } catch {}

  // 4) GitHub Raw (geoBoundaries ADM0)
  try {
    const url = `https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/${iso}/ADM0/geoBoundaries-${iso}-ADM0.geojson`;
    const j = (await fetchJSON(url)) as FeatureCollection<G, any>;
    const feats = (j.features ?? []).map((f) => ({
      ...f,
      properties: { ...f.properties, iso, name: normName(f.properties, iso === "LAO" ? "Laos" : "Cambodia") },
    })) as Feature<G, GeoJsonProperties>[];
    if (feats.length) return feats;
  } catch {}

  // 모두 실패 시 빈 배열
  return [];
}

export default function CountryLayer({
  adminCountry,
  onPick,
}: {
  /** ISO3: "LAO" | "KHM" | ""(초기) */
  adminCountry?: string;
  onPick?: (iso: string, name?: string) => void;
}) {
  const map = useMap();
  const [fc, setFc] = useState<FeatureCollection<G, GeoJsonProperties> | null>(null);
  const geoRef = useRef<L.GeoJSON<any>>(null);
  const selectedIsoRef = useRef<string | null>(null);
  const [visibleIso, setVisibleIso] = useState<string | null>(null);

  // 스타일
  const base = useMemo<PathOptions>(() => ({ color: "#2563eb", weight: 1, fill: true, fillOpacity: 0.04 }), []);
  const hover = useMemo<PathOptions>(() => ({ ...base, weight: 2, color: "#10b981", fillOpacity: 0.08 }), [base]);
  const selected = useMemo<PathOptions>(() => ({ ...base, weight: 3, color: "#ef4444", fillOpacity: 0.12 }), [base]);

  // 두 나라 ADM0 로드
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const [lao, khm] = await Promise.all([loadAdm0One("LAO"), loadAdm0One("KHM")]);
        if (abort) return;
        const merged: FeatureCollection<G, GeoJsonProperties> = {
          type: "FeatureCollection",
          features: [...lao, ...khm],
        };
        setFc(merged);
      } catch (e) {
        console.error("[CountryLayer] ADM0 load failed:", e);
        if (!abort) setFc(null);
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  // 전체 보기
  const fitAll = () => {
    if (!fc) return;
    const b = L.geoJSON(fc as any).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [BASE_PADDING, BASE_PADDING], maxZoom: 6 });
  };

  // ✅ 목표 줌/중심을 미리 계산해서 애니메이션 1회만 수행
  function flyToCountry(bounds: L.LatLngBounds, iso?: string) {
    if (!bounds.isValid()) return;

    // 1) 경계를 담기 위한 기본 줌(대칭 패딩) 계산 — 타입 안전한 오버로드 사용
    const fitZ = map.getBoundsZoom(bounds, true, L.point(BASE_PADDING, BASE_PADDING));
    let targetZ = Math.min(fitZ, MAX_COUNTRY_ZOOM);

    // 2) 라오스만 필요 시 +1 단계
    if (iso === "LAO" && targetZ < MAX_COUNTRY_ZOOM) targetZ += 1;

    // 3) 기본 중심
    let targetCenter = bounds.getCenter();

    // 4) 라오스만 중심을 위로 살짝 치우침(픽셀 좌표 보정) — dy가 0일 땐 스킵
    if (iso === "LAO") {
      const size = map.getSize();
      const dy = Math.round(size.y * LAO_BIAS_RATIO);
      if (dy !== 0) {
        const pt = map.project(targetCenter, targetZ);
        pt.y -= dy;
        targetCenter = map.unproject(pt, targetZ);
      }
    }

    // 5) 단 한번의 flyTo로 이동
    map.flyTo(targetCenter, targetZ, { duration: 0.6 });
  }

  // 초기: 두 나라 전체
  useEffect(() => {
    if (!fc) return;
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc]);

  // 상위 상태(드롭다운/리셋) 변화에 따라 표시/이동
  useEffect(() => {
    if (!fc) return;

    if (!adminCountry) {
      selectedIsoRef.current = null;
      setVisibleIso(null);                // 두 나라 모두
      geoRef.current?.eachLayer((ly: any) => ly.setStyle?.(base));
      fitAll();
      return;
    }

    // ① 화면엔 해당 ISO만 렌더
    setVisibleIso(adminCountry);

    // ② 스타일 초기화 후 선택 ISO에만 selected 스타일 적용
    geoRef.current?.eachLayer((ly: any) => ly.setStyle?.(base));
    geoRef.current?.eachLayer((ly: any) => {
      const p = (ly as any).feature?.properties ?? {};
      if (p?.iso === adminCountry) (ly as any).setStyle?.(selected);
    });

    // ③ 경계로 한 번에 이동 (라오스 보정 포함)
    const feature = fc.features.find((f) => (f.properties as any)?.iso === adminCountry);
    if (!feature) return;
    const b = L.geoJSON(feature as any).getBounds();
    flyToCountry(b, adminCountry);
    selectedIsoRef.current = adminCountry;
  }, [adminCountry, fc, map, base, selected]);

  function onEachFeature(feature: Feature<G, GeoJsonProperties>, layer: L.Layer) {
    const props = feature.properties ?? {};
    const iso = (props as any)?.iso as string | undefined;
    (layer as any).setStyle?.(base);

    layer.on("mouseover", () => (layer as any).setStyle?.(hover));
    layer.on("mouseout", () => (layer as any).setStyle?.(selectedIsoRef.current === iso ? selected : base));

    layer.on("click", () => {
      // 이동은 여기서 하지 않음 — 상위 상태만 갱신해서 useEffect에서 1회 수행
      onPick?.(iso ?? "", (props as any)?.name);
    });
  }

  if (!fc) return null;

  // 선택이 있으면 해당 ISO만, 없으면 LAO/KHM 모두
  const filterFn = (f: Feature<G, GeoJsonProperties>) => {
    const iso = (f.properties as any)?.iso ?? "";
    if (!["LAO", "KHM"].includes(iso)) return false;
    return visibleIso ? iso === visibleIso : true;
  };

  return (
    <GeoJSON
      ref={geoRef as any}
      data={fc as any}
      filter={filterFn}
      style={() => base}
      onEachFeature={onEachFeature}
      bubblingMouseEvents={false}
      interactive
    />
  );
}
