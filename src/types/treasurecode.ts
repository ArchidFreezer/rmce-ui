// ------------------------
// Treasure Codes
// ------------------------
import type { TreasureValueType } from './enum'; // adjust the relative path if needed

export interface TreasureCode {
  id: string;
  itemsValueType: TreasureValueType;
  wealthValueType: TreasureValueType;
}

export interface TreasureCodesPayload {
  treasurecodes: TreasureCode[];
}