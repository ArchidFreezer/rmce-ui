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
export const TEMPERATURES: ReadonlyArray<Temperature> = [
  'Hot',
  'Warm',
  'Temperate',
  'Cool',
  'Cold',
] as const;

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

/** Enum for Environment terrain  */
export type EnvironmentTerrain = 'Alpine' | 'Rough' | 'Underground' | 'Waste';
export const ENVIRONMENT_TERRAINS: ReadonlyArray<EnvironmentTerrain> = ['Alpine', 'Rough', 'Underground', 'Waste'] as const;

/** Enum for Environment vegetation */
export type EnvironmentVegetation = 'Barren' | 'Coniferous' | 'Deciduous' | 'Grasslands' | 'Heath' | 'Jungle' | 'Plains' | 'Tundra';
export const ENVIRONMENT_VEGETATIONS: ReadonlyArray<EnvironmentVegetation> = ['Barren', 'Coniferous', 'Deciduous', 'Grasslands', 'Heath', 'Jungle', 'Plains', 'Tundra'] as const;

/** Enum for Environment water bodies */
export type EnvironmentWaterBody = 'Breaks' | 'Desert' | 'Fresh Coast' | 'Glacier' | 'Islet' | 'Lake' | 'Marsh' | 'Oasis' | 'Ocean' | 'Salt Coast';
export const ENVIRONMENT_WATER_BODIES: ReadonlyArray<EnvironmentWaterBody> = ['Breaks', 'Desert', 'Fresh Coast', 'Glacier', 'Islet', 'Lake', 'Marsh', 'Oasis', 'Ocean', 'Salt Coast'] as const;

//** Enum for armour types  */
export type ArmourType = 'AT 1' | 'AT 2' | 'AT 3' | 'AT 4' | 'AT 5' | 'AT 6' | 'AT 7' | 'AT 8' | 'AT 9' | 'AT 10' | 'AT 11' | 'AT 12' | 'AT 13' | 'AT 14' | 'AT 15' | 'AT 16' | 'AT 17' | 'AT 18' | 'AT 19' | 'AT 20';
export const ARMOUR_TYPES: ReadonlyArray<ArmourType> = ['AT 1', 'AT 2', 'AT 3', 'AT 4', 'AT 5', 'AT 6', 'AT 7', 'AT 8', 'AT 9', 'AT 10', 'AT 11', 'AT 12', 'AT 13', 'AT 14', 'AT 15', 'AT 16', 'AT 17', 'AT 18', 'AT 19', 'AT 20'] as const;

/** Enum for SkillActionType */
export type SkillActionType = 'Moving' | 'OB' | 'Special' | 'Static';
export const SKILL_ACTION_TYPES: ReadonlyArray<SkillActionType> = ['Moving', 'OB', 'Special', 'Static'] as const;