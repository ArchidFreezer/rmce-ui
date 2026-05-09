import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchBooks,
  fetchSpellLists, upsertSpellList, deleteSpellList,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CharacterTraitsEditor,
  CheckboxGroup,
  CheckboxInput,
  LabeledInput,
  LabeledSelect,
  PillList,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Book,
  SpellList,
} from '../../types';
import type { CharacterTraits } from '../../types/base';

import {
  SPELL_TYPES, SpellType,
  SPELL_REALMS, Realm,
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
} from '../../utils';

const prefix = 'SPELLLIST_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  name: string;
  book: string;
  type: string;          // keep as string while typing; validate to SpellType
  description: string;
  evil: boolean;
  summoning: boolean;
  directed: boolean;
  realms: Realm[];       // keep as Realm[] in the form (CheckboxGroup)
  traits: CharacterTraits;
};

type FormErrors = {
  id?: string;
  name?: string;
  type?: string;
  realms?: string;
  book?: string;
};

function emptyVM(): FormState {
  return { id: prefix, name: '', book: '', type: '', description: '', evil: false, summoning: false, directed: false, realms: [], traits: { caster: 5, combat: 5, information: 5, stealth: 5, support: 5, utility: 5 } };
}
function toVM(s: SpellList): FormState {
  return { ...s, type: s.type, traits: s.traits ?? { caster: 5, combat: 5, information: 5, stealth: 5, support: 5, utility: 5 } };
}

function fromVM(vm: FormState): SpellList {
  return {
    id: vm.id.trim(),
    name: vm.name.trim(),
    book: vm.book.trim(),
    type: vm.type.trim() as SpellType,        // safe after validation
    description: vm.description.trim(),
    evil: !!vm.evil,
    summoning: !!vm.summoning,
    directed: !!vm.directed,
    realms: [...vm.realms],
    traits: vm.traits,
  };
}

