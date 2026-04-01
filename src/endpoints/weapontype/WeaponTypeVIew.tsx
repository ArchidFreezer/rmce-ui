// src/endpoints/weapontype/WeapontypesView.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchAttackTables,
  fetchBooks,
  fetchSkills,
  fetchWeaponTypes, upsertWeaponType, deleteWeaponType,
} from '../../api';

import {
  DataTable, DataTableSearchInput, type ColumnDef, type DataTableHandle,
  LabeledInput,
  LabeledSelect,
  MarkupPreview,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  AttackTable,
  Book,
  Skill,
  WeaponType,
} from '../../types';

import {
  CRITICAL_TYPES, type CriticalType,
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
  isValidSignedInt, makeSignedIntOnChange, sanitizeSignedInt,
  isValidUnsignedInt, makeUnsignedIntOnChange, sanitizeUnsignedInt,
} from '../../utils';

const prefix = 'WEAPONTYPE_';
const showNotesTooltipStorageKey = 'weapontype.showNotesTooltip';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type CriticalVM = { critical: CriticalType | ''; modifier: string };
type RangeVM = { min: string; max: string; modifier: string };

type FormState = {
  id: string;
  name: string;
  notes: string;

  skill: string;
  book: string;
  attackTable: string; // AttackTable.id or '' while editing

  fumble: string;
  breakage: string;

  minLength: string;
  maxLength: string;

  minStrength: string;
  maxStrength: string;

  minWeight: string;
  maxWeight: string;

  woodenHaft: boolean;

  criticals: CriticalVM[];
  ranges: RangeVM[];
};

type FormErrors = {
  id?: string;
  name?: string;
  skill?: string;
  book?: string;
  attackTable?: string;
  fumble?: string;
  breakage?: string;
  minLength?: string;
  maxLength?: string;
  minStrength?: string;
  maxStrength?: string;
  minWeight?: string;
  maxWeight?: string;
  criticals?: string;
  ranges?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  notes: '',

  skill: '',
  book: '',
  attackTable: '',

  fumble: '',
  breakage: '',

  minLength: '',
  maxLength: '',

  minStrength: '',
  maxStrength: '',

  minWeight: '',
  maxWeight: '',

  woodenHaft: false,

  criticals: [],
  ranges: [],
});

const toVM = (x: WeaponType): FormState => ({
  id: x.id,
  name: x.name,
  notes: x.notes ?? '',

  skill: x.skill,
  book: x.book,
  attackTable: x.attackTable ?? '',

  fumble: String(x.fumble),
  breakage: String(x.breakage),

  minLength: String(x.minLength),
  maxLength: String(x.maxLength),

  minStrength: String(x.minStrength),
  maxStrength: String(x.maxStrength),

  minWeight: String(x.minWeight),
  maxWeight: String(x.maxWeight),

  woodenHaft: !!x.woodenHaft,

  criticals: (x.criticals ?? []).map(c => ({ critical: c.critical, modifier: String(c.modifier) })),
  ranges: (x.ranges ?? []).map(r => ({ min: String(r.min), max: String(r.max), modifier: String(r.modifier) })),
});

