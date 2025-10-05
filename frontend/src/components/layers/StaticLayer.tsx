"use client";
import { GeoJSON } from "react-leaflet";
import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Feature,
} from "geojson";
import L from "leaflet";
import { COLORS } from "@/lib/style";

type FC = FeatureCollection<Geometry, GeoJsonProperties>;
type F = Feature<Geometry, GeoJsonProperties>;

export default function StaticLayer({
  data,
  interactive = false,
  onSelect,
}: {
  data: FC;
  interactive?: boolean;
  onSelect?: (f: F, layer: L.Layer) => void;
}) {
  return (
    <GeoJSON
      data={data as any}
      filter={(
        feat: Feature<Geometry, GeoJsonProperties>
      ): boolean => {
        const t = feat.geometry?.type;
        const isPolyOrLine =
          t === "Polygon" ||
          t === "MultiPolygon" ||
          t === "LineString" ||
          t === "MultiLineString";
        // 건물은 제외 (건물은 BuildingLayer에서 따로 처리)
        return isPolyOrLine && (feat as any).properties?.kind !== "building";
      }}
      style={{ color: COLORS.primary, weight: 2, fillOpacity: 0.25 }}
      onEachFeature={(
        feature: Feature<Geometry, GeoJsonProperties>,
        layer: L.Layer
      ) => {
        if (!interactive) {
          // 비인터랙티브: 포인터 이벤트 끔 → 아래(건물) 클릭 방해 X
          layer.on("add", () => {
            const el = (layer as any).getElement?.();
            if (el) el.style.pointerEvents = "none";
          });
          return;
        }
        if (onSelect) {
          layer.on("click", () => onSelect(feature as F, layer));
          layer.on("mouseover", () => {
            if (layer instanceof L.Path) layer.setStyle({ weight: 3 });
          });
          layer.on("mouseout", () => {
            if (layer instanceof L.Path) layer.setStyle({ weight: 2 });
          });
        }
      }}
    />
  );
}
