import { Named } from './base';
import type { Location } from './location';
import type {
  ForagableEffectType,
  ForagablePreparationType,
  ManoeuvreDifficulty,
} from './enum';

export interface Foragable extends Named {
  otherNames?: string | undefined;
  loreSkill: string; // Skill.id
  characteristics?: string | undefined;
  medicinalUses?: string | undefined;
  otherUses?: string | undefined;
  warning?: string | undefined;
  preparationType: ForagablePreparationType;
  effectType: ForagableEffectType;
  findDifficulty: ManoeuvreDifficulty;
  addictionFactor: number;
  cost?: string | undefined;
  location?: Location | undefined;
}

export interface ForagablesPayload {
  foragables: Foragable[];
}
