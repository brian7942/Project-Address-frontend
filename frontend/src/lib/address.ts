import type { AdminForm, BuildingProperties } from "@/types/geo";

/**
 * 행정정보 + (선택) 건물 속성을 기반으로 표시용 전체 주소 문자열을 생성
 * - 누락 가능성 고려
 * - 숫자/문자 타입 혼재 가능성 고려
 */
export function buildAddressString(
  admin: AdminForm,
  building?: Partial<BuildingProperties> | null
): string {
  const parts: string[] = [];

  if (admin.countryName) parts.push(admin.countryName);
  if (admin.provinceName) parts.push(admin.provinceName);
  if (admin.districtName) parts.push(admin.districtName);
  if (admin.villageName) parts.push(admin.villageName);

  if (building?.street) parts.push(String(building.street));
  if (building?.housenumber != null) parts.push(String(building.housenumber));
  if (building?.name) parts.push(building.name);

  return parts.filter(Boolean).join(" ");
}

/**
 * 행정 라벨(빵부스러기 식) 포맷
 */
export function formatAdminLabel(admin: AdminForm): string {
  return [
    admin.countryName,
    admin.provinceName,
    admin.districtName,
    admin.villageName,
  ]
    .filter(Boolean)
    .join(" / ");
}

/**
 * 안전 파서: 외부 JSON → BuildingProperties
 * - 입력은 unknown으로 받아 내부에서 좁힘
 * - 누락 필드는 기본값 부여
 */
export function toBuildingProperties(input: unknown): BuildingProperties {
  const obj =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};

  return {
    id: (obj.id as string | number | undefined) ?? "",
    name: (obj.name as string | null | undefined) ?? null,
    housenumber:
      (obj.housenumber as string | number | null | undefined) ?? null,
    street: (obj.street as string | null | undefined) ?? null,
    road_id: (obj.road_id as string | number | null | undefined) ?? null,
    village: (obj.village as string | null | undefined) ?? null,
    district: (obj.district as string | null | undefined) ?? null,
    province: (obj.province as string | null | undefined) ?? null,
    country: (obj.country as string | null | undefined) ?? null,
  };
}

/**
 * 간단한 유틸: 건물 속성에서 도로명+번지 라벨 생성
 */
export function formatStreetNumber(
  b: Partial<BuildingProperties> | null | undefined
): string {
  if (!b) return "";
  const street = b.street ? String(b.street) : "";
  const no =
    b.housenumber !== undefined && b.housenumber !== null
      ? String(b.housenumber)
      : "";
  return [street, no].filter(Boolean).join(" ");
}
