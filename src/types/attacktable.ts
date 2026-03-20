// ------------------------
// Attack Tables
// ------------------------
export interface AttackTableRow {
  min: number;
  max: number;
  at1: string;  at2: string;  at3: string;  at4: string;  at5: string;
  at6: string;  at7: string;  at8: string;  at9: string;  at10: string;
  at11: string; at12: string; at13: string; at14: string; at15: string;
  at16: string; at17: string; at18: string; at19: string; at20: string;
}

export interface AttackTable {
  id: string;
  name: string;
  /** Highest row index for the underlying table (e.g., 150) */
  maxRow: number;
  /** Overrides/patch rows for this weapon (ranges with 20 cells) */
  modifiedRows: AttackTableRow[];
  /** Optional explicit "unmodified" rows that always override defaults (same shape as modified) */
  unmodifiedRows?: AttackTableRow[] | undefined;
}

export interface AttackTablesPayload {
  attacktables: AttackTable[];
}