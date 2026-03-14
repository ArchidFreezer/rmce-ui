import { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { fetchBooks, upsertBook, deleteBook } from './api';
import type { Book } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

export default function BooksView() {
  const [rows, setRows] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const globalFilter = (b: Book, q: string) => {
    const s = q.toLowerCase();
    return [b.id, b.code, b.name, b.abbreviation, b.isbn]
      .some(v => String(v ?? '').toLowerCase().includes(s));
  };

  // Columns
  const columns: ColumnDef<Book>[] = [
    { id: 'id', header: 'id', accessor: r => r.id, sortable: true },
    { id: 'code', header: 'code', accessor: r => r.code, sortable: true },
    { id: 'name', header: 'name', accessor: r => r.name, sortable: true },
    { id: 'abbreviation', header: 'abbreviation', accessor: r => r.abbreviation, sortable: true },
    { id: 'isbn', header: 'isbn', accessor: r => r.isbn, sortable: true },
    {
      id: 'actions',
      header: 'actions',
      sortable: false,
      render: (row) => (
        <>
          <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
  ];

  const [sort, setSort] = useState<{ key: keyof Book; dir: 'asc' | 'desc' }>({ key: 'id', dir: 'asc' });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Book>(emptyBook());   // <- form is typed as Book
  const [formErr, setFormErr] = useState('');

  const confirm = useConfirm();
  const toast = useToast();

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((b) =>
      [b.id, b.code, b.name, b.abbreviation, b.isbn]
        .some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      const av = String(a?.[key] ?? '');
      const bv = String(b?.[key] ?? '');
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const onSort = (key: keyof Book) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  const startNew = () => {
    setEditingId(null);
    setForm(emptyBook());
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row: Book) => {
    setEditingId(row.id);
    setForm({ ...row });
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormErr('');
  };

  const validate = (b: Book): string => {
    if (!b.id?.trim()) return 'id is required';
    if (!b.name?.trim()) return 'name is required';
    if (!b.code?.trim()) return 'code is required';
    if (!b.abbreviation?.trim()) return 'abbreviation is required';
    if (!b.isbn?.trim()) return 'isbn is required';
    return '';
  };

  const saveForm = async () => {
    const payload: Book = {
      id: String(form.id).trim(),
      code: String(form.code).trim(),
      name: String(form.name).trim(),
      abbreviation: String(form.abbreviation).trim(),
      isbn: String(form.isbn).trim(),
    };

    const msg = validate(payload);
    if (msg) {
      setFormErr(msg);
      return;
    }

    try {
      // default POST to /rmce/objects/book/ with a single JSON object
      const opts = editingId
        ? { method: 'POST' as const, useResourceIdPath: false }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertBook(payload, opts);

      setRows((prev) => {
        const idx = prev.findIndex((b) => b.id === payload.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...payload };
          return copy;
        }
        return [payload, ...prev];
      });

      setShowForm(false);
      setFormErr('');
      toast({ variant: 'success', title: 'Saved', description: `Book "${payload.id}" saved.` });
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
    setRows(prev.filter((b) => b.id !== id));
    try {
      await deleteBook(id);
      toast({ variant: 'success', title: 'Deleted', description: `Book "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({
        variant: 'danger',
        title: 'Delete failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

return (
  <>
    <h2>Books</h2>

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

    {/* Form panel (unchanged) */}
    {showForm && (
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16, background: '#fafafa' }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Book' : 'New Book'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LabeledInput label="ID" value={form.id} onChange={(v) => setForm((s) => ({ ...s, id: v }))} disabled={!!editingId} />
          <LabeledInput label="Code" value={form.code} onChange={(v) => setForm((s) => ({ ...s, code: v }))} />
          <LabeledInput label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
          <LabeledInput label="Abbreviation" value={form.abbreviation} onChange={(v) => setForm((s) => ({ ...s, abbreviation: v }))} />
          <LabeledInput label="ISBN" value={form.isbn} onChange={(v) => setForm((s) => ({ ...s, isbn: v }))} />
        </div>

        {formErr && <div style={{ color: 'crimson', marginTop: 8 }}>{formErr}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={saveForm}>Save</button>
          <button onClick={cancelForm} type="button">Cancel</button>
        </div>
      </div>
    )}

    {/* Shared DataTable */}
    {loading ? (
      <div>Loading…</div>
    ) : error ? (
      <div style={{ color: 'crimson' }}>Error: {error}</div>
    ) : (
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
        tableMinWidth={900}
        zebra
      />
    )}
  </>
);
}


function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: 'text' | 'number';
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        disabled={disabled}
        style={{ padding: 8 }}
      />
    </label>
  );
}

function SortableTh<T extends string>({
  onClick,
  label,
  sort,
  colKey,
}: {
  onClick: () => void;
  label: string;
  sort: { key: T; dir: 'asc' | 'desc' };
  colKey: T;
}) {
  const active = sort.key === colKey;
  const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      onClick={onClick}
      style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: '8px', cursor: 'pointer', userSelect: 'none' }}
      title={`Sort by ${label}`}
      scope="col"
    >
      {label}{arrow}
    </th>
  );
}

const tdStyle: React.CSSProperties = { borderBottom: '1px solid #f0f0f0', padding: '8px' };
const emptyCell: React.CSSProperties = { padding: 12, textAlign: 'center', color: '#666' };

function emptyBook(): Book {
  return { id: '', code: '', name: '', abbreviation: '', isbn: '' };
}