import { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { fetchBooks, upsertBook, deleteBook } from '../../api/book';
import type { Book } from '../../types/book';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { LabeledInput } from '../../components/inputs';
import { isIntegerString, isISBN } from '../../components/inputs/validators';

export default function BookView() {
  const [rows, setRows] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<Book>(emptyBook());   // <- form is typed as Book
  const toast = useToast();
  const confirm = useConfirm();

  // ----- Load -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const books = await fetchBooks();
        if (!mounted) return;
        setRows(books);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ----- Inline validation helpers -----
  const [errors, setErrors] = useState<{ id?: string; name?: string; type?: string; code?: string; abbreviation?: string; isbn?: string; }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.type || errors.code || errors.abbreviation || errors.isbn);
  const computeErrors = (draft: Book, isEditing: boolean) => {
    if (viewing) return {};             // suppress inline errors in view mode

    const next: { id?: string; name?: string; type?: string; code?: string; abbreviation?: string; isbn?: string; } = {};
    // ID (only on create, must be unique and start with prefix in ucase and contain additional characters)
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!isEditing && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    else if (!draft.id.trim().toUpperCase().startsWith('BOOK_')) next.id = 'ID must start with "BOOK_"';
    else if (draft.id.trim().length <= 5) next.id = 'ID must contain additional characters after "BOOK_"';
    else if (!/^[A-Z0-9_]+$/.test(draft.id.trim())) next.id = 'ID can only contain uppercase letters, numbers and underscores';
    // Name
    if (!draft.name.trim()) next.name = 'Name is required';
    // Code
    const code = (draft.code);
    if (!code) next.code = 'Code is required';
    else if (!isIntegerString(String(code))) next.code = 'Code must be an integer (digits only)';
    // Abbreviation
    if (!draft.abbreviation.trim()) next.abbreviation = 'Abbreviation is required';
    // ISBN
    if (!draft.isbn.trim()) next.isbn = 'ISBN is required';
    else if (!isISBN(draft.isbn.trim())) next.isbn = 'ISBN must be a valid ISBN-10 or ISBN-13';

    return next;
  };

  useEffect(() => {
    if (!showForm) return;
    const isEditing = Boolean(editingId);
    setErrors(computeErrors(form, isEditing));
  }, [form, editingId, showForm]); // keep current to avoid stale closure

  // ----- Handlers (Create / Edit / Delete) -----
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyBook());
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Book) => {
    setViewing(false);
    setEditingId(row.id);
    setForm({ ...row });
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Book) => {
    setViewing(false);
    setEditingId(null);

    const next = { ...row };
    next.id = 'BOOK_';
    next.name += ' (Copy)';
    next.isbn = ''; // Clear ISBN to force user to enter a new one, since it must be unique

    setForm(next);
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: Book) => {
    setViewing(true);
    setEditingId(row.id);       // we can reuse editingId to preload the item, but we won't allow saving
    setForm({ ...row });
    setErrors({});              // no need to compute field errors for read-only view, but we can keep formErr for any potential top-level messages
    setShowForm(true);
  }

  const cancelForm = () => {
    setViewing(false);
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  };

  const saveForm = async () => {
    const payload: Book = {
      id: String(form.id).trim(),
      code: Number(form.code),
      name: String(form.name).trim(),
      abbreviation: String(form.abbreviation).trim(),
      isbn: String(form.isbn).trim(),
    };

    const isEditing = Boolean(editingId);
    const nextErrors = computeErrors(payload, isEditing);
    setErrors(nextErrors);
    const topError = nextErrors.id || nextErrors.name || nextErrors.type || nextErrors.code || nextErrors.abbreviation || nextErrors.isbn || '';
    if (topError) return;

    try {
      // default POST to /rmce/objects/book/ with a single JSON object
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertBook(payload, opts);

      setRows((prev) => {
        if (isEditing) {
          // replace existing row
          const idx = prev.findIndex((r) => r.id === payload.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...payload };
            return copy;
          }
          // fallback: if not found (rare), prepend
          return [payload, ...prev];
        }
        // create → prepend
        return [payload, ...prev];
      });


      setShowForm(false);
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
    }
  };

  const onDelete = async (row: Book) => {
    const id = row?.id;
    if (!id) return;
    const ok = await confirm({
      title: 'Delete Book',
      body: `Delete book "${id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(a => a.id !== id));
    try {
      await deleteBook(id);
      // if currently editing this item, close the form
      if (editingId === row.id) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Book "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // Columns
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
        width: 160,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, editingId]); // allows closing form on self-delete

  // ----- Search -----
  const globalFilter = (b: Book, q: string) => {
    const s = q.toLowerCase();
    return [b.id, b.code, b.name, b.abbreviation, b.isbn]
      .some(v => String(v ?? '').toLowerCase().includes(s));
  };


  // ----- Render -----
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Books</h2>

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Book' : 'New Book'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={(v) => setForm((s) => ({ ...s, id: v }))} disabled={!!editingId || viewing} error={errors.id} />

            <LabeledInput label="Code" value={String(form.code).trim()} disabled={viewing}
              onChange={(v) => setForm((s) => {
                // Sanitize: keep at most one leading '-', strip all other non-digits
                // 1) Remove everything except digits and '-'
                let raw = v.replace(/[^\d]+/g, '');
                // 2) If there are multiple '-', keep only the first
                const firstDash = raw.indexOf('-');
                if (firstDash !== -1) {
                  raw = '-' + raw.slice(firstDash + 1).replace(/-/g, '');
                }
                // 3) Allow raw === '-' temporarily so users can type the sign first;
                //    validation will show an error until at least one digit is added.
                return { ...s, code: Number(raw) };
              })}
              inputProps={{
                inputMode: 'numeric', // mobile numeric keypad
                pattern: '\\d*',
              }}
              error={errors.code} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} error={errors.name} disabled={viewing} />
            <LabeledInput label="Abbreviation" value={form.abbreviation} onChange={(v) => setForm((s) => ({ ...s, abbreviation: v }))} error={errors.abbreviation} disabled={viewing} />
            <LabeledInput label="ISBN" value={form.isbn} onChange={(v) => setForm((s) => ({ ...s, isbn: v }))} error={errors.isbn} disabled={viewing} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Shared DataTable */}
      {!showForm && (
        <>
          {/* New + Search */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
            <button onClick={startNew}>New Book</button>
            <DataTableSearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search books…"
              aria-label="Search books"
            />
          </div>

          <DataTable<Book>
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
        </>
      )}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No books found.
        </div>
      )}
    </>
  );
}

function emptyBook(): Book {
  return { id: 'BOOK_', code: 1234, name: '', abbreviation: '', isbn: '' };
}