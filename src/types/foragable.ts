import { Named } from './base';
import type { Location } from './location';
import type {
  ForagableEffectType,
  ForagablePreparationType,
  ManoeuvreDifficulty,
} from './enum';

export interface Foragable extends Named {
  effectType: ForagableEffectType;
  form?: string | undefined;
  difficulty: ManoeuvreDifficulty;
  preparationType: ForagablePreparationType;
  addictionFactor: number;
  cost?: string | undefined;
  location?: Location | undefined;
  effect?: string | undefined;
}

export interface ForagablesPayload {
  foragables: Foragable[];
}
