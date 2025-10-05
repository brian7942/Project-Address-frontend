"use client";

import { useEffect, useRef } from "react";
import { GeoJSON } from "react-leaflet";
import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Feature,
} from "geojson";
import L from "leaflet";

type FC = FeatureCollection<Geometry, GeoJsonProperties>;
type F = Feature<Geometry, GeoJsonProperties>;

/** 스타일 세트 (Tailwind 팔레트 기반 색감) */
const baseStyle: L.PathOptions = {
  color: "#2563eb",        // 파랑 테두리
  weight: 2,
  fill: true,
  fillColor: "#67e8f9",    // 청록 계열 채움
  fillOpacity: 0.35,
};

const hoverStyle: L.PathOptions = {
  ...baseStyle,
  weight: 3,
};

const selectedStyle: L.PathOptions = {
  color: "#ef4444",        // 빨강 테두리
  weight: 3,
  fill: true,
  fillColor: "#fecaca",    // 연한 빨강 채움
  fillOpacity: 0.25,
};

/** 안전한 ID 추출 */
function getId(f: Feature<Geometry, GeoJsonProperties>): string | null {
  const props = (f.properties ?? {}) as Record<string, unknown>;
  const topId = (f as unknown as { id?: string | number }).id;
  const propId =
    (props.id as string | number | undefined) ??
    (props.OBJECTID as string | number | undefined) ??
    (props.FID as string | number | undefined) ??
    (props.fid as string | number | undefined);

  const cand = propId ?? topId ?? null;
  return cand != null ? String(cand) : null;
}

/** 폴리곤 계열만 허용 */
function isPolygonLike(t?: string | null) {
  return t === "Polygon" || t === "MultiPolygon";
}

export default function BuildingLayer({
  data,
  selectedId,
  onSelect,
}: {
  data: FC;
  selectedId?: string | null;
  onSelect: (f: F, layer: L.Layer) => void;
}) {
  // selectedId 최신값을 이벤트 핸들러에서 참조하기 위한 ref
  const selRef = useRef<string | null | undefined>(selectedId);
  useEffect(() => {
    selRef.current = selectedId;
  }, [selectedId]);

  // 현재 선택 여부에 따라 스타일 리졸브
  const resolveStyle = (feat: Feature<Geometry, GeoJsonProperties>) => {
    const isSel = selRef.current && getId(feat) === selRef.current;
    return isSel ? selectedStyle : baseStyle;
  };

  return (
    <GeoJSON
      data={data as any}
      pane="overlayPane"
      // 건물만 필터링
      filter={(feat: Feature<Geometry, GeoJsonProperties>) => {
        const t = feat.geometry?.type;
        const props = (feat.properties ?? {}) as Record<string, unknown>;
        return isPolygonLike(t) && props.kind === "building";
      }}
      // 최초 스타일
      style={(feat: Feature<Geometry, GeoJsonProperties>) => resolveStyle(feat)}
      // 인터랙션
      onEachFeature={(
        feature: Feature<Geometry, GeoJsonProperties>,
        layer: L.Layer
      ) => {
        // 클릭 → 선택 콜백
        layer.on("click", () => onSelect(feature as F, layer));

        // 호버 효과
        layer.on("mouseover", () => {
          if (layer instanceof L.Path) {
            layer.bringToFront?.();
            layer.setStyle(hoverStyle);
          }
        });

        // 호버 해제 → 현재 선택 상태 기준으로 복원
        layer.on("mouseout", () => {
          if (layer instanceof L.Path) {
            layer.setStyle(resolveStyle(feature));
          }
        });

        // 툴팁(이름/ID)
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        const label = (props.name as string | undefined) ?? getId(feature) ?? "building";
        (layer as any).bindTooltip?.(label, { sticky: true });
      }}
    />
  );
}
