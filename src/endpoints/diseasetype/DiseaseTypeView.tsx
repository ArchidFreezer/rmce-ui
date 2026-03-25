import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchDiseasetypes, upsertDiseasetype, deleteDiseasetype,
  deleteTrainingPackage
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  LabeledInput,
  MarkupPreview,
  Spinner,
  useConfirm, useToast,
} from '../../components';


import type {
  DiseaseType,
} from '../../types';

import {
  MALADY_SEVERITIES, MaladySeverity,
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
} from '../../utils/inputHelpers';

const prefix = 'DISEASETYPE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type SymptomRowVM = { severity: MaladySeverity; symptoms: string };

type FormState = {
  id: string;
  type: string;
  transmission: string;
  description: string;
  symptoms: SymptomRowVM[]; // Mild..Extreme (exactly 4)
};

type FormErrors = {
  id?: string;
  type?: string;
  transmission?: string;
  description?: string;
  symptoms?: Record<MaladySeverity, string | undefined>;
};

function emptyVM(): FormState {
  const mkSymptom = (s: MaladySeverity): SymptomRowVM => ({ severity: s, symptoms: '' });
  return {
    id: prefix,
    type: '',
    transmission: '',
    description: '',
    symptoms: MALADY_SEVERITIES.map(mkSymptom),
  };
}

// Map API model -> VM
function toVM(d: DiseaseType): FormState {
  const by = new Map(d.severitySymptoms.map((x) => [x.severity, x]));
  return {
    id: d.id,
    type: d.type,
    transmission: d.transmission,
    description: d.description,
    symptoms: MALADY_SEVERITIES.map((s) => {
      const r = by.get(s);
      return { severity: s, symptoms: r ? r.symptoms : '' };
    }),
  };
}

// Map VM -> API model (compute from form state, trim strings, etc.)
function fromVM(vm: FormState): DiseaseType {
  return {
    id: vm.id.trim(),
    type: vm.type.trim(),
    transmission: vm.transmission.trim(),
    description: vm.description.trim(),
    severitySymptoms: vm.symptoms.map((r) => ({ severity: r.severity, symptoms: r.symptoms.trim() })),
  };
}

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function DiseaseTypeView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<DiseaseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const [previewDescription, setPreviewDescription] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [tp] = await Promise.all([
          fetchDiseasetypes(),

        ]);
        setRows(tp);

      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */

  const computeErrors = (draft: FormState): FormErrors => {
    const e: typeof errors = {};

    // ID: required, unique (when creating), format (starts with DISEASETYPE_, only uppercase letters/numbers/underscores, etc.)
    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id.trim(), prefix)) e.id = `ID must start with "${prefix}" and contain only uppercase letters, numbers, and underscores`;

    // Type, Transmission, Description: required
    if (!draft.type.trim()) e.type = 'Type is required';
    if (!draft.transmission.trim()) e.transmission = 'Transmission is required';
    if (!draft.description.trim()) e.description = 'Description is required';

    const sy: Record<MaladySeverity, string | undefined> = {} as any;
    const seen = new Set<MaladySeverity>();
    for (const r of draft.symptoms) {
      if (seen.has(r.severity)) sy[r.severity] = 'Duplicate severity';
      else seen.add(r.severity);
      if (!r.symptoms.trim()) sy[r.severity] = 'Symptoms are required';
    }

    // Ensure all severities
    for (const s of MALADY_SEVERITIES) {
      if (!draft.symptoms.some((r) => r.severity === s)) sy[s] = 'Missing severity';
    }
    if (MALADY_SEVERITIES.some((s) => sy[s])) e.symptoms = sy;

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]); // keep current with form changes for live validation (but skip in view mode)


  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<DiseaseType>[] = [
    { id: 'id', header: 'ID', accessor: (r) => r.id, minWidth: 260 },
    { id: 'type', header: 'Type', accessor: (r) => r.type, minWidth: 160 },
    { id: 'transmission', header: 'Transmission', accessor: (r) => r.transmission, minWidth: 160 },
    { id: 'description', header: 'Description', accessor: (r) => r.description, minWidth: 320 },
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
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
  ];


  const globalFilter = (r: DiseaseType, q: string) => {
    const s = q.toLowerCase();
    const hay = [
      r.id, r.type, r.transmission, r.description,
      ...r.severitySymptoms.map(o => `${o.severity} ${o.symptoms}`),
    ].join(' ').toLowerCase();
    return hay.includes(s);
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

  const startView = (row: DiseaseType) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: DiseaseType) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: DiseaseType) => {
    setViewing(false);
    setEditingId(null);
    const vm = toVM(row);
    vm.id = prefix;
    vm.type += ' (Copy)';
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

      await upsertDiseasetype(payload, opts);

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
        description: `Disease Type "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: DiseaseType) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Disease Type',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter((r) => r.id !== row.id));

    try {
      await deleteDiseasetype(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Disease Type "${row.id}" deleted.` });
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
      <h2>Disease Types</h2>

      {/* Toolbar shown only when table visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Disease Type</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search disease types…"
            aria-label="Search disease types"
          />

          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Disease Type</h3>

            {/* Basics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
              <LabeledInput label="Type" value={form.type} onChange={(v) => setForm(s => ({ ...s, type: v }))} disabled={viewing} error={errors.type} />
              <LabeledInput label="Transmission" value={form.transmission} onChange={(v) => setForm(s => ({ ...s, transmission: v }))} disabled={viewing} error={errors.transmission} />
            </div>

            {/* Description */}
            <section style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ margin: '8px 0' }}>Description</h4>
                {!viewing && (
                  <button type="button" onClick={() => setPreviewDescription((p) => !p)}>
                    {previewDescription ? 'Edit' : 'Preview'}
                  </button>
                )}
              </div>
              {previewDescription || viewing ? (
                <MarkupPreview
                  content={form.description}
                  emptyHint="No description"
                  className="preview-html"
                  style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
                />
              ) : (
                <label style={{ display: 'grid', gap: 6 }}>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    disabled={viewing}
                    rows={5}
                  />
                </label>
              )}
            </section>

            {/* Symptoms editor */}
            <section style={{ marginTop: 8 }}>
              <h4 style={{ margin: '8px 0' }}>Severity Symptoms</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Severity</div>
                <div style={{ fontWeight: 600 }}>Symptoms</div>

                {form.symptoms.map((row, idx) => (
                  <FragmentRowSymptom
                    key={row.severity}
                    row={row}
                    error={errors.symptoms?.[row.severity]}
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
        </div>
      )}

      {/* Shared DataTable */}
      {!showForm && (
        <DataTable
          ref={dtRef}
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
          initialSort={{ colId: 'type', dir: 'asc' }} //
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
          persistKey="dt.diseasetype.v1"
          ariaLabel='Disease types'
        />
      )}
    </>
  );
}

// --- Subcomponent (textarea row) ---
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
          {!disabled && (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              // Allow toggling even in view mode (useful if you want to see raw HTML)
              aria-pressed={showPreview}
            >
              {disabled ? 'Raw' : showPreview ? 'Edit' : 'Preview'}
            </button>
          )}
        </div>

        {showPreview ? (
          <MarkupPreview
            content={row.symptoms}
            emptyHint="No symptoms provided"
            className="preview-html"
            format="markdown"
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
