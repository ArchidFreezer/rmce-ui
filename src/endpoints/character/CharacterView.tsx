import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';

const CharacterCreationView = lazy(() => import('./CharacterCreationView'));
const CharacterLevellingView = lazy(() => import('./CharacterLevellingView'));

import {
  fetchCharacters, deleteCharacter,
  fetchRaces, fetchCultures, fetchProfessions,
  fetchSkills, fetchSkillCategories, fetchSkillGroups, fetchSpellLists,
  fetchSkillProgressionTypes, fetchLanguages,
  fetchWeaponTypes,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  PillList,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Character, CharacterCategory, CharacterCategorySpellLists, CharacterSkill, CharacterSpellList, Profession,
  Skill, SkillCategory, SkillGroup,
} from '../../types';

/* ------------------------------------------------------------------ */
/* Reference data lookup                                              */
/* ------------------------------------------------------------------ */

type NameMap = Map<string, string>;

interface RefData {
  races: NameMap;
  cultures: NameMap;
  professions: NameMap;
  professionStats: Map<string, Set<string>>;
  skills: NameMap;
  skillCategories: NameMap;
  skillCategoryLabels: NameMap;
  skillToCategory: Map<string, string>;
  spellLists: NameMap;
  progressionTypes: NameMap;
  languages: NameMap;
  weaponTypes: NameMap;
}

const emptyRefData = (): RefData => ({
  races: new Map(),
  cultures: new Map(),
  professions: new Map(),
  professionStats: new Map(),
  skills: new Map(),
  skillCategories: new Map(),
  skillCategoryLabels: new Map(),
  skillToCategory: new Map(),
  spellLists: new Map(),
  progressionTypes: new Map(),
  languages: new Map(),
  weaponTypes: new Map(),
});

function buildMap(items: { id: string; name: string }[]): NameMap {
  return new Map(items.map(i => [i.id, i.name]));
}

/** Returns the display name for an id, falling back to the id itself */
function resolve(map: NameMap, id: string): string {
  return map.get(id) ?? id;
}

/** Converts total inches to feet and inches string, e.g. 69 → 5' 9" */
function formatHeight(totalInches: number): string {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}' ${inches}"`;
}

/** Converts pounds to stones and pounds string, e.g. 175 → 12 st 7 lbs */
function formatWeight(lbs: number): string {
  const stones = Math.floor(lbs / 14);
  const remainingLbs = lbs % 14;
  return `${stones} st ${remainingLbs} lbs`;
}

/** Formats a lifespan in years, using comma separators for long-lived races */
function formatLifespan(years: number): string {
  return `${years.toLocaleString()} years`;
}

/* ------------------------------------------------------------------ */
/* Tab types                                                           */
/* ------------------------------------------------------------------ */
type Tab = 'details' | 'skills' | 'categories' | 'spells';

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

function Card({ title, children, fullWidth }: { title: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div style={{
      border: '1px solid var(--border, #ccc)',
      borderRadius: 6,
      padding: '10px 14px',
      flex: fullWidth ? '1 1 100%' : '1 1 280px',
      minWidth: fullWidth ? undefined : 240,
      maxWidth: fullWidth ? undefined : 480,
      boxSizing: 'border-box',
    }}>
      <h4 style={{ margin: '0 0 8px', fontSize: '0.95em', fontWeight: 700, borderBottom: '1px solid var(--border, #ccc)', paddingBottom: 4 }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function CollapsibleCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      border: '1px solid var(--border, #ccc)',
      borderRadius: 6,
      padding: '10px 14px',
      flex: '1 1 100%',
      boxSizing: 'border-box',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, width: '100%', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '0.95em', fontWeight: 700,
          borderBottom: open ? '1px solid var(--border, #ccc)' : 'none',
          paddingBottom: open ? 4 : 0, marginBottom: open ? 8 : 0,
        }}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span style={{ fontSize: '0.8em' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  );
}

function SpellListCategoriesTable({ rows, refs, charId }: { rows: CharacterCategorySpellLists[]; refs: RefData; charId: string }) {
  const columns: ColumnDef<CharacterCategorySpellLists>[] = useMemo(() => [
    {
      id: 'category',
      header: 'Category',
      accessor: (r) => resolve(refs.skillCategories, r.category),
      sortType: 'string',
      minWidth: 120,
    },
    {
      id: 'spellLists',
      header: 'Spell Lists',
      render: (r) => (
        <PillList
          values={r.spellLists}
          getLabel={(sl) => resolve(refs.spellLists, sl)}
        />
      ),
      sortable: false,
      minWidth: 160,
    },
  ], [refs]);

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowId={(r) => r.category}
      mode="client"
      showPagination={false}
      resizable
      persistKey={`dt.char.spellListCats.${charId}.v1`}
      tableMinWidth={0}
    />
  );
}

