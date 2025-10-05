"use client";

import dynamic from "next/dynamic";
const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function Page() {
  return (
    <section className="h-[80vh]">
      <WorldMap />
    </section>
  );
}
