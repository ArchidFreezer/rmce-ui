import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchBooks,
  fetchSkills, upsertSkill, deleteSkill,
  fetchSkillCategories,
  fetchSkillgroups,
} from '../../api';

import {
  DataTable, DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxInput,
  LabeledInput,
  LabeledSelect,
  MarkupPreview,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Book,
  Skill,
  SkillCategory,
  SkillGroup,
} from '../../types';

import {
  SKILL_ACTION_TYPES, type SkillActionType,
  STATS, type Stat,
} from '../../types/enum';


import {
  isValidSignedFloat, makeSignedFloatOnChange,
  isValidID, makeIDOnChange
} from '../../utils';


const prefix = 'SKILL_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  name: string;

  category: string; // id
  book: string;     // id
  action: SkillActionType | '';

  description: string;
  difficultiesSummary: string;
  notes: string;

  isRestricted: boolean;
  canSpecialise: boolean;
  mandatorySubcategory: boolean;

  // dynamic string list
  subcategories: string[];

  // 3 stat slots (duplicates allowed)
  stat1: Stat | '';
  stat2: Stat | '';
  stat3: Stat | '';

  // floats as strings while typing
  exhaustion: string;
  distanceMultiplier: string;
};

type FormErrors = {
  id?: string;
  name?: string;

  category?: string;
  book?: string;
  action?: string;

  stats?: string;
  exhaustion?: string;
  distanceMultiplier?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',

  category: '',
  book: '',
  action: '',

  description: '',
  difficultiesSummary: '',
  notes: '',

  isRestricted: false,
  canSpecialise: false,
  mandatorySubcategory: false,

  subcategories: [],

  stat1: '',
  stat2: '',
  stat3: '',

  exhaustion: '',
  distanceMultiplier: '',
});

function toVM(x: Skill): FormState {
  return {
    id: x.id,
    name: x.name,
    category: x.category,
    book: x.book,
    action: x.action ?? '',

    description: x.description ?? '',
    difficultiesSummary: x.difficultiesSummary ?? '',
    notes: x.notes ?? '',

    isRestricted: x.isRestricted,
    canSpecialise: x.canSpecialise,
    mandatorySubcategory: x.mandatorySubcategory,

    subcategories: x.subcategories ?? [],

    stat1: x.stats[0] ?? '',
    stat2: x.stats[1] ?? '',
    stat3: x.stats[2] ?? '',

    exhaustion: String(Number.isFinite(x.exhaustion) ? x.exhaustion : ''),
    distanceMultiplier: String(Number.isFinite(x.distanceMultiplier) ? x.distanceMultiplier : ''),
  };
}

