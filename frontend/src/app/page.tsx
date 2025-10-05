"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { FeatureCollection, Geometry, GeoJsonProperties, Feature } from "geojson";
import type { Map as LeafletMap } from "leaflet";
import { buildAddressString, type AdminForm } from "@/lib/address";

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

// AdminForm 확장(로컬 타입) — district만 추가
type AdminFormEx = AdminForm & { district?: string };

// -------- 유틸: 다양한 스키마 안전 대응 --------
function pickProvinceCode(props: Record<string, any>): string | undefined {
  return (
    props.GID_1 ??
    props.ADM1_PCODE ??
    props.PCODE ??
    props.CODE_1 ??
    props.ID_1 ??
    props.PROV_CODE ??
    props.province_id ??
    props.state ??
    props.state_id ??
    undefined
  )?.toString();
}
function pickDistrictId(props: Record<string, any>, f?: Feature): string | undefined {
  return (
    (f as any)?.id ??
    props.GID_2 ??
    props.ADM2_PCODE ??
    props.PCODE ??
    props.CODE_2 ??
    props.ID_2 ??
    props.OBJECTID ??
    props.id ??
    undefined
  )?.toString();
}
function pickDistrictName(props: Record<string, any>): string | undefined {
  return (
    props.NAME_2 ??
    props.DIST_NAME ??
    props.DISTRICT ??
    props.NAME ??
    props.en_name ??
    props.local_name ??
    undefined
  )?.toString();
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

  // 행정 선택 상태 (district 추가)
  const [admin, setAdmin] = useState<AdminFormEx>({
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
  const [resetTick, setResetTick] = useState(0);

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
    setAdmin((p) => ({ ...p, state: "", district: "", city: "", village: "" }));
  }, [admin.country]);

  // ✅ Province 선택 시 District 옵션을 '실데이터(GeoJSON)'로 채우기 (코드 또는 정규화된 이름 매칭)
  useEffect(() => {
    let aborted = false;
    async function loadDistrictOptions() {
      if (!admin.country || (!selectedProvinceId && !selectedProvinceName)) {
        setDistrictOpts([]);
        setCityOpts([]);
        setVillageOpts([]);
        setAdmin((prev) => ({ ...prev, district: "", city: "", village: "" }));
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
            const p = (f.properties ?? {}) as Record<string, any>;
            const provCode = (pickProvinceCode(p) ?? "").toString();
            const provName = (p.NAME_1 ?? p.NAME ?? "").toString();
            // ① 코드 동일
            if (selectedProvinceId && provCode === selectedProvinceId) return true;
            // ② 이름 정규화 동일
            if (selectedProvinceName && normalizeAdmName(provName) === selNameNorm) return true;
            return false;
          })
          .map((f) => {
            const p = (f.properties ?? {}) as Record<string, any>;
            const id = pickDistrictId(p, f);
            const name = pickDistrictName(p) ?? id ?? "(unknown)";
            return { value: id!, label: name };
          })
          .filter((o) => !!o.value)
          .sort((a, b) => a.label.localeCompare(b.label));

        setDistrictOpts(opts);
        setCityOpts([]);
        setVillageOpts([]);
        setAdmin((prev) => ({ ...prev, district: "", city: "", village: "" }));
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
    setAdmin((prev) => ({ ...prev, city: "", village: "" }));
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

        const { default: Lmod } = await import("leaflet");
        const layer = (Lmod as any).geoJSON(fc);
        const bb = layer.getBounds?.();
        if (bb?.isValid?.()) {
          map.fitBounds(bb, { padding: [16, 16] });
          if (map.getZoom() < 16) map.setZoom(16);
        }
      } catch (e: any) {
        console.error("[sample] load failed:", e);
        if (!aborted) setLoadError(e?.message ?? "Unknown error");
      } finally {
        if (!aborted) setIsLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [map]);

  function onSelect(f: F, layer: any) {
    const id = (f as any)?.properties?.id ?? (f as any)?.id ?? null;
    setSelected({ id, feature: f });
    layer?.bringToFront?.();
  }

  async function generate() {
    if (!selected.feature) {
      alert("Please select a building first.");
      return;
    }
    const out = buildAddressString(selected.feature, admin as AdminForm);
    if (!out) {
      alert("Failed to generate an address.");
      return;
    }
    try {
      await navigator.clipboard.writeText(out.addr);
    } catch {}
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
      setResetTick((t) => t + 1);
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
      <Select value={value ?? ""} onValueChange={(v) => onChange(v || undefined)} disabled={disabled}>
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
                onPick={(iso) => {
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
                  onReadyList={(rows) => {
                    // value=id, label=name 유지
                    const opts = rows
                      .map((r) => ({ value: r.id, label: r.name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    setProvinceOpts(opts);
                  }}
                  onSelectFeature={(f) => {
                    // 지도에서 Province 클릭 시 id(=GID계열)와 name 모두 반영
                    const p = (f?.properties ?? {}) as Record<string, any>;
                    const gid1 =
                      p.GID_1 ??
                      p.ADM1_PCODE ??
                      p.PCODE ??
                      p.CODE_1 ??
                      p.ID_1 ??
                      p.PROV_CODE ??
                      p.province_id ??
                      null;
                    const name1 = p.NAME_1 ?? p.NAME ?? null;

                    const idStr = (gid1 ?? p.id ?? null)?.toString() ?? null;
                    const nameStr = (name1 ?? "").toString() || null;

                    setSelectedProvinceId(idStr);
                    setSelectedProvinceName(nameStr);
                    setAdmin((prev) => ({
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
                  onSelect={(info) => {
                    if (info.bbox && map) {
                      const [[s, w], [n, e]] = info.bbox;
                      // @ts-ignore
                      map.fitBounds([[s, w], [n, e]], { padding: [12, 12] });
                    }
                    setAdmin((prev) => ({ ...prev, district: info.id || "" }));
                  }}
                />
              )}

              {/* 건물 레이어 */}
              {buildings && !loadError && (
                <BuildingLayer data={buildings} selectedId={selected.id} onSelect={onSelect} />
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
                        setAdmin((prev) => ({ ...prev, state: v || "", district: "", city: "", village: "" }));
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
                      onChange={(v) => setAdmin((prev) => ({ ...prev, district: v || "", city: "", village: "" }))}
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
                      onChange={(v) => setAdmin((prev) => ({ ...prev, city: v || "", village: "" }))}
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
                      onChange={(v) => setAdmin((prev) => ({ ...prev, village: v || "" }))}
                      options={villageOpts}
                      disabled={!admin.city}
                      placeholder="Village"
                    />
                  </div>
                )}
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
