"use client";

import { GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

type FC = FeatureCollection<Geometry, any>;
type F = Feature<Geometry, any>;

type Props = {
  /** 'LAO' | 'KHM' */
  country: "LAO" | "KHM";
  /** Province(ADM1) 코드 또는 이름(GADM의 GID_1 또는 NAME_1) */
  provinceCode?: string | null;
  /** 표시 여부 */
  visible?: boolean;
  /** 선택 이벤트 */
  onSelect?: (info: {
    id: string;
    name?: string;
    props: Record<string, unknown>;
    bbox?: L.LatLngBoundsLiteral;
  }) => void;
  /** Leaflet pane */
  pane?: string;
};

const URLS: Record<Props["country"], string> = {
  LAO: "/data/laos_districts.geojson",
  KHM: "/data/cambodia_districts.geojson",
};

const baseStyle: L.PathOptions = {
  color: "#0ea5e9",      // 윤곽선 가독성
  weight: 1.5,
  fill: true,
  fillColor: "#60a5fa",
  fillOpacity: 0.06,     // 겹침 어두워 보이는 현상 완화
};

const hoverStyle: L.PathOptions = {
  color: "#0284c7",
  weight: 2,
  fillOpacity: 0.12,
};

const selectedStyle: L.PathOptions = {
  color: "#ef4444",
  weight: 2.5,
  fillOpacity: 0.16,
};

export default function DistrictLayer({
  country,
  provinceCode = null,
  visible = true,
  onSelect,
  pane = "overlayPane",
}: Props) {
  const [data, setData] = useState<FC | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 데이터 로드
  useEffect(() => {
    setData(null);
    setHoverId(null);
    setSelectedId(null);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch(URLS[country], { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json: FC) => setData(json))
      .catch((e) => {
        if (e.name !== "AbortError") console.error("[DistrictLayer] fetch error:", e);
      });

    return () => ctrl.abort();
  }, [country]);

  // Province(ADM1)로 필터링 — GID_1 또는 NAME_1 둘 다 지원
  const filtered: FC | null = useMemo(() => {
    if (!data) return null;
    if (!provinceCode) return data;

    const key = String(provinceCode);
    const list = (data.features ?? []).filter((f) => {
      const p = f.properties ?? {};
      const provCode =
        p.GID_1 ??
        p.ADM1_PCODE ??
        p.PCODE ??
        p.CODE_1 ??
        p.ID_1 ??
        p.PROV_CODE ??
        p.province_id ??
        null;
      const provName = p.NAME_1 ?? p.NAME ?? null;

      return (
        (provCode && String(provCode) === key) ||
        (provName && String(provName) === key)
      );
    });

    return { type: "FeatureCollection", features: list } as FC;
  }, [data, provinceCode]);

  function safeId(f: F): string {
    const p = f.properties ?? {};
    return String(
      (f as any).id ??
        p.GID_2 ??
        p.ADM2_PCODE ??
        p.PCODE ??
        p.CODE_2 ??
        p.ID_2 ??
        p.OBJECTID ??
        p.id ??
        ""
    );
  }

  function safeName(f: F): string | undefined {
    const p = f.properties ?? {};
    return (
      p.NAME_2 ??
      p.DIST_NAME ??
      p.DISTRICT ??
      p.NAME ??
      p.en_name ??
      p.local_name
    );
  }

  function styleFn(f: F): L.PathOptions {
    const fid = safeId(f);
    if (selectedId && fid === selectedId) return { ...baseStyle, ...selectedStyle };
    if (hoverId && fid === hoverId) return { ...baseStyle, ...hoverStyle };
    return baseStyle;
  }

  function getFeatureBounds(layer: L.Path): L.LatLngBoundsLiteral | undefined {
    const anyLayer = layer as any;
    if (typeof anyLayer.getBounds === "function") {
      const b = anyLayer.getBounds() as L.LatLngBounds;
      return [
        [b.getSouth(), b.getWest()],
        [b.getNorth(), b.getEast()],
      ];
    }
    return undefined;
  }

  function onEachFeature(f: F, layer: L.Layer) {
    const l = layer as L.Path;
    l.on("mouseover", () => setHoverId(safeId(f)));
    l.on("mouseout", () => setHoverId(null));
    l.on("click", () => {
      const fid = safeId(f);
      setSelectedId(fid);
      onSelect?.({
        id: fid,
        name: safeName(f),
        props: (f.properties ?? {}) as Record<string, unknown>,
        bbox: getFeatureBounds(l),
      });
    });
  }

  if (!visible || !filtered || (filtered.features ?? []).length === 0) return null;

  return (
    <GeoJSON
      key={country + (provinceCode ?? "")}
      data={filtered as any}
      style={styleFn}
      onEachFeature={onEachFeature}
      pane={pane}
    />
  );
}