function fromVM(vm: FormState): Skill {
  const stats: Stat[] = [];
  if (vm.stat1) stats.push(vm.stat1);
  if (vm.stat2) stats.push(vm.stat2);
  if (vm.stat3) stats.push(vm.stat3);

  const exhaustion = Number(vm.exhaustion);
  const distanceMultiplier = Number(vm.distanceMultiplier);

  return {
    id: vm.id.trim(),
    name: vm.name.trim(),

    category: vm.category.trim(),
    book: vm.book.trim(),
    action: vm.action as Skill['action'],

    description: vm.description.trim() || undefined,
    difficultiesSummary: vm.difficultiesSummary.trim() || undefined,
    notes: vm.notes.trim() || undefined,

    isRestricted: !!vm.isRestricted,
    canSpecialise: !!vm.canSpecialise,
    mandatorySubcategory: !!vm.mandatorySubcategory,

    subcategories: vm.subcategories.map(s => s.trim()).filter(Boolean),

    stats,
    exhaustion,
    distanceMultiplier,
  };
}

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function SkillView() {

  const dtRef = useRef<DataTableHandle>(null);
  const [rows, setRows] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [skillgroups, setSkillgroups] = useState<SkillGroup[]>([]);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  // HTML preview toggles
  const [previewAll, setPreviewAll] = useState(false);
  const [showPreview, setShowPreview] = useState<{
    description: boolean;
    difficulties: boolean;
    notes: boolean;
  }>({ description: false, difficulties: false, notes: false });

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [s, c, g, b] = await Promise.all([
          fetchSkills(),
          fetchSkillCategories(),
          fetchSkillgroups(),
          fetchBooks(),
        ]);
        setRows(s);
        setCategories(c);
        setSkillgroups(g);
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

  const sgNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const sg of skillgroups) m.set(sg.id, sg.name);
    return m;
  }, [skillgroups]);

  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, `(${sgNameById.get(c.group) ?? c.group}) - ${c.name}`);
    return m;
  }, [categories, sgNameById]);

  const bookNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of books) m.set(b.id, b.name);
    return m;
  }, [books]);

  const categoryOptions = useMemo(
    () => categories.map(c => ({ value: c.id, label: `(${sgNameById.get(c.group) ?? c.group}) - ${c.name}` })),
    [categories, sgNameById]
  );
  const bookOptions = useMemo(
    () => books.map(b => ({ value: b.id, label: b.name })),
    [books]
  );
  const actionOptions = useMemo(
    () => (SKILL_ACTION_TYPES as readonly string[]).map(v => ({ value: v, label: v })),
    []
  );

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */
  const computeErrors = (draft: FormState): FormErrors => {
    const e: typeof errors = {};

    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!isValidID(draft.id.trim(), prefix)) e.id = `ID must start with "${prefix}" and contain only uppercase letters, numbers and underscores`;
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;

    if (!draft.name.trim()) e.name = 'Name is required';

    if (!draft.category.trim()) e.category = 'Category is required';
    else if (!catNameById.has(draft.category.trim())) e.category = 'Category must be a valid SkillCategory id';

    if (!draft.book.trim()) e.book = 'Book is required';
    else if (!bookNameById.has(draft.book.trim())) e.book = 'Book must be a valid Book id';

    if (!draft.action) e.action = 'Action is required';
    else if (!(SKILL_ACTION_TYPES as readonly string[]).includes(draft.action)) e.action = 'Pick a valid SkillActionType';

    // stats: require at least one
    const chosen: Stat[] = [draft.stat1, draft.stat2, draft.stat3].filter(Boolean) as Stat[];
    const validStats = new Set(STATS);
    if (chosen.length === 0) e.stats = 'Select at least one Stat';
    else if (!chosen.every(s => validStats.has(s))) e.stats = 'Stats must be valid';

    // floats: required and must parse
    const ex = draft.exhaustion.trim();
    if (!ex) e.exhaustion = 'Exhaustion is required';
    else if (!(isValidSignedFloat(ex) || /^\d+$/.test(ex))) e.exhaustion = 'Must be a number';

    const dm = draft.distanceMultiplier.trim();
    if (!dm) e.distanceMultiplier = 'Distance multiplier is required';
    else if (!(isValidSignedFloat(dm) || /^\d+$/.test(dm))) e.distanceMultiplier = 'Must be a number';

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing, catNameById, bookNameById]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<Skill>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: r => r.id, sortType: 'string', minWidth: 280 },
    { id: 'name', header: 'Name', accessor: r => r.name, sortType: 'string', minWidth: 180 },
    {
      id: 'category',
      header: 'Category',
      accessor: r => catNameById.get(r.category) ?? r.category,
      sortType: 'string',
      minWidth: 180,
      render: r => {
        const label = catNameById.get(r.category);
        return label ? label : r.category;
      },
    },
    {
      id: 'book',
      header: 'Book',
      accessor: r => bookNameById.get(r.book) ?? r.book,
      sortType: 'string',
      minWidth: 180,
      render: r => {
        const label = bookNameById.get(r.book);
        return label ? label : r.book;
      },
    },
    { id: 'action', header: 'Action', accessor: r => r.action, sortType: 'string', minWidth: 140 },
    { id: 'isRestricted', header: 'Restricted', accessor: r => Number(r.isRestricted), sortType: 'number', minWidth: 80, render: r => r.isRestricted ? 'Yes' : 'No' },
    { id: 'canSpecialise', header: 'Can Specialise', accessor: r => Number(r.canSpecialise), sortType: 'number', minWidth: 80, render: r => r.canSpecialise ? 'Yes' : 'No' },
    { id: 'mandatorySubcategory', header: 'Mandatory Subcategory', accessor: r => Number(r.mandatorySubcategory), sortType: 'number', minWidth: 80, render: r => r.mandatorySubcategory ? 'Yes' : 'No' },
    { id: 'exhaustion', header: 'Exhaustion', accessor: r => r.exhaustion, sortType: 'number', align: 'right', minWidth: 120 },
    { id: 'distanceMultiplier', header: 'Distance Multiplier', accessor: r => r.distanceMultiplier, sortType: 'number', align: 'right', minWidth: 160 },
    {
      id: 'stats', header: 'Stats', accessor: r => r.stats.join(','), sortType: 'string', minWidth: 220,
      render: r => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {r.stats.map((s, i) => (
            <span key={`${s}-${i}`} style={{ display: 'inline-block', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 999, fontSize: 12 }}>
              {s}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'subcategories', header: 'Subcategories', accessor: r => r.subcategories.join(','), sortType: 'string', minWidth: 240,
      render: r => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {r.subcategories.map((s, i) => (
            <span key={`${s}-${i}`} style={{ display: 'inline-block', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
              {s}
            </span>
          ))}
        </div>
      )
    },
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
  ], [catNameById, bookNameById]);

  const globalFilter = (r: Skill, q: string) => {
    const s = q.toLowerCase();
    const cat = catNameById.get(r.category) ?? '';
    const book = bookNameById.get(r.book) ?? '';
    return [
      r.id, r.name,
      r.category, cat,
      r.book, book,
      r.action,
      r.isRestricted ? 'yes' : 'no',
      r.canSpecialise ? 'yes' : 'no',
      r.mandatorySubcategory ? 'yes' : 'no',
      r.exhaustion, r.distanceMultiplier,
      r.stats.join(','),
      r.subcategories.join(','),
    ].some(v => String(v ?? '').toLowerCase().includes(s));
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

  const startView = (row: Skill) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Skill) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Skill) => {
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
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertSkill(payload, opts);

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
        description: `Skill "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: Skill) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Skill',
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
      await deleteSkill(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Skill "${row.id}" deleted.` });
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

  // helpers to manage subcategories inline
  const addSubcat = () => setForm(s => ({ ...s, subcategories: [...s.subcategories, ''] }));

  const updateSubcat = (i: number, v: string) => setForm(s => {
    const copy = s.subcategories.slice();
    copy[i] = v;
    return { ...s, subcategories: copy };
  });
  const removeSubcat = (i: number) => setForm(s => {
    const copy = s.subcategories.slice();
    copy.splice(i, 1);
    return { ...s, subcategories: copy };
  });

  return (
    <>
      <h2>Skills</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Skill</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            aria-label="Search skills"
          />

          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {/* Display main Form */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Skill</h3>

            <button
              type="button"
              onClick={() => {
                setPreviewAll(p => !p);
                setShowPreview({ description: !previewAll, difficulties: !previewAll, notes: !previewAll });
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
                label="Category"
                value={form.category}
                onChange={(v) => setForm(s => ({ ...s, category: v }))}
                options={categoryOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.category}
                helperText={(loading) ? 'Loading categories…' : 'Select a SkillCategory id'}
              />
              <LabeledSelect
                label="Book"
                value={form.book}
                onChange={(v) => setForm(s => ({ ...s, book: v }))}
                options={bookOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.book}
                helperText={loading ? 'Loading books…' : 'Select a Book id'}
              />
              <LabeledSelect
                label="Action"
                value={form.action}
                onChange={(v) => setForm(s => ({ ...s, action: v as SkillActionType }))}
                options={actionOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.action}
              />

              {/* Stats (3 slots) */}
              <LabeledSelect
                label="Stat #1"
                value={form.stat1}
                onChange={(v) => setForm(s => ({ ...s, stat1: (v as Stat) || '' }))}
                options={STATS}
                disabled={viewing}
                error={viewing ? undefined : errors.stats}
              />
              <LabeledSelect
                label="Stat #2"
                value={form.stat2}
                onChange={(v) => setForm(s => ({ ...s, stat2: (v as Stat) || '' }))}
                options={STATS}
                disabled={viewing}
              />
              <LabeledSelect
                label="Stat #3"
                value={form.stat3}
                onChange={(v) => setForm(s => ({ ...s, stat3: (v as Stat) || '' }))}
                options={STATS}
                disabled={viewing}
              />

              {/* Floats */}
              <LabeledInput
                label="Exhaustion"
                value={form.exhaustion}
                onChange={makeSignedFloatOnChange<typeof form>('exhaustion', setForm)}
                disabled={viewing}
                width={140}
                inputProps={{ inputMode: 'decimal', pattern: '^-?(?:\\d+\\.?\\d*|\\.\\d+)$' }}
                error={viewing ? undefined : errors.exhaustion}
              />
              <LabeledInput
                label="Distance Multiplier"
                value={form.distanceMultiplier}
                onChange={makeSignedFloatOnChange<typeof form>('distanceMultiplier', setForm)}
                disabled={viewing}
                width={180}
                inputProps={{ inputMode: 'decimal', pattern: '^-?(?:\\d+\\.?\\d*|\\.\\d+)$' }}
                error={viewing ? undefined : errors.distanceMultiplier}
              />
            </div>

            {/* Long text sections */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 12 }}>
              {/* Description */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4 style={{ margin: '8px 0' }}>Description (HTML allowed)</h4>
                  {!viewing && (
                    <button type="button" onClick={() => setShowPreview(s => ({ ...s, description: !s.description }))}>
                      {showPreview.description ? 'Edit' : 'Preview'}
                    </button>
                  )}
                </div>

                {(showPreview.description || viewing) ? (
                  <MarkupPreview
                    content={form.description}
                    emptyHint="No description"
                    className="preview-html"
                    style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
                  />
                ) : (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))}
                      disabled={viewing}
                      rows={5}
                    />
                  </label>
                )}
              </div>

              {/* Difficulties Summary */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4 style={{ margin: '8px 0' }}>Difficulties Summary (HTML allowed)</h4>
                  {!viewing && (
                    <button
                      type="button"
                      onClick={() => setShowPreview(s => ({ ...s, difficulties: !s.difficulties }))}
                    >
                      {showPreview.difficulties ? 'Edit' : 'Preview'}
                    </button>
                  )}
                </div>

                {(showPreview.difficulties || viewing) ? (
                  <MarkupPreview
                    content={form.difficultiesSummary}
                    emptyHint="No difficulties summary"
                    className="preview-html"
                    style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
                  />
                ) : (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <textarea
                      value={form.difficultiesSummary}
                      onChange={(e) => setForm(s => ({ ...s, difficultiesSummary: e.target.value }))}
                      disabled={viewing}
                      rows={6}
                    />
                  </label>
                )}
              </div>

              {/* Notes */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4 style={{ margin: '8px 0' }}>Notes (HTML allowed)</h4>
                  {!viewing && (
                    <button
                      type="button"
                      onClick={() => setShowPreview(s => ({ ...s, notes: !s.notes }))}
                    >
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
            {/* Subcategories */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <CheckboxInput
                  label="Restricted"
                  checked={form.isRestricted}
                  onChange={(c) => setForm(s => ({ ...s, isRestricted: c }))}
                  disabled={viewing}
                />
                <CheckboxInput
                  label="Can Specialise"
                  checked={form.canSpecialise}
                  onChange={(c) => setForm(s => ({ ...s, canSpecialise: c }))}
                  disabled={viewing}
                />
                <CheckboxInput
                  label="Mandatory Subcategory"
                  checked={form.mandatorySubcategory}
                  onChange={(c) => setForm(s => ({ ...s, mandatorySubcategory: c }))}
                  disabled={viewing}
                />
              </div>
              {form.subcategories.length > 0 && (
                <>
                  <h4 style={{ margin: '8px 0' }}>Subcategories</h4>
                  {!viewing && <button type="button" onClick={addSubcat} style={{ marginBottom: 8 }}>+ Add subcategory</button>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    {form.subcategories.map((sc, i) => (
                      <React.Fragment key={`subcat-${i}`}>
                        <LabeledInput
                          label="Subcategory"
                          hideLabel
                          ariaLabel={`Subcategory ${i + 1}`}
                          value={sc}
                          onChange={(v) => updateSubcat(i, v)}
                          disabled={viewing}
                        />
                        {!viewing && (
                          <button type="button" onClick={() => removeSubcat(i)} style={{ color: '#b00020' }}>
                            Remove
                          </button>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}
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
          rows={rows}
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
          persistKey="dt.skill.v1"
          ariaLabel="Skills"
        />
      )}
    </>
  );
}