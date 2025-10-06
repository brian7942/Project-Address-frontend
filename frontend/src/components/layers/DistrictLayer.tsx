"use client";

import { GeoJSON } from "react-leaflet";
import L, { PathOptions, LatLngBoundsLiteral } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonObject,
} from "geojson";

type Props = {
  country: "LAO" | "KHM";
  /** Province 식별자: 코드(id) 또는 이름 */
  provinceCode: string | null;
  visible?: boolean;
  pane?: string;
  onSelect?: (info: {
    id: string;
    name?: string;
    props: Record<string, unknown>;
    bbox?: LatLngBoundsLiteral;
  }) => void;
};

type FCAny = FeatureCollection<Geometry, Record<string, unknown>>;
type FAny = Feature<Geometry, Record<string, unknown>>;

/** ---- 유틸: 다양한 스키마 호환 ---- */
function normalizeAdmName(s?: string | null) {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/kh/g, "x")
    .replace(/ph/g, "f");
}

function pickProvinceCode(props: Record<string, unknown>): string | undefined {
  const v =
    (props.GID_1 as string | number | undefined) ??
    (props.ADM1_PCODE as string | number | undefined) ??
    (props.PCODE as string | number | undefined) ??
    (props.CODE_1 as string | number | undefined) ??
    (props.ID_1 as string | number | undefined) ??
    (props.PROV_CODE as string | number | undefined) ??
    (props.province_id as string | number | undefined) ??
    (props.state as string | number | undefined) ??
    (props.state_id as string | number | undefined);
  return v != null ? String(v) : undefined;
}
function pickProvinceName(props: Record<string, unknown>): string | undefined {
  const v = (props.NAME_1 as string | undefined) ?? (props.NAME as string | undefined);
  return v ?? undefined;
}

/* ⬇️ 여기: f의 타입을 FAny로 넓혀 onEachFeature의 feature와 일치시킵니다. */
function pickDistrictId(props: Record<string, unknown>, f?: FAny): string | undefined {
  const v =
    (f?.id as string | number | undefined) ??
    (props.GID_2 as string | number | undefined) ??
    (props.ADM2_PCODE as string | number | undefined) ??
    (props.PCODE as string | number | undefined) ??
    (props.CODE_2 as string | number | undefined) ??
    (props.ID_2 as string | number | undefined) ??
    (props.OBJECTID as string | number | undefined) ??
    (props.id as string | number | undefined);
  return v != null ? String(v) : undefined;
}
function pickDistrictName(props: Record<string, unknown>): string | undefined {
  const v =
    (props.NAME_2 as string | undefined) ??
    (props.DIST_NAME as string | undefined) ??
    (props.DISTRICT as string | undefined) ??
    (props.NAME as string | undefined) ??
    (props.en_name as string | undefined) ??
    (props.local_name as string | undefined);
  return v ?? undefined;
}
/** ----------------------------------- */

