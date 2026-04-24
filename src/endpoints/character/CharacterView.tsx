import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchCharacters, deleteCharacter,
  fetchRaces, fetchCultures, fetchProfessions,
  fetchSkills, fetchSkillCategories, fetchSpellLists,
  fetchSkillProgressionTypes, fetchLanguages,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Character, CharacterCategory, CharacterSkill,
} from '../../types';

/* ------------------------------------------------------------------ */
/* Reference data lookup                                              */
/* ------------------------------------------------------------------ */

type NameMap = Map<string, string>;

interface RefData {
  races: NameMap;
  cultures: NameMap;
  professions: NameMap;
  skills: NameMap;
  skillCategories: NameMap;
  spellLists: NameMap;
  progressionTypes: NameMap;
  languages: NameMap;
}

const emptyRefData = (): RefData => ({
  races: new Map(),
  cultures: new Map(),
  professions: new Map(),
  skills: new Map(),
  skillCategories: new Map(),
  spellLists: new Map(),
  progressionTypes: new Map(),
  languages: new Map(),
});

function buildMap(items: { id: string; name: string }[]): NameMap {
  return new Map(items.map(i => [i.id, i.name]));
}

/** Returns the display name for an id, falling back to the id itself */
function resolve(map: NameMap, id: string): string {
  return map.get(id) ?? id;
}

/* ------------------------------------------------------------------ */
/* Tab types                                                           */
/* ------------------------------------------------------------------ */
type Tab = 'details' | 'skills' | 'categories';

/* ------------------------------------------------------------------ */
/* Detail sub-components                                              */
/* ------------------------------------------------------------------ */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th style={{ textAlign: 'left', padding: '3px 12px 3px 0', whiteSpace: 'nowrap', fontWeight: 600 }}>{label}</th>
      <td style={{ padding: '3px 0' }}>{value ?? '—'}</td>
    </tr>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h4 style={{ margin: '16px 0 6px', borderBottom: '1px solid var(--border, #ccc)', paddingBottom: 4 }}>
      {title}
    </h4>
  );
}

