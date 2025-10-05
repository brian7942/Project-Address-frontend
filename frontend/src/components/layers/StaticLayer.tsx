"use client";

import { memo, useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import type { GeoJSON as LeafletGeoJSON, Layer, LatLng } from "leaflet";
import L from "leaflet";
import type {
  Geometry,
  Feature,
  Point,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
} from "geojson";
import type {
  BuildingFC,
  BuildingProperties,
  FeatureAnyGeom,
} from "@/types/geo";

/**
 * GeoJSON을 그대로 표시하는 범용 레이어.
 * - 포인트는 circleMarker로 렌더링
 * - 라인/폴리곤은 기본 스타일 적용
 */
type Props = {
  /** GeoJSON FeatureCollection */
  data: BuildingFC | {
    type: "FeatureCollection";
    features: Array<Feature<
      Point | LineString | MultiLineString | Polygon | MultiPolygon,
      Record<string, unknown>
    >>;
  };
  /** 라벨/팝업에 표시할 속성 키 (예: "name") */
  labelKey?: string;
  /** 활성/선택 상태 등 외부에서 스타일에 반영하고 싶을 때 전달 */
  isActiveFeature?: (f: FeatureAnyGeom<BuildingProperties | Record<string, unknown>>) => boolean;
  /** 클릭 등 이벤트 핸들러 */
  onFeatureClick?: (f: FeatureAnyGeom<BuildingProperties | Record<string, unknown>>) => void;
  /** 마우스오버 핸들러 */
  onFeatureHover?: (f: FeatureAnyGeom<BuildingProperties | Record<string, unknown>>) => void;
  /** 마우스아웃 핸들러 */
  onFeatureOut?: (f: FeatureAnyGeom<BuildingProperties | Record<string, unknown>>) => void;
  /** GeoJSON 스타일 오버라이드 */
  styleOverride?: (
    f: FeatureAnyGeom<BuildingProperties | Record<string, unknown>>
  ) => L.PathOptions | undefined;
};

function getDefaultStyle(
  active: boolean
): L.PathOptions {
  return {
    color: active ? "#ef4444" : "#2563eb",
    weight: active ? 3 : 2,
    opacity: 0.9,
    fillOpacity: 0.2,
  };
}

function StaticLayerImpl({
  data,
  labelKey = "name",
  isActiveFeature,
  onFeatureClick,
  onFeatureHover,
  onFeatureOut,
  styleOverride,
}: Props) {
  const styleFn = useMemo(() => {
    return (feat: FeatureAnyGeom<BuildingProperties | Record<string, unknown>>): L.PathOptions => {
      const active = isActiveFeature ? isActiveFeature(feat) : false;
      const base = getDefaultStyle(active);
      const override = styleOverride?.(feat);
      return { ...base, ...(override ?? {}) };
    };
  }, [isActiveFeature, styleOverride]);

  const pointToLayer = (
    feat: Feature<Geometry, BuildingProperties | Record<string, unknown>>,
    latlng: LatLng
  ) => {
    const active = isActiveFeature ? isActiveFeature(feat) : false;
    const opts: L.CircleMarkerOptions = {
      radius: active ? 5 : 4,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.7,
    };
    return L.circleMarker(latlng, opts);
  };

  const onEachFeature = (
    feature: Feature<Geometry, BuildingProperties | Record<string, unknown>>,
    layer: Layer
  ) => {
    // 안전 접근
    const props = feature.properties ?? {};
    // 라벨 추출
    const labelValue = (props as Record<string, unknown>)[labelKey];
    const label = typeof labelValue === "string" ? labelValue : "";

    if (label) {
      (layer as LeafletGeoJSON).bindTooltip?.(label, { sticky: true });
    }

    layer.on("click", () => {
      onFeatureClick?.(feature);
    });
    layer.on("mouseover", () => {
      onFeatureHover?.(feature);
    });
    layer.on("mouseout", () => {
      onFeatureOut?.(feature);
    });
  };

  return (
    <GeoJSON
      data={data as unknown as GeoJSON.GeoJsonObject}
      style={styleFn}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
    />
  );
}

export const StaticLayer = memo(StaticLayerImpl);
export default StaticLayer;
