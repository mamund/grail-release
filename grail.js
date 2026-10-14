import { loadAffordanceRegistry } from './affordanceRegistry.js';
import { WorldState } from './worldState.js';
import { ObservationStore } from './observationStore.js';
import { Server } from './server.js';
import { Client } from './client.js';
import { performance } from 'node:perf_hooks';

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
    this.initialWorldstate = { ...worldstate };
    this.observationPath = observationPath;
    this.baseDir = baseDir;
    this.resetPursuit();
  }

  resetPursuit() {
    this.worldState = new WorldState(this.affordanceRegistry, this.initialWorldstate);
    this.observationStore = new ObservationStore(this.observationPath);
    this.server = new Server(
      this.worldState,
      this.affordanceRegistry,
      this.observationStore,
      this.baseDir
    );
    this.client = new Client(this.server, this.inputs);
  }

  async pursue(goal, { onProgress } = {}) {
    if (!goal) {
      throw new Error('Grail.pursue requires a goal.');
    }

    this.resetPursuit();
    this.client.onProgress = onProgress;
    const startedAt = performance.now();
    if (onProgress) {
      this.client.onProgress = event => {
        if (event.type === 'pursuit.completed' ||
            event.type === 'pursuit.unresolvable' ||
            event.type === 'pursuit.stopped' ||
            event.type === 'condition.unresolvable') {
          onProgress({ ...event, durationMs: performance.now() - startedAt });
        } else {
          onProgress(event);
        }
      };
    }
    await this.client.pursue(goal);
    const durationMs = performance.now() - startedAt;

    return {
      goal,
      reached: this.worldState.isPreconditionMet(goal),
      timing: { durationMs },
      worldstate: { ...this.worldState.state },
      observations: [...this.observationStore.observations]
    };
  }
}
