// src/components/Map.tsx
// DEPRECATED: components/Map.tsx
// 이제는 MapBase + 각 레이어를 직접 가져다 쓰는 구조입니다.
// (예) import MapBase, { BuildingLayer } from "@/components/Map";

export { default } from "./MapBase";                // default -> MapBase (기존 호환)
export { default as MapBase } from "./MapBase";
export { default as BuildingLayer } from "./layers/BuildingLayer";
export { default as StaticLayer } from "./layers/StaticLayer";
export { default as PointLayer } from "./layers/PointLayer";
export { default as PinnedLayer } from "./layers/PinnedLayer";
