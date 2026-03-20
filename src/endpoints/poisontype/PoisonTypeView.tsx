// src/endpoints/poisontype/PoisontypesView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput, HtmlPreview } from '../../components/inputs';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

import { fetchPoisontypes, upsertPoisontype, deletePoisontype } from '../../api/poisontype';
import type { PoisonType } from '../../types/poisontype';
import { MALADY_SEVERITIES, MaladySeverity } from '../../types/enum';
import { isValidID, makeIDOnChange, isValidUnsignedInt, makeUnsignedIntOnChange } from '../../utils/inputHelpers';

const prefix = 'POISONTYPE_';

// ----- Local form VM types (strings for numeric editors to allow partial typing) -----
type EffectRowVM = { severity: MaladySeverity; min: string; max: string };
type SymptomRowVM = { severity: MaladySeverity; symptoms: string };

type FormState = {
  id: string;
  type: string;
  areasAffected: string;
  effectOnsets: EffectRowVM[]; // exactly 4 rows (Mild..Extreme)
  symptoms: SymptomRowVM[];    // exactly 4 rows (Mild..Extreme)
};

// Build an empty VM with all severities present
function emptyVM(): FormState {
  const mkEffect = (s: MaladySeverity): EffectRowVM => ({ severity: s, min: '', max: '' });
  const mkSymptom = (s: MaladySeverity): SymptomRowVM => ({ severity: s, symptoms: '' });
  return {
    id: prefix,
    type: '',
    areasAffected: '',
    effectOnsets: MALADY_SEVERITIES.map(mkEffect),
    symptoms: MALADY_SEVERITIES.map(mkSymptom),
  };
}

// Map API model -> VM
function toVM(p: PoisonType): FormState {
  const ensureOrder = <T extends { severity: MaladySeverity }>(arr: T[], builder: (s: MaladySeverity) => T): T[] => {
    const by = new Map(arr.map((r) => [r.severity, r]));
    return MALADY_SEVERITIES.map((s) => by.get(s) ?? builder(s));
  };
  return {
    id: p.id,
    type: p.type,
    areasAffected: p.areasAffected,
    effectOnsets: ensureOrder(
      p.severityEffectOnsets.map((r) => ({ severity: r.severity, min: String(r.min), max: String(r.max) })),
      (s) => ({ severity: s, min: '', max: '' })
    ),
    symptoms: ensureOrder(
      p.severitySymptoms.map((r) => ({ severity: r.severity, symptoms: r.symptoms })),
      (s) => ({ severity: s, symptoms: '' })
    ),
  };
}

// Map VM -> API model (convert min/max to numbers)
function fromVM(vm: FormState): PoisonType {
  return {
    id: vm.id.trim(),
    type: vm.type.trim(),
    areasAffected: vm.areasAffected.trim(),
    severityEffectOnsets: vm.effectOnsets.map((r) => ({
      severity: r.severity,
      min: Number(r.min),
      max: Number(r.max),
    })),
    severitySymptoms: vm.symptoms.map((r) => ({
      severity: r.severity,
      symptoms: r.symptoms.trim(),
    })),
  };
}

