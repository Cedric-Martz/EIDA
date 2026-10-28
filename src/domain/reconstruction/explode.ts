export type Vec3 = readonly [number, number, number];
export function explodedPosition(
  index: number,
  count: number,
  amount: number,
): Vec3 {
  if (count <= 1) return [0, 0, 0];
  return [0, 0, (index - (count - 1) / 2) * amount];
}
