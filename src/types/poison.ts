/**
 * Poison type data
 */
import type { Named } from './base';
import { MaladySeverity } from './enum';

export interface Poison extends Named {
  type: string;
  notes: string | undefined;
  level: number;
  levelVariance: string;
  maxSeverity: MaladySeverity;
}
export interface PoisonsPayload {
  poisons: Poison[];
}