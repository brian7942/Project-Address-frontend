"use client";

import { GeoJSON } from "react-leaflet";
import L, { PathOptions, LatLng } from "leaflet";
import { useMemo, useRef } from "react";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonObject,
} from "geojson";
import type { BuildingFC, BuildingProperties } from "@/types/geo";

type F = Feature<Geometry, BuildingProperties>;
type FC = FeatureCollection<Geometry, BuildingProperties>;

type Props = {
  data: BuildingFC;                   // 건물 FC (Point 중심)
  selectedId?: string | null;         // 선택된 feature id
  onSelect?: (feature: F, layer: L.Layer) => void;
};

export default function BuildingLayer({ data, selectedId, onSelect }: Props) {
  const selectedLayerRef = useRef<L.Path | null>(null);

  // 기본/호버/선택 스타일
  const base = useMemo<PathOptions>(
    () => ({ color: "#2563eb", weight: 1, opacity: 0.9, fill: true, fillOpacity: 0.25 }),
    []
  );
  const hover = useMemo<PathOptions>(
    () => ({ color: "#0891b2", weight: 2, opacity: 1, fill: true, fillOpacity: 0.35 }),
    []
  );
  const selected = useMemo<PathOptions>(
    () => ({ color: "#f97316", weight: 3, opacity: 1, fill: true, fillColor: "#f97316", fillOpacity: 0.4 }),
    []
  );

  // feature id 추출: properties.id 우선, 없으면 feature.id
  function getId(feat?: Feature<Geometry, unknown>): string {
    if (!feat) return "";
    const pid = (feat.properties as Record<string, unknown> | null)?.["id"];
    if (typeof pid === "string" || typeof pid === "number") return String(pid);
    if (typeof feat.id === "string" || typeof feat.id === "number") return String(feat.id);
    return "";
    }

  // StyleFunction<any>와 호환: feature는 optional
  function resolveStyle(feat?: Feature<Geometry, unknown>): PathOptions {
    const isSelected =
      selectedId != null && selectedId !== "" && getId(feat) === String(selectedId);
    return isSelected ? selected : base;
  }

  // 포인트 렌더: circleMarker로
  function pointToLayer(
    feature: Feature<Geometry, unknown>,
    latlng: LatLng
  ): L.Layer {
    return L.circleMarker(latlng, {
      radius: 5,
      ...resolveStyle(feature),
    });
  }

  // 이벤트 바인딩
  function onEachFeature(
    feature: Feature<Geometry, unknown>,
    layer: L.Layer
  ) {
    if (layer instanceof L.Path) {
      // 초기 스타일
      layer.setStyle(resolveStyle(feature));

      // 호버
      layer.on("mouseover", () => {
        layer.setStyle(hover);
        const el = (layer as L.Path).getElement?.() as SVGElement | HTMLElement | null | undefined;
        if (el && (el instanceof SVGElement || el instanceof HTMLElement)) {
          el.style.cursor = "pointer";
        }
      });

      layer.on("mouseout", () => {
        // 선택된 레이어는 유지
        if (selectedLayerRef.current === layer) {
          layer.setStyle(selected);
        } else {
          layer.setStyle(resolveStyle(feature));
        }
      });
    }

    // 클릭: 선택/콜백
    layer.on("click", () => {
      if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
        // 이전 선택을 기본 스타일로 복귀
        selectedLayerRef.current.setStyle(base);
      }
      if (layer instanceof L.Path) {
        selectedLayerRef.current = layer;
        layer.setStyle(selected);
        layer.bringToFront?.();
      }

      // 사용자 콜백
      onSelect?.(feature as F, layer);
    });
  }

  return (
    <GeoJSON
      data={data as unknown as GeoJsonObject}
      style={(feat?: Feature<Geometry, unknown>) => resolveStyle(feat)}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
      bubblingMouseEvents={false}
      interactive
    />
  );
}
