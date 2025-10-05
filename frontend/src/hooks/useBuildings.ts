// hooks/useBuildings.ts
"use client";
import { useEffect, useRef, useState } from "react";

type FC = GeoJSON.FeatureCollection;
type Fetcher = (bbox: string, zoom: number, signal: AbortSignal) => Promise<FC>;

export function useBuildings(map: L.Map | null, fetcher: Fetcher) {
  const [data, setData] = useState<FC | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const acRef = useRef<AbortController | null>(null);
  const timer = useRef<any>(null);
  const cache = useRef<Map<string, FC>>(new Map());

  function keyFrom(map: L.Map) {
    const b = map.getBounds();
    const z = map.getZoom();
    // 키 안정화를 위해 좌표를 약간 라운딩
    const k = [
      Math.round(b.getWest() * 1000) / 1000,
      Math.round(b.getSouth() * 1000) / 1000,
      Math.round(b.getEast() * 1000) / 1000,
      Math.round(b.getNorth() * 1000) / 1000,
      z,
    ].join(",");
    return { k, bbox: `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`, z };
  }

  useEffect(() => {
    if (!map) return;

    const run = () => {
      const { k, bbox, z } = keyFrom(map);

      if (cache.current.has(k)) {
        setData(cache.current.get(k)!);
        return;
      }

      if (acRef.current) acRef.current.abort();
      const ac = new AbortController();
      acRef.current = ac;

      setLoading(true);
      setErr(null);

      fetcher(bbox, z, ac.signal)
        .then((fc) => {
          cache.current.set(k, fc);
          setData(fc);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setErr(e?.message ?? "fetch failed");
        })
        .finally(() => setLoading(false));
    };

    const onMoveEnd = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, 250); // 디바운스
    };

    map.on("moveend zoomend", onMoveEnd);
    // 첫 로드도 실행
    onMoveEnd();

    return () => {
      map.off("moveend zoomend", onMoveEnd);
      if (timer.current) clearTimeout(timer.current);
      if (acRef.current) acRef.current.abort();
    };
  }, [map, fetcher]);

  return { data, loading, error };
}
