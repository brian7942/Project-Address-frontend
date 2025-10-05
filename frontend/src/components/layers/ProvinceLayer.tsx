"use client";

import { GeoJSON, useMap } from "react-leaflet";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
} from "geojson";
import L, {
  GeoJSON as LGeoJSON,
  LeafletMouseEvent,
  PathOptions,
} from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

type AdminGeom = Feature<Polygon | MultiPolygon, any>;
type FC = FeatureCollection<Geometry, any>;
type CCode = "LA" | "KH";

type Props = {
  country: CCode;
  onReadyList?: (rows: { id: string; name: string; country: CCode }[]) => void;
  selectedId?: string | null;                   // 드롭다운으로 선택된 주 id (string)
  onSelectFeature?: (f: AdminGeom | null) => void; // 지도에서 클릭 시 상위에 알림
};

function ensureId(f: any): string {
  const p = f?.properties ?? {};
  // geoBoundaries 표준 필드(shapeID/shapeISO)를 우선 사용
  const id =
    p.id ??
    p.shapeID ??
    p.shapeISO ??
    f?.id ??
    null;
  return id != null ? String(id) : `${p.country ?? "XX"}-${Math.random().toString(36).slice(2)}`;
}

function ensureName(f: any): string {
  const p = f?.properties ?? {};
  return String(
    p.name ??
      p.shapeName ??
      p.NAME_1 ??
      p.en_name ??
      "Unknown"
  );
}

const base: PathOptions = { color: "#2563eb", weight: 1, fill: true, fillOpacity: 0.06 };
const hover: PathOptions = { ...base, weight: 2, color: "#10b981", fillOpacity: 0.1 };
const selectedStyle: PathOptions = { ...base, weight: 3, color: "#ef4444", fillOpacity: 0.15 };

export default function ProvinceLayer({
  country,
  onReadyList,
  selectedId,
  onSelectFeature,
}: Props) {
  const map = useMap();
  const layerRef = useRef<LGeoJSON | null>(null);
  const [fc, setFc] = useState<FC | null>(null);

  // 나라가 바뀌면 기존 레이어/데이터 즉시 초기화(잔상 제거)
  useEffect(() => {
    layerRef.current?.clearLayers?.();
    setFc(null);
  }, [country]);

  // GeoJSON 로드 + 속성 표준화(id/name/country)
  useEffect(() => {
    let alive = true;
    (async () => {
      const file = country === "LA" ? "/data/laos_provinces.geojson" : "/data/cambodia_provinces.geojson";
      const data = await fetch(file).then((r) => r.json()).catch(() => null);
      if (!alive) return;
      if (data && Array.isArray(data.features)) {
        for (const f of data.features as any[]) {
          const p = f.properties ?? {};
          const id = ensureId(f);
          const name = ensureName(f);
          f.properties = { ...p, id, name, country }; // 표준화하여 주입
        }
      }
      setFc(data);
    })();
    return () => { alive = false; };
  }, [country]);

  // 폴리곤(주/도)만 필터
  const feats = useMemo<AdminGeom[]>(() => {
    const f = fc?.features ?? [];
    return f.filter(
      (x: any) => x?.geometry?.type === "Polygon" || x?.geometry?.type === "MultiPolygon"
    ) as any;
  }, [fc]);

  // 드롭다운 목록 상위로 전달
  useEffect(() => {
    if (!onReadyList) return;
    const rows = feats.map((f) => ({
      id: String((f.properties as any)?.id),
      name: String((f.properties as any)?.name),
      country,
    }));
    onReadyList(rows.sort((a, b) => a.name.localeCompare(b.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feats, country]);

  // 드롭다운 선택 → 해당 주로 fitBounds
  useEffect(() => {
    if (!selectedId || !layerRef.current) return;
    const sid = String(selectedId);
    const layers = (layerRef.current.getLayers?.() as L.Layer[]) ?? [];
    const target = layers.find((lyr: any) => String(lyr?.feature?.properties?.id) === sid) as L.Polygon | undefined;
    if (target) {
      const b = target.getBounds?.();
      if (b) map.fitBounds(b, { padding: [24, 24] });
      onSelectFeature?.((target as any).feature ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 이벤트 바인딩(this 사용 안 함)
  function onEachFeature(feature: AdminGeom, layer: L.Layer) {
    const poly = layer as L.Polygon;

    layer.on("mouseover", () => {
      poly.setStyle?.(hover);
    });

    layer.on("mouseout", () => {
      const isSel = String((layer as any).feature?.properties?.id) === String(selectedId ?? "");
      poly.setStyle?.(isSel ? selectedStyle : base);
    });

    layer.on("click", (e: LeafletMouseEvent) => {
      const l = e.target as L.Polygon & { feature?: AdminGeom };
      const b = l.getBounds?.();
      if (b) map.fitBounds(b, { padding: [24, 24] });
      onSelectFeature?.((l as any).feature ?? null); // 상위에서 selectedId 동기화
    });
  }

  function style(feature: AdminGeom): PathOptions {
    const isSel = String((feature.properties as any)?.id) === String(selectedId ?? "");
    return isSel ? selectedStyle : base;
  }

  if (!feats.length) return null;

  return (
    <GeoJSON
      ref={(ref: LGeoJSON | null) => { layerRef.current = ref; }}
      data={feats as any}
      style={style as any}
      onEachFeature={onEachFeature as any}
    />
  );
}
