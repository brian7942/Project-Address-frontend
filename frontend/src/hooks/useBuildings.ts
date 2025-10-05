import { useEffect, useMemo, useState } from "react";
import type { BuildingFC } from "@/types/geo";

type UseBuildingsParams = {
  /** [minX, minY, maxX, maxY] (경도/위도 순, WGS84) */
  bbox?: [number, number, number, number];
  /** ADM 구역 식별자 등 */
  districtId?: string;
  /** 커스텀 엔드포인트가 필요하면 지정 */
  url?: string;
};

type UseBuildingsResult = {
  data: BuildingFC | null;
  loading: boolean;
  error: Error | null;
  /** 재조회 */
  refetch: () => void;
};

export function useBuildings(
  { bbox, districtId, url = "/api/buildings" }: UseBuildingsParams
): UseBuildingsResult {
  const [data, setData] = useState<BuildingFC | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // ✅ 의존성에서 사용할 bboxKey는 useMemo로 계산
  const bboxKey = useMemo(() => (Array.isArray(bbox) ? bbox.join(",") : ""), [bbox]);

  useEffect(() => {
    let aborted = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (bboxKey) params.set("bbox", bboxKey);
        if (districtId) params.set("districtId", districtId);

        const resp = await fetch(`${url}?${params.toString()}`, {
          headers: { Accept: "application/json" },
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const json = (await resp.json()) as BuildingFC;

        const isFC =
          json &&
          typeof json === "object" &&
          json.type === "FeatureCollection" &&
          Array.isArray(json.features);

        if (!isFC) throw new Error("Invalid GeoJSON FeatureCollection");

        if (!aborted) setData(json);
      } catch (e: unknown) {
        if (!aborted) {
          setError(e instanceof Error ? e : new Error("Unknown error"));
          setData(null);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [bboxKey, districtId, url, reloadKey]); // ✅ 깔끔한 의존성

  const refetch = () => setReloadKey((k) => k + 1);

  return { data, loading, error, refetch };
}

export default useBuildings;
