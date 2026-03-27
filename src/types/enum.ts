/** Enum plus reusable list for form checkboxes */
export type Precipitation = 'Rainy' | 'Humid' | 'Temperate' | 'Dry' | 'Arid';
export const PRECIPITATIONS: ReadonlyArray<Precipitation> = [
  'Rainy',
  'Humid',
  'Temperate',
  'Dry',
  'Arid',
] as const;

/** Enum plus reusable list for form checkboxes */
export type Temperature = 'Hot' | 'Warm' | 'Temperate' | 'Cool' | 'Cold';
export const TEMPERATURES: ReadonlyArray<Temperature> = [ 'Hot', 'Warm', 'Temperate', 'Cool', 'Cold'] as const;

/** Enum for moving manoeuvres reusable list for form checkboxes */
export type ManoeuvreDifficulty = 'Normal' | 'Routine' | 'Easy' | 'Light' | 'Medium' | 'Hard' | 'Very Hard' | 'Extremely Hard' | 'Sheer Folly' | 'Absurd'
export const MANOEUVRE_DIFFICULTIES: ReadonlyArray<ManoeuvreDifficulty> = [
  'Normal', 'Routine', 'Easy', 'Light', 'Medium', 'Hard', 'Very Hard', 'Extremely Hard', 'Sheer Folly', 'Absurd'
] as const;

/** Enum for disease and poison severity reusable list for form dropdowns */
export type MaladySeverity = 'Mild' | 'Moderate' | 'Severe' | 'Extreme';
export const MALADY_SEVERITIES: ReadonlyArray<MaladySeverity> = ['Mild', 'Moderate', 'Severe', 'Extreme'] as const;

/** Enum for realms */
export type Realm = 'Arcane' | 'Arms' | 'Channeling' | 'Essence' | 'Mentalism' | 'Neutral';
export const REALMS: ReadonlyArray<Realm> = ['Arcane', 'Arms', 'Channeling', 'Essence', 'Mentalism', 'Neutral'] as const;
export const SPELL_REALMS: ReadonlyArray<Realm> = ['Arcane', 'Channeling', 'Essence', 'Mentalism', 'Neutral'] as const;

/** Enum for spell types */
export type SpellType = 'Base' | 'Closed' | 'Open' | 'Racial' | 'Training Package';
export const SPELL_TYPES: ReadonlyArray<SpellType> = ['Base', 'Closed', 'Open', 'Racial', 'Training Package'] as const;

/** Enum for stats */
export type Stat = 'Agility' | 'Constitution' | 'Empathy' | 'Intuition' | 'Memory' | 'Presence' | 'Quickness' | 'Reasoning' | 'Self Discipline' | 'Strength';
export const STATS: ReadonlyArray<Stat> = ['Agility', 'Constitution', 'Empathy', 'Intuition', 'Memory', 'Presence', 'Quickness', 'Reasoning', 'Self Discipline', 'Strength'] as const;
export const DEVELOPMENT_STATS: ReadonlyArray<Stat> = ['Agility', 'Constitution', 'Empathy', 'Intuition', 'Memory'] as const;

/** Enum for treasure value types */
export type TreasureValueType = 'Very Poor' | 'Poor' | 'Normal' | 'Rich' | 'Very Rich' | 'Special';
export const TREASUREVALUETYPES: ReadonlyArray<TreasureValueType> = ['Very Poor', 'Poor', 'Normal', 'Rich', 'Very Rich', 'Special'] as const;

/** Enum for Environment features */
export type EnvironmentFeature = 'Battlefield' | 'Burial' | 'Cave' | 'Cavern' | 'Dimention' | 'Enchanted' | 'Habitation' | 'Ruins' | 'Rural' | 'Volcanic';
export const ENVIRONMENT_FEATURES: ReadonlyArray<EnvironmentFeature> = ['Battlefield', 'Burial', 'Cave', 'Cavern', 'Dimention', 'Enchanted', 'Habitation', 'Ruins', 'Rural', 'Volcanic'] as const;
const FEATURE_SET = new Set<EnvironmentFeature>(ENVIRONMENT_FEATURES);
export function asFeatureArray(v: unknown): EnvironmentFeature[] {
  if (!Array.isArray(v)) return [];
  const out: EnvironmentFeature[] = [];
  for (const x of v) {
    const s = String(x) as EnvironmentFeature;
    if (FEATURE_SET.has(s)) out.push(s);
  }
  return out;
}

