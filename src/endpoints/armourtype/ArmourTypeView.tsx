import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchArmourTypes, upsertArmourType, deleteArmourType,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxInput,
  LabeledInput,
  useConfirm, useToast,
} from '../../components';

import type {
  ArmourType
} from '../../types';

import {
  isValidID, makeIDOnChange,
  isValidSignedInt, makeSignedIntOnChange,
  isValidUnsignedInt, makeUnsignedIntOnChange,
} from '../../utils';

const prefix = 'ARMOURTYPE_';

type FormState = {
  id: string;
  name: string;
  type: string;
  description: string;
  minManoeuvreMod: string;
  maxManoeuvreMod: string;
  missileAttackPenalty: string;
  quicknessPenalty: string;
  animalOnly: boolean;
  includesGreaves: boolean;
};

// Create an empty form state with default values
function emptyVM(): FormState {
  return {
    id: prefix,
    name: '',
    type: '',
    description: '',
    minManoeuvreMod: '',
    maxManoeuvreMod: '',
    missileAttackPenalty: '',
    quicknessPenalty: '',
    animalOnly: false,
    includesGreaves: false,
  };
}

function toVM(a: ArmourType): FormState {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    description: a.description,
    minManoeuvreMod: String(a.minManoeuvreMod),
    maxManoeuvreMod: String(a.maxManoeuvreMod),
    missileAttackPenalty: String(a.missileAttackPenalty),
    quicknessPenalty: String(a.quicknessPenalty),
    animalOnly: a.animalOnly,
    includesGreaves: a.includesGreaves,
  };
}

function fromVM(vm: FormState): ArmourType {
  return {
    id: vm.id.trim(),
    name: vm.name.trim(),
    type: vm.type.trim(),
    description: vm.description.trim(),
    minManoeuvreMod: Number(vm.minManoeuvreMod),
    maxManoeuvreMod: Number(vm.maxManoeuvreMod),
    missileAttackPenalty: Number(vm.missileAttackPenalty),
    quicknessPenalty: Number(vm.quicknessPenalty),
    animalOnly: vm.animalOnly,
    includesGreaves: vm.includesGreaves,
  };
}

