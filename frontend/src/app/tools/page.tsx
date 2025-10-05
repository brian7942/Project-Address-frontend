"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Leaflet 의존 컴포넌트는 브라우저에서만 로드
const MapBase = dynamic(() => import("@/components/MapBase"), { ssr: false });
const BuildingLayer = dynamic(() => import("@/components/layers/BuildingLayer"), { ssr: false });
const StaticLayer = dynamic(() => import("@/components/layers/StaticLayer"), { ssr: false });
const PointLayer = dynamic(() => import("@/components/layers/PointLayer"), { ssr: false });
const PinnedLayer = dynamic(() => import("@/components/layers/PinnedLayer"), { ssr: false });

import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Feature,
  Point as GPoint,
  MultiPoint as GMultiPoint,
  LineString as GLineString,
  MultiLineString as GMultiLineString,
  Polygon as GPolygon,
  MultiPolygon as GMultiPolygon,
} from "geojson";

type FC = FeatureCollection<Geometry, GeoJsonProperties>;
type F = Feature<Geometry, GeoJsonProperties>;

/** 안전한 ID */
function getId(f: any) {
  return f?.properties?.id ?? f?.id ?? null;
}

/** 타입 가드(기하 타입) */
function isPointLike(
  feat: Feature<Geometry, GeoJsonProperties>
): feat is Feature<GPoint | GMultiPoint, GeoJsonProperties> {
  const t = feat.geometry?.type;
  return t === "Point" || t === "MultiPoint";
}
function isPolygonLike(
  feat: Feature<Geometry, GeoJsonProperties>
): feat is Feature<GPolygon | GMultiPolygon | GLineString | GMultiLineString, GeoJsonProperties> {
  const t = feat.geometry?.type;
  return t === "Polygon" || t === "MultiPolygon" || t === "LineString" || t === "MultiLineString";
}

/** 최상위 판별 */
function isFC(x: any): x is FC {
  return x && x.type === "FeatureCollection" && Array.isArray(x.features);
}
function isF(x: any): x is F {
  return x && x.type === "Feature" && x.geometry;
}

/** 좌표 포맷 */
type CoordFormat = "dd" | "dms" | "utm";
function toDMS(value: number, isLat: boolean) {
  const abs = Math.abs(value),
    deg = Math.floor(abs),
    minFloat = (abs - deg) * 60,
    min = Math.floor(minFloat),
    sec = (minFloat - min) * 60;
  const hemi = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${deg}° ${min}' ${sec.toFixed(2)}" ${hemi}`;
}