export default function PoisonTypeView() {
  const [rows, setRows] = useState<PoisonType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    id?: string; type?: string; areasAffected?: string;
    effectOnsets?: Record<MaladySeverity, string | undefined>;
    symptoms?: Record<MaladySeverity, string | undefined>;
  }>({});
  const hasErrors = Boolean(errors.id || errors.type || errors.areasAffected ||
    (errors.effectOnsets && MALADY_SEVERITIES.some((s) => errors.effectOnsets?.[s])) ||
    (errors.symptoms && MALADY_SEVERITIES.some((s) => errors.symptoms?.[s]))
  );

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);                         // read-only toggle

  const [form, setForm] = useState<FormState>(emptyVM());
  const toast = useToast();
  const confirm = useConfirm();

  // ----- Load -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchPoisontypes();
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

  // ----- Validation -----
  const computeErrors = (draft = form) => {
    if (viewing) return {};             // suppress inline errors in view mode

    const e: typeof errors = {};
    // ID
    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;
    // Type
    if (!draft.type.trim()) e.type = 'Type is required';
    // Areas affected
    if (!draft.areasAffected.trim()) e.areasAffected = 'Areas affected is required';

    // Check we have exactly one row per known severity (we always build that, but double-check)
    const seenOnsets = new Set<MaladySeverity>();
    const eo: Record<MaladySeverity, string | undefined> = {} as any;
    for (const r of draft.effectOnsets) {
      if (seenOnsets.has(r.severity)) eo[r.severity] = 'Duplicate severity';
      else seenOnsets.add(r.severity);

      if (r.min.trim() === '' || r.max.trim() === '') eo[r.severity] = 'Min and max are required';
      else if (!isValidUnsignedInt(r.min) || !isValidUnsignedInt(r.max)) eo[r.severity] = 'Min and max must be integers';
      else if (Number(r.min) > Number(r.max)) eo[r.severity] = 'Min must be ≤ max';
    }
    if (Object.keys(eo).some((k) => eo[k as MaladySeverity])) e.effectOnsets = eo;

    const seenSymptoms = new Set<MaladySeverity>();
    const sy: Record<MaladySeverity, string | undefined> = {} as any;
    for (const r of draft.symptoms) {
      if (seenSymptoms.has(r.severity)) sy[r.severity] = 'Duplicate severity';
      else seenSymptoms.add(r.severity);

      if (!r.symptoms.trim()) sy[r.severity] = 'Symptoms are required';
    }
    if (Object.keys(sy).some((k) => sy[k as MaladySeverity])) e.symptoms = sy;

    // Ensure all 4 severities present
    for (const s of MALADY_SEVERITIES) {
      if (!draft.effectOnsets.some((r) => r.severity === s)) (e.effectOnsets ??= {} as any)[s] = 'Missing severity';
      if (!draft.symptoms.some((r) => r.severity === s)) (e.symptoms ??= {} as any)[s] = 'Missing severity';
    }

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, editingId]); // keep current to avoid stale closure

  // ----- Actions -----
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyVM());
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: PoisonType) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: PoisonType) => {
    setViewing(false);
    setEditingId(null);
    // Create a copy of the row 
    const vm = toVM(row);
    vm.id = prefix; // Set the ID to a default value that the user must change
    vm.type += ' (Copy)'; // Append " (Copy)" to the type for clarity
    setForm(vm);
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: PoisonType) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
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

      await upsertPoisontype(payload, opts);

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
        description: `Poison type "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: PoisonType) => {
    const ok = await confirm({
      title: 'Delete Poison Type',
      body: `Delete poison type "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    // optimistic remove + rollback
    const prev = rows;
    setRows(prev.filter((r) => r.id !== row.id));
    try {
      await deletePoisontype(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Poison type "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // ----- Table -----
  const columns: ColumnDef<PoisonType>[] = useMemo(() => {
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

    const renderOnsets = (r: PoisonType) => {
      // “Mild: 1–50; Moderate: 3–30; …”
      const map = new Map(r.severityEffectOnsets.map(o => [o.severity, o]));
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MALADY_SEVERITIES.map((s) => {
            const o = map.get(s);
            return (
              <span key={s} title={`${s}: ${o ? `${o.min}–${o.max}` : '—'}`}>
                <strong>{s}</strong>: {o ? `${o.min}–${o.max}` : '—'}
              </span>
            );
          })}
        </div>
      );
    };

    // THis would be used if we were showing the symptoms in the table.
    // const renderSymptoms = (r: PoisonType) => {
    //   const map = new Map(r.severitySymptoms.map(o => [o.severity, o]));
    //   return (
    //     <div style={{ display: 'grid', gap: 4 }}>
    //       {MALADY_SEVERITIES.map((s) => {
    //         const o = map.get(s);
    //         return (
    //           <div key={s}>
    //             <strong>{s}</strong>: {o ? o.symptoms : '—'}
    //           </div>
    //         );
    //       })}
    //     </div>
    //   );
    // };

    return [
      { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 240 },
      { id: 'type', header: 'Type', accessor: (r) => r.type, sortType: 'string', minWidth: 160 },
      {
        id: 'areasAffected',
        header: 'Areas Affected',
        accessor: (r) => r.areasAffected,
        sortType: 'string',
        minWidth: 280,
        render: (r) => {
          const parts = r.areasAffected.split(',').map((x) => x.trim()).filter(Boolean);
          return <div style={{ display: 'flex', flexWrap: 'wrap' }}>{parts.map(pill)}</div>;
        },
      },
      {
        id: 'effectOnsets',
        header: 'Effect Onsets',
        accessor: (r) => r.severityEffectOnsets.length,
        sortType: 'number',
        minWidth: 360,
        render: renderOnsets,
      },
      // Symptoms can be very long, so we do not show them in the table and the full text in the form
      //   {
      //     id: 'symptoms',
      //     header: 'Symptoms',
      //     accessor: (r) => r.severitySymptoms.length,
      //     sortType: 'number',
      //     minWidth: 420,
      //     render: renderSymptoms,
      //   },
      {
        id: 'actions',
        header: 'Actions',
        sortable: false,
        width: 220,
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
  }, [rows]);

  // ----- Search -----
  const globalFilter = (r: PoisonType, q: string) => {
    const s = q.toLowerCase();
    const hay = [
      r.id, r.type, r.areasAffected,
      ...r.severityEffectOnsets.map(o => `${o.severity} ${o.min}-${o.max}`),
      ...r.severitySymptoms.map(o => `${o.severity} ${o.symptoms}`),
    ].join(' ').toLowerCase();
    return hay.includes(s);
  };

  // ----- Render -----
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Poison Types</h2>

      {/* Toolbar shown only when table visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Poison Type</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search poison types…"
            aria-label="Search poison types"
          />
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Poison Type' : (editingId ? 'Edit Poison Type' : 'New Poison Type')}
          </h3>

          {/* Basics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
            <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
            <LabeledInput label="Type" value={form.type} onChange={(v) => setForm(s => ({ ...s, type: v }))} disabled={viewing} error={errors.type} />
            <LabeledInput
              label="Areas Affected"
              value={form.areasAffected}
              onChange={(v) => setForm(s => ({ ...s, areasAffected: v }))}
              disabled={viewing}
              error={viewing ? undefined : errors.areasAffected}
              helperText="Comma-separated list (e.g., feet, legs, hands)"
            />
          </div>

          {/* Effect Onsets editor */}
          <section style={{ marginTop: 8 }}>
            <h4 style={{ margin: '8px 0' }}>Effect Onsets</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Severity</div>
              <div style={{ fontWeight: 600 }}>Min</div>
              <div style={{ fontWeight: 600 }}>Max</div>

              {form.effectOnsets.map((row, idx) => (
                <FragmentRowEffect
                  key={row.severity}
                  row={row}
                  error={viewing ? undefined : errors.effectOnsets?.[row.severity]}
                  disabled={viewing}
                  onChange={(next) => setForm(s => {
                    const copy = [...s.effectOnsets];
                    copy[idx] = next;
                    return { ...s, effectOnsets: copy };
                  })}
                />
              ))}
            </div>
          </section>

          {/* Symptoms editor */}
          <section style={{ marginTop: 16 }}>
            <h4 style={{ margin: '8px 0' }}>Symptoms</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Severity</div>
              <div style={{ fontWeight: 600 }}>Symptoms</div>

              {form.symptoms.map((row, idx) => (
                <FragmentRowSymptom
                  key={row.severity}
                  row={row}
                  error={viewing ? undefined : errors.symptoms?.[row.severity]}
                  disabled={viewing}
                  onChange={(next) => setForm(s => {
                    const copy = [...s.symptoms];
                    copy[idx] = next;
                    return { ...s, symptoms: copy };
                  })}
                />
              ))}
            </div>
          </section>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Shared DataTable */}
      {!showForm && (
        <DataTable<PoisonType>
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
          initialSort={{ colId: 'type', dir: 'asc' }}
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
          persistKey="dt.poisontype.v1"
          ariaLabel="Poison types"
        />
      )}

      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No poison types found.
        </div>
      )}
    </>
  );
}

