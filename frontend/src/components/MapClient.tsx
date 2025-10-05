"use client";

import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center text-sm text-gray-500">
      지도를 불러오는 중…
    </div>
  ),
});

export default function MapClient() {
  return <Map />;
}
