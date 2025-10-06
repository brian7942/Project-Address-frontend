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
  GeoJsonObject,
} from "geojson";

type G = Polygon | MultiPolygon;
type Props = Record<string, unknown>;
type FC = FeatureCollection<G, Props>;

const ALLOWED = new Set(["LAO", "KHM"]); // 라오스/캄보디아만

// ISO 헬퍼
function getIso(props: GeoJsonProperties | null | undefined): string | undefined {
  const p = props as Record<string, unknown> | null | undefined;
  return (p?.["iso_a3"] as string | undefined) ?? (p?.["ADM0_A3"] as string | undefined);
}

export default function WorldMap() {
  const [data, setData] = useState<FC | null>(null);
  const geoRef = useRef<L.GeoJSON | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selectedLayerRef = useRef<L.Path | null>(null);

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
      .then((j) => setData(j as FC))
      .catch((e) => console.error("[countries] load error:", e));
  }, []);

  // 데이터 로드 후 LAO+KHM 자동 맞춤
  useEffect(() => {
    if (!data || !mapRef.current) return;

    const filtered: FC = {
      type: "FeatureCollection",
      features: data.features.filter((f) => ALLOWED.has(getIso(f.properties) ?? "")),
    };

    const layer = L.geoJSON(filtered as unknown as GeoJsonObject);
    const b = layer.getBounds();
    if (b.isValid()) {
      mapRef.current.fitBounds(b, { padding: [32, 32], maxZoom: 6 });
    }
  }, [data]);

  function resetAll() {
    const g = geoRef.current;
    if (!g) return;
    g.eachLayer((lyr) => {
      if (lyr instanceof L.Path) {
        lyr.setStyle(base);
      }
    });
  }

  function onEachFeature(_feature: Feature<G, GeoJsonProperties>, layer: L.Layer) {
    if (layer instanceof L.Path) layer.setStyle(base);

    layer.on("mouseover", () => {
      if (layer instanceof L.Path) {
        layer.setStyle(hover);
        const el = layer.getElement?.() as SVGElement | HTMLElement | null | undefined;
        if (el && (el instanceof SVGElement || el instanceof HTMLElement)) {
          el.style.cursor = "pointer";
        }
      }
    });

    layer.on("mouseout", () => {
      if (!(layer instanceof L.Path)) return;
      if (selectedLayerRef.current === layer) {
        layer.setStyle(selected);
      } else {
        layer.setStyle(base);
      }
    });

    layer.on("click", () => {
      resetAll();
      if (layer instanceof L.Path) {
        selectedLayerRef.current = layer;
        layer.setStyle(selected);
        layer.bringToFront?.();
      }

      // 폴리곤/멀티폴리곤에서 경계 구해 flyToBounds
      if (layer instanceof L.Polygon) {
        const bounds = layer.getBounds();
        if (bounds.isValid() && mapRef.current) {
          mapRef.current.flyToBounds(bounds, { padding: [32, 32], maxZoom: 7, duration: 0.7 });
        }
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
      // whenCreated 제거 → whenReady로 Map 인스턴스 확보
      whenReady={(e: L.LeafletEvent) => {
        mapRef.current = e.target as L.Map;
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {data && (
        <GeoJSON
          ref={geoRef}
          data={data as unknown as GeoJsonObject}
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
