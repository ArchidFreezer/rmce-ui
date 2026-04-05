import { AttackTableRow } from "./attacktable";
import type { Named } from "./base";

export interface SpecialAttackTable extends Named {
  small: number;
  medium: number;
  large: number;
  huge: number;
  maxRow: number;
  modifiedRows: AttackTableRow[];
  unmodifiedRows?: AttackTableRow[] | undefined;
}

export interface SpecialAttackTablesPayload {
  specialattacktables: SpecialAttackTable[];
}
