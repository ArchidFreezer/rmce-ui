// src/hooks/useResourceCounts.ts
import * as React from 'react';
import { fetchResourceCount, fetchResourceCountsBatch } from '../api/counts';

export function inferPrefixFromPath(path: `/${string}`): string | undefined {
  const m = /^\/r\/([^/]+)$/.exec(path);
  return m ? m[1] : undefined;
}

const countsCache = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();

export type CountEntry = { key: string | undefined; prefix: string | undefined; count?: number | undefined; error?: string | undefined; loading: boolean };

export function useResourceCounts(items: Array<{ path: `/${string}`; prefix?: string | undefined}>) {
  const [version, setVersion] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);

  // Normalize → unique prefixes we need
  const prefixes = React.useMemo(() => {
    const acc = new Set<string>();
    for (const it of items) {
      if (it.prefix) acc.add(it.prefix);
      else {
        const inferred = inferPrefixFromPath(it.path);
        if (inferred) acc.add(inferred);
      }
    }
    return Array.from(acc).sort();
  }, [items]);

  // Local state view from cache
  const state = React.useMemo(() => {
    const m = new Map<string, CountEntry>();
    for (const p of prefixes) {
      const c = countsCache.get(p);
      m.set(p, { key: p, prefix: p, count: c, loading: c == null, error: undefined });
    }
    return m;
  }, [prefixes, version]);

  // Kick off fetches
  React.useEffect(() => {
    if (!prefixes.length) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    (async () => {
      // Determine which prefixes still need fetching
      const need = prefixes.filter((p) => !countsCache.has(p));
      if (!need.length) return;

      // 1) Try batch
      let missing = new Set(need);
      try {
        const batchMap = await fetchResourceCountsBatch(need, controller.signal);
        for (const [k, v] of batchMap) {
          countsCache.set(k, v);
          missing.delete(k);
        }
      } catch (err) {
        // Batch failed — we'll fall back to per-prefix
        // console.warn('Batch count failed', err);
      }

      // 2) Fallback: per‑prefix for anything missing and not already in-flight
      const tasks: Promise<void>[] = [];
      for (const p of missing) {
        if (countsCache.has(p) || inFlight.has(p)) continue;
        const prom = (async () => {
          try {
            const n = await fetchResourceCount(p, controller.signal);
            countsCache.set(p, n);
          } catch (err) {
            // leave cache empty; render will show “—”
          }
        })()
          .catch(() => {})
          .finally(() => { inFlight.delete(p); });

        inFlight.set(p, prom);
        tasks.push(prom);
      }

      if (tasks.length) {
        await Promise.allSettled(tasks);
      }

      if (!cancelled) setVersion((v) => v + 1);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [prefixes]);

  return state;
}