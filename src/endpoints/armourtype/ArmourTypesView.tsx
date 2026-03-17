import { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { fetchArmourTypes, upsertArmourType, deleteArmourType } from '../../api/armourtype';
import type { ArmourType } from '../../types/armourtype';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { CheckboxInput, LabeledInput } from '../../components/inputs';
import { isSignedIntegerString } from '../../components/inputs/validators';

export default function ArmourTypesView() {
  const [rows, setRows] = useState<ArmourType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state (Create & Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<ArmourType>(emptyArmourType());
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
  const [errors, setErrors] = useState<{ id?: string; name?: string; type?: string; numeric?: string }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.type || errors.numeric);
  const computeErrors = (draft: ArmourType, isEditing: boolean) => {
    if (viewing) return {}; // no errors in view mode

    const next: { id?: string; name?: string; type?: string; numeric?: string } = {};
    // ID (only on create, must be unique and start with prefix in ucase and contain additional characters)
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!isEditing && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    else if (!draft.id.trim().toUpperCase().startsWith('ARMOURTYPE_')) next.id = 'ID must start with "ARMOURTYPE_"';
    else if (draft.id.trim().length <= 11) next.id = 'ID must contain additional characters after "ARMOURTYPE_"';
    else if (!/^[A-Z0-9_]+$/.test(draft.id.trim())) next.id = 'ID can only contain uppercase letters, numbers and underscores';
    // Name
    if (!draft.name.trim()) next.name = 'Name is required';
    // Type
    if (!draft.type.trim()) next.type = 'Type is required';
    else if (!isEditing && rows.some(r => r.type === draft.type.trim())) next.type = `Type "${draft.type.trim()}" already exists`;
    else if (!/^AT [1-2]?[0-9]$/.test(draft.type.trim())) next.type = 'Type must follow the pattern "AT [1-2]?[0-9]"';
    // Numeric values
    if (!draft.minManoeuvreMod && draft.minManoeuvreMod !== 0) next.numeric = 'Min Manoeuvre Mod is required';
    else if (!isSignedIntegerString(String(draft.minManoeuvreMod))) next.numeric = 'Min Manoeuvre Mod must be an integer';
    if (!draft.maxManoeuvreMod && draft.maxManoeuvreMod !== 0) next.numeric = 'Max Manoeuvre Mod is required';
    else if (!isSignedIntegerString(String(draft.maxManoeuvreMod))) next.numeric = 'Max Manoeuvre Mod must be an integer';
    if (!draft.missileAttackPenalty && draft.missileAttackPenalty !== 0) next.numeric = 'Missile Attack Penalty is required';
    else if (!isSignedIntegerString(String(draft.missileAttackPenalty))) next.numeric = 'Missile Attack Penalty must be an integer';
    if (!draft.quicknessPenalty && draft.quicknessPenalty !== 0) next.numeric = 'Quickness Penalty is required';
    else if (!isSignedIntegerString(String(draft.quicknessPenalty))) next.numeric = 'Quickness Penalty must be an integer';
    return next;
  };

  useEffect(() => {
    if (!showForm) return;
    const isEditing = Boolean(editingId);
    setErrors(computeErrors(form, isEditing));
  }, [form, editingId, showForm]); // keep current

  // ----- Handlers (Create / Edit / Delete) -----
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyArmourType());
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: ArmourType) => {
    setViewing(false);
    setEditingId(row.id);
    setForm({ ...row });
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: ArmourType) => {
    setViewing(false);           // if you have viewing state; otherwise omit
    setEditingId(null);

    const next = { ...row };
    next.id = 'ARMOURTYPE_';
    next.name += ' (Copy)';

    setForm(next as any); // if your form state = ArmourType
    setErrors?.({});      // if you have an errors object
    setShowForm(true);
  };

  const startView = (row: ArmourType) => {
    setViewing(true);
    setEditingId(row.id);       // we can reuse editingId to preload the item, but we won't allow saving
    setForm({ ...row });
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
    const payload: ArmourType = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      type: String(form.type).trim(),
      description: String(form.description).trim(),
      minManoeuvreMod: Number(form.minManoeuvreMod),
      maxManoeuvreMod: Number(form.maxManoeuvreMod),
      missileAttackPenalty: Number(form.missileAttackPenalty),
      quicknessPenalty: Number(form.quicknessPenalty),
      animalOnly: Boolean(form.animalOnly),
      includesGreaves: Boolean(form.includesGreaves),
    };

    const nextErrors = computeErrors(payload, Boolean(editingId));
    setErrors(nextErrors);
    const topError = nextErrors.id || nextErrors.name || nextErrors.type || nextErrors.numeric || '';
    if (topError) return;

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
      { id: 'type', header: 'Type', accessor: r => r.type },
      // { id: 'description', header: 'Description', accessor: r => r.description },
      { id: 'minManoeuvreMod', header: 'Min Manoeuvre Mod', accessor: (r) => r.minManoeuvreMod, sortType: 'number', align: 'right' },
      { id: 'maxManoeuvreMod', header: 'Max Manoeuvre Mod', accessor: (r) => r.maxManoeuvreMod, sortType: 'number', align: 'right' },
      { id: 'missileAttackPenalty', header: 'Missile Attack Penalty', accessor: (r) => r.missileAttackPenalty, sortType: 'number', align: 'right' },
      { id: 'quicknessPenalty', header: 'Quickness Penalty', accessor: (r) => r.quicknessPenalty, sortType: 'number', align: 'right' },
      { id: 'animalOnly', header: 'Animal Only', accessor: r => r.animalOnly, sortType: 'boolean', align: 'center' },
      { id: 'includesGreaves', header: 'Includes Greaves', accessor: r => r.includesGreaves, sortType: 'boolean', align: 'center' },
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

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Armour Type' : 'New Armour Type'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={(v) => setForm(s => ({ ...s, id: v }))} disabled={!!editingId || viewing} error={errors.id} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />
            <LabeledInput label="Type" value={form.type} onChange={(v) => setForm(s => ({ ...s, type: v }))} disabled={viewing} error={errors.type} />
            <LabeledInput label="Description" value={form.description} onChange={(v) => setForm(s => ({ ...s, description: v }))} disabled={viewing} />

            <LabeledInput label="Min Manoeuvre Mod" value={String(form.minManoeuvreMod).trim()} disabled={viewing}
              onChange={(v) => setForm((s) => {
                // Sanitize: keep at most one leading '-', strip all other non-digits
                // 1) Remove everything except digits and '-'
                let raw = v.replace(/[^-\d]+/g, '');
                // 2) If there are multiple '-', keep only the first
                const firstDash = raw.indexOf('-');
                if (firstDash !== -1) {
                  raw = '-' + raw.slice(firstDash + 1).replace(/-/g, '');
                }
                // 3) Allow raw === '-' temporarily so users can type the sign first;
                //    validation will show an error until at least one digit is added.
                return { ...s, minManoeuvreMod: Number(raw) };
              })}
              inputProps={{ inputMode: 'numeric', pattern: '\\d*', }} // mobile numeric keypad
              error={errors.numeric} />
            <LabeledInput label="Max Manoeuvre Mod" value={String(form.maxManoeuvreMod)} disabled={viewing}
              onChange={(v) => setForm((s) => {
                // Sanitize: keep at most one leading '-', strip all other non-digits
                // 1) Remove everything except digits and '-'
                let raw = v.replace(/[^-\d]+/g, '');
                // 2) If there are multiple '-', keep only the first
                const firstDash = raw.indexOf('-');
                if (firstDash !== -1) {
                  raw = '-' + raw.slice(firstDash + 1).replace(/-/g, '');
                }
                // 3) Allow raw === '-' temporarily so users can type the sign first;
                //    validation will show an error until at least one digit is added.
                return { ...s, maxManoeuvreMod: Number(raw) };

              })}
              error={errors.numeric && errors.numeric.includes('maxManoeuvreMod') ? errors.numeric : undefined}
            />
            <LabeledInput label="Missile Attack Penalty" value={String(form.missileAttackPenalty)} disabled={viewing}
              onChange={(v) => setForm((s) => {
                // Sanitize: keep at most one leading '-', strip all other non-digits
                // 1) Remove everything except digits and '-'
                let raw = v.replace(/[^-\d]+/g, '');
                // 2) If there are multiple '-', keep only the first
                const firstDash = raw.indexOf('-');
                if (firstDash !== -1) {
                  raw = '-' + raw.slice(firstDash + 1).replace(/-/g, '');
                }
                // 3) Allow raw === '-' temporarily so users can type the sign first;
                //    validation will show an error until at least one digit is added.
                return { ...s, missileAttackPenalty: Number(raw) };

              })}
              error={errors.numeric && errors.numeric.includes('missileAttackPenalty') ? errors.numeric : undefined}
            />
            <LabeledInput label="Quickness Penalty" value={String(form.quicknessPenalty)} disabled={viewing}
              onChange={(v) => setForm((s) => {
                // Sanitize: keep at most one leading '-', strip all other non-digits
                // 1) Remove everything except digits and '-'
                let raw = v.replace(/[^-\d]+/g, '');
                // 2) If there are multiple '-', keep only the first
                const firstDash = raw.indexOf('-');
                if (firstDash !== -1) {
                  raw = '-' + raw.slice(firstDash + 1).replace(/-/g, '');
                }
                // 3) Allow raw === '-' temporarily so users can type the sign first;
                //    validation will show an error until at least one digit is added.
                return { ...s, quicknessPenalty: Number(raw) };

              })}
              error={errors.numeric && errors.numeric.includes('quicknessPenalty') ? errors.numeric : undefined}
            />

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
        <>
          {/* New + Search */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
            <button onClick={startNew}>New Armour type</button>
            <DataTableSearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search armour types…"
              aria-label="Search armour types"
            />
          </div>

          <DataTable<ArmourType>
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
        </>
      )}

      {/* Empty dataset */}
      {!rows.length && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No armour types found.
        </div>
      )}
    </>
  );
}

function emptyArmourType(): ArmourType {
  return {
    id: 'ARMOURTYPE_',
    name: '',
    type: '',
    description: '',
    minManoeuvreMod: 0,
    maxManoeuvreMod: 0,
    missileAttackPenalty: 0,
    quicknessPenalty: 0,
    animalOnly: false,
    includesGreaves: false,
  };
}