export default function ArmourTypeView() {
  const dtRef = useRef<DataTableHandle>(null);
  const [rows, setRows] = useState<ArmourType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ id?: string; name?: string; type?: string; minManoeuvreMod?: string; maxManoeuvreMod?: string; missileAttackPenalty?: string; quicknessPenalty?: string; }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.type || errors.minManoeuvreMod || errors.maxManoeuvreMod || errors.missileAttackPenalty || errors.quicknessPenalty);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state (Create & Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());
  const toast = useToast();
  const confirm = useConfirm();

  // ----- Load -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchArmourTypes();
        if (!mounted) return;
        setRows(data);
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

  const computeErrors = (draft = form) => {
    const next: { id?: string; name?: string; type?: string; minManoeuvreMod?: string; maxManoeuvreMod?: string; missileAttackPenalty?: string; quicknessPenalty?: string } = {};
    // ID (only on create, must be unique and start with prefix in ucase and contain additional characters)
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) next.id = `ID must start with "${prefix}" and contain additional characters`;
    // Name
    if (!draft.name.trim()) next.name = 'Name is required';
    // Type
    if (!draft.type.trim()) next.type = 'Type is required';
    else if (!editingId && rows.some(r => r.type === draft.type.trim())) next.type = `Type "${draft.type.trim()}" already exists`;
    else if (!/^AT [1-2]?[0-9]$/.test(draft.type.trim())) next.type = 'Type must follow the pattern "AT [1-2]?[0-9]"';
    // Numeric values
    if (!draft.minManoeuvreMod) next.minManoeuvreMod = 'Min Manoeuvre Mod is required';
    else if (!isValidSignedInt(draft.minManoeuvreMod)) next.minManoeuvreMod = 'Min Manoeuvre Mod must be an integer';
    if (!draft.maxManoeuvreMod) next.maxManoeuvreMod = 'Max Manoeuvre Mod is required';
    else if (!isValidSignedInt(draft.maxManoeuvreMod)) next.maxManoeuvreMod = 'Max Manoeuvre Mod must be an integer';
    if (!draft.missileAttackPenalty) next.missileAttackPenalty = 'Missile Attack Penalty is required';
    else if (!isValidUnsignedInt(draft.missileAttackPenalty)) next.missileAttackPenalty = 'Missile Attack Penalty must be a positive integer';
    if (!draft.quicknessPenalty) next.quicknessPenalty = 'Quickness Penalty is required';
    else if (!isValidUnsignedInt(draft.quicknessPenalty)) next.quicknessPenalty = 'Quickness Penalty must be a positive integer';
    return next;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]); // keep current with form changes for live validation (but skip in view mode)

  // ----- Handlers (Create / Edit / Delete) -----
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyVM());
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: ArmourType) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: ArmourType) => {
    setViewing(false);           // if you have viewing state; otherwise omit
    setEditingId(null);

    const next = toVM(row);
    next.id = prefix;
    next.name += ' (Copy)';

    setForm(next);
    setErrors?.({});      // if you have an errors object
    setShowForm(true);
  };

  const startView = (row: ArmourType) => {
    setViewing(true);
    setEditingId(row.id);       // we can reuse editingId to preload the item, but we won't allow saving
    setForm(toVM(row));
    setErrors({});              // no need to compute field errors for read-only view, but we can keep formErr for any potential top-level messages
    setShowForm(true);
  };

  const cancelForm = () => {
    setViewing(false);
    setShowForm(false);
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
      const opts = editingId
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertArmourType(payload, opts);

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
        description: `Armourtype "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: ArmourType) => {
    const id = row?.id;
    if (!id) return;
    const ok = await confirm({
      title: 'Delete ArmourType',
      body: `Delete ArmourType "${id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(a => a.id !== id));
    try {
      await deleteArmourType(id);
      // if currently editing this item, close the form
      if (editingId === row.id) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `ArmourType "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // ----- Columns (Edit + Delete) -----
  const columns: ColumnDef<ArmourType>[] = useMemo(() => {
    return [
      { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 220 },
      { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
      { id: 'type', header: 'Type', accessor: r => r.type, minWidth: 80 },
      // { id: 'description', header: 'Description', accessor: r => r.description },
      { id: 'minManoeuvreMod', header: 'Min Manoeuvre Mod', accessor: (r) => r.minManoeuvreMod, sortType: 'number', align: 'center', width: 80 },
      { id: 'maxManoeuvreMod', header: 'Max Manoeuvre Mod', accessor: (r) => r.maxManoeuvreMod, sortType: 'number', align: 'center', width: 80 },
      { id: 'missileAttackPenalty', header: 'Missile Attack Penalty', accessor: (r) => r.missileAttackPenalty, sortType: 'number', align: 'center', width: 80 },
      { id: 'quicknessPenalty', header: 'Quickness Penalty', accessor: (r) => r.quicknessPenalty, sortType: 'number', align: 'center', width: 80 },
      { id: 'animalOnly', header: 'Animal Only', accessor: r => r.animalOnly, sortType: 'boolean', align: 'center', width: 80 },
      { id: 'includesGreaves', header: 'Includes Greaves', accessor: r => r.includesGreaves, sortType: 'boolean', align: 'center', width: 80 },
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
  }, [rows]); // allows closing form on self-delete

  // ----- Search -----
  const globalFilter = (a: ArmourType, q: string) => {
    const s = q.toLowerCase();
    return [
      a.id, a.name, a.type, a.description,
      a.minManoeuvreMod, a.maxManoeuvreMod,
      a.missileAttackPenalty, a.quicknessPenalty,
      a.animalOnly, a.includesGreaves,
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  // ----- Render -----
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Armour Types</h2>

      {/* Toolbar shown only when table visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Armour Type</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search armour types…"
            aria-label="Search armour types"
          />
          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>{viewing ? 'View Armour Type' : (editingId ? 'Edit Armour Type' : 'New Armour Type')}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />
            <LabeledInput label="Type" value={form.type} onChange={(v) => setForm(s => ({ ...s, type: v }))} disabled={viewing} error={errors.type} />
            <LabeledInput label="Description" value={form.description} onChange={(v) => setForm(s => ({ ...s, description: v }))} disabled={viewing} />

            <LabeledInput label="Min Manoeuvre Mod" value={String(form.minManoeuvreMod).trim()} disabled={viewing}
              onChange={makeSignedIntOnChange<typeof form>('minManoeuvreMod', setForm)}
              inputProps={{ inputMode: 'numeric', pattern: '\\d*', }} // mobile numeric keypad
              error={errors.minManoeuvreMod} />
            <LabeledInput label="Max Manoeuvre Mod" value={String(form.maxManoeuvreMod)} disabled={viewing}
              onChange={makeSignedIntOnChange<typeof form>('maxManoeuvreMod', setForm)}
              inputProps={{ inputMode: 'numeric', pattern: '\\d*', }} // mobile numeric keypad
              error={errors.maxManoeuvreMod} />
            <LabeledInput label="Missile Attack Penalty" value={String(form.missileAttackPenalty)} disabled={viewing}
              onChange={makeUnsignedIntOnChange<typeof form>('missileAttackPenalty', setForm)}
              inputProps={{ inputMode: 'numeric', pattern: '\\d*', }} // mobile numeric keypad
              error={errors.missileAttackPenalty} />
            <LabeledInput label="Quickness Penalty" value={String(form.quicknessPenalty)} disabled={viewing}
              onChange={makeUnsignedIntOnChange<typeof form>('quicknessPenalty', setForm)}
              inputProps={{ inputMode: 'numeric', pattern: '\\d*', }} // mobile numeric keypad
              error={errors.quicknessPenalty} />

            <CheckboxInput label="Animal Only" checked={form.animalOnly} onChange={(v) => setForm(s => ({ ...s, animalOnly: v }))} disabled={viewing} />
            <CheckboxInput label="Includes Greaves" checked={form.includesGreaves} onChange={(v) => setForm(s => ({ ...s, includesGreaves: v }))} disabled={viewing} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Shared DataTable */}
      {!showForm && (
        <DataTable<ArmourType>
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
          tableMinWidth={0} // Allow table to shrink below container width (enables horizontal scroll when needed)
          zebra
          // Resizable columns
          resizable
          persistKey="dt.armourtypes.v1"
          ariaLabel='ArmourTypes data'
        />
      )}

      {/* Empty dataset */}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No armour types found.
        </div>
      )}
    </>
  );
}

