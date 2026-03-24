import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchLanguages, upsertLanguage, deleteLanguage,
  fetchLanguagecategories,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxInput,
  LabeledInput,
  LabeledSelect,
  useConfirm, useToast,
} from '../../components';

import type {
  Language,
  LanguageCategory,
} from '../../types';

import {
  isValidID, makeIDOnChange,
} from '../../utils';

const prefix = 'LANGUAGE_';

// ------------------------
// Form VM (strings for inputs, booleans as booleans)
// ------------------------
type FormState = {
  id: string;
  name: string;
  category: string;
  baseLanguage?: string | undefined;
  isSpoken: boolean;
  isWritten: boolean;
  isSomatic: boolean;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  category: '',
  baseLanguage: '',
  isSpoken: false,
  isWritten: false,
  isSomatic: false,
});

const toVM = (x: Language): FormState => ({
  id: x.id,
  name: x.name,
  category: x.category,
  baseLanguage: x.baseLanguage ?? '',
  isSpoken: x.isSpoken,
  isWritten: x.isWritten,
  isSomatic: x.isSomatic,
});

const fromVM = (vm: FormState): Language => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  category: vm.category.trim(),
  baseLanguage: vm.baseLanguage?.trim() ? vm.baseLanguage.trim() : undefined,
  isSpoken: !!vm.isSpoken,
  isWritten: !!vm.isWritten,
  isSomatic: !!vm.isSomatic,
});

export default function LanguagesView() {
  const dtRef = useRef<DataTableHandle>(null);
  const [rows, setRows] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ id?: string | undefined; name?: string | undefined; category?: string | undefined; baseLanguage?: string | undefined; isSpoken?: string | undefined; isWritten?: string | undefined; isSomatic?: string | undefined; }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.category || errors.baseLanguage || errors.isSpoken || errors.isWritten || errors.isSomatic);

  const [categories, setCategories] = useState<LanguageCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const toast = useToast();
  const confirm = useConfirm();

  // ---- Load languages ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchLanguages();
        if (!mounted) return;
        setRows(list);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ---- Load categories (for select + table labels) ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchLanguagecategories();
        if (!mounted) return;
        setCategories(list);
      } catch (e) {
        console.error('Failed to load LanguageCategories', e);
      } finally {
        if (mounted) setCatLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ---- Category maps/options ----
  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: `${c.name}` })),
    [categories]
  );

  // ---- Validation ----
  const computeErrors = (draft = form) => {
    const e: typeof errors = {};
    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;
    if (!draft.name.trim()) e.name = 'Name is required';

    const cat = draft.category.trim();
    if (!cat) e.category = 'Category is required';
    else if (!categoryNameById.has(cat)) e.category = 'Category must be a valid LanguageCategory ID';

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors());
  }, [form, showForm, viewing, categoryNameById]);

  // ---- Actions ----
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyVM());
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: Language) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Language) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Language) => {
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
    setShowForm(false);
    setViewing(false);
    setEditingId(null);
    setErrors({});
  };

  const saveForm = async () => {
    // Normalize payload (strings -> numbers for numeric fields)
    const payload = fromVM(form);

    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    if (hasErrors) return;

    const isEditing = Boolean(editingId);
    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };
      await upsertLanguage(payload, opts);

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
        description: `Language "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: Language) => {
    const ok = await confirm({
      title: 'Delete Language',
      body: `Delete language "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter((r) => r.id !== row.id));
    try {
      await deleteLanguage(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Language "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // ---- Table ----
  const columns: ColumnDef<Language>[] = useMemo(() => [
    { id: 'id', header: 'id', accessor: (r) => r.id, sortType: 'string', minWidth: 260 },
    { id: 'name', header: 'name', accessor: (r) => r.name, sortType: 'string', minWidth: 160 },
    {
      id: 'category',
      header: 'category',
      accessor: (r) => categoryNameById.get(r.category) ?? r.category, // sort by label fallback to id
      sortType: 'string',
      minWidth: 100,
      render: (r) => {
        const label = categoryNameById.get(r.category);
        return label ? `${label}` : r.category;
      },
    },
    {
      id: 'baseLanguage',
      header: 'baseLanguage',
      accessor: (r) => r.baseLanguage ?? '',
      sortType: 'string',
      minWidth: 160,
    },
    {
      id: 'isSpoken',
      header: 'spoken',
      accessor: (r) => Number(r.isSpoken),
      sortType: 'number',
      minWidth: 90,
      render: (r) => (r.isSpoken ? 'Yes' : 'No'),
    },
    {
      id: 'isWritten',
      header: 'written',
      accessor: (r) => Number(r.isWritten),
      sortType: 'number',
      minWidth: 90,
      render: (r) => (r.isWritten ? 'Yes' : 'No'),
    },
    {
      id: 'isSomatic',
      header: 'somatic',
      accessor: (r) => Number(r.isSomatic),
      sortType: 'number',
      minWidth: 100,
      render: (r) => (r.isSomatic ? 'Yes' : 'No'),
    },
    {
      id: 'actions',
      header: 'actions',
      sortable: false,
      width: 340,
      render: (row) => (
        <>
          <button onClick={() => startView(row)} style={{ marginRight: 6 }}>View</button>
          <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
          <button onClick={() => startDuplicate(row)} style={{ marginRight: 6 }}>Duplicate</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
    // 👇 ensure columns recompute when category labels arrive
  ], [categoryNameById]);

  const globalFilter = (r: Language, q: string) => {
    const s = q.toLowerCase();
    const catLabel = categoryNameById.get(r.category) ?? '';
    return [
      r.id, r.name, r.category, catLabel,
      r.baseLanguage ?? '',
      r.isSpoken ? 'yes' : 'no',
      r.isWritten ? 'yes' : 'no',
      r.isSomatic ? 'yes' : 'no',
    ].some((v) => String(v ?? '').toLowerCase().includes(s));
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Languages</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Language</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search languages…"
            aria-label="Search languages"
          />
          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Language' : (editingId ? 'Edit Language' : 'New Language')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />

            <LabeledSelect
              label="Category"
              value={form.category}
              onChange={(v) => setForm((s) => ({ ...s, category: v }))}
              options={categoryOptions}
              disabled={catLoading || viewing}
              error={viewing ? undefined : errors.category}
              helperText={catLoading ? 'Loading categories…' : undefined}
            />

            <LabeledInput
              label="Base Language (optional)"
              value={form.baseLanguage ?? ''}
              onChange={(v) => setForm((s) => ({ ...s, baseLanguage: v }))}
              disabled={viewing}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <CheckboxInput label="Spoken" checked={form.isSpoken} onChange={(c) => setForm((s) => ({ ...s, isSpoken: c }))} disabled={viewing} />
              <CheckboxInput label="Written" checked={form.isWritten} onChange={(c) => setForm((s) => ({ ...s, isWritten: c }))} disabled={viewing} />
              <CheckboxInput label="Somatic" checked={form.isSomatic} onChange={(c) => setForm((s) => ({ ...s, isSomatic: c }))} disabled={viewing} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Table hidden while form up */}
      {!showForm && (
        <DataTable<Language>
          ref={dtRef}
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
          initialSort={{ colId: 'name', dir: 'asc' }}
          searchQuery={query}
          globalFilter={globalFilter}
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50, 100]}
          tableMinWidth={0}
          zebra
          hover
          resizable
          persistKey="dt.language.v1"
          ariaLabel="Languages"
        />
      )}
    </>
  );
}