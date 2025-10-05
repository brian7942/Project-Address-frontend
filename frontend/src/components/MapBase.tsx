"use client";

import { ReactNode, useEffect } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  onReady?: (map: LeafletMap) => void;
  framed?: boolean;
  children?: ReactNode;
};

function MapReady({ onReady }: { onReady?: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => { onReady?.(map); }, [map, onReady]);
  return null;
}

export default function MapBase({ onReady, framed = false, children }: Props) {
  const zoomPos: "topleft" | "topright" | "bottomleft" | "bottomright" =
    framed ? "bottomright" : "topright";

  return (
    <MapContainer
      className={
        // 라운드 + 오버플로 클립 + iOS/Safari 강제 마스크(클립 안정화)
        "h-full w-full rounded-2xl overflow-hidden " +
        "[mask-image:linear-gradient(black,black)]"
      }
      style={{
        // 일부 브라우저에서 transform 자식까지 확실히 자르기
        clipPath: "inset(0 round 16px)",
      }}
      center={[0, 0]}
      zoom={3}
      zoomControl={false}
    >
      <ZoomControl position={zoomPos} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapReady onReady={onReady} />
      {children}
    </MapContainer>
  );
}
