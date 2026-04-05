// src/types/weapontype.ts
import type { CriticalType } from './enum';
import type { Named } from './base';

export interface WeaponTypeCritical {
  critical: CriticalType;
  modifier: number;
}

export interface WeaponTypeRange {
  min: number;
  max: number;
  modifier: number;
}

export interface WeaponType extends Named {
  notes?: string | undefined;

  /** references Skill.id */
  skill: string;

  /** references Book.id */
  book: string;

  /** references AttackTable.id */
  attackTable: string;

  fumble: number;
  breakage: number;

  minLength: number;
  maxLength: number;

  minStrength: number;
  maxStrength: number;

  minWeight: number;
  maxWeight: number;

  woodenHaft: boolean;

  criticals: WeaponTypeCritical[];
  ranges: WeaponTypeRange[];
}

export interface WeaponTypesPayload {
  weapontypes: WeaponType[];
}