function DetailsTab({ char, ref: refs }: { char: Character; ref: RefData }) {
  return (
    <div style={{ padding: '12px 0' }}>
      {/* Wrapping card row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>

        {/* Basic */}
        <Card title="Basic">
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <DetailRow label="Name" value={char.name} />
              <DetailRow label="Gender" value={char.male ? 'Male' : 'Female'} />
              <DetailRow label="Race" value={resolve(refs.races, char.race)} />
              <DetailRow label="Culture" value={resolve(refs.cultures, char.culture)} />
              <DetailRow label="Profession" value={resolve(refs.professions, char.profession)} />
              <DetailRow label="Magical Realm" value={char.magicalRealms.join(', ') || '—'} />
              <DetailRow label="Hits" value={`${char.hits} / ${char.maxHits}`} />
              <DetailRow label="Power Points" value={`${char.powerPoints} / ${char.maxPowerPoints}`} />
            </tbody>
          </table>
        </Card>

        {/* General */}
        <Card title="General">
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <DetailRow label="Height" value={formatHeight(char.height)} />
              <DetailRow label="Weight" value={formatWeight(char.weight)} />
              <DetailRow label="Build" value={char.buildDescription} />
              <DetailRow label="Lifespan" value={formatLifespan(char.lifespan)} />
              <DetailRow label="Level" value={char.level} />
              <DetailRow label="Experience Points" value={char.experiencePoints.toLocaleString()} />
              <DetailRow label="Development Points" value={char.developmentPoints} />
            </tbody>
          </table>
        </Card>

        {/* Stats */}
        <Card title="Stats">
          {(() => {
            const primaryStats = refs.professionStats.get(char.profession) ?? new Set<string>();
            return (
              <table style={{ borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: 140 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 80 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)', fontSize: '0.85em' }}>Stat</th>
                    {['Tmp', 'Pot', 'Racial', 'Total'].map(h => (
                      <th key={h} style={{ textAlign: 'center', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)', fontSize: '0.85em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {char.stats.map(s => {
                    const isPrimary = primaryStats.has(s.stat);
                    return (
                      <tr key={s.stat} style={isPrimary ? { background: 'var(--primary-weak)' } : undefined}>
                        <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em', fontWeight: isPrimary ? 600 : undefined }}>
                          {s.stat}
                        </td>
                        <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{s.temporary}</td>
                        <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{s.potential}</td>
                        <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{s.racialBonus}</td>
                        <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{s.totalBonus}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </Card>

        {/* Languages */}
        {char.languages.length > 0 && (
          <Card title="Languages">
            <table style={{ borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: 180 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 70 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)', fontSize: '0.85em' }}>Language</th>
                  {['Spoken', 'Written', 'Somatic'].map(h => (
                    <th key={h} style={{ textAlign: 'center', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)', fontSize: '0.85em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {char.languages.map(lang => (
                  <tr key={lang.id}>
                    <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{resolve(refs.languages, lang.id)}</td>
                    <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>
                      {lang.spokenRanks}
                      {lang.spokenBonus !== 0 && <span style={{ color: 'var(--text-muted, #888)', marginLeft: 4 }}>({lang.spokenBonus})</span>}
                    </td>
                    <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>
                      {lang.writtenRanks}
                      {lang.writtenBonus !== 0 && <span style={{ color: 'var(--text-muted, #888)', marginLeft: 4 }}>({lang.writtenBonus})</span>}
                    </td>
                    <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>
                      {lang.somaticRanks}
                      {lang.somaticBonus !== 0 && <span style={{ color: 'var(--text-muted, #888)', marginLeft: 4 }}>({lang.somaticBonus})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Resistances */}
        {char.resistances.length > 0 && (
          <Card title="Resistances">
            <table style={{ borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: 180 }} />
                <col style={{ width: 70 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)', fontSize: '0.85em' }}>Resistance Type</th>
                  <th style={{ textAlign: 'center', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)', fontSize: '0.85em' }}>Bonus</th>
                </tr>
              </thead>
              <tbody>
                {char.resistances.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{r.id}</td>
                    <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Items */}
        <Card title="Items">
          <table style={{ borderCollapse: 'collapse', marginBottom: char.items && char.items.length > 0 ? 8 : 0 }}>
            <tbody>
              <DetailRow label="Gold" value={char.gold} />
            </tbody>
          </table>
          {char.items && char.items.length > 0 && (
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              {char.items.map((item, i) => <li key={i} style={{ fontSize: '0.9em', marginBottom: 2 }}>{item}</li>)}
            </ul>
          )}
        </Card>

      </div>
    </div>
  );
}

function SpellsTab({ char, refs }: { char: Character; refs: RefData }) {
  const sorted = useMemo(
    () => [...(char.spellLists ?? [])].sort((a, b) =>
      resolve(refs.spellLists, a.id).localeCompare(resolve(refs.spellLists, b.id))
    ),
    [char.spellLists, refs.spellLists]
  );

  /** reverse lookup: SpellList.id → SkillCategory.id */
  const slToCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of char.spellListCategories) {
      for (const slId of entry.spellLists) map.set(slId, entry.category);
    }
    return map;
  }, [char.spellListCategories]);

  return (
    <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CollapsibleCard title={`Spell Lists (${sorted.length})`}>
        {sorted.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--muted, #666)' }}>No spell list ranks.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Category', 'Spell List', 'Ranks', 'Total Bonus'].map(h => (
                  <th key={h} style={{ textAlign: (h === 'Ranks' || h === 'Total Bonus') ? 'center' : 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((sl: CharacterSpellList) => (
                <tr key={sl.id}>
                  <td style={{ padding: '3px 10px 3px 0' }}>{resolve(refs.skillCategories, slToCategory.get(sl.id) ?? '')}</td>
                  <td style={{ padding: '3px 10px 3px 0' }}>{resolve(refs.spellLists, sl.id)}</td>
                  <td style={{ padding: '3px 10px 3px 0', textAlign: 'center' }}>{sl.ranks}</td>
                  <td style={{ padding: '3px 10px 3px 0', textAlign: 'center' }}>{sl.totalBonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="Spell List Categories">
        <SpellListCategoriesTable rows={char.spellListCategories} refs={refs} charId={char.id} />
      </CollapsibleCard>
    </div>
  );
}

function SkillTable({ skills, refs }: { skills: CharacterSkill[]; refs: RefData }) {
  if (skills.length === 0) return null;
  const effectiveCatId = (s: CharacterSkill) => refs.skillToCategory.get(s.skillData.id) ?? '';
  const sorted = [...skills].sort((a, b) => {
    const catA = resolve(refs.skillCategoryLabels, effectiveCatId(a));
    const catB = resolve(refs.skillCategoryLabels, effectiveCatId(b));
    const cmp = catA.localeCompare(catB);
    return cmp !== 0 ? cmp : resolve(refs.skills, a.skillData.id).localeCompare(resolve(refs.skills, b.skillData.id));
  });
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          {['Category', 'Skill', 'Subcategory', 'Progression', 'Dev Type', 'Ranks', 'Prof Bonus', 'Special Bonus', 'Total Bonus'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)', fontSize: '0.85em' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((s, i) => (
          <tr key={i}>
            <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{(() => { const cId = refs.skillToCategory.get(s.skillData.id) ?? ''; return cId ? resolve(refs.skillCategoryLabels, cId) : '—'; })()}</td>
            <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{resolve(refs.skills, s.skillData.id)}</td>
            <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{s.skillData.subcategory ? resolve(refs.weaponTypes, s.skillData.subcategory) : '—'}</td>
            <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{resolve(refs.progressionTypes, s.progression)}</td>
            <td style={{ padding: '3px 10px 3px 0', fontSize: '0.9em' }}>{s.developmentType}</td>
            <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{s.ranks}</td>
            <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{s.professionBonus}</td>
            <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{s.specialBonus}</td>
            <td style={{ padding: '3px 10px 3px 0', textAlign: 'center', fontSize: '0.9em' }}>{s.totalBonus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SkillsTab({ char, refs }: { char: Character; refs: RefData }) {
  const [categoryFilter, setCategoryFilter] = useState('');

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const s of char.skills) {
      const catId = refs.skillToCategory.get(s.skillData.id) ?? '';
      if (catId && !seen.has(catId)) {
        seen.add(catId);
        opts.push({ value: catId, label: resolve(refs.skillCategoryLabels, catId) });
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [char.skills, refs.skillCategoryLabels, refs.skillToCategory]);

  const filteredSkills = useMemo(
    () => categoryFilter
      ? char.skills.filter(s => refs.skillToCategory.get(s.skillData.id) === categoryFilter)
      : char.skills,
    [char.skills, categoryFilter, refs.skillToCategory]
  );

  const developed = filteredSkills.filter(s => s.ranks > 0);
  const undeveloped = filteredSkills.filter(s => s.ranks <= 0);

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>Category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            style={{ padding: '6px 8px' }}
          >
            <option value="">All</option>
            {categoryOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        {categoryFilter && (
          <button type="button" onClick={() => setCategoryFilter('')}>Clear filter</button>
        )}
      </div>

      <SectionHeading title={`Developed Skills (${developed.length})`} />
      {developed.length === 0 ? (
        <p style={{ color: 'var(--muted, #666)' }}>No developed skills.</p>
      ) : (
        <SkillTable skills={developed} refs={refs} />
      )}

      <SectionHeading title={`Undeveloped Skills (${undeveloped.length})`} />
      {undeveloped.length === 0 ? (
        <p style={{ color: 'var(--muted, #666)' }}>No undeveloped skills.</p>
      ) : (
        <SkillTable skills={undeveloped} refs={refs} />
      )}
    </div>
  );
}

function CategoriesTab({ char, refs }: { char: Character; refs: RefData }) {
  const sorted = useMemo(
    () => [...char.categories].sort((a, b) =>
      resolve(refs.skillCategoryLabels, a.id).localeCompare(resolve(refs.skillCategoryLabels, b.id))
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
            {['Category', 'Progression', 'Dev Cost', 'Ranks', 'Prof Bonus', 'Special Bonus', 'Total Bonus'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 10px 4px 0', borderBottom: '1px solid var(--border, #ccc)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((cat: CharacterCategory) => (
            <tr key={cat.id}>
              <td style={{ padding: '3px 10px 3px 0' }}>{resolve(refs.skillCategoryLabels, cat.id)}</td>
              <td style={{ padding: '3px 10px 3px 0' }}>{resolve(refs.progressionTypes, cat.progression)}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'center' }}>{cat.developmentCost}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'center' }}>{cat.ranks}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'center' }}>{cat.professionBonus}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'center' }}>{cat.specialBonus}</td>
              <td style={{ padding: '3px 10px 3px 0', textAlign: 'center' }}>{cat.totalBonus}</td>
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
  const [showCreation, setShowCreation] = useState(false);
  const [levellingCharacter, setLevellingCharacter] = useState<Character | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    (async () => {
      try {
        const [
          characters, races, cultures, professions,
          skills, skillCategories, skillGroups, spellLists,
          progressionTypes, languages, weaponTypes,
        ] = await Promise.all([
          fetchCharacters(),
          fetchRaces(),
          fetchCultures(),
          fetchProfessions(),
          fetchSkills(),
          fetchSkillCategories(),
          fetchSkillGroups(),
          fetchSpellLists(),
          fetchSkillProgressionTypes(),
          fetchLanguages(),
          fetchWeaponTypes(),
        ]);
        const sgMap = new Map((skillGroups as SkillGroup[]).map(g => [g.id, g.name]));
        const skillCategoryLabels = new Map(
          (skillCategories as SkillCategory[]).map(c => [c.id, `(${sgMap.get(c.group) ?? c.group}) - ${c.name}`])
        );
        const skillToCategory = new Map(
          (skills as Skill[]).map(s => [s.id, s.category])
        );
        setRows(characters);
        setRefs({
          races: buildMap(races),
          cultures: buildMap(cultures),
          professions: buildMap(professions),
          professionStats: new Map((professions as Profession[]).map(p => [p.id, new Set<string>(p.stats)])),
          skills: buildMap(skills),
          skillCategories: buildMap(skillCategories),
          skillCategoryLabels,
          skillToCategory,
          spellLists: buildMap(spellLists),
          progressionTypes: buildMap(progressionTypes),
          languages: buildMap(languages),
          weaponTypes: buildMap(weaponTypes),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

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
      width: 240,
      render: (row) => (
        <>
          <button onClick={() => { setSelected(row); setActiveTab('details'); }}>View</button>
          <button onClick={() => setLevellingCharacter(row)} style={{ marginLeft: 8 }}>Level up</button>
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

    const ok = await confirm({
      title: 'Delete Character',
      body: `Delete character "${row.name}" (${row.id})? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    setSubmitting(true);

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

      {showCreation && (
        <Suspense fallback={<Spinner size={24} />}>
          <CharacterCreationView onFinish={(created) => { setShowCreation(false); setRows(prev => [...prev, created]); }} />
        </Suspense>
      )}

      {levellingCharacter && (
        <Suspense fallback={<Spinner size={24} />}>
          <CharacterLevellingView
            character={levellingCharacter}
            onFinish={(updated) => {
              setLevellingCharacter(null);
              setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
            }}
            onCancel={() => setLevellingCharacter(null)}
          />
        </Suspense>
      )}

      {!showCreation && !levellingCharacter && !selected && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={() => setShowCreation(true)}>New Character</button>
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
      )}

      {!showCreation && !levellingCharacter && !selected && (
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
      )}

      {selected && (
        <div style={{ marginTop: 24, border: '1px solid var(--border, #ccc)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border, #ccc)' }}>
            <strong>
              {selected.name}
              <span style={{ fontWeight: 400, color: 'var(--muted, #888)', marginLeft: 6, fontSize: '0.85em' }}>({selected.id})</span>
            </strong>
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
            {(selected.spellLists?.length ?? 0) > 0 && (
              <button style={tabStyle('spells')} onClick={() => setActiveTab('spells')}>
                Spells ({selected.spellLists!.length})
              </button>
            )}
          </div>

          <div style={{ padding: '0 12px 12px' }}>
            {activeTab === 'details' && <DetailsTab char={selected} ref={refs} />}
            {activeTab === 'skills' && <SkillsTab char={selected} refs={refs} />}
            {activeTab === 'categories' && <CategoriesTab char={selected} refs={refs} />}
            {activeTab === 'spells' && (selected.spellLists?.length ?? 0) > 0 && <SpellsTab char={selected} refs={refs} />}
          </div>
        </div>
      )}
    </>
  );
}
