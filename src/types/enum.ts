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