/**
 * Armour data
 * Note: Armourtype is a bit of an odd name, but it matches the API and avoids confusion with the Armour interface used for character equipment.
 * The API's "armourtype" is more like a template or category of armour, while the actual "armour" items that characters wear would be instances of these types.
 */
export interface ArmourType {
  id: string;
  name: string;
  type: string;
  description: string;
  minManoeuvreMod: number;
  maxManoeuvreMod: number;
  missileAttackPenalty: number;
  quicknessPenalty: number;
  animalOnly: boolean;
  includesGreaves: boolean;
}

export interface ArmourTypesPayload {
  armourtypes: ArmourType[];
}