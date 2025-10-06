"use client";

import { GeoJSON } from "react-leaflet";
import L, { PathOptions, LatLng } from "leaflet";
import { useMemo } from "react";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonObject,
} from "geojson";

type Props = {
  /** 폴리곤/라인/포인트 섞여 있어도 OK */
  data: FeatureCollection<Geometry, Record<string, unknown>>;
  interactive?: boolean;
  onSelect?: (f: Feature<Geometry, Record<string, unknown>>, layer: L.Layer) => void;
  pane?: string;
};

export default function StaticLayer({
  data,
  interactive = true,
  onSelect,
  pane,
}: Props) {
  // 기본/호버/선택 스타일
  const base = useMemo<PathOptions>(
    () => ({ color: "#374151", weight: 1, opacity: 0.9, fill: true, fillOpacity: 0.05 }),
    []
  );
  const hover = useMemo<PathOptions>(
    () => ({ color: "#06b6d4", weight: 2, opacity: 1, fill: true, fillOpacity: 0.08 }),
    []
  );

  // ✅ react-leaflet의 타입과 일치: feature는 optional, 제네릭 any
  const styleFn: L.StyleFunction<any> = (feature?: Feature<Geometry, any>) => {
    // 필요시 feature?.properties 로 분기
    return base;
  };

  // 포인트는 circleMarker로
  function pointToLayer(
    feature: Feature<Geometry, any>,
    latlng: LatLng
  ): L.Layer {
    return L.circleMarker(latlng, { radius: 4, ...base });
  }

  // 인터랙션 바인딩
  function onEachFeature(
    feature: Feature<Geometry, Record<string, unknown>>,
    layer: L.Layer
  ) {
    if (layer instanceof L.Path) {
      layer.on("mouseover", () => {
        layer.setStyle(hover);
        const el = (layer as L.Path).getElement?.() as SVGElement | HTMLElement | null | undefined;
        if (el && (el instanceof SVGElement || el instanceof HTMLElement)) {
          el.style.cursor = "pointer";
        }
      });
      layer.on("mouseout", () => {
        layer.setStyle(base);
      });
    }
    if (interactive) {
      layer.on("click", () => onSelect?.(feature, layer));
    }
  }

  return (
    <GeoJSON
      data={data as unknown as GeoJsonObject}
      style={styleFn}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
      pane={pane}
      bubblingMouseEvents={false}
      interactive={interactive}
    />
  );
}
