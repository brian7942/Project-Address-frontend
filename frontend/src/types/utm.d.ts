declare module "utm" {
  export interface UtmResult {
    easting: number;
    northing: number;
    zoneNum: number;
    zoneLetter: string;
    accuracy?: number;
  }

  export function fromLatLon(lat: number, lon: number): UtmResult;

  export function toLatLon(
    easting: number,
    northing: number,
    zoneNum: number,
    zoneLetter: string,
    northern?: boolean
  ): { latitude: number; longitude: number };

  const _default: {
    fromLatLon: typeof fromLatLon;
    toLatLon: typeof toLatLon;
  };
  export default _default;
}