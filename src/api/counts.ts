// Fetch a count for a single resource prefix via GET /rmce/objects/{resource}?count → { count: number }
export async function fetchResourceCount(prefix: string, signal?: AbortSignal): Promise<number> {
  const url = `/rmce/objects/${encodeURIComponent(prefix)}?count`;
  const res = await fetch(url, {signal : signal ?? null, headers: { 'accept': 'application/json' } });
  if (!res.ok) throw new Error(`Count fetch failed for ${prefix}: ${res.status}`);
  const data = await res.json() as { count?: unknown };
  const n = Number((data as any).count);
  if (!Number.isFinite(n)) throw new Error(`Invalid count payload for ${prefix}`);
  return n;
}

/** Batch: GET /rmce/objects/count?types=a,b,c -> { counts: [{ type: 'a', count: n }, ...] } */
export async function fetchResourceCountsBatch(
  prefixes: string[],
  signal?: AbortSignal
): Promise<Map<string, number>> {
  const list = Array.from(new Set(prefixes)).filter(Boolean);
  if (list.length === 0) return new Map();

  const url = `/rmce/objects/count?types=${encodeURIComponent(list.join(','))}`;
  const res = await fetch(url, {
    signal: signal ?? null,
    headers: { accept: 'application/json' } as const,
  });
  if (!res.ok) {
    throw new Error(`Batch count fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    counts?: Array<{ type?: unknown; count?: unknown }>;
  };

  const out = new Map<string, number>();
  if (Array.isArray(data?.counts)) {
    for (const row of data.counts) {
      const key = String(row?.type ?? '');
      const n = Number(row?.count);
      if (!key) continue;
      if (!Number.isFinite(n)) continue;
      out.set(key, n);
    }
  }
  return out;
}