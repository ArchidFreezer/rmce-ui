import { fetchJson, sendJson } from './client';

import type {
  Animal,
  AnimalAttackBase,
  AnimalsPayload,
} from '../types';

import {
  ANIMAL_OUTLOOK_TYPES,
  asFeatureArray,
  asTerrainArray,
  asVegetationArray,
  asWaterBodyArray,
  ATTACK_SIZE_TYPES,
  CREATURE_BONUS_XP_TYPES,
  CREATURE_CONSTITUTION_VARIANCE_TYPES,
  CREATURE_MOVEMENT_SPEED_TYPES,
  CREATURE_SIZES,
  CRITICAL_MODIFIER_TYPES,
  CRITICAL_SIZE_TABLE_TYPES,
  CRITICAL_SIZES,
  CRITICAL_TYPES,
  LEVEL_VARIANCE_TYPES,
  type AnimalOutlookType,
  type AttackSizeType,
  type CreatureBonusXpType,
  type CreatureConstitutionVarianceType,
  type CreatureMovementSpeedType,
  type CreatureSize,
  type CriticalModifierType,
  type CriticalSize,
  type CriticalSizeTableType,
  type CriticalType,
  type LevelVarianceType,
} from '../types/enum';

const BASE = '/rmce/objects/animal';

const asString = (v: unknown) => String(v ?? '');
const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean) : [];

function asOptionalInt(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = asInt(v);
  return Number.isFinite(n) ? n : undefined;
}

function rangeFromJson(x: any): Animal['encounterRange'] {
  if (x == null) return undefined;
  return {
    min: asInt(x?.min),
    max: asInt(x?.max),
  };
}

function asEnumValue<T extends string>(values: readonly T[], v: unknown, fallback: T): T {
  const s = asString(v);
  return (values as readonly string[]).includes(s) ? (s as T) : fallback;
}

function nonWeaponAttackFromJson(x: any): NonNullable<Animal['standardAttacks'][number]['nonWeaponAttack']> {
  return {
    table: asString(x?.table),
    size: asEnumValue(ATTACK_SIZE_TYPES, x?.size, 'Medium' as AttackSizeType),
  };
}

function attackBaseFromJson(x: any): AnimalAttackBase {
  return {
    offensiveBonus: asInt(x?.offensiveBonus),
    weaponAttack: x?.weaponAttack != null ? asString(x.weaponAttack) : undefined,
    nonWeaponAttack: x?.nonWeaponAttack != null ? nonWeaponAttackFromJson(x.nonWeaponAttack) : undefined,
    useAllAttacks: asBool(x?.useAllAttacks),
    attacksPerRound: asOptionalInt(x?.attacksPerRound) ?? 1,
    special: x?.special != null ? asString(x.special) : undefined,
    poison: x?.poison != null ? asString(x.poison) : undefined,
    disease: x?.disease != null ? asString(x.disease) : undefined,
    autoCriticalType: x?.autoCriticalType != null
      ? asEnumValue(CRITICAL_TYPES, x.autoCriticalType, 'Brawling' as CriticalType)
      : undefined,
    autoCriticalSize: x?.autoCriticalSize != null
      ? asEnumValue(CRITICAL_SIZES, x.autoCriticalSize, 'A' as CriticalSize)
      : undefined,
    sameRoundConditionalAttackId: x?.sameRoundConditionalAttackId != null ? asInt(x.sameRoundConditionalAttackId) : undefined,
    nextRoundConditionalAttackId: x?.nextRoundConditionalAttackId != null ? asInt(x.nextRoundConditionalAttackId) : undefined,
  };
}

function standardAttackFromJson(x: any): Animal['standardAttacks'][number] {
  return {
    ...attackBaseFromJson(x),
    chanceMin: asInt(x?.chanceMin),
    chanceMax: asInt(x?.chanceMax),
  };
}

function rangedAttackFromJson(x: any): Animal['rangedAttacks'][number] {
  const base = attackBaseFromJson(x);
  return {
    ...base,
    range: asInt(x?.range),
  };
}

function conditionalAttackFromJson(x: any): Animal['conditionalAttacks'][number] {
  const base = attackBaseFromJson(x);
  return {
    ...base,
    id: asInt(x?.id),
  };
}

function groupAttackFromJson(x: any): Animal['groupAttacks'][number] {
  const base = attackBaseFromJson(x);
  return {
    ...base,
    minGroupSize: asInt(x?.minGroupSize ?? x?.['min-group-size']),
  };
}

