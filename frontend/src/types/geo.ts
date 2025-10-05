// src/types/geo.ts
import type { Feature, FeatureCollection, Geometry } from "geojson";

export type AdminForm = {
  countryCode: string;
  countryName?: string;
  provinceCode?: string;
  provinceName?: string;
  districtCode?: string;
  districtName?: string;
  villageCode?: string;
  villageName?: string;
};

export type BuildingProperties = {
  id: string | number;
  name?: string | null;
  housenumber?: string | number | null;
  street?: string | null;
  road_id?: string | number | null;
  village?: string | null;
  district?: string | null;
  province?: string | null;
  country?: string | null;
  [k: string]: unknown;
};

// ✅ 여기 변경: Geometry 전체를 허용
export type FeatureAnyGeom<P = Record<string, unknown>> = Feature<Geometry, P>;
export type FCAnyGeom<P = Record<string, unknown>> = FeatureCollection<Geometry, P>;

// 참고: 아래 두 타입은 필요하면 유지
export type BuildingFeature = FeatureAnyGeom<BuildingProperties>;
export type BuildingFC = FCAnyGeom<BuildingProperties>;
