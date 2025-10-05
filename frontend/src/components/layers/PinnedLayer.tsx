"use client";

import { GeoJSON } from "react-leaflet";
import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Feature,
} from "geojson";
import L, { LatLng, Layer } from "leaflet";
import { COLORS } from "@/lib/style";

type FC = FeatureCollection<Geometry, GeoJsonProperties>;
type OnSelect = (f: Feature<Geometry, GeoJsonProperties>, layer: L.Layer) => void;

export default function PinnedLayer({
  data,
  onSelect,
}: {
  data: FC;
  onSelect?: OnSelect;
}) {
  return (
    <GeoJSON
      data={data as any}
      style={() => ({ color: COLORS.pinned, weight: 3, fillOpacity: 0.2 })}
      pointToLayer={(
        _feat: Feature<Geometry, GeoJsonProperties>,
        ll: LatLng
      ) =>
        L.circleMarker(ll, {
          radius: 7,
          color: COLORS.pinned,
          weight: 3,
          fillOpacity: 0.9,
        })
      }
      onEachFeature={(
        feature: Feature<Geometry, GeoJsonProperties>,
        layer: Layer
      ) => {
        layer.bindTooltip(
          `PIN · ${
            (feature as any)?.properties?.name ??
            (feature as any)?.properties?.id ??
            ""
          }`,
        { sticky: true });

        if (onSelect) {
          layer.on("click", () => onSelect(feature, layer as L.Layer));
        }
      }}
    />
  );
}
