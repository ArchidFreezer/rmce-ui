import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchLanguages, upsertLanguage, deleteLanguage,
  fetchLanguageCategories,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxInput,
  LabeledInput,
  LabeledSelect,
  Spinner,
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

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  name: string;
  category: string;
  baseLanguage?: string | undefined;
  isSpoken: boolean;
  isWritten: boolean;
  isSomatic: boolean;
};

type FormErrors = {
  id?: string;
  name?: string;
  category?: string;
  baseLanguage?: string;
  isSpoken?: string;
  isWritten?: string;
  isSomatic?: string;
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

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function LanguagesView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [categories, setCategories] = useState<LanguageCategory[]>([]);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [tp, lc] = await Promise.all([
          fetchLanguages(),
          fetchLanguageCategories(),
        ]);
        setRows(tp);
        setCategories(lc);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Options                                                            */
  /* ------------------------------------------------------------------ */

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: `${c.name}` })),
    [categories]
  );

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */
  const computeErrors = (draft: FormState): FormErrors => {
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
    setErrors(computeErrors(form));
  }, [form, showForm, viewing, categoryNameById]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<Language>[] = useMemo(() => {
    return [
      { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 260 },
      { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 160 },
      {
        id: 'category',
        header: 'Category',
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
        header: 'Base Language',
        accessor: (r) => r.baseLanguage ?? '',
        sortType: 'string',
        minWidth: 160,
      },
      {
        id: 'isSpoken',
        header: 'Spoken',
        accessor: (r) => Number(r.isSpoken),
        sortType: 'number',
        minWidth: 90,
        render: (r) => (r.isSpoken ? 'Yes' : 'No'),
      },
      {
        id: 'isWritten',
        header: 'Written',
        accessor: (r) => Number(r.isWritten),
        sortType: 'number',
        minWidth: 90,
        render: (r) => (r.isWritten ? 'Yes' : 'No'),
      },
      {
        id: 'isSomatic',
        header: 'Somatic',
        accessor: (r) => Number(r.isSomatic),
        sortType: 'number',
        minWidth: 100,
        render: (r) => (r.isSomatic ? 'Yes' : 'No'),
      },
      {
        id: 'actions',
        header: 'Actions',
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
    ];
  }, [rows, categoryNameById]);

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
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (row: Language) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Language',
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
      await deleteLanguage(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Language "${row.id}" deleted.` });
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
      <h2>Languages</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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

      {/* Display main Form */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Language</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
              <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />

              <LabeledSelect
                label="Category"
                value={form.category}
                onChange={(v) => setForm((s) => ({ ...s, category: v }))}
                options={categoryOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.category}
                helperText={loading ? 'Loading categories…' : undefined}
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

      {/* Table hidden while form up */}
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
          persistKey="dt.language.v1"
          ariaLabel="Languages"
        />
      )}
    </>
  );
}