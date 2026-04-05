/**
 * Poison type data
 */
import type { Named } from './base';

export interface Poison extends Named {
  type: string;
  level: number;
  levelVariance: string;
}
export interface PoisonsPayload {
  poisons: Poison[];
}