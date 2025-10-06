"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { FeatureCollection, Geometry, GeoJsonProperties, Feature } from "geojson";
import type { Map as LeafletMap, Layer, LatLngBoundsLiteral } from "leaflet";
import type { BuildingFC, BuildingProperties } from "@/types/geo";

// shadcn/ui
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

// CSR 전용
const MapBase = dynamic(() => import("@/components/MapBase"), { ssr: false });
const BuildingLayer = dynamic(() => import("@/components/layers/BuildingLayer"), { ssr: false });
const CountryLayer = dynamic(() => import("@/components/layers/CountryLayer"), { ssr: false });
const ProvinceLayer = dynamic(() => import("@/components/layers/ProvinceLayer"), { ssr: false });
const DistrictLayer = dynamic(() => import("@/components/layers/DistrictLayer"), { ssr: false });

type FC = FeatureCollection<Geometry, GeoJsonProperties>;
type F = Feature<Geometry, GeoJsonProperties>;
type Option = { value: string; label: string };

// Leaflet Layer 중 bringToFront를 가진 Path 계열만 안전 호출하기 위한 협소 타입
type BringToFrontCapable = Layer & { bringToFront?: () => void };

// 페이지 로컬 UI 상태 타입 (드롭다운 값 보관용)
type AdminUI = {
  country: string; // ISO3 ("LAO" | "KHM")
  state: string;   // province code/id
  district: string;
  city: string;
  village: string;
};

// -------- 유틸: 다양한 스키마 안전 대응 --------
function pickProvinceCode(props: Record<string, unknown>): string | undefined {
  const p = props as Record<string, unknown>;
  const v =
    (p.GID_1 ??
      p.ADM1_PCODE ??
      p.PCODE ??
      p.CODE_1 ??
      p.ID_1 ??
      p.PROV_CODE ??
      p.province_id ??
      p.state ??
      p.state_id) as string | number | undefined;
  return v != null ? String(v) : undefined;
}

function pickDistrictId(
  props: Record<string, unknown>,
  f?: Feature<Geometry, GeoJsonProperties>
): string | undefined {
  const p = props as Record<string, unknown>;
  const v =
    (f?.id as string | number | undefined) ??
    (p.GID_2 as string | number | undefined) ??
    (p.ADM2_PCODE as string | number | undefined) ??
    (p.PCODE as string | number | undefined) ??
    (p.CODE_2 as string | number | undefined) ??
    (p.ID_2 as string | number | undefined) ??
    (p.OBJECTID as string | number | undefined) ??
    (p.id as string | number | undefined);
  return v != null ? String(v) : undefined;
}

function pickDistrictName(props: Record<string, unknown>): string | undefined {
  const p = props as Record<string, unknown>;
  const v =
    (p.NAME_2 as string | undefined) ??
    (p.DIST_NAME as string | undefined) ??
    (p.DISTRICT as string | undefined) ??
    (p.NAME as string | undefined) ??
    (p.en_name as string | undefined) ??
    (p.local_name as string | undefined);
  return v != null ? String(v) : undefined;
}

// 🔧 이름 정규화(철자/발음 차이 보정: kh≈x, ph≈f 등)
function normalizeAdmName(s?: string | null) {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/kh/g, "x")
    .replace(/ph/g, "f");
}
// ---------------------------------------------

