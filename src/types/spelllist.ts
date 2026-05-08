import { SpellType, Realm } from './enum';
import type { CharacterTraits, Named } from './base';

export interface SpellList extends Named {
  book: string;
  type: SpellType;
  description: string;
  evil: boolean;
  summoning: boolean;
  directed: boolean;
  realms: Realm[];
  traits: CharacterTraits;
}

export interface SpellListsPayload {
  spelllists: SpellList[];
}