export default function ToolsPage() {
  // ❗ Leaflet 런타임 모듈 보관 (SSR에서 평가 피함)
  const LRef = useRef<any>(null);
  useEffect(() => {
    (async () => {
      const mod = await import("leaflet");
      LRef.current = mod;
    })();
  }, []);

  const [map, setMap] = useState<any>(null);
  const [fc, setFC] = useState<FC | null>(null);
  const [adminLevel, setAdminLevel] = useState(2);
  const [showPoly, setShowPoly] = useState(true);
  const [showPoint, setShowPoint] = useState(true);
  const [showPinned, setShowPinned] = useState(true);

  const [selected, setSelected] = useState<{ id: string | null; feature: F | null }>({
    id: null,
    feature: null,
  });
  const [pinned, setPinned] = useState<Record<string, F>>({});

  // 파일 input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 좌표 HUD
  const [cursor, setCursor] = useState<any>(null);
  const [lastClick, setLastClick] = useState<any>(null);

  // react-leaflet 없이 직접 이벤트 연결
  useEffect(() => {
    if (!map) return;
    const onMove = (e: any) => setCursor(e.latlng);
    const onClick = (e: any) => setLastClick(e.latlng);
    map.on("mousemove", onMove);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", onMove);
      map.off("click", onClick);
    };
  }, [map]);

  // 좌표 포맷
  const [coordFormat, setCoordFormat] = useState<CoordFormat>("dd");
  const utmModuleRef = useRef<any>(null);
  async function ensureUtm() {
    if (utmModuleRef.current) return true;
    try {
      utmModuleRef.current = await import("utm");
      return true;
    } catch {
      alert("UTM 포맷은 `pnpm add utm` 설치 후 사용하세요.");
      return false;
    }
  }
  async function changeFormat(next: CoordFormat) {
    if (next === "utm") {
      const ok = await ensureUtm();
      if (!ok) return;
    }
    setCoordFormat(next);
  }
  function fmt(ll: any) {
    if (coordFormat === "dms") return `${toDMS(ll.lat, true)}, ${toDMS(ll.lng, false)}`;
    if (coordFormat === "utm" && utmModuleRef.current) {
      const { fromLatLon } = utmModuleRef.current;
      const u = fromLatLon(ll.lat, ll.lng);
      return `UTM ${u.zoneNum}${u.zoneLetter} ${Math.round(u.easting)}E ${Math.round(u.northing)}N`;
    }
    return `${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`;
  }
  async function copyCoords(ll?: any | null) {
    const target = ll ?? lastClick;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(fmt(target));
      alert("좌표 복사됨");
    } catch {}
  }

  // 데이터 로딩/적재
  async function loadMock() {
    const res = await fetch("/api/mock/geojson", { cache: "no-store" });
    const d: FC = await res.json();
    setFC(d);
    fit(d);
  }
  async function loadAdmin() {
    if (!map) return;
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(",");
    const res = await fetch(`/api/mock/admin/${adminLevel}?bbox=${encodeURIComponent(bbox)}`, { cache: "no-store" });
    const d: FC = await res.json();
    setFC(d);
    setSelected({ id: null, feature: null });
    setPinned({});
    fit(d);
  }
  function clearAll() {
    setFC(null);
    setSelected({ id: null, feature: null });
    setPinned({});
    setCursor(null);
    setLastClick(null);
  }
  function fit(d: FC) {
    try {
      const L = LRef.current;
      if (!L) return;
      const layer = (L as any).geoJSON(d);
      const bb = layer.getBounds?.();
      if (bb?.isValid?.()) map?.fitBounds(bb, { padding: [16, 16] });
    } catch {}
  }

  // 파일 업로드: 안전 파서 (항상 FeatureCollection으로 정규화)
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json: unknown = JSON.parse(await file.text());
      let d: FC | null = null;

      if ((json as any)?.type === "Topology") {
        const { feature: topoFeature } = await import("topojson-client");
        const key = Object.keys((json as any).objects || {})[0];
        if (!key) throw new Error("TopoJSON objects가 비어 있습니다.");
        const out = topoFeature(json as any, (json as any).objects[key]);
        d = isFC(out) ? out : isF(out) ? { type: "FeatureCollection", features: [out] } : null;
      } else if (isFC(json)) {
        d = json as FC;
      } else if (isF(json)) {
        d = { type: "FeatureCollection", features: [json as F] };
      } else if ((json as any)?.geometry) {
        const f: F = {
          type: "Feature",
          geometry: (json as any).geometry,
          properties: (json as any).properties ?? {},
        };
        d = { type: "FeatureCollection", features: [f] };
      }

      if (!d) throw new Error("지원하지 않는 형식입니다. GeoJSON/TopoJSON/Feature만 지원됩니다.");

      setFC(d);
      setSelected({ id: null, feature: null });
      setPinned({});
      fit(d);
    } catch (err: any) {
      alert(`파일 파싱 실패: ${err?.message ?? ""}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // 선택/핀
  function onSelect(f: F, layer: any) {
    setSelected({ id: getId(f), feature: f });
    layer?.bringToFront?.();
  }
  function togglePin() {
    const f = selected.feature;
    if (!f) return;
    const id = getId(f) ?? JSON.stringify(f.geometry).slice(0, 64);
    setPinned((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = f;
      return next;
    });
  }
  function pinnedFC(): FC | null {
    const feats = Object.values(pinned);
    return feats.length ? ({ type: "FeatureCollection", features: feats } as FC) : null;
  }

  // Export
  function dl(name: string, d: FC) {
    const blob = new Blob([JSON.stringify(d)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.geojson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function exportSelected() {
    if (!selected.feature) return alert("선택된 피처가 없습니다.");
    dl(getId(selected.feature) ?? "feature", { type: "FeatureCollection", features: [selected.feature] } as FC);
  }
  function exportPinned() {
    const d = pinnedFC();
    if (!d) return alert("핀 데이터가 없습니다.");
    dl("pinned", d);
  }
  function exportAll() {
    if (!fc) return alert("데이터가 없습니다.");
    const seen = new Set<string>();
    const out: F[] = [];
    const push = (f: F) => {
      const id = getId(f) ?? JSON.stringify(f.geometry).slice(0, 64);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(f);
      }
    };
    fc.features.forEach((f: any) => push(f as F));
    Object.values(pinned).forEach(push);
    dl("all_features", { type: "FeatureCollection", features: out } as FC);
  }
  function resetView() {
    if (fc) fit(fc);
  }

  // 뷰포트 통계
  type Vp = {
    total: number;
    totalPoints: number;
    totalPolyLine: number;
    visible: number;
    visiblePoints: number;
    visiblePolyLine: number;
  } | null;
  const [vp, setVp] = useState<Vp>(null);

  function updateVp() {
    if (!map || !fc) {
      setVp(null);
      return;
    }
    const L = LRef.current;
    if (!L) return;

    const b = map.getBounds();
    const feats = fc.features as F[];
    let tp = 0,
      tl = 0,
      vpP = 0,
      vpL = 0;

    for (const f of feats) {
      if (!f.geometry) continue;
      const pointy = isPointLike(f);
      if (pointy) tp++;
      else if (isPolygonLike(f)) tl++;
      else continue;

    let visible = false;
      try {
        if (pointy) {
          if (f.geometry.type === "Point") {
            const [lon, lat] = (f.geometry as GPoint).coordinates as [number, number];
            visible = b.contains(L.latLng(lat, lon));
          } else {
            for (const [lon, lat] of (f.geometry as GMultiPoint).coordinates) {
              if (b.contains(L.latLng(lat, lon))) {
                visible = true;
                break;
              }
            }
          }
        } else {
          const layer = L.geoJSON(f as any);
          const bb = (layer as any).getBounds?.() as any;
          if (bb?.isValid?.()) visible = bb.intersects(b);
        }
      } catch {
        // skip
      }

      if (visible) {
        if (pointy) vpP++;
        else vpL++;
      }
    }

    setVp({
      total: feats.length,
      totalPoints: tp,
      totalPolyLine: tl,
      visible: vpP + vpL,
      visiblePoints: vpP,
      visiblePolyLine: vpL,
    });
  }

  useEffect(() => {
    updateVp();
    if (!map) return;
    const h = () => updateVp();
    map.on("moveend zoomend", h);
    return () => {
      map.off("moveend zoomend", h);
    };
  }, [map, fc, showPoint, showPoly]);

  // ---------- JSX ----------
  return (
    // 헤더(3.5rem)를 제외한 높이 확보 + relative 기준 제공
    <div className="relative h-[calc(100dvh-3.5rem)] w-full">
      {/* 컨트롤 바 */}
      <div className="absolute left-3 top-3 z-[1000] flex flex-wrap items-center gap-2">
        <button onClick={loadMock} className="rounded-md border bg-white px-3 py-1.5 text-sm shadow hover:bg-gray-50">
          Mock 불러오기
        </button>

        {/* Admin level */}
        <div className="rounded-md border bg-white px-2 py-1 text-sm shadow flex items-center gap-2">
          <span>Admin level</span>
          <select className="border rounded px-1 py-0.5 text-sm" value={adminLevel} onChange={(e) => setAdminLevel(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button onClick={loadAdmin} className="rounded border px-2 py-1 text-xs hover:bg-gray-50">
            불러오기
          </button>
        </div>

        {/* 파일 */}
        <button onClick={() => fileInputRef.current?.click()} className="rounded-md border bg-white px-3 py-1.5 text-sm shadow hover:bg-gray-50">
          파일 불러오기
        </button>
        <input ref={fileInputRef} type="file" accept=".json,.geojson,.topojson,application/json" className="hidden" onChange={onPick} />

        {/* Export */}
        <button
          onClick={exportSelected}
          className="rounded-md border bg-white px-3 py-1.5 text-sm shadow hover:bg-gray-50 disabled:opacity-50"
          disabled={!selected.feature}
        >
          Export 선택
        </button>
        <button
          onClick={exportPinned}
          className="rounded-md border bg-white px-3 py-1.5 text-sm shadow hover:bg-gray-50 disabled:opacity-50"
          disabled={!Object.keys(pinned).length}
        >
          Export 핀
        </button>
        <button onClick={exportAll} className="rounded-md border bg-white px-3 py-1.5 text-sm shadow hover:bg-gray-50">
          Export 전체
        </button>
        <button onClick={resetView} className="rounded-md border bg-white px-3 py-1.5 text-sm shadow hover:bg-gray-50">
          뷰 리셋
        </button>
        <button onClick={clearAll} className="rounded-md border bg-white px-3 py-1.5 text-sm shadow hover:bg-gray-50">
          지우기
        </button>

        {/* 토글 */}
        <label className="ml-2 flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-sm shadow">
          <input type="checkbox" checked={showPoly} onChange={(e) => setShowPoly(e.target.checked)} />
          <span>경계/라인</span>
        </label>
        <label className="flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-sm shadow">
          <input type="checkbox" checked={showPoint} onChange={(e) => setShowPoint(e.target.checked)} />
          <span>포인트</span>
        </label>
        <label className="flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-sm shadow">
          <input type="checkbox" checked={showPinned} onChange={(e) => setShowPinned(e.target.checked)} />
          <span>핀 레이어</span>
        </label>

        {/* 좌표 포맷 */}
        <div className="rounded-md border bg-white px-2 py-1 text-sm shadow flex items-center gap-2">
          <span>좌표</span>
          <button onClick={() => setCoordFormat("dd")} className={`rounded border px-2 py-1 text-xs ${coordFormat === "dd" ? "bg-gray-100" : "hover:bg-gray-50"}`}>
            DD
          </button>
          <button onClick={() => setCoordFormat("dms")} className={`rounded border px-2 py-1 text-xs ${coordFormat === "dms" ? "bg-gray-100" : "hover:bg-gray-50"}`}>
            DMS
          </button>
          <button
            onClick={() => changeFormat("utm")}
            className={`rounded border px-2 py-1 text-xs ${coordFormat === "utm" ? "bg-gray-100" : "hover:bg-gray-50"}`}
            title="`pnpm add utm` 설치 필요"
          >
            UTM
          </button>
        </div>
      </div>

      {/* 우상단: 뷰포트 통계 */}
      {vp && (
        <div className="absolute right-3 top-3 z-[1000] rounded-md border bg-white/95 px-3 py-2 text-xs shadow">
          <div className="font-medium mb-1">요약</div>
          <div>전체: {vp.total} (포인트 {vp.totalPoints}, 경계/라인 {vp.totalPolyLine})</div>
          <div>뷰포트 내: {vp.visible} (포인트 {vp.visiblePoints}, 경계/라인 {vp.visiblePolyLine})</div>
        </div>
      )}

      {/* 좌하단: 커서 좌표 */}
      {cursor && (
        <div className="absolute left-3 bottom-3 z-[1000] rounded-md border bg-white/95 px-3 py-2 text-xs shadow">
          <div className="font-mono">{fmt(cursor)}</div>
          <div className="mt-1 flex gap-2">
            <button onClick={() => copyCoords(cursor)} className="rounded border px-2 py-0.5 hover:bg-gray-50">
              복사
            </button>
          </div>
        </div>
      )}

      {/* 우하단: 최근 클릭 좌표 */}
      {lastClick && (
        <div className="absolute right-3 bottom-3 z-[1000] rounded-md border bg-white/95 px-3 py-2 text-xs shadow">
          <div className="mb-1 font-medium">최근 좌클릭 좌표</div>
          <div className="font-mono">{fmt(lastClick)}</div>
          <div className="mt-2 flex justify-end">
            <button onClick={() => copyCoords(lastClick)} className="rounded border px-2 py-1 hover:bg-gray-50">
              복사
            </button>
          </div>
        </div>
      )}

      {/* 지도 */}
      <MapBase onReady={setMap}>
        {fc && showPoly && <StaticLayer data={fc} interactive onSelect={onSelect} />}
        {fc && <BuildingLayer data={fc} selectedId={selected.id} onSelect={onSelect} />}
        {fc && showPoint && <PointLayer data={fc} onSelect={onSelect} />}
        {showPinned && pinnedFC() && <PinnedLayer data={pinnedFC() as FC} onSelect={onSelect} />}
      </MapBase>

      {/* 우측 속성/동작 패널 */}
      <div
        className={[
          "absolute right-0 top-14 z-[1000] h-[calc(100dvh-3.5rem)] w-96 bg-white/95 backdrop-blur",
          "border-l shadow-xl transition-transform duration-200",
          selected.feature ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <strong className="text-sm">속성 & 작업</strong>
          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePin()}
              disabled={!selected.feature}
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              {selected.id && pinned[selected.id] ? "핀 해제" : "핀 고정"}
            </button>
            <button onClick={() => setSelected({ id: null, feature: null })} className="text-sm text-gray-600 hover:text-gray-900">
              닫기
            </button>
          </div>
        </div>
        <div className="p-4 text-sm">
          {selected.feature ? (
            <ul className="space-y-2">
              {Object.entries((selected.feature.properties ?? {}) as Record<string, unknown>).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-3">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">지도의 피처를 클릭하면 속성이 표시됩니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