/** Enum for Environment terrain  */
export type EnvironmentTerrain = 'Alpine' | 'Rough' | 'Underground' | 'Waste';
export const ENVIRONMENT_TERRAINS: ReadonlyArray<EnvironmentTerrain> = ['Alpine', 'Rough', 'Underground', 'Waste'] as const;
const TERRAIN_SET = new Set<EnvironmentTerrain>(ENVIRONMENT_TERRAINS);
export function asTerrainArray(v: unknown): EnvironmentTerrain[] {
  if (!Array.isArray(v)) return [];
  const out: EnvironmentTerrain[] = [];
  for (const x of v) {
    const s = String(x) as EnvironmentTerrain;
    if (TERRAIN_SET.has(s)) out.push(s);
  }
  return out;
}

/** Enum for Environment vegetation */
export type EnvironmentVegetation = 'Barren' | 'Coniferous' | 'Deciduous' | 'Grasslands' | 'Heath' | 'Jungle' | 'Plains' | 'Tundra';
export const ENVIRONMENT_VEGETATIONS: ReadonlyArray<EnvironmentVegetation> = ['Barren', 'Coniferous', 'Deciduous', 'Grasslands', 'Heath', 'Jungle', 'Plains', 'Tundra'] as const;
const VEGETATION_SET = new Set<EnvironmentVegetation>(ENVIRONMENT_VEGETATIONS);
export function asVegetationArray(v: unknown): EnvironmentVegetation[] {
  if (!Array.isArray(v)) return [];
  const out: EnvironmentVegetation[] = [];
  for (const x of v) {
    const s = String(x) as EnvironmentVegetation;
    if (VEGETATION_SET.has(s)) out.push(s);
  }
  return out;
}

/** Enum for Environment water bodies */
export type EnvironmentWaterBody = 'Breaks' | 'Desert' | 'Fresh Coast' | 'Glacier' | 'Islet' | 'Lake' | 'Marsh' | 'Oasis' | 'Ocean' | 'Salt Coast';
export const ENVIRONMENT_WATER_BODIES: ReadonlyArray<EnvironmentWaterBody> = ['Breaks', 'Desert', 'Fresh Coast', 'Glacier', 'Islet', 'Lake', 'Marsh', 'Oasis', 'Ocean', 'Salt Coast'] as const;
const WATER_BODY_SET = new Set<EnvironmentWaterBody>(ENVIRONMENT_WATER_BODIES);
export function asWaterBodyArray(v: unknown): EnvironmentWaterBody[] {
  if (!Array.isArray(v)) return [];
  const out: EnvironmentWaterBody[] = [];
  for (const x of v) {
    const s = String(x) as EnvironmentWaterBody;
    if (WATER_BODY_SET.has(s)) out.push(s);
  }
  return out;
}

//** Enum for armour types  */
export type ArmourType = 'AT 1' | 'AT 2' | 'AT 3' | 'AT 4' | 'AT 5' | 'AT 6' | 'AT 7' | 'AT 8' | 'AT 9' | 'AT 10' | 'AT 11' | 'AT 12' | 'AT 13' | 'AT 14' | 'AT 15' | 'AT 16' | 'AT 17' | 'AT 18' | 'AT 19' | 'AT 20';
export const ARMOUR_TYPES: ReadonlyArray<ArmourType> = ['AT 1', 'AT 2', 'AT 3', 'AT 4', 'AT 5', 'AT 6', 'AT 7', 'AT 8', 'AT 9', 'AT 10', 'AT 11', 'AT 12', 'AT 13', 'AT 14', 'AT 15', 'AT 16', 'AT 17', 'AT 18', 'AT 19', 'AT 20'] as const;

/** Enum for SkillActionType */
export type SkillActionType = 'Moving' | 'OB' | 'Special' | 'Static';
export const SKILL_ACTION_TYPES: ReadonlyArray<SkillActionType> = ['Moving', 'OB', 'Special', 'Static'] as const;

/** Enum for Critical Types */
export type CriticalType = 'Brawling' | 'Grapple' | 'Impact' | 'Krush' | 'Martial Arts Strikes' | 'Martial Arts Sweeps' | 'Puncture' | 'Slash' | 'Subdual' | 'Tiny' | 'Unbalance' | 'Aether' | 'Cold' | 'Electrical' | 'Heat' | 'Nether';
export const CRITICAL_TYPES: ReadonlyArray<CriticalType> = ['Brawling', 'Grapple', 'Impact', 'Krush', 'Martial Arts Strikes', 'Martial Arts Sweeps', 'Puncture', 'Slash', 'Subdual', 'Tiny', 'Unbalance', 'Aether', 'Cold', 'Electrical', 'Heat', 'Nether'] as const;