export default function Page() {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [buildings, setBuildings] = useState<FC | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<{ id: string | null; feature: F | null }>({ id: null, feature: null });

  // 행정 선택 상태 (District 포함)
  const [admin, setAdmin] = useState<AdminUI>({
    country: "",
    state: "",
    district: "",
    city: "",
    village: "",
  });

  // 드롭다운 옵션
  const [countryOpts] = useState<Option[]>([
    { value: "LAO", label: "Laos" },
    { value: "KHM", label: "Cambodia" },
  ]);
  const [provinceOpts, setProvinceOpts] = useState<Option[]>([]);
  const [districtOpts, setDistrictOpts] = useState<Option[]>([]);
  const [cityOpts, setCityOpts] = useState<Option[]>([]);
  const [villageOpts, setVillageOpts] = useState<Option[]>([]);

  // Province 동기화용 (id와 name을 각각 보관)
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);

  // 전체 초기화 트리거(로고 클릭 시 증가 → 레이어 강제 리마운트)
  const [resetTick, setResetTick] = useState<number>(0);

  // ISO3 → 내부 CCode (ProvinceLayer용)
  const ccode: "LA" | "KH" | null = admin.country === "LAO" ? "LA" : admin.country === "KHM" ? "KH" : null;

  // 국가가 바뀌면 하위 초기화
  useEffect(() => {
    setSelectedProvinceId(null);
    setSelectedProvinceName(null);
    setProvinceOpts([]);
    setDistrictOpts([]);
    setCityOpts([]);
    setVillageOpts([]);
    setAdmin((p: AdminUI) => ({ ...p, state: "", district: "", city: "", village: "" }));
  }, [admin.country]);

  // ✅ Province 선택 시 District 옵션을 '실데이터(GeoJSON)'로 채우기 (코드 또는 정규화된 이름 매칭)
  useEffect(() => {
    let aborted = false;
    async function loadDistrictOptions() {
      if (!admin.country || (!selectedProvinceId && !selectedProvinceName)) {
        setDistrictOpts([]);
        setCityOpts([]);
        setVillageOpts([]);
        setAdmin((prev: AdminUI) => ({ ...prev, district: "", city: "", village: "" }));
        return;
      }

      try {
        const url =
          admin.country === "LAO"
            ? "/data/laos_districts.geojson"
            : admin.country === "KHM"
            ? "/data/cambodia_districts.geojson"
            : null;
        if (!url) return;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
        const fc = (await res.json()) as FC;
        if (aborted) return;

        const selNameNorm = normalizeAdmName(selectedProvinceName);

        const opts: Option[] = (fc.features ?? [])
          .filter((f) => {
            const p = (f.properties ?? {}) as Record<string, unknown>;
            const provCode = (pickProvinceCode(p) ?? "").toString();
            const provName = (p as Record<string, unknown>).NAME_1 ?? (p as Record<string, unknown>).NAME ?? "";
            // ① 코드 동일
            if (selectedProvinceId && provCode === selectedProvinceId) return true;
            // ② 이름 정규화 동일
            if (selectedProvinceName && normalizeAdmName(String(provName)) === selNameNorm) return true;
            return false;
          })
          .map((f) => {
            const p = (f.properties ?? {}) as Record<string, unknown>;
            const id = pickDistrictId(p, f);
            const name = pickDistrictName(p) ?? id ?? "(unknown)";
            return { value: id!, label: name };
          })
          .filter((o) => !!o.value)
          .sort((a, b) => a.label.localeCompare(b.label));

        setDistrictOpts(opts);
        setCityOpts([]);
        setVillageOpts([]);
        setAdmin((prev: AdminUI) => ({ ...prev, district: "", city: "", village: "" }));
      } catch (e) {
        console.error("[district] load options failed:", e);
        if (!aborted) {
          setDistrictOpts([]);
          setCityOpts([]);
          setVillageOpts([]);
        }
      }
    }
    loadDistrictOptions();
    return () => {
      aborted = true;
    };
  }, [admin.country, selectedProvinceId, selectedProvinceName]);

  // District 선택 시 시/마을 더미
  useEffect(() => {
    if (!admin.country || !admin.state || !admin.district) {
      setCityOpts([]);
      setVillageOpts([]);
      return;
    }
    setCityOpts([{ value: "Central", label: "Central" }]);
    setVillageOpts([
      { value: "Village-01", label: "Village 01" },
      { value: "Village-02", label: "Village 02" },
    ]);
    setAdmin((prev: AdminUI) => ({ ...prev, city: "", village: "" }));
  }, [admin.country, admin.state, admin.district]);

  // 샘플 빌딩 로드
  useEffect(() => {
    if (!map) return;
    let aborted = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/sample-buildings.geojson", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load sample-buildings.geojson (HTTP ${res.status})`);
        const fc = (await res.json()) as FC;
        if (aborted) return;

        setBuildings(fc);

        const Lmod = await import("leaflet");
        const layer = Lmod.geoJSON(fc); // L.GeoJSON 반환
        const bb = layer.getBounds?.(); // LatLngBounds
        if (bb?.isValid?.()) {
          map.fitBounds(bb, { padding: [16, 16] });
          if (map.getZoom() < 16) map.setZoom(16);
        }
      } catch (e) {
        console.error("[sample] load failed:", e);
        if (!aborted) setLoadError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!aborted) setIsLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [map]);

  // ✅ BuildingLayer가 요구하는 BuildingFC로 변환
  const buildingFC = useMemo<BuildingFC | null>(() => {
    if (!buildings) return null;
    const features = (buildings.features ?? [])
      .filter((f) => f.geometry?.type === "Point")
      .map((f) => {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const props: BuildingProperties = {
          id: String(
            (p.id as string | number | undefined) ??
              (f.id as string | number | undefined) ??
              ""
          ),
          name: (p.name as string | null | undefined) ?? null,
          housenumber: (p.housenumber as string | null | undefined) ?? null,
          street: (p.street as string | null | undefined) ?? null,
          road_id: (p.road_id as string | null | undefined) ?? null,
          village: (p.village as string | null | undefined) ?? null,
          district: (p.district as string | null | undefined) ?? null,
          province: (p.province as string | null | undefined) ?? null,
          country: (p.country as string | null | undefined) ?? null,
        };
        return { ...f, properties: props };
      });
    return { type: "FeatureCollection", features };
  }, [buildings]);

  // BuildingLayer 시그니처에 맞춰 타입 지정
  function onSelect(f: Feature<Geometry, BuildingProperties>, layer: Layer) {
    const id =
      (f.properties?.id as string | number | undefined) ??
      (f.id as string | number | undefined) ??
      null;
    setSelected({ id: id != null ? String(id) : null, feature: f as unknown as F });

    // bringToFront는 Path 계열에서만 존재 → 안전 캐스팅 후 옵셔널 호출
    (layer as BringToFrontCapable | null)?.bringToFront?.();
  }

  // 헤더 로고 클릭 시 완전 초기화
  useEffect(() => {
    const el = document.getElementById("app-logo") || document.getElementById("site-logo");
    if (!el) return;
    const onClick = (e: Event) => {
      e.preventDefault();
      setAdmin({ country: "", state: "", district: "", city: "", village: "" });
      setSelectedProvinceId(null);
      setSelectedProvinceName(null);
      setProvinceOpts([]);
      setDistrictOpts([]);
      setCityOpts([]);
      setVillageOpts([]);
      setSelected({ id: null, feature: null });
      setResetTick((t: number) => t + 1);
      map?.stop?.();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [map]);

  function SelectField({
    value,
    onChange,
    options,
    disabled,
    placeholder,
  }: {
    value?: string;
    onChange: (v: string | undefined) => void;
    options: Option[];
    disabled?: boolean;
    placeholder: string;
  }) {
    return (
      <Select value={value ?? ""} onValueChange={(v: string) => onChange(v || undefined)} disabled={disabled}>
        <SelectTrigger className="w-full h-8 rounded-md bg-white shadow-sm ring-1 ring-black/5 px-2 text-xs" aria-label={placeholder}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent sideOffset={4} className="rounded-md z-[3000] p-0 text-xs">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs py-1.5">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <main className="pt-14">
      <div className="mx-auto px-1 md:px-2 -mt-14">
        <div className="rounded-lg shadow-md ring-1 ring-black/5 bg-white">
          <div className="relative h-[70dvh] md:h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-6rem)]">
            {/* 지도 */}
            <div className="absolute inset-0 rounded-xl overflow-hidden"></div>
            <MapBase onReady={setMap} framed={false}>
              {/* 나라 경계 */}
              <CountryLayer
                key={`country-${resetTick}-${admin.country || "ALL"}`}
                adminCountry={admin.country}
                onPick={(iso: string | null) => {
                  const v = iso || "";
                  setAdmin({ country: v, state: "", district: "", city: "", village: "" });
                  setSelectedProvinceId(null);
                  setSelectedProvinceName(null);
                }}
              />

              {/* 주(도) 경계 */}
              {ccode && (
                <ProvinceLayer
                  key={`prov-${resetTick}-${ccode}`}
                  country={ccode}
                  selectedId={selectedProvinceId}
                  onReadyList={(rows: Array<{ id: string; name: string }>) => {
                    const opts = rows
                      .map((r) => ({ value: r.id, label: r.name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    setProvinceOpts(opts);
                  }}
                  onSelectFeature={(f: F | null) => {
                    const p = (f?.properties ?? {}) as Record<string, unknown>;
                    const gid1 =
                      (p.GID_1 as string | number | undefined) ??
                      (p.ADM1_PCODE as string | number | undefined) ??
                      (p.PCODE as string | number | undefined) ??
                      (p.CODE_1 as string | number | undefined) ??
                      (p.ID_1 as string | number | undefined) ??
                      (p.PROV_CODE as string | number | undefined) ??
                      (p.province_id as string | number | undefined) ??
                      null;
                    const name1 =
                      (p.NAME_1 as string | undefined) ??
                      (p.NAME as string | undefined) ??
                      null;

                    const idStr = gid1 != null ? String(gid1) : (f?.id != null ? String(f.id) : null);
                    const nameStr = name1 ? String(name1) : null;

                    setSelectedProvinceId(idStr);
                    setSelectedProvinceName(nameStr);
                    setAdmin((prev: AdminUI) => ({
                      ...prev,
                      state: idStr || "",
                      district: "",
                      city: "",
                      village: "",
                    }));
                  }}
                />
              )}

              {/* District 레이어 */}
              {admin.country && (selectedProvinceId || selectedProvinceName) && (
                <DistrictLayer
                  key={`dist-${resetTick}-${admin.country}-${selectedProvinceId || selectedProvinceName}`}
                  country={admin.country as "LAO" | "KHM"}
                  provinceCode={selectedProvinceId ?? selectedProvinceName ?? null}
                  visible={true}
                  onSelect={(
                    info: {
                      id: string;
                      name?: string;
                      props: Record<string, unknown>;
                      bbox?: LatLngBoundsLiteral;
                    }
                  ) => {
                    if (info.bbox && map) {
                      // Leaflet의 LatLngBoundsLiteral = [[south, west], [north, east]]
                      const [[s, w], [n, e]] = info.bbox;
                      map.fitBounds([[s, w], [n, e]], { padding: [12, 12] });
                    }
                    setAdmin((prev: AdminUI) => ({ ...prev, district: info.id || "" }));
                  }}
                />
              )}

              {/* 건물 레이어 */}
              {buildingFC && !loadError && (
                <BuildingLayer data={buildingFC} selectedId={selected.id} onSelect={onSelect} />
              )}
            </MapBase>

            {/* 컨트롤 오버레이 */}
            <div
              className="absolute left-2 top-2 z-[2000] pointer-events-auto"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-end gap-1.5 whitespace-nowrap max-w-[calc(100vw-1rem)] overflow-x-auto">
                {/* Country */}
                <div className="w-36">
                  <SelectField
                    value={admin.country}
                    onChange={(v) => {
                      setAdmin({ country: v || "", state: "", district: "", city: "", village: "" });
                      setSelectedProvinceId(null);
                      setSelectedProvinceName(null);
                    }}
                    options={countryOpts}
                    placeholder="Country"
                  />
                </div>

                {/* Province */}
                {admin.country && (
                  <div className="w-44 transition-all duration-200 ease-out">
                    <SelectField
                      value={selectedProvinceId ?? ""}
                      onChange={(v) => {
                        // 드롭다운에서 고를 때: id와 name을 동시에 세팅
                        const picked = provinceOpts.find((o) => o.value === (v ?? ""));
                        setSelectedProvinceId(v || null);
                        setSelectedProvinceName(picked?.label ?? null);
                        setAdmin((prev: AdminUI) => ({ ...prev, state: v || "", district: "", city: "", village: "" }));
                      }}
                      options={provinceOpts}
                      disabled={!admin.country}
                      placeholder="Province"
                    />
                  </div>
                )}

                {/* District */}
                {admin.state && (
                  <div className="w-40 transition-all duration-200 ease-out">
                    <SelectField
                      value={admin.district ?? ""}
                      onChange={(v) => setAdmin((prev: AdminUI) => ({ ...prev, district: v || "", city: "", village: "" }))}
                      options={districtOpts}
                      disabled={!admin.state}
                      placeholder="District"
                    />
                  </div>
                )}

                {/* City — District 선택 이후(더미) */}
                {admin.district && (
                  <div className="w-36 transition-all duration-200 ease-out">
                    <SelectField
                      value={admin.city}
                      onChange={(v) => setAdmin((prev: AdminUI) => ({ ...prev, city: v || "", village: "" }))}
                      options={cityOpts}
                      disabled={!admin.district}
                      placeholder="City"
                    />
                  </div>
                )}

                {/* Village — City 선택 이후(더미) */}
                {admin.city && (
                  <div className="w-36 transition-all duration-200 ease-out">
                    <SelectField
                      value={admin.village}
                      onChange={(v) => setAdmin((prev: AdminUI) => ({ ...prev, village: v || "" }))}
                      options={villageOpts}
                      disabled={!admin.city}
                      placeholder="Village"
                    />
                  </div>
                )}

                {/* 예시: 주소 생성 버튼 (원하면 노출) */}
                {/* <button
                  onClick={generate}
                  className="ml-2 rounded-md border px-2 py-1 text-xs bg-white hover:bg-gray-50"
                >
                  Copy Address
                </button> */}
              </div>
            </div>

            {/* 로더/에러 */}
            {isLoading && (
              <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border bg-white px-2 py-1.5 text-xs shadow z-[1900]">
                Loading sample buildings…
              </div>
            )}
            {loadError && (
              <div className="pointer-events-auto absolute left-1/2 top-2 -translate-x-1/2 rounded-md border bg-white px-2 py-1.5 text-xs text-red-600 shadow z-[1900]">
                Failed to load data: {loadError}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="h-10 px-3 md:px-4 flex items-center justify-between text-xs text-gray-600">
        <div>© 2025 Project:Address</div>
        <div className="flex items-center gap-3">
          <a href="/about" className="hover:underline">About</a>
          <a href="/tools" className="hover:underline">Data Studio</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:underline">GitHub</a>
        </div>
      </footer>
    </main>
  );
}
