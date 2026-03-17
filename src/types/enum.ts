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