"use client";

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L, { PathOptions } from "leaflet";
import { useEffect, useRef, useState, useMemo } from "react";
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
  GeoJsonProperties,
} from "geojson";

type G = Polygon | MultiPolygon;
type FC = FeatureCollection<G, any>;

const ALLOWED = new Set(["LAO", "KHM"]); // 라오스/캄보디아만

// ISO 헬퍼
function getIso(props: GeoJsonProperties | null | undefined): string | undefined {
  const p = props as Record<string, unknown> | null | undefined;
  return (p?.["iso_a3"] as string | undefined) ?? (p?.["ADM0_A3"] as string | undefined);
}

export default function WorldMap() {
  const [data, setData] = useState<FC | null>(null);
  const geoRef = useRef<L.GeoJSON<any>>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selectedLayerRef = useRef<L.Layer | null>(null);

  const base: PathOptions = useMemo(
    () => ({ color: "#1f2937", weight: 1, opacity: 0.8, fill: true, fillOpacity: 0 }),
    []
  );
  const hover: PathOptions = useMemo(
    () => ({ color: "#06b6d4", weight: 2, opacity: 1, fill: true, fillOpacity: 0.05 }),
    []
  );
  const selected: PathOptions = useMemo(
    () => ({ color: "#f97316", weight: 3, opacity: 1, fill: true, fillColor: "#f97316", fillOpacity: 0.08 }),
    []
  );

  useEffect(() => {
    fetch("/data/countries.geojson")
      .then((r) => {
        if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => console.error("[countries] load error:", e));
  }, []);

  // 데이터 로드 후 LAO+KHM 자동 맞춤
  useEffect(() => {
    if (!data || !mapRef.current) return;
    const filtered: FC = {
      type: "FeatureCollection",
      features: data.features.filter((f) => ALLOWED.has(getIso(f.properties) ?? "")) as any,
    };
    const b = L.geoJSON(filtered as any).getBounds();
    if (b.isValid()) {
      mapRef.current.fitBounds(b, { padding: [32, 32], maxZoom: 6 });
    }
  }, [data]);

  function resetAll() {
    const g = geoRef.current;
    if (!g) return;
    g.eachLayer((lyr: any) => lyr.setStyle?.(base));
  }

  function onEachFeature(feature: Feature<G, GeoJsonProperties>, layer: L.Layer) {
    (layer as any).setStyle?.(base);

    layer.on("mouseover", () => {
      (layer as any).setStyle?.(hover);
      const el = (layer as any).getElement?.();
      if (el) el.style.cursor = "pointer";
    });

    layer.on("mouseout", () => {
      if (selectedLayerRef.current === layer) {
        (layer as any).setStyle?.(selected);
      } else {
        (layer as any).setStyle?.(base);
      }
    });

    layer.on("click", () => {
      resetAll();
      selectedLayerRef.current = layer;
      (layer as any).setStyle?.(selected);
      (layer as any).bringToFront?.();

      const bounds = (layer as any).getBounds?.();
      if (bounds?.isValid?.()) {
        (layer as any)._map.flyToBounds(bounds, { padding: [32, 32], maxZoom: 7, duration: 0.7 });
      }
    });
  }

  return (
    <MapContainer
      center={[16, 103.5]}
      zoom={5}
      className="h-full w-full rounded-2xl overflow-hidden"
      zoomControl
      worldCopyJump
      whenCreated={(map: L.Map) => (mapRef.current = map)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {data && (
        <GeoJSON
          ref={geoRef as any}
          data={data as any}
          style={() => base}
          onEachFeature={onEachFeature}
          bubblingMouseEvents={false}
          interactive
          filter={(f: Feature<G, GeoJsonProperties>) => {
            const iso = getIso(f.properties);
            return iso ? ALLOWED.has(iso) : false;
          }}
        />
      )}
    </MapContainer>
  );
}
