import { loadAffordanceRegistry } from './affordanceRegistry.js';
import { WorldState } from './worldState.js';
import { ObservationStore } from './observationStore.js';
import { Server } from './server.js';
import { Client } from './client.js';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Public facade for the GRAIL runtime.
 *
 * This class deliberately composes the existing runtime components rather
 * than replacing them. Configuration loading and validation remain concerns
 * of the calling application.
 */
export class Grail {
  constructor({ registry, worldstate, inputs = {}, observationPath, baseDir = process.cwd(), recover = false }) {
    if (!registry) {
      throw new Error('Grail requires a registry.');
    }

    if (!worldstate) {
      throw new Error('Grail requires worldstate.');
    }

    this.recover = recover === true;
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

  async pursue(goal, { onProgress, pursuitTrace, recover = this.recover } = {}) {
    if (!goal) {
      throw new Error('Grail.pursue requires a goal.');
    }

    this.resetPursuit();
    const pursuitId = randomUUID();
    if (this.server) {
      this.server.pursuitId = pursuitId;
      this.server.recoveryEnabled = recover === true;
    }
    const detachTrace = pursuitTrace?.attach(this.client, this.server);
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
    try {
      await this.client.pursue(goal);
    } finally {
      detachTrace?.();
    }
    const durationMs = performance.now() - startedAt;

    return {
      pursuitId,
      goal,
      reached: this.worldState.isPreconditionMet(goal),
      timing: { durationMs },
      worldstate: { ...this.worldState.state },
      observations: [...this.observationStore.observations],
      ...(recover === true ? { recovery: { enabled: true, attempted: this.client.unresolvable === true } } : {})
    };
  }
}