export default function DistrictLayer({
  country,
  provinceCode,
  visible = true,
  pane,
  onSelect,
}: Props) {
  const [fc, setFc] = useState<FCAny | null>(null);
  const [filtered, setFiltered] = useState<FCAny | null>(null);
  const selectedRef = useRef<L.Path | null>(null);

  // 스타일
  const base = useMemo<PathOptions>(
    () => ({ color: "#1f2937", weight: 1, opacity: 0.9, fill: true, fillOpacity: 0.05 }),
    []
  );
  const hover = useMemo<PathOptions>(
    () => ({ color: "#06b6d4", weight: 2, opacity: 1, fill: true, fillOpacity: 0.08 }),
    []
  );
  const selected = useMemo<PathOptions>(
    () => ({ color: "#f97316", weight: 3, opacity: 1, fill: true, fillOpacity: 0.12 }),
    []
  );

  // 데이터 로드
  useEffect(() => {
    let aborted = false;
    async function run() {
      const url =
        country === "LAO"
          ? "/data/laos_districts.geojson"
          : "/data/cambodia_districts.geojson";
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as FCAny;
        if (!aborted) setFc(j);
      } catch (e) {
        if (!aborted) setFc(null);
        // eslint-disable-next-line no-console
        console.error("[DistrictLayer] fetch failed:", e);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [country]);

  // Province 필터링 (코드 매칭 OR 이름 정규화 매칭)
  useEffect(() => {
    if (!fc) {
      setFiltered(null);
      return;
    }
    if (!provinceCode) {
      setFiltered(fc);
      return;
    }
    const codeNorm = normalizeAdmName(provinceCode);
    const feats = fc.features.filter((f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const provCode = (pickProvinceCode(p) ?? "").toString();
      const provName = (pickProvinceName(p) ?? "").toString();

      if (provCode && provCode === provinceCode) return true;
      if (provName && normalizeAdmName(provName) === codeNorm) return true;
      return false;
    });
    setFiltered({ type: "FeatureCollection", features: feats });
  }, [fc, provinceCode]);

  // 선택 기준 id
  function getId(feature?: Feature<Geometry, unknown>): string {
    if (!feature) return "";
    const p = (feature.properties ?? {}) as Record<string, unknown>;
    const id =
      (p.id as string | number | undefined) ??
      (feature.id as string | number | undefined) ??
      pickDistrictId(p, feature as FAny);
    return id != null ? String(id) : "";
  }

  // StyleFunction<any> 호환
  function resolveStyle(feature?: Feature<Geometry, unknown>): PathOptions {
    const isSel =
      selectedRef.current &&
      (selectedRef.current as unknown as { __id?: string }).__id === getId(feature);
    return isSel ? selected : base;
  }
  const styleFn: L.StyleFunction<any> = (feature?: Feature<Geometry, any>) => resolveStyle(feature);

  // 레이어 초기화/인터랙션
  function onEachFeature(feature: FAny, layer: L.Layer) {
    if (layer instanceof L.Path) {
      // id 메모 (선택 비교 용)
      (layer as unknown as { __id?: string }).__id = getId(feature);
      layer.setStyle(resolveStyle(feature));

      layer.on("mouseover", () => {
        layer.setStyle(hover);
        const el = (layer as L.Path).getElement?.() as SVGElement | HTMLElement | null | undefined;
        if (el && (el instanceof SVGElement || el instanceof HTMLElement)) {
          el.style.cursor = "pointer";
        }
      });

      layer.on("mouseout", () => {
        if (selectedRef.current === layer) {
          layer.setStyle(selected);
        } else {
          layer.setStyle(resolveStyle(feature));
        }
      });
    }

    layer.on("click", () => {
      if (selectedRef.current && selectedRef.current !== layer && selectedRef.current instanceof L.Path) {
        selectedRef.current.setStyle(base);
      }
      if (layer instanceof L.Path) {
        selectedRef.current = layer;
        layer.setStyle(selected);
        layer.bringToFront?.();
      }

      const p = (feature.properties ?? {}) as Record<string, unknown>;
      const id = getId(feature);
      const name = pickDistrictName(p);

      // bbox 계산
      let bbox: LatLngBoundsLiteral | undefined;
      if (layer instanceof L.Polygon) {
        const b = layer.getBounds();
        if (b.isValid()) {
          const sw = b.getSouthWest();
          const ne = b.getNorthEast();
          bbox = [
            [sw.lat, sw.lng],
            [ne.lat, ne.lng],
          ];
        }
      }

      onSelect?.({ id, name, props: p, bbox });
    });
  }

  if (!visible || !filtered) return null;

  return (
    <GeoJSON
      key={country + (provinceCode ?? "")}
      data={filtered as unknown as GeoJsonObject}
      style={styleFn}
      onEachFeature={onEachFeature}
      pane={pane}
      bubblingMouseEvents={false}
      interactive
    />
  );
}
