// Fetch a count for a resource prefix via GET /rmce/objects/{resource}?count → { count: number }
export async function fetchResourceCount(prefix: string, signal?: AbortSignal): Promise<number> {
  const url = `/rmce/objects/${encodeURIComponent(prefix)}?count`;
  const res = await fetch(url, {signal : signal ?? null, headers: { 'accept': 'application/json' } });
  if (!res.ok) throw new Error(`Count fetch failed for ${prefix}: ${res.status}`);
  const data = await res.json() as { count?: unknown };
  const n = Number((data as any).count);
  if (!Number.isFinite(n)) throw new Error(`Invalid count payload for ${prefix}`);
  return n;
}