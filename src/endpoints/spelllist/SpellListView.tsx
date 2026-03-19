import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput, LabeledSelect, CheckboxGroup, CheckboxInput } from '../../components/inputs';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

import { fetchSpelllists, upsertSpelllist, deleteSpelllist } from '../../api/spelllist';
import type { SpellList } from '../../types/spelllist';
import { SPELL_TYPES, SPELL_REALMS, SpellType, Realm } from '../../types/enum';

import { fetchBooks } from '../../api/book';
import type { Book } from '../../types/book';

import { isValidID, makeIDOnChange } from '../../utils/inputHelpers';

const prefix = 'SPELLLIST_';

// ------------------------
// Form VM
// ------------------------
type FormState = {
  id: string;
  name: string;
  book: string;
  type: string;          // keep as string while typing; validate to SpellType
  evil: boolean;
  summoning: boolean;
  realms: Realm[];       // keep as Realm[] in the form (CheckboxGroup)
};

function emptyVM(): FormState {
  return { id: prefix, name: '', book: '', type: '', evil: false, summoning: false, realms: [] };
}
function toVM(s: SpellList): FormState {
  return { ...s, type: s.type };
}
function fromVM(vm: FormState): SpellList {
  return {
    id: vm.id.trim(),
    name: vm.name.trim(),
    book: vm.book.trim(),
    type: vm.type.trim() as SpellType,        // safe after validation
    evil: !!vm.evil,
    summoning: !!vm.summoning,
    realms: [...vm.realms],
  };
}

export default function SpellListView() {
  const [rows, setRows] = useState<SpellList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ id?: string | undefined; name?: string | undefined; type?: string | undefined; realms?: string | undefined; book?: string | undefined; }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.type || errors.realms || errors.book);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  // Books for dropdown (non-fatal)
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);

  const toast = useToast();
  const confirm = useConfirm();

  // ---- Load Spell Lists ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchSpelllists();
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

  // ---- Load Books for dropdown ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchBooks();
        if (!mounted) return;
        setBooks(list);
      } catch (e) {
        // Non-fatal: users can still type an id; save-time validation will catch unknowns
        console.error('Failed to load Books', e);
      } finally {
        if (mounted) setBooksLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);


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


  // ---- Validation ----
  const isSpellType = (s: string) => (SPELL_TYPES as readonly string[]).includes(s);
  const computeErrors = (draft: FormState = form) => {
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

  // ---- Actions ----
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
    setShowForm(false);
    setViewing(false);
    setEditingId(null);
    setErrors({});
  };

  const saveForm = async () => {
    const payload = fromVM(form);

    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    if (hasErrors) return;

    const isEditing = Boolean(editingId);
    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };
      await upsertSpelllist(payload, opts);

      setRows(prev => {
        if (isEditing) {
          const idx = prev.findIndex(r => r.id === payload.id);
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
      toast({ variant: 'success', title: isEditing ? 'Updated' : 'Saved', description: `Spell list "${payload.id}" ${isEditing ? 'updated' : 'created'}.` });
    } catch (err) {
      toast({ variant: 'danger', title: 'Save failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  const onDelete = async (row: SpellList) => {
    const ok = await confirm({
      title: 'Delete Spell List',
      body: `Delete spell list "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(r => r.id !== row.id));
    try {
      await deleteSpelllist(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Spell list "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // ---- Table ----
  const columns: ColumnDef<SpellList>[] = useMemo(() => {
    /** Helper to render a "pill" UI for realms. This is just a styled span with the realm name. */
    const pill = (txt: string) => (
      <span
        key={txt}
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          marginRight: 6,
          marginBottom: 4,
          borderRadius: 999,
          fontSize: 12,
          border: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
        title={txt}
      >
        {txt}
      </span>
    );

    return [
      { id: 'id', header: 'ID', accessor: r => r.id, sortType: 'string', minWidth: 260 },
      { id: 'name', header: 'Name', accessor: r => r.name, sortType: 'string', minWidth: 160 },

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
        id: 'realms', header: 'Realms', accessor: r => r.realms.length, sortType: 'number', minWidth: 260,
        render: (r) => {
          const parts = r.realms.map((x) => x.trim()).filter(Boolean);
          return <div style={{ display: 'flex', flexWrap: 'wrap' }}>{parts.map(pill)}</div>;
        },
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

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Spell Lists</h2>

      {/* Toolbar shown only when table visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Spell List</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search spell lists…"
            aria-label="Search spell lists"
          />
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Spell List' : (editingId ? 'Edit Spell List' : 'New Spell List')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />

            <LabeledSelect
              label="Book"
              value={form.book}
              onChange={(v) => setForm(s => ({ ...s, book: v }))}
              options={bookOptions}
              disabled={booksLoading || viewing}
              error={viewing ? undefined : errors.book}
              helperText={booksLoading ? 'Loading Books…' : 'Select a Book ID'}
            />

            <LabeledSelect
              label="Type"
              value={form.type}
              onChange={(v) => setForm(s => ({ ...s, type: v }))}
              options={SPELL_TYPES}
              disabled={viewing}
              error={viewing ? undefined : errors.type}
            />

            <CheckboxInput label="Evil" checked={form.evil} onChange={(c) => setForm(s => ({ ...s, evil: c }))} disabled={viewing} />
            <CheckboxInput label="Summoning" checked={form.summoning} onChange={(c) => setForm(s => ({ ...s, summoning: c }))} disabled={viewing} />

            <div style={{ gridColumn: '1 / -1' }}>
              <CheckboxGroup<Realm>
                label="Realms"
                value={form.realms}
                options={SPELL_REALMS}
                onChange={(vals) => setForm(s => ({ ...s, realms: vals }))}
                disabled={viewing}
                error={viewing ? undefined : errors.realms}
                helperText="Select at least one"
                columns={4}
                showSelectAll
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Table hidden while form is up */}
      {!showForm && (
        <DataTable<SpellList>
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