// ----- Small subcomponents for row editors -----

function FragmentRowEffect({
  row,
  onChange,
  disabled,
  error,
}: {
  row: EffectRowVM;
  onChange: (next: EffectRowVM) => void;
  disabled?: boolean;
  error?: string | undefined;
}) {
  return (
    <>
      <div style={{ alignSelf: 'center', fontWeight: 600 }}>{row.severity}</div>
      <LabeledInput
        label="Min"
        value={row.min}
        onChange={(v) => onChange({ ...row, min: v.replace(/[^\d-]/g, '') })}
        disabled={disabled}
        inputProps={{ inputMode: 'numeric', pattern: '^-?\\d*$' }}
        error={error}
      />
      <LabeledInput
        label="Max"
        value={row.max}
        onChange={(v) => onChange({ ...row, max: v.replace(/[^\d-]/g, '') })}
        disabled={disabled}
        inputProps={{ inputMode: 'numeric', pattern: '^-?\\d*$' }}
        error={error}
      />
    </>
  );
}

function FragmentRowSymptom({
  row,
  onChange,
  disabled,
  error,
}: {
  row: SymptomRowVM;
  onChange: (next: SymptomRowVM) => void;
  disabled?: boolean | undefined;
  error?: string | undefined;
}) {
  const id = `sym-${row.severity}`;

  // Show preview by default in view mode; allow toggling at any time
  const [showPreview, setShowPreview] = React.useState<boolean>(!!disabled);
  React.useEffect(() => {
    if (disabled) setShowPreview(true);
  }, [disabled]);

  return (
    <>
      {/* Left column: severity label */}
      <div style={{ alignSelf: 'start', fontWeight: 600, paddingTop: 6 }}>
        {row.severity}
      </div>

      {/* Right column: editor/preview + toggle */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {/* <label htmlFor={id} style={{ fontWeight: 600 }}>Symptoms</label> - We don't want a label as it is clear from the table heading */}
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            // Allow toggling even in view mode (useful if you want to see raw HTML)
            aria-pressed={showPreview}
          >
            {disabled ? 'Raw' : showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {showPreview ? (
          <HtmlPreview
            html={row.symptoms}
            emptyHint="No symptoms provided"
            className="preview-html"
            style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
          />
        ) : (
          <label htmlFor={id} style={{ display: 'grid', gap: 6 }}>
            <textarea
              id={id}
              value={row.symptoms}
              onChange={(e) => onChange({ ...row, symptoms: e.target.value })}
              disabled={disabled}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              rows={3}
              style={{
                padding: 8,
                border: error ? '1px solid #b00020' : '1px solid var(--border)',
                outline: 'none',
                background: 'var(--bg)',
                color: 'var(--text)',
                resize: 'vertical',
              }}
            />
            {error && (
              <span id={`${id}-error`} style={{ color: '#b00020', fontSize: 12 }}>
                {error}
              </span>
            )}
          </label>
        )}
      </div>
    </>
  );
}