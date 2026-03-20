import { AttackTableRow } from "./attacktable";


export interface SpecialAttackTable {
  id: string;
  name: string;
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
