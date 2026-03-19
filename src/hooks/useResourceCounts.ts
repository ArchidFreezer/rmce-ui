import * as React from 'react';
import { fetchResourceCount } from '../api/counts';

// A minimal in-memory cache (lives across Sidebar re-mounts)
const countsCache = new Map<string, number>();
const inFlight = new Map<string, Promise<number>>();

export function inferPrefixFromPath(path: `/${string}`): string | undefined {
  // Known routes look like '/books', '/poisons', '/climate', etc.
  // Generic routes look like '/r/{prefix}'
  // If your known path differs from the prefix, prefer item.prefix if present.
  const m = /^\/r\/([^/]+)$/.exec(path);
  return m ? m[1] : undefined;
}

export type CountEntry = { key: string; prefix: string | undefined; count?: number | undefined; error?: string | undefined; loading: boolean };

/**
 * items: sidebar items → { label, path, isKnown?, prefix? }
 * Returns a map key → { count, loading, error }
 */
export function useResourceCounts(items: Array<{ path: `/${string}`; prefix?: string | undefined }>) {
  const [version, setVersion] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);

  // Build a normalized list of distinct prefixes we need counts for
  const prefixes = React.useMemo(() => {
    const acc = new Set<string>();
    for (const it of items) {
      if (it.prefix) { acc.add(it.prefix); continue; }
      const inferred = inferPrefixFromPath(it.path);
      if (inferred) acc.add(inferred);
    }
    return Array.from(acc).sort();
  }, [items]);

  const state = React.useMemo(() => {
    const m = new Map<string, CountEntry>();
    for (const p of prefixes) {
      const key = p;
      const cached = countsCache.get(p);
      m.set(key, { key, prefix: p, count: cached, loading: cached == null, error: undefined });
    }
    return m;
  }, [prefixes, version]);

  // Kick off fetches for any missing prefix
  React.useEffect(() => {
    if (!prefixes.length) return;

    // Cancel previous batch when items change rapidly
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    (async () => {
      const work: Promise<void>[] = [];
      for (const p of prefixes) {
        if (countsCache.has(p) || inFlight.has(p)) continue;

        const prom = fetchResourceCount(p, controller.signal)
          .then((n) => { countsCache.set(p, n); })
          .catch((err) => {
            // Store a sentinel to avoid tight loops; we render error state without caching error permanently
            // (Alternative: cache a negative value or store in a separate error cache)
            console.error('count fetch failed for', p, err);
          })
          .finally(() => { inFlight.delete(p); });

        inFlight.set(p, prom.then(() => countsCache.get(p) ?? NaN));
        work.push(prom.then(() => {}));
      }

      if (work.length) {
        await Promise.allSettled(work);
        if (!cancelled) setVersion((v) => v + 1);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [prefixes]);

  return state;
}

