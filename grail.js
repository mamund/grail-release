import { loadAffordanceRegistry } from './affordanceRegistry.js';
import { WorldState } from './worldState.js';
import { ObservationStore } from './observationStore.js';
import { Server } from './server.js';
import { Client } from './client.js';

/**
 * Public facade for the GRAIL runtime.
 *
 * This class deliberately composes the existing runtime components rather
 * than replacing them. Configuration loading and validation remain concerns
 * of the calling application.
 */
export class Grail {
  constructor({ registry, worldstate, inputs = {}, observationPath, baseDir = process.cwd() }) {
    if (!registry) {
      throw new Error('Grail requires a registry.');
    }

    if (!worldstate) {
      throw new Error('Grail requires worldstate.');
    }

    this.inputs = inputs;
    this.affordanceRegistry = loadAffordanceRegistry(registry);
    this.worldState = new WorldState(this.affordanceRegistry, worldstate);
    this.observationStore = new ObservationStore(observationPath);
    this.server = new Server(
      this.worldState,
      this.affordanceRegistry,
      this.observationStore,
      baseDir
    );
    this.client = new Client(this.server, this.inputs);
  }

  async pursue(goal) {
    if (!goal) {
      throw new Error('Grail.pursue requires a goal.');
    }

    await this.client.pursue(goal);

    return {
      goal,
      reached: this.worldState.isPreconditionMet(goal),
      worldstate: { ...this.worldState.state },
      observations: [...this.observationStore.observations]
    };
  }
}
