export type Coordinates = { latitude: number; longitude: number };

export function parseCoordinates(value: string): Coordinates | null {
  const [latitude, longitude, ...rest] = value.split(",").map(Number);
  if (rest.length || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function milesBetween(a: Coordinates, b: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isProviderInRange(distance: number, searchRadiusMiles: number, serviceRadiusMiles: number | null | undefined): boolean {
  return Number.isFinite(distance) && distance <= searchRadiusMiles && distance <= (serviceRadiusMiles ?? 0);
}

export async function resolveVisitorLocation(location: string, geocode: (value: string) => Promise<Coordinates>): Promise<Coordinates | null> {
  return parseCoordinates(location) ?? await geocode(location).catch(() => null);
}
