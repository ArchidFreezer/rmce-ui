import { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { fetchArmourtypes, upsertArmourtype, deleteArmourtype } from '../../api/armourtypes';
import type { Armourtype } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { CheckboxInput, LabeledInput } from '../../components/inputs';
import { isSignedIntegerString } from '../../components/inputs/validators';

type ArmourNumberKey =
  | 'minManoeuvreMod'
  | 'maxManoeuvreMod'
  | 'missileAttackPenalty'
  | 'quicknessPenalty';

type ArmourBooleanKey = 'animalOnly' | 'includesGreaves';
type ArmourStringKey = Exclude<keyof Armourtype, ArmourNumberKey | ArmourBooleanKey>;

const NUM_KEYS: ArmourNumberKey[] = [
  'minManoeuvreMod',
  'maxManoeuvreMod',
  'missileAttackPenalty',
  'quicknessPenalty',
];

export default function ArmourtypesView() {
  const [rows, setRows] = useState<Armourtype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state (Create & Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Armourtype>(emptyArmourtype());
  const [formErr, setFormErr] = useState('');// legacy single message (kept for top-level)
  const toast = useToast();
  const confirm = useConfirm();

  // ----- Load -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchArmourtypes();
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
  const computeErrors = (draft: Armourtype, isEditing: boolean) => {
    const next: { id?: string; name?: string; type?: string; numeric?: string } = {};
    // ID (only on create, must be unique and start with prefix in ucase and contain additional characters)
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!isEditing && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    if (!draft.id.trim().toUpperCase().startsWith('ARMOURTYPE_')) next.id = 'ID must start with "ARMOURTYPE_"';
    if (!/^[A-Z0-9_]+$/.test(draft.id.trim())) next.id = 'ID can only contain uppercase letters, numbers and underscores';
    if (draft.id.trim().length <= 11) next.id = 'ID must contain additional characters after "ARMOURTYPE_"';
    // Name
    if (!draft.name.trim()) next.name = 'Name is required';
    // Type
    if (!draft.type.trim()) next.type = 'Type is required';

    // Numeric values
    for (const k of NUM_KEYS) {
      const raw = (draft[k] ?? '').toString().trim();
      if (!isSignedIntegerString(raw)) next.numeric = `${k} must be an integer`;
    }
    return next;
  };

  useEffect(() => {
    if (!showForm) return;
    const isEditing = Boolean(editingId);
    setErrors(computeErrors(form, isEditing));
  }, [form, editingId, showForm]); // keep current

  // ----- Handlers (Create / Edit / Delete) -----
  const startNew = () => {
    setEditingId(null);
    setForm(emptyArmourtype());
    setErrors({});
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row: Armourtype) => {
    setEditingId(row.id);
    setForm({ ...row });
    setFormErr('');
    setErrors({});
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
    setFormErr('');
  };

  const saveForm = async () => {
    // Normalize payload (strings -> numbers for numeric fields)
    const payload: Armourtype = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      type: String(form.type).trim(),
      description: String(form.description ?? ''),
      minManoeuvreMod: Number(form.minManoeuvreMod),
      maxManoeuvreMod: Number(form.maxManoeuvreMod),
      missileAttackPenalty: Number(form.missileAttackPenalty),
      quicknessPenalty: Number(form.quicknessPenalty),
      animalOnly: Boolean(form.animalOnly),
      includesGreaves: Boolean(form.includesGreaves),
    };

    const nextErrors = computeErrors(payload, Boolean(editingId));
    setErrors(nextErrors);
    const topError = nextErrors.id || nextErrors.name || nextErrors.type || '';
    if (topError) { setFormErr(topError); return; }

    const isEditing = Boolean(editingId);
    try {
      const opts = editingId
        ? { method: 'POST' as const, useResourceIdPath: false } // or PUT+id if your API prefers
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertArmourtype(payload, opts);

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
      setFormErr('');
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

  const onDelete = async (row: Armourtype) => {
    const id = row?.id;
    if (!id) return;
    const ok = await confirm({
      title: 'Delete Armourtype',
      body: `Delete armourtype "${id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(a => a.id !== id));
    try {
      await deleteArmourtype(id);
      // if currently editing this item, close the form
      if (editingId === row.id) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Armourtype "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // ----- Columns (Edit + Delete) -----
  const columns: ColumnDef<Armourtype>[] = useMemo(() => {
    return [
      { id: 'id', header: 'id', accessor: (r) => r.id, sortType: 'string', minWidth: 220 },
      { id: 'name', header: 'name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
      { id: 'type', header: 'Type', accessor: r => r.type },
      { id: 'description', header: 'Description', accessor: r => r.description },
      { id: 'minManoeuvreMod', header: 'Min Manoeuvre Mod', accessor: (r) => r.minManoeuvreMod, sortType: 'number', align: 'right' },
      { id: 'maxManoeuvreMod', header: 'Max Manoeuvre Mod', accessor: (r) => r.maxManoeuvreMod, sortType: 'number', align: 'right' },
      { id: 'missileAttackPenalty', header: 'Missile Attack Penalty', accessor: (r) => r.missileAttackPenalty, sortType: 'number', align: 'right' },
      { id: 'quicknessPenalty', header: 'Quickness Penalty', accessor: (r) => r.quicknessPenalty, sortType: 'number', align: 'right' },
      { id: 'animalOnly', header: 'Animal Only', accessor: r => r.animalOnly, sortType: 'boolean', align: 'center' },
      { id: 'includesGreaves', header: 'Includes Greaves', accessor: r => r.includesGreaves, sortType: 'boolean', align: 'center' },
      {
        id: 'actions',
        header: 'actions',
        sortable: false,
        width: 160,
        render: (row) => (
          <>
            <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
            <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
          </>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, editingId]); // allows closing form on self-delete

  // ----- Search -----
  const globalFilter = (a: Armourtype, q: string) => {
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

      {/* New + Search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <button onClick={startNew}>New Armourtype</button>
        <DataTableSearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search armourtypes…"
          aria-label="Search armourtypes"
        />
      </div>

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Armourtype' : 'New Armourtype'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={(v) => setForm(s => ({ ...s, id: v }))} disabled={!!editingId} error={errors.id} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} error={errors.name} />
            <LabeledInput label="Type" value={form.type} onChange={(v) => setForm(s => ({ ...s, type: v }))} error={errors.type} />
            <LabeledInput label="Description" value={form.description} onChange={(v) => setForm(s => ({ ...s, description: v }))} />

            <LabeledInput
              label="Min Manoeuvre Mod"
              value={String(form.minManoeuvreMod).trim()}
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
              inputProps={{
                inputMode: 'numeric', // mobile numeric keypad
                pattern: '\\d*',
              }}
              error={errors.numeric} />
            <LabeledInput
              label="Max Manoeuvre Mod"
              value={String(form.maxManoeuvreMod)}
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
            <LabeledInput
              label="Missile Attack Penalty"
              value={String(form.missileAttackPenalty)}
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
            <LabeledInput
              label="Quickness Penalty"
              value={String(form.quicknessPenalty)}
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

            <CheckboxInput
              label="Animal Only"
              checked={form.animalOnly}
              onChange={(v) => setForm(s => ({ ...s, animalOnly: v }))}
            />
            <CheckboxInput
              label="Includes Greaves"
              checked={form.includesGreaves}
              onChange={(v) => setForm(s => ({ ...s, includesGreaves: v }))}
            />
          </div>

          {formErr && <div style={{ color: 'crimson', marginTop: 8 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveForm} disabled={hasErrors}>Save</button>
            <button onClick={cancelForm} type="button">Cancel</button>
          </div>
        </div>
      )}

      {/* Shared DataTable */}
      <DataTable<Armourtype>
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
      {!rows.length && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No armour types found.
        </div>
      )}

    </>
  );
}

function emptyArmourtype(): Armourtype {
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