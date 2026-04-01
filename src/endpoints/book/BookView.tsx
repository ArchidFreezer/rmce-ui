import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchBooks, upsertBook, deleteBook,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  LabeledInput,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Book
} from '../../types';

import {
  isValidID, makeIDOnChange,
  isValidUnsignedInt, makeUnsignedIntOnChange,
  isValidISBN,
} from '../../utils';

const prefix = 'BOOK_';

function emptyBook(): Book {
  return { id: prefix, code: '', name: '', abbreviation: '', isbn: '' };
}

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  name: string;
  code: string;
  abbreviation: string;
  isbn: string;
}

type FormErrors = {
  id?: string;
  name?: string;
  code?: string;
  abbreviation?: string;
  isbn?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  code: '',
  abbreviation: '',
  isbn: '',
});

const toVM = (b: Book): FormState => ({
  id: b.id,
  name: b.name,
  code: b.code,
  abbreviation: b.abbreviation,
  isbn: b.isbn,
});

const fromVM = (vm: FormState): Book => ({
  id: String(vm.id).trim(),
  name: String(vm.name).trim(),
  code: String(vm.code).trim(),
  abbreviation: String(vm.abbreviation).trim(),
  isbn: String(vm.isbn).trim(),
});

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */
export default function BookView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const toast = useToast();
  const confirm = useConfirm();

  // ----- Load -----
  useEffect(() => {
    (async () => {
      try {
        const [b] = await Promise.all([
          fetchBooks(),
        ]);
        setRows(b);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */
  const computeErrors = (draft: FormState): FormErrors => {
    const e: FormErrors = {};

    // ID (only on create, must be unique and start with prefix in ucase and contain additional characters)
    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id.trim(), prefix)) e.id = `ID must start with "${prefix}" and contain only uppercase letters, numbers and underscores`;

    // Name
    if (!draft.name.trim()) e.name = 'Name is required';

    // Code
    const code = (draft.code);
    if (!code.trim()) e.code = 'Code is required';
    else if (!isValidUnsignedInt(code.trim())) e.code = 'Code must be a positive integer';

    // Abbreviation
    if (!draft.abbreviation.trim()) e.abbreviation = 'Abbreviation is required';

    // ISBN
    if (!draft.isbn.trim()) e.isbn = 'ISBN is required';
    else if (!isValidISBN(draft.isbn.trim())) e.isbn = 'ISBN must be a valid ISBN-10 or ISBN-13';

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<Book>[] = useMemo(() => {
    return [
      { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 220 },
      { id: 'code', header: 'Code', accessor: (r) => r.code, sortType: 'number', align: 'right' },
      { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
      { id: 'abbreviation', header: 'Abbreviation', accessor: (r) => r.abbreviation, sortType: 'string' },
      { id: 'isbn', header: 'ISBN', accessor: (r) => r.isbn, sortType: 'string' },
      {
        id: 'actions',
        header: 'Actions',
        sortable: false,
        width: 360,
        render: (row) => (
          <>
            <button onClick={() => startView(row)}>View</button>
            <button onClick={() => startEdit(row)}>Edit</button>
            <button onClick={() => startDuplicate(row)}>Duplicate</button>
            <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>
              Delete
            </button>
          </>
        ),
      },
    ];
  }, [rows]);

  // ----- Search -----
  const globalFilter = (b: Book, q: string) => {
    return [b.id, b.code, b.name, b.abbreviation, b.isbn]
      .some(v => String(v ?? '').toLowerCase().includes(q.toLowerCase()));
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

  const startView = (row: Book) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  }

  const startEdit = (row: Book) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Book) => {
    setViewing(false);
    setEditingId(null);
    const vm = toVM(row);
    vm.id = prefix;
    vm.name += ' (Copy)';
    vm.isbn = ''; // ISBN should be unique, so we clear it for the user to fill in
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

      await upsertBook(payload, opts);

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
        description: `Book "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: Book) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Book',
      body: `Delete book "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows((current) => current.filter((r) => r.id !== row.id));
    setPage(1);

    try {
      await deleteBook(row.id);
      // if currently editing this item, close the form
      if (editingId === row.id) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Book "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
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
      <h2>Books</h2>

      {/* Toolbar shown only when table visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Book</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books…"
            aria-label="Search books"
          />
          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3 style={{ marginTop: 0 }}>{viewing ? 'View Book' : (editingId ? 'Edit Book' : 'New Book')}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />

              <LabeledInput label="Code" value={String(form.code).trim()} disabled={viewing}
                onChange={makeUnsignedIntOnChange<typeof form>('code', setForm)}
                inputProps={{ inputMode: 'numeric', pattern: '\\d*', }} // mobile numeric keypad
                error={errors.code} />
              <LabeledInput label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} error={errors.name} disabled={viewing} />
              <LabeledInput label="Abbreviation" value={form.abbreviation} onChange={(v) => setForm((s) => ({ ...s, abbreviation: v }))} error={errors.abbreviation} disabled={viewing} />
              <LabeledInput label="ISBN" value={form.isbn} onChange={(v) => setForm((s) => ({ ...s, isbn: v }))} error={errors.isbn} disabled={viewing} />
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

      {/* Shared DataTable */}
      {!showForm && (
        <DataTable
          ref={dtRef}
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
          initialSort={{ colId: 'name', dir: 'asc' }}
          // search
          searchQuery={query}
          globalFilter={globalFilter}
          // pagination (client)
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          // styles
          tableMinWidth={0} // allow table to shrink below container width (for better mobile support)
          zebra
          // Resizable columns
          resizable
          persistKey="dt.books.v1"
          ariaLabel='Book data'
        />
      )}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No books found.
        </div>
      )}
    </>
  );
}