const fromVM = (vm: FormState): WeaponType => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  notes: vm.notes.trim() || undefined,

  skill: vm.skill.trim(),
  book: vm.book.trim(),
  attackTable: vm.attackTable.trim(),

  fumble: Number(vm.fumble),
  breakage: Number(vm.breakage),

  minLength: Number(vm.minLength),
  maxLength: Number(vm.maxLength),

  minStrength: Number(vm.minStrength),
  maxStrength: Number(vm.maxStrength),

  minWeight: Number(vm.minWeight),
  maxWeight: Number(vm.maxWeight),

  woodenHaft: !!vm.woodenHaft,

  criticals: vm.criticals.map(c => ({ critical: c.critical as CriticalType, modifier: Number(c.modifier) })),
  ranges: vm.ranges.map(r => ({ min: Number(r.min), max: Number(r.max), modifier: Number(r.modifier) })),
});

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */
export default function WeaponTypeView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<WeaponType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [attackTables, setAttackTables] = useState<AttackTable[]>([]);

  const [query, setQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [showNotesTooltip, setShowNotesTooltip] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(showNotesTooltipStorageKey);
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  // Markup preview toggles
  const [previewAll, setPreviewAll] = useState(false);
  const [showPreview, setShowPreview] = useState<{ notes: boolean; }>({ notes: false });

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [wt, b, s, at] = await Promise.all([
          fetchWeaponTypes(),
          fetchBooks(),
          fetchSkills(),
          fetchAttackTables(),
        ]);
        setRows(wt);
        setBooks(b);
        setSkills(s);
        setAttackTables(at);
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

  const skillNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of skills) m.set(s.id, s.name);
    return m;
  }, [skills]);
  const bookNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of books) m.set(b.id, b.name);
    return m;
  }, [books]);
  const attackTableNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of attackTables) m.set(a.id, a.name);
    return m;
  }, [attackTables]);

  const weaponSkillOptions = useMemo(
    () => skills.filter(s => s.name.startsWith('Weapon -')).map(s => ({ value: s.id, label: s.name })),
    [skills]
  );

  const bookOptions = useMemo(
    () => books.map(b => ({ value: b.id, label: b.name })),
    [books]
  );
  const attackTableOptions = useMemo(
    () => attackTables.map(a => ({ value: a.id, label: a.name })),
    [attackTables]
  );
  const criticalTypeOptions = useMemo(
    () => (CRITICAL_TYPES as readonly string[]).map(v => ({ value: v, label: v })),
    []
  );

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */
  const computeErrors = (draft: FormState): FormErrors => {
    const e: typeof errors = {};
    const id = draft.id.trim();
    const nm = draft.name.trim();

    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === id)) e.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!nm) e.name = 'Name is required';

    if (!draft.skill) e.skill = 'Skill is required';
    else if (!skillNameById.has(draft.skill)) e.skill = 'Pick a valid Skill id';

    if (!draft.book) e.book = 'Book is required';
    else if (!bookNameById.has(draft.book)) e.book = 'Pick a valid Book id';

    if (!draft.attackTable) e.attackTable = 'Attack table is required';
    else if (!attackTableNameById.has(draft.attackTable)) e.attackTable = 'Pick a valid AttackTable id'

    const checkInt = (key: keyof FormState, label: string) => {
      const v = (draft[key] as string).trim();
      if (!v) e[key as keyof typeof e] = `${label} is required`;
      else if (!isValidUnsignedInt(v)) e[key as keyof typeof e] = `${label} must be a non-negative integer`;
    };

    const checkRangeIntUnsigned = (key: keyof FormState, label: string, min: number, max: number) => {
      const v = (draft[key] as string).trim();
      if (!v) e[key as keyof typeof e] = `${label} is required`;
      else if (!isValidUnsignedInt(v)) e[key as keyof typeof e] = `${label} must be a non-negative integer`;
      else if (Number(v) < min || Number(v) > max) e[key as keyof typeof e] = `${label} must be between ${min} and ${max}`;
    };

    const checkRangeIntSigned = (key: keyof FormState, label: string, min: number, max: number) => {
      const v = (draft[key] as string).trim();
      if (!v) e[key as keyof typeof e] = `${label} is required`;
      else if (!isValidSignedInt(v)) e[key as keyof typeof e] = `${label} must be an integer`;
      else if (Number(v) < min || Number(v) > max) e[key as keyof typeof e] = `${label} must be between ${min} and ${max}`;
    };

    checkRangeIntUnsigned('fumble', 'Fumble', 0, 50);
    checkRangeIntSigned('breakage', 'Breakage', -1, 50);
    checkRangeIntUnsigned('minLength', 'Min length', 1, 50);
    checkRangeIntUnsigned('maxLength', 'Max length', 1, 50);
    checkRangeIntUnsigned('minStrength', 'Min strength', 1, 100);
    checkRangeIntUnsigned('maxStrength', 'Max strength', 1, 100);
    checkRangeIntUnsigned('minWeight', 'Min weight', 0, 50);
    checkRangeIntUnsigned('maxWeight', 'Max weight', 0, 50);

    // Ranges
    for (let i = 0; i < draft.ranges.length; i++) {
      const r = draft.ranges[i];
      if (!r) continue; // should not happen
      if (!isValidSignedInt(r.min) || !isValidSignedInt(r.max) || !isValidSignedInt(r.modifier)) {
        e.ranges = `Range[${i + 1}]: min/max/modifier must be integers`;
        break;
      }
      if (Number(r.min) > Number(r.max)) {
        e.ranges = `Range[${i + 1}]: min must be ≤ max`;
        break;
      }
    }

    // Criticals
    for (let i = 0; i < draft.criticals.length; i++) {
      const c = draft.criticals[i];
      if (!c) continue
      if (!c.critical) { e.criticals = `Critical[${i + 1}]: type is required`; break; }
      if (!(CRITICAL_TYPES as readonly string[]).includes(c.critical)) {
        e.criticals = `Critical[${i + 1}]: invalid CriticalType`; break;
      }
      if (!isValidSignedInt(c.modifier)) { e.criticals = `Critical[${i + 1}]: modifier must be integer`; break; }
    }

    // simple logical checks
    if (!e.minLength && !e.maxLength && Number(draft.minLength) > Number(draft.maxLength)) {
      e.minLength = 'minLength must be ≤ maxLength';
    }
    if (!e.minStrength && !e.maxStrength && Number(draft.minStrength) > Number(draft.maxStrength)) {
      e.minStrength = 'minStrength must be ≤ maxStrength';
    }
    if (!e.minWeight && !e.maxWeight && Number(draft.minWeight) > Number(draft.maxWeight)) {
      e.minWeight = 'minWeight must be ≤ maxWeight';
    }

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing, skillNameById, bookNameById, attackTableNameById]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<WeaponType>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: r => r.id, sortType: 'string', minWidth: 260 },
    { id: 'name', header: 'Name', accessor: r => r.name, sortType: 'string', minWidth: 180 },
    {
      id: 'skill', header: 'Skill', accessor: r => r.skill, sortType: 'string', minWidth: 240,
      render: r => skillNameById.get(r.skill) ? `${skillNameById.get(r.skill)}` : r.skill,
    },
    {
      id: 'book', header: 'Book', accessor: r => r.book, sortType: 'string', minWidth: 240,
      render: r => bookNameById.get(r.book) ? `${bookNameById.get(r.book)}` : r.book,
    },
    {
      id: 'attackTable', header: 'Attack Table', accessor: r => r.attackTable, sortType: 'string', minWidth: 180,
      render: r => attackTableNameById.get(r.attackTable) ? `${attackTableNameById.get(r.attackTable)}` : r.attackTable,
    },
    { id: 'fumble', header: 'Fumble', accessor: r => r.fumble, sortType: 'number', align: 'right', minWidth: 90 },
    { id: 'breakage', header: 'Breakage', accessor: r => r.breakage, sortType: 'number', align: 'right', minWidth: 90 },
    {
      id: 'actions',
      header: 'Actions',
      sortable: false,
      width: 420,
      render: (row) => (
        <>
          <button onClick={() => startView(row)} style={{ marginRight: 6 }}>View</button>
          <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
          <button onClick={() => startDuplicate(row)} style={{ marginRight: 6 }}>Duplicate</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
  ], [skillNameById, bookNameById, attackTableNameById]);

  const globalFilter = (r: WeaponType, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.skill, skillNameById.get(r.skill) ?? '',
      r.book, bookNameById.get(r.book) ?? '',
      r.attackTable,
      r.fumble, r.breakage,
      r.minStrength, r.maxStrength,
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  const filteredRows = useMemo(
    () => rows.filter((r) => !skillFilter || r.skill === skillFilter),
    [rows, skillFilter]
  );

  const hasActiveFilters = skillFilter !== '';

  useEffect(() => {
    setPage(1);
  }, [skillFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(showNotesTooltipStorageKey, String(showNotesTooltip));
    } catch {
      // ignore persistence failures
    }
  }, [showNotesTooltip]);

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

  const startView = (row: WeaponType) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: WeaponType) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: WeaponType) => {
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

      await upsertWeaponType(payload, opts);

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
        description: `Weapon Type "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: WeaponType) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Weapon Type',
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
      await deleteWeaponType(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Weapon Type "${row.id}" deleted.` });
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

  // ---- Criticals editor row ----
  const addCritical = () => setForm(s => ({ ...s, criticals: [...s.criticals, { critical: '' as const, modifier: '' }] }));
  const updateCritical = (i: number, patch: Partial<CriticalVM>) =>
    setForm(s => {
      const copy = s.criticals.slice();
      if (!copy[i]) return s; // should not happen
      copy[i] = { ...copy[i], ...patch };
      return { ...s, criticals: copy };
    });
  const removeCritical = (i: number) =>
    setForm(s => {
      const copy = s.criticals.slice();
      copy.splice(i, 1);
      return { ...s, criticals: copy };
    });

  // ---- Ranges editor row ----
  const addRange = () => setForm(s => ({ ...s, ranges: [...s.ranges, { min: '', max: '', modifier: '' }] }));
  const updateRange = (i: number, patch: Partial<RangeVM>) =>
    setForm(s => {
      const copy = s.ranges.slice();
      if (!copy[i]) return s; // should not happen
      copy[i] = { ...copy[i], ...patch };
      return { ...s, ranges: copy };
    });
  const removeRange = (i: number) =>
    setForm(s => {
      const copy = s.ranges.slice();
      copy.splice(i, 1);
      return { ...s, ranges: copy };
    });

  return (
    <>
      <h2>Weapon Types</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={startNew}>New Weapon Type</button>
            <DataTableSearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search weapon types…"
              aria-label="Search weapon types"
            />

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>Skill</span>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                aria-label="Filter by skill"
                style={{ padding: '6px 8px' }}
              >
                <option value="">All</option>
                {weaponSkillOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={showNotesTooltip}
                onChange={(e) => setShowNotesTooltip(e.target.checked)}
              />
              <span style={{ fontSize: 14 }}>Show notes tooltip</span>
            </label>

            {hasActiveFilters && (
              <button type="button" onClick={() => setSkillFilter('')}>Clear filters</button>
            )}

            {/* Reset and auto-fit column widths */}
            <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
            <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
          </div>
        </div>
      )}

      {/* Display main Form */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Weapon Type</h3>

            <button
              type="button"
              onClick={() => {
                setPreviewAll(p => !p);
                setShowPreview({ notes: !previewAll });
              }}
            >
              {previewAll ? 'Hide Previews' : 'Show Previews'}
            </button>

            {/* Basics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput
                label="ID"
                value={form.id}
                onChange={makeIDOnChange<typeof form>('id', setForm, prefix)}
                disabled={!!editingId || viewing}
                error={viewing ? undefined : errors.id}
              />
              <LabeledInput
                label="Name"
                value={form.name}
                onChange={(v) => setForm(s => ({ ...s, name: v }))}
                disabled={viewing}
                error={viewing ? undefined : errors.name}
              />
              <LabeledSelect
                label="Skill"
                value={form.skill}
                onChange={(v) => setForm(s => ({ ...s, skill: v }))}
                options={weaponSkillOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.skill}
                helperText={loading ? 'Loading skills…' : undefined}
              />
              <LabeledSelect
                label="Book"
                value={form.book}
                onChange={(v) => setForm(s => ({ ...s, book: v }))}
                options={bookOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.book}
                helperText={loading ? 'Loading books…' : undefined}
              />
              <LabeledSelect
                label="Attack Table"
                value={form.attackTable}
                onChange={(v) => setForm(s => ({ ...s, attackTable: v }))}
                options={attackTableOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.attackTable}
                helperText={loading ? 'Loading attack tables…' : undefined}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 12 }}>
              {/* Notes */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ display: 'grid', gap: 6 }}>Notes (HTML allowed)</label>
                  {!viewing && (
                    <button type="button" onClick={() => setShowPreview(s => ({ ...s, notes: !s.notes }))}>
                      {showPreview.notes ? 'Edit' : 'Preview'}
                    </button>
                  )}
                </div>

                {(showPreview.notes || viewing) ? (
                  <MarkupPreview
                    content={form.notes}
                    emptyHint="No notes"
                    className="preview-html"
                    style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
                  />
                ) : (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm(s => ({ ...s, notes: e.target.value }))}
                      disabled={viewing}
                      rows={5}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Numbers */}
            <h4 style={{ margin: '12px 0 4px' }}>Stats</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <LabeledInput label="Fumble" value={form.fumble} onChange={makeUnsignedIntOnChange<typeof form>('fumble', setForm)} disabled={viewing} width={90} />
              <LabeledInput label="Breakage" value={form.breakage} onChange={makeSignedIntOnChange<typeof form>('breakage', setForm)} disabled={viewing} width={90} />
              <LabeledInput label="Min Length" value={form.minLength} onChange={makeUnsignedIntOnChange<typeof form>('minLength', setForm)} disabled={viewing} width={110} />
              <LabeledInput label="Max Length" value={form.maxLength} onChange={makeUnsignedIntOnChange<typeof form>('maxLength', setForm)} disabled={viewing} width={110} />
              <LabeledInput label="Min Strength" value={form.minStrength} onChange={makeUnsignedIntOnChange<typeof form>('minStrength', setForm)} disabled={viewing} width={110} />
              <LabeledInput label="Max Strength" value={form.maxStrength} onChange={makeUnsignedIntOnChange<typeof form>('maxStrength', setForm)} disabled={viewing} width={110} />
              <LabeledInput label="Min Weight" value={form.minWeight} onChange={makeUnsignedIntOnChange<typeof form>('minWeight', setForm)} disabled={viewing} width={110} />
              <LabeledInput label="Max Weight" value={form.maxWeight} onChange={makeUnsignedIntOnChange<typeof form>('maxWeight', setForm)} disabled={viewing} width={110} />
            </div>

            {/* Wooden Haft */}
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.woodenHaft}
                  onChange={(e) => setForm(s => ({ ...s, woodenHaft: e.target.checked }))}
                  disabled={viewing}
                />
                <span>Wooden haft</span>
              </label>
            </div>

            {/* Criticals */}
            <section style={{ marginTop: 12 }}>
              <h4 style={{ margin: '8px 0' }}>Criticals</h4>
              {!viewing && <button type="button" onClick={addCritical} style={{ marginBottom: 8 }}>+ Add critical</button>}
              {form.criticals.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '240px 140px 120px', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>Critical</div>
                  <div style={{ fontWeight: 600 }}>Modifier</div>
                  <div />
                  {form.criticals.map((c, i) => (
                    <React.Fragment key={`c-${i}`}>
                      <LabeledSelect
                        label="Critical"
                        hideLabel
                        value={c.critical}
                        onChange={(v) => updateCritical(i, { critical: v as CriticalType })}
                        options={criticalTypeOptions}
                        disabled={viewing}
                      />
                      <LabeledInput
                        label="Modifier"
                        hideLabel
                        ariaLabel="Modifier"
                        value={c.modifier}
                        onChange={(v) => updateCritical(i, { modifier: sanitizeSignedInt(v) })}
                        disabled={viewing}
                        width={120}
                      />
                      {!viewing && (
                        <button type="button" onClick={() => removeCritical(i)} style={{ color: '#b00020' }}>
                          Remove
                        </button>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              {errors.criticals && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.criticals}</div>}
            </section>

            {/* Ranges */}
            <section style={{ marginTop: 12 }}>
              <h4 style={{ margin: '8px 0' }}>Ranges</h4>
              {!viewing && <button type="button" onClick={addRange} style={{ marginBottom: 8 }}>+ Add range</button>}
              {form.ranges.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: viewing ? '120px 120px 140px' : '120px 120px 140px 120px', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>Min</div>
                  <div style={{ fontWeight: 600 }}>Max</div>
                  <div style={{ fontWeight: 600 }}>Modifier</div>
                  {!viewing && <div />}
                  {form.ranges.map((r, i) => (
                    <React.Fragment key={`r-${i}`}>
                      <LabeledInput
                        label="Min"
                        hideLabel
                        ariaLabel="Min"
                        value={r.min}
                        onChange={(v) => updateRange(i, { min: sanitizeUnsignedInt(v) })}
                        disabled={viewing}
                        width={100}
                      />
                      <LabeledInput
                        label="Max"
                        hideLabel
                        ariaLabel="Max"
                        value={r.max}
                        onChange={(v) => updateRange(i, { max: sanitizeUnsignedInt(v) })}
                        disabled={viewing}
                        width={100}
                      />
                      <LabeledInput
                        label="Modifier"
                        hideLabel
                        ariaLabel="Modifier"
                        value={r.modifier}
                        onChange={(v) => updateRange(i, { modifier: sanitizeSignedInt(v) })}
                        disabled={viewing}
                        width={120}
                      />
                      {!viewing && (
                        <button type="button" onClick={() => removeRange(i)} style={{ color: '#b00020' }}>
                          Remove
                        </button>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              {errors.ranges && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.ranges}</div>}
            </section>

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
          rowHoverTooltip={(row) => {
            if (!showNotesTooltip) return null;
            if (!row.notes?.trim()) return null;
            return (
              <MarkupPreview
                content={row.notes}
                format="html"
                emptyHint=""
                className="preview-html"
              />
            );
          }}
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
          persistKey="dt.weapontype.v1"
          ariaLabel="Weapon types"
        />
      )}
    </>
  );
}