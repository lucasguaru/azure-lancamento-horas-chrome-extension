export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  getter: () => T | null | undefined,
  timeoutMs = 12000,
  intervalMs = 250
): Promise<T | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = getter();
    if (value) return value;
    await sleep(intervalMs);
  }
  return null;
}
