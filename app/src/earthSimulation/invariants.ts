import { EarthSimulationStateSchema } from './schema.ts';
import type { EarthSimulationState } from './types.ts';

export function assertEarthSimulationState(state: EarthSimulationState): EarthSimulationState {
  return EarthSimulationStateSchema.parse(state) as EarthSimulationState;
}
