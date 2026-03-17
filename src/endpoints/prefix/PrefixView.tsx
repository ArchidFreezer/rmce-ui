import { useEffect, useState } from 'react';
import { fetchPrefixes } from '../../api/prefix';
import { Link } from 'react-router-dom';

export default function PrefixView() {
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const px = await fetchPrefixes();
        if (!mounted) return;
        setPrefixes(px);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Available Object Types</h2>
      {prefixes.length === 0 ? (
        <div>No prefixes returned.</div>
      ) : (
        <ul style={{ listStyle: 'disc', paddingLeft: 20, margin: 0 }}>
          {prefixes.map((p) => (
            <li key={p} style={{ lineHeight: 1.7 }}>
              <strong>{p}</strong>{' '}
              {/* Known routes → link; unknown → just show name */}
              {routeFor(p) ? (
                <Link to={routeFor(p)!} style={{ marginLeft: 8 }}>Open</Link>
              ) : (
                <span style={{ color: 'var(--muted)', marginLeft: 8 }}>(no route configured)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Map API prefixes to UI routes you’ve registered in registry.ts
function routeFor(prefix: string): string | null {
  switch (prefix) {
    case 'book': return '/books';
    case 'poison': return '/poisons';
    case 'armourtype': return '/armourtypes';
    default: return null;
  }
}