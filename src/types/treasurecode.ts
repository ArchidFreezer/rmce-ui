// ------------------------
// Treasure Codes
// ------------------------
import type { TreasureValueType } from './enum'; // adjust the relative path if needed
import type { Persistent } from './base';

export interface TreasureCode extends Persistent {
  itemsValueType: TreasureValueType;
  wealthValueType: TreasureValueType;
}

export interface TreasureCodesPayload {
  treasurecodes: TreasureCode[];
}