export default function SpellListView() {
  const dtRef = useRef<DataTableHandle>(null);
  const [rows, setRows] = useState<SpellList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<SpellType | ''>('');
  const [evilFilter, setEvilFilter] = useState('');
  const [summoningFilter, setSummoningFilter] = useState('');
  const [bookFilters, setBookFilters] = useState<string[]>([]);
  const [realmFilters, setRealmFilters] = useState<Realm[]>([]);
  const [traitFilters, setTraitFilters] = useState<Partial<Record<keyof CharacterTraits, number>>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());


  // Books for dropdown (non-fatal)
  const [books, setBooks] = useState<Book[]>([]);

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [sl, b] = await Promise.all([
          fetchSpellLists(),
          fetchBooks(),
        ]);
        setRows(sl);
        setBooks(b);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  const bookNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of books) m.set(b.id, b.name);
    return m;
  }, [books]);

  // Structured options for LabeledSelect (value=id, label= "Name")
  const bookOptions = useMemo(
    () => books.map(b => ({ value: b.id, label: `${b.name || '(no name)'}` })),
    [books]
  );

  const bookFilterOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.book) ids.add(row.book);
    }
    return Array.from(ids)
      .map((id) => ({ value: id, label: bookNameById.get(id) ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, bookNameById]);

  useEffect(() => {
    const allowed = new Set(bookFilterOptions.map((o) => o.value));
    setBookFilters((prev) => prev.filter((id) => allowed.has(id)));
  }, [bookFilterOptions]);


  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */
  const isSpellType = (s: string) => (SPELL_TYPES as readonly string[]).includes(s);

  const computeErrors = (draft: FormState): FormErrors => {
    const next: typeof errors = {};

    // ID validations
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) next.id = `ID must start with "${prefix}" and contain additional characters`;

    // Book validations (non-fatal, just warn if unknown)
    if (draft.book.trim() && !bookNameById.has(draft.book.trim())) next.book = `Unknown book ID "${draft.book.trim()}"`;

    // Name validations
    if (!draft.name.trim()) next.name = 'Name is required';
    else if (!editingId && rows.some(r => r.name === draft.name.trim())) next.name = `Name "${draft.name.trim()}" already exists`;

    // Type validations
    if (!draft.type.trim()) next.type = 'Type is required';
    else if (!isSpellType(draft.type.trim())) next.type = 'Pick a valid spell type';

    // Realms validations
    if (!draft.realms || draft.realms.length === 0) next.realms = 'Select at least one realm';

    return next;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */

  const columns: ColumnDef<SpellList>[] = useMemo(() => {

    return [
      { id: 'id', header: 'ID', accessor: r => r.id, sortType: 'string', minWidth: 260 },
      { id: 'name', header: 'Name', accessor: r => r.name, sortType: 'string', minWidth: 160 },
      { id: 'description', header: 'Description', accessor: r => r.description, sortType: 'string', minWidth: 200 },

      {
        id: 'book', header: 'Book', accessor: (r) => bookNameById.get(r.book) ?? r.book, sortType: 'string', minWidth: 240,
        render: (r) => {
          const label = bookNameById.get(r.book);
          return label ? `${label}` : r.book;
        },
      },

      { id: 'type', header: 'Type', accessor: r => r.type, sortType: 'string', minWidth: 160 },
      {
        id: 'evil', header: 'Evil', accessor: r => Number(r.evil), sortType: 'number', minWidth: 90,
        render: r => (r.evil ? 'Yes' : 'No'),
      },
      {
        id: 'summoning', header: 'Summoning', accessor: r => Number(r.summoning), sortType: 'number', minWidth: 90,
        render: r => (r.summoning ? 'Yes' : 'No'),
      },
      {
        id: 'directed', header: 'Directed', accessor: r => Number(r.directed), sortType: 'number', minWidth: 90,
        render: r => (r.directed ? 'Yes' : 'No'),
      },
      {
        id: 'realms', header: 'Realms', accessor: r => r.realms.length, sortType: 'number', minWidth: 260,
        render: r => (<PillList values={r.realms} />),
      },
      {
        id: 'actions', header: 'Actions', sortable: false, width: 320,
        render: row => (
          <>
            <button onClick={() => startView(row)} style={{ marginRight: 6 }}>View</button>
            <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
            <button onClick={() => startDuplicate(row)} style={{ marginRight: 6 }}>Duplicate</button>
            <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
          </>
        ),
      },
    ]
  }, [bookNameById]);

  const filteredRows = useMemo(
    () => rows.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (evilFilter !== '' && r.evil !== (evilFilter === 'true')) return false;
      if (summoningFilter !== '' && r.summoning !== (summoningFilter === 'true')) return false;
      if (bookFilters.length > 0 && !bookFilters.includes(r.book)) return false;
      if (realmFilters.length > 0 && !realmFilters.every((realm) => r.realms.includes(realm))) return false;
      for (const [key, min] of Object.entries(traitFilters) as [keyof CharacterTraits, number][]) {
        if (min !== undefined && r.traits[key] < min) return false;
      }
      return true;
    }),
    [rows, typeFilter, evilFilter, summoningFilter, bookFilters, realmFilters, traitFilters]
  );

  const hasActiveTraitFilters = Object.keys(traitFilters).length > 0;
  const hasActiveFilters = typeFilter !== '' || evilFilter !== '' || summoningFilter !== '' || bookFilters.length > 0 || realmFilters.length > 0 || hasActiveTraitFilters;

  useEffect(() => { setPage(1); }, [typeFilter, evilFilter, summoningFilter, bookFilters, realmFilters, traitFilters]);

  const globalFilter = (r: SpellList, q: string) => {
    const s = q.toLowerCase();
    const bookLabel = bookNameById.get(r.book) ?? '';
    return [
      r.id, r.name, r.book, bookLabel, r.type,
      r.evil ? 'yes' : 'no',
      r.summoning ? 'yes' : 'no',
      r.realms.join(','),
    ]
      .some(v => String(v ?? '').toLowerCase().includes(s));
  };

  /* ------------------------------------------------------------------ */
  /* Actions                                                            */
  /* ------------------------------------------------------------------ */

  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyVM());
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: SpellList) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: SpellList) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: SpellList) => {
    setViewing(false);
    setEditingId(null);
    const vm = toVM(row);
    vm.id = prefix;
    vm.name += ' (Copy)';
    setForm(vm);
    setErrors({});
    setShowForm(true);
  };

  const cancelForm = () => {
    setViewing(false);
    setEditingId(null);
    setErrors({});
    setShowForm(false);
  };

  const saveForm = async () => {

    if (submitting) return;

    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSubmitting(true);

    const payload = fromVM(form);
    const isEditing = Boolean(editingId);

    try {
      const opts = isEditing
        ? { method: 'PUT' as const }
        : { method: 'POST' as const };

      await upsertSpellList(payload, opts);

      setRows((prev) => {
        if (isEditing) {
          const idx = prev.findIndex((r) => r.id === payload.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...payload };
            return copy;
          }
          return [payload, ...prev];
        }
        return [payload, ...prev];
      });

      setShowForm(false);
      setViewing(false);
      setEditingId(null);

      toast({
        variant: 'success',
        title: isEditing ? 'Updated' : 'Saved',
        description: `Spell List "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (row: SpellList) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Spell List',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows((current) => current.filter((r) => r.id !== row.id));
    setPage(1);

    try {
      await deleteSpellList(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Spell List "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err), });
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Spell Lists</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={startNew}>New Spell List</button>
            <DataTableSearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search spell lists…"
              aria-label="Search spell lists"
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Type:
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as SpellType | '')}>
                <option value="">All</option>
                {SPELL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Evil:
              <select value={evilFilter} onChange={(e) => setEvilFilter(e.target.value)}>
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Summoning:
              <select value={summoningFilter} onChange={(e) => setSummoningFilter(e.target.value)}>
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            {hasActiveFilters && (
              <button onClick={() => { setTypeFilter(''); setEvilFilter(''); setSummoningFilter(''); setBookFilters([]); setRealmFilters([]); setTraitFilters({}); }}>Clear filters</button>
            )}
            {/* Reset and auto-fit column widths */}
            <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
            <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
              Books{bookFilters.length > 0 ? ` (${bookFilters.length} selected)` : ''}
            </summary>
            <div style={{ marginTop: 6 }}>
              <CheckboxGroup<string>
                value={bookFilters}
                options={bookFilterOptions}
                onChange={setBookFilters}
                inline
                showSelectAll
                columns={4}
              />
            </div>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
              Realms{realmFilters.length > 0 ? ` (${realmFilters.length} selected)` : ''}
            </summary>
            <div style={{ marginTop: 6 }}>
              <CheckboxGroup<Realm>
                value={realmFilters}
                options={SPELL_REALMS}
                onChange={setRealmFilters}
                inline
                showSelectAll
                columns={5}
              />
            </div>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
              Traits{hasActiveTraitFilters ? ` (${Object.keys(traitFilters).length} active)` : ''}
            </summary>
            <div style={{ marginTop: 6 }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--muted, #666)' }}>
                Show only spell lists where each selected trait is at least the chosen value.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, auto)', gap: '8px 16px', alignItems: 'center' }}>
                {(['caster', 'combat', 'information', 'stealth', 'support', 'utility'] as (keyof CharacterTraits)[]).map((key) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{key}</span>
                    <select
                      value={traitFilters[key] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTraitFilters((prev) => {
                          const next = { ...prev };
                          if (val === '') {
                            delete next[key];
                          } else {
                            next[key] = parseInt(val, 10);
                          }
                          return next;
                        });
                      }}
                    >
                      <option value="">Any</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <option key={n} value={n}>{n}+</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Display main Form */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Spell List</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
              <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />

              <div style={{ gridColumn: '1 / -1' }}>
                <LabeledInput label="Description" value={form.description} onChange={(v) => setForm(s => ({ ...s, description: v }))} disabled={viewing} />
              </div>

              <LabeledSelect
                label="Book"
                value={form.book}
                onChange={(v) => setForm(s => ({ ...s, book: v }))}
                options={bookOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.book}
                helperText={loading ? 'Loading Books…' : undefined}
              />

              <LabeledSelect
                label="Type"
                value={form.type}
                onChange={(v) => setForm(s => ({ ...s, type: v }))}
                options={SPELL_TYPES}
                disabled={viewing}
                error={viewing ? undefined : errors.type}
              />

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 24 }}>
                <CheckboxInput label="Evil" checked={form.evil} onChange={(c) => setForm(s => ({ ...s, evil: c }))} disabled={viewing} />
                <CheckboxInput label="Summoning" checked={form.summoning} onChange={(c) => setForm(s => ({ ...s, summoning: c }))} disabled={viewing} />
                <CheckboxInput label="Directed" checked={form.directed} onChange={(c) => setForm(s => ({ ...s, directed: c }))} disabled={viewing} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <CheckboxGroup<Realm>
                  label="Realms"
                  value={form.realms}
                  options={SPELL_REALMS}
                  onChange={(vals) => setForm(s => ({ ...s, realms: vals }))}
                  disabled={viewing}
                  error={viewing ? undefined : errors.realms}
                  helperText="Select at least one"
                  columns={5}
                  showSelectAll
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <CharacterTraitsEditor
                value={form.traits}
                onChange={(t) => setForm(s => ({ ...s, traits: t }))}
                disabled={viewing}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {!viewing && <button onClick={saveForm} disabled={hasErrors || submitting}>{submitting ? 'Submitting…' : 'Save'}</button>}
              <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
            </div>

            {/* Validation errors */}
            {Object.values(errors).some(Boolean) && (
              <div style={{ marginTop: 12, color: '#b00020' }}>
                <h4 style={{ margin: '0 0 4px' }}>Please fix the following errors:</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Object.entries(errors).map(([field, error]) =>
                    error ? <li key={field}>{error}</li> : null
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {!showForm && (
        <DataTable
          ref={dtRef}
          rows={filteredRows}
          columns={columns}
          rowId={(r) => r.id}
          initialSort={{ colId: 'name', dir: 'asc' }} //
          // search
          searchQuery={query}
          globalFilter={globalFilter}
          // pagination (client)
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          // styles
          tableMinWidth={0} // allow table to shrink below container width (for better mobile support)
          persistKey="dt.spelllist.v1"
          ariaLabel="Spell lists"
        />
      )}

      {/* Empty dataset */}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No spell lists found.
        </div>
      )}
    </>
  );
}
