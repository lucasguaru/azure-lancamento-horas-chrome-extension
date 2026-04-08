export function parseHoursMaybe(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(String(value).replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

export function parseHours(value: unknown): number {
  return parseHoursMaybe(value) ?? 0;
}

export function round2(value: unknown): number {
  return Number((Number(value) || 0).toFixed(2));
}

export function formatHours(value: number): string {
  if (!value) return "";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