function DetailsTab({ char, ref: refs }: { char: Character; ref: RefData }) {
  return (
    <div style={{ padding: '12px 0' }}>
      <SectionHeading title="General" />
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <DetailRow label="ID" value={char.id} />
          <DetailRow label="Name" value={char.name} />
          <DetailRow label="Gender" value={char.male ? 'Male' : 'Female'} />
          <DetailRow label="Player Character" value={char.playerCharacter ? 'Yes' : 'No'} />
          <DetailRow label="Level" value={char.level} />
          <DetailRow label="Experience Points" value={char.experiencePoints.toLocaleString()} />
          <DetailRow label="Gold" value={char.gold} />
          <DetailRow label="Development Points" value={char.developmentPoints} />
        </tbody>
      </table>

      <SectionHeading title="Origin" />
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <DetailRow label="Race" value={resolve(refs.races, char.race)} />
          <DetailRow label="Culture" value={resolve(refs.cultures, char.culture)} />
          <DetailRow label="Profession" value={resolve(refs.professions, char.profession)} />
        </tbody>
      </table>

      <SectionHeading title="Physique" />
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <DetailRow label="Height (in)" value={char.height} />
          <DetailRow label="Weight (lbs)" value={char.weight} />
          <DetailRow label="Build" value={char.buildDescription} />
          <DetailRow label="Lifespan (days)" value={char.lifespan.toLocaleString()} />
        </tbody>
      </table>

      <SectionHeading title="Stats" />
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Stat', 'Temporary', 'Potential', 'Racial Bonus'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {char.stats.map(s => (
            <tr key={s.stat}>
              <td style={{ padding: '3px 10px 3px 0' }}>{s.stat}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{s.temporary}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{s.potential}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{s.racialBonus}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionHeading title="Combat" />
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <DetailRow label="Hits" value={`${char.hits} / ${char.maxHits}`} />
          <DetailRow label="Power Points" value={`${char.powerPoints} / ${char.maxPowerPoints}`} />
          <DetailRow label="Magical Realms" value={char.magicalRealms.join(', ') || '—'} />
        </tbody>
      </table>

      {char.resistances.length > 0 && (
        <>
          <SectionHeading title="Resistances" />
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Resistance Type', 'Bonus'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {char.resistances.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: '3px 10px 3px 0' }}>{r.id}</td>
                  <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {char.spellListCategories.length > 0 && (
        <>
          <SectionHeading title="Spell List Categories" />
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Category', 'Spell Lists'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {char.spellListCategories.map(c => (
                <tr key={c.category}>
                  <td style={{ padding: '3px 10px 3px 0', verticalAlign: 'top' }}>{resolve(refs.skillCategories, c.category)}</td>
                  <td style={{ padding: '3px 0' }}>{c.spellLists.map(sl => resolve(refs.spellLists, sl)).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {char.languageAbilities.length > 0 && (
        <>
          <SectionHeading title="Language Abilities" />
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Language', 'Spoken', 'Written', 'Somatic'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {char.languageAbilities.map(la => (
                <tr key={la.language}>
                  <td style={{ padding: '3px 10px 3px 0' }}>{resolve(refs.languages, la.language)}</td>
                  <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{la.spoken ?? '—'}</td>
                  <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{la.written ?? '—'}</td>
                  <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{la.somatic ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {char.items && char.items.length > 0 && (
        <>
          <SectionHeading title="Items" />
          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
            {char.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function SkillGroup({ title, skills, refs }: { title: string; skills: CharacterSkill[]; refs: RefData }) {
  if (skills.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <h5 style={{ margin: '8px 0 4px', color: 'var(--muted, #666)' }}>{title}</h5>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Skill', 'Subcategory', 'Progression', 'Dev Type', 'Ranks', 'Prof Bonus', 'Special Bonus', 'Total Bonus'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)', fontSize: '0.85em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skills.map((s, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{resolve(refs.skills, s.skillData.id)}</td>
              <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{s.skillData.subcategory ?? '—'}</td>
              <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{resolve(refs.progressionTypes, s.progression)}</td>
              <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{s.developmentType}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right', fontSize: '0.9em' }}>{s.ranks}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right', fontSize: '0.9em' }}>{s.professionBonus}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right', fontSize: '0.9em' }}>{s.specialBonus}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right', fontSize: '0.9em' }}>{s.totalBonus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupSkillsByCategory(skills: CharacterSkill[], refs: RefData): Map<string, CharacterSkill[]> {
  const groups = new Map<string, CharacterSkill[]>();
  for (const skill of skills) {
    const catId = skill.category ?? '';
    const catName = catId ? resolve(refs.skillCategories, catId) : 'Uncategorized';
    const arr = groups.get(catName) ?? [];
    arr.push(skill);
    groups.set(catName, arr);
  }
  return groups;
}

function SkillsTab({ char, refs }: { char: Character; refs: RefData }) {
  const developed = char.skills.filter(s => s.ranks > 0);
  const undeveloped = char.skills.filter(s => s.ranks <= 0);

  const developedGroups = groupSkillsByCategory(developed, refs);
  const undevelopedGroups = groupSkillsByCategory(undeveloped, refs);

  return (
    <div style={{ padding: '12px 0' }}>
      <SectionHeading title={`Developed Skills (${developed.length})`} />
      {developed.length === 0 ? (
        <p style={{ color: 'var(--muted, #666)' }}>No developed skills.</p>
      ) : (
        Array.from(developedGroups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([cat, skills]) => (
          <SkillGroup key={cat} title={cat} skills={skills} refs={refs} />
        ))
      )}

      <SectionHeading title={`Undeveloped Skills (${undeveloped.length})`} />
      {undeveloped.length === 0 ? (
        <p style={{ color: 'var(--muted, #666)' }}>No undeveloped skills.</p>
      ) : (
        Array.from(undevelopedGroups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([cat, skills]) => (
          <SkillGroup key={cat} title={cat} skills={skills} refs={refs} />
        ))
      )}
    </div>
  );
}

function CategoriesTab({ char, refs }: { char: Character; refs: RefData }) {
  const sorted = useMemo(
    () => [...char.categories].sort((a, b) =>
      resolve(refs.skillCategories, a.id).localeCompare(resolve(refs.skillCategories, b.id))
    ),
    [char.categories, refs]
  );

  if (sorted.length === 0) {
    return <p style={{ padding: '12px 0', color: 'var(--muted, #666)' }}>No categories.</p>;
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Category', 'Progression', 'Dev Cost', 'Ranks', 'Prof Bonus', 'Special Bonus'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((cat: CharacterCategory) => (
            <tr key={cat.id}>
              <td style={{ padding: '3px 10px 3px 0' }}>{resolve(refs.skillCategories, cat.id)}</td>
              <td style={{ padding: '3px 10px 3px 0' }}>{resolve(refs.progressionTypes, cat.progression)}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{cat.developmentCost}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{cat.ranks}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{cat.professionBonus}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'right' }}>{cat.specialBonus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */
export default function CharacterView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Character[]>([]);
  const [refs, setRefs] = useState<RefData>(emptyRefData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [selected, setSelected] = useState<Character | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('details');

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    (async () => {
      try {
        const [
          characters, races, cultures, professions,
          skills, skillCategories, spellLists,
          progressionTypes, languages,
        ] = await Promise.all([
          fetchCharacters(),
          fetchRaces(),
          fetchCultures(),
          fetchProfessions(),
          fetchSkills(),
          fetchSkillCategories(),
          fetchSpellLists(),
          fetchSkillProgressionTypes(),
          fetchLanguages(),
        ]);
        setRows(characters);
        setRefs({
          races: buildMap(races),
          cultures: buildMap(cultures),
          professions: buildMap(professions),
          skills: buildMap(skills),
          skillCategories: buildMap(skillCategories),
          spellLists: buildMap(spellLists),
          progressionTypes: buildMap(progressionTypes),
          languages: buildMap(languages),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns: ColumnDef<Character>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 220 },
    { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 160 },
    { id: 'race', header: 'Race', accessor: (r) => resolve(refs.races, r.race), sortType: 'string' },
    { id: 'profession', header: 'Profession', accessor: (r) => resolve(refs.professions, r.profession), sortType: 'string' },
    { id: 'level', header: 'Level', accessor: (r) => r.level, sortType: 'number', align: 'right' },
    { id: 'gender', header: 'Gender', accessor: (r) => r.male ? 'Male' : 'Female', sortType: 'string' },
    { id: 'pc', header: 'PC', accessor: (r) => r.playerCharacter ? 'Yes' : 'No', sortType: 'string' },
    {
      id: 'actions',
      header: 'Actions',
      sortable: false,
      width: 180,
      render: (row) => (
        <>
          <button onClick={() => { setSelected(row); setActiveTab('details'); }}>View</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020', marginLeft: 8 }}>Delete</button>
        </>
      ),
    },
  ], [rows, refs]);

  const globalFilter = (c: Character, q: string) =>
    [c.id, c.name, c.race, c.culture, c.profession]
      .some(v => String(v ?? '').toLowerCase().includes(q.toLowerCase()));

  const onDelete = async (row: Character) => {
    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Character',
      body: `Delete character "${row.name}" (${row.id})? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) { setSubmitting(false); return; }

    const prev = rows;
    setRows(current => current.filter(r => r.id !== row.id));
    setPage(1);

    try {
      await deleteCharacter(row.id);
      if (selected?.id === row.id) setSelected(null);
      toast({ variant: 'success', title: 'Deleted', description: `Character "${row.name}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner size={24} />;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '6px 16px',
    cursor: 'pointer',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--accent, #0078d4)' : '2px solid transparent',
    background: 'none',
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? 'var(--accent, #0078d4)' : 'inherit',
  });

  return (
    <>
      <h2>Characters</h2>

      {submitting && <Spinner size={20} />}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <DataTableSearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search characters…"
          aria-label="Search characters"
        />
        <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset column widths" style={{ marginLeft: 'auto' }}>
          Reset column widths
        </button>
        <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit columns</button>
      </div>

      <DataTable
        ref={dtRef}
        rows={rows}
        columns={columns}
        rowId={(r) => r.id}
        globalFilter={globalFilter}
        searchQuery={query}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        persistKey="character"
      />

      {selected && (
        <div style={{ marginTop: 24, border: '1px solid var(--border, #ccc)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border, #ccc)' }}>
            <strong>{selected.name}</strong>
            <button onClick={() => setSelected(null)} aria-label="Close detail panel">✕</button>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #ccc)', padding: '0 12px' }}>
            <button style={tabStyle('details')} onClick={() => setActiveTab('details')}>Details</button>
            <button style={tabStyle('skills')} onClick={() => setActiveTab('skills')}>
              Skills ({selected.skills.length})
            </button>
            <button style={tabStyle('categories')} onClick={() => setActiveTab('categories')}>
              Categories ({selected.categories.length})
            </button>
          </div>

          <div style={{ padding: '0 12px 12px' }}>
            {activeTab === 'details' && <DetailsTab char={selected} ref={refs} />}
            {activeTab === 'skills' && <SkillsTab char={selected} refs={refs} />}
            {activeTab === 'categories' && <CategoriesTab char={selected} refs={refs} />}
          </div>
        </div>
      )}
    </>
  );
}