/** Enum for Spell User Types */
export type SpellUserType = 'Pure' | 'Hybrid' | 'Semi' | 'Chaotic' | 'None';
export const SPELL_USER_TYPES: ReadonlyArray<SpellUserType> = ['Pure', 'Hybrid', 'Semi', 'Chaotic', 'None'] as const;

/** Enum for skill development type */
export type SkillDevelopmentType = 'Everyman' | 'Occupational' | 'Restricted' | 'Standard';
export const SKILL_DEVELOPMENT_TYPES: ReadonlyArray<SkillDevelopmentType> = ['Everyman', 'Occupational', 'Restricted', 'Standard'] as const;

/** Enum for CreatureSize */
export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge';
export const CREATURE_SIZES: ReadonlyArray<CreatureSize> = ['Tiny', 'Small', 'Medium', 'Large', 'Huge'] as const;

/** Enum for Animal bonus XP code */
export type CreatureBonusXpType = 'None' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';
export const CREATURE_BONUS_XP_TYPES: ReadonlyArray<CreatureBonusXpType> = ['None', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

/** Enum for constitution variance */
export type CreatureConstitutionVarianceType = 'None' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export const CREATURE_CONSTITUTION_VARIANCE_TYPES: ReadonlyArray<CreatureConstitutionVarianceType> = ['None', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/** Enum for level variance */
export type LevelVarianceType = 'None' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export const LEVEL_VARIANCE_TYPES: ReadonlyArray<LevelVarianceType> = ['None', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/** Enum for creature movement speed */
export type CreatureMovementSpeedType = 'Immobile' | 'Inching' | 'Creeping' | 'Very Slow' | 'Slow' | 'Medium' | 'Moderately Fast' | 'Fast' | 'Very Fast' | 'Blindingly Fast';
export const CREATURE_MOVEMENT_SPEED_TYPES: ReadonlyArray<CreatureMovementSpeedType> = ['Immobile', 'Inching', 'Creeping', 'Very Slow', 'Slow', 'Medium', 'Moderately Fast', 'Fast', 'Very Fast', 'Blindingly Fast'] as const;

/** Enum for animal outlook */
export type AnimalOutlookType = 'Aggressive' | 'Aloof' | 'Altruistic' | 'Belligerent' | 'Berserk' | 'Carefree' | 'Cruel' | 'Domineering' | 'Good' | 'Greedy' | 'Hostile' | 'Hungry' | 'Inquisitive' | 'Jumpy' | 'Normal' | 'Passive' | 'Playful' | 'Protective' | 'Timid';
export const ANIMAL_OUTLOOK_TYPES: ReadonlyArray<AnimalOutlookType> = ['Aggressive', 'Aloof', 'Altruistic', 'Belligerent', 'Berserk', 'Carefree', 'Cruel', 'Domineering', 'Good', 'Greedy', 'Hostile', 'Hungry', 'Inquisitive', 'Jumpy', 'Normal', 'Passive', 'Playful', 'Protective', 'Timid'] as const;

/** Enum for critical size table */
export type CriticalSizeTableType = 'Normal' | 'Large' | 'Huge';
export const CRITICAL_SIZE_TABLE_TYPES: ReadonlyArray<CriticalSizeTableType> = ['Normal', 'Large', 'Huge'] as const;

/** Enum for critical modifier */
export type CriticalModifierType = 'Decrease Severity I' | 'Decrease Severity II' | 'No Bleed' | 'No Stun';
export const CRITICAL_MODIFIER_TYPES: ReadonlyArray<CriticalModifierType> = ['Decrease Severity I', 'Decrease Severity II', 'No Bleed', 'No Stun'] as const;

/** Enum for special attack size */
export type AttackSizeType = 'Small' | 'Medium' | 'Large' | 'Huge';
export const ATTACK_SIZE_TYPES: ReadonlyArray<AttackSizeType> = ['Small', 'Medium', 'Large', 'Huge'] as const;

/** Enum for critical size */
export type CriticalSize = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export const CRITICAL_SIZES: ReadonlyArray<CriticalSize> = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/** Enum for CriticalTableType */
export type CriticalTableType = 'Normal' | 'Large Creature Physical' | 'Huge Creature Physical' | 'Large Creature Spell' | 'Huge Creature Spell';
export const CRITICAL_TABLE_TYPES: ReadonlyArray<CriticalTableType> = ['Normal', 'Large Creature Physical', 'Huge Creature Physical', 'Large Creature Spell', 'Huge Creature Spell'] as const;