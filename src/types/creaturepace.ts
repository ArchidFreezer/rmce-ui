import { ManoeuvreDifficulty } from './enum';

/**
 * CreaturePace data
 */
export interface CreaturePace {
  id: string;
  name: string;
  exhaustionMultiplier: number;   // accepts scientific notation on input; stored as number
  movementMultiplier: number;     // accepts scientific notation on input; stored as number
  manoeuvreDifficulty: ManoeuvreDifficulty;    // free text or pick from suggested difficulties below
}

export interface CreaturePacesPayload {
  creaturepaces: CreaturePace[];
}