function criticalModifiersFromJson(v: unknown): CriticalModifierType[] {
  if (Array.isArray(v)) {
    return v
      .map((value: unknown) => asString(value))
      .filter((value: string): value is CriticalModifierType => (CRITICAL_MODIFIER_TYPES as readonly string[]).includes(value));
  }
  if (v != null) {
    const value = asString(v);
    return (CRITICAL_MODIFIER_TYPES as readonly string[]).includes(value)
      ? [value as CriticalModifierType]
      : [];
  }
  return [];
}

function fromJson(x: any): Animal {
  return {
    id: asString(x?.id),
    name: asString(x?.name),
    description: x?.description != null ? asString(x.description) : undefined,
    baseHits: asInt(x?.baseHits),
    baseMovement: asInt(x?.baseMovement),
    defensiveBonus: asInt(x?.defensiveBonus),
    frequencyCode: asInt(x?.frequencyCode),
    carryCapacity: asOptionalInt(x?.carryCapacity),
    ridingBonus: asOptionalInt(x?.ridingBonus),
    bonusXpCode: asEnumValue(CREATURE_BONUS_XP_TYPES, x?.bonusXpCode, 'None' as CreatureBonusXpType),
    constitutionVarianceType: asEnumValue(CREATURE_CONSTITUTION_VARIANCE_TYPES, x?.constitutionVarianceType, 'None' as CreatureConstitutionVarianceType),
    levelVarianceType: asEnumValue(LEVEL_VARIANCE_TYPES, x?.levelVarianceType, 'None' as LevelVarianceType),
    averageLevel: asInt(x?.averageLevel),
    treasureCode: x?.treasureCode != null ? asString(x.treasureCode) : undefined,
    size: asEnumValue(CREATURE_SIZES, x?.size, 'Medium' as CreatureSize),
    armourType: x?.armourType != null ? asString(x.armourType) : undefined,
    movementSpeed: asEnumValue(CREATURE_MOVEMENT_SPEED_TYPES, x?.movementSpeed, 'Medium' as CreatureMovementSpeedType),
    attackQuickness: asEnumValue(CREATURE_MOVEMENT_SPEED_TYPES, x?.attackQuickness, 'Medium' as CreatureMovementSpeedType),
    maxPace: x?.maxPace != null ? asString(x.maxPace) : undefined,
    outlook: asEnumValue(ANIMAL_OUTLOOK_TYPES, x?.outlook, 'Normal' as AnimalOutlookType),
    criticalTable: asEnumValue(CRITICAL_SIZE_TABLE_TYPES, x?.criticalTable, 'Normal' as CriticalSizeTableType),
    criticalModifiers: criticalModifiersFromJson(x?.criticalModifiers),
    encounterRange: rangeFromJson(x?.encounterRange),
    numberYoungRange: rangeFromJson(x?.numberYoungRange),
    location: x?.location != null
      ? {
          features: asFeatureArray(x.location.features),
          terrains: asTerrainArray(x.location.terrains),
          vegetation: asVegetationArray(x.location.vegetation),
          waterSources: asWaterBodyArray(x.location.waterSources),
          climates: asStringArray(x.location.climates),
        }
      : undefined,
    standardAttacks: Array.isArray(x?.standardAttacks) ? x.standardAttacks.map(standardAttackFromJson) : [],
    rangedAttacks: Array.isArray(x?.rangedAttacks) ? x.rangedAttacks.map(rangedAttackFromJson) : [],
    conditionalAttacks: Array.isArray(x?.conditionalAttacks) ? x.conditionalAttacks.map(conditionalAttackFromJson) : [],
    groupAttacks: Array.isArray(x?.groupAttacks) ? x.groupAttacks.map(groupAttackFromJson) : [],
  };
}

export async function fetchAnimals(): Promise<Animal[]> {
  const data = await fetchJson<AnimalsPayload>(BASE);
  if (!data || !Array.isArray((data as any).animals)) {
    throw new Error('Unexpected response: expected { animals: [...] }');
  }
  return (data as any).animals.map(fromJson);
}

export async function upsertAnimal(
  animal: Animal,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url =
    useResourceIdPath && animal.id
      ? `${BASE}/${encodeURIComponent(animal.id)}`
      : `${BASE}/`;
  return sendJson(url, method, animal);
}

export async function deleteAnimal(id: string) {
  if (!id) throw new Error('deleteAnimal: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}