export function fmtNaira(v: number) {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  return `₦${(v / 1_000).toFixed(0)}K`;
}
