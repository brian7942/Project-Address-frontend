export async function fetchBuildings(bbox: string, zoom: number, signal?: AbortSignal) {
  const url = `/api/buildings?bbox=${encodeURIComponent(bbox)}&zoom=${zoom}`;
  const res = await fetch(url, {
    signal,
    cache: "no-store",
    headers: {
      // 서버가 ETag를 준다면 다음 라인을 연결: 'If-None-Match': etagStore[url] ?? ''
    },
  });
  if (res.status === 304) {
    // etag 캐시 히트 처리 가능
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as GeoJSON.FeatureCollection;
}
