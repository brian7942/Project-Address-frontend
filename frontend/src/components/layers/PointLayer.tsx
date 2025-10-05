"use client";

import { GeoJSON } from "react-leaflet";
import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Feature,
} from "geojson";
import L, { LatLng, Layer } from "leaflet";
// 프로젝트 경로에 맞게 조정하세요: "@/lib/style" 또는 "../../lib/style"
import { COLORS } from "@/lib/style";

type FC = FeatureCollection<Geometry, GeoJsonProperties>;
type F = Feature<Geometry, GeoJsonProperties>;

export default function PointLayer({
  data,
  onSelect,
}: {
  data: FC;
  onSelect?: (f: F, layer: Layer) => void;
}) {
  return (
    <GeoJSON
      data={data as any}
      // 👇 feat 타입 명시
      filter={(feat: F) => {
        const t = feat.geometry?.type;
        return t === "Point" || t === "MultiPoint";
      }}
      // 👇 feat, latlng 타입 명시
      pointToLayer={(feat: F, latlng: LatLng) => {
        const m = L.circleMarker(latlng, {
          radius: 6,
          color: COLORS.primary,
          weight: 2,
          fillOpacity: 0.9,
        });
        const name =
          (feat.properties as any)?.name ??
          (feat.properties as any)?.id ??
          "point";
        m.bindTooltip(String(name), { sticky: true });
        return m;
      }}
      // 👇 feature, layer 타입 명시
      onEachFeature={(feature: F, layer: Layer) => {
        if (onSelect) layer.on("click", () => onSelect(feature, layer));
      }}
    />
  );
}
