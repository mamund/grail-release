import { loadAffordanceRegistry } from './affordanceRegistry.js';
import { WorldState } from './worldState.js';
import { ObservationStore } from './observationStore.js';
import { Server } from './server.js';
import { Client } from './client.js';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
    const attempted = recover === true && this.client.unresolvable === true;
    const recoveryCounts = attempted
      ? await recoverStack(this.server.recoveryStack, this.baseDir)
      : null;
    const durationMs = performance.now() - startedAt;

    return {
      pursuitId,
      goal,
      reached: this.worldState.isPreconditionMet(goal),
      timing: { durationMs },
      worldstate: { ...this.worldState.state },
      observations: [...this.observationStore.observations],
      ...(recover === true ? { recovery: { enabled: true, attempted, ...(attempted ? recoveryCounts : {}) } } : {})
    };
  }
}

// Recovery handlers receive only the identity of the original invocation.
async function recoverNode(entry, baseDir) {
  const { binding, pursuitId, invocationId } = entry;
  const declaration = binding.recover;
  if (!declaration) return 'SKIPPED';
  if (binding.protocol === 'http') return recoverHttp(entry);
  if (binding.protocol === 'stdio') return recoverStdio(entry, baseDir);
  if (binding.protocol !== 'node') return 'SKIPPED';

  try {
    const moduleName = typeof declaration === 'string' ? binding.module : declaration.module;
    const functionName = typeof declaration === 'string' ? declaration : declaration.function;
    const moduleUrl = pathToFileURL(path.resolve(baseDir, moduleName)).href;
    const fn = (await import(moduleUrl))[functionName];
    if (typeof fn !== 'function') return 'RECOVERY_FAILED';
    const response = await fn({ pursuitId, invocationId });
    return response?.result === 'SUCCESS' ? 'RECOVERED' : 'RECOVERY_FAILED';
  } catch {
    return 'RECOVERY_FAILED';
  }
}

// HTTP recovery uses the declared endpoint and original invocation identity only.
async function recoverHttp({ binding, pursuitId, invocationId }) {
  try {
    const response = await fetch(binding.recover.url, {
      method: binding.recover.method,
      headers: {
        'Grail-Pursuit-Id': pursuitId,
        'Grail-Invocation-Id': invocationId
      }
    });
    if (!response.ok) return 'RECOVERY_FAILED';
    const body = await response.json();
    return body?.result === 'SUCCESS' ? 'RECOVERED' : 'RECOVERY_FAILED';
  } catch {
    return 'RECOVERY_FAILED';
  }
}

// STDIO recovery uses a separate noninteractive process with only the original IDs on stdin.
async function recoverStdio({ binding, pursuitId, invocationId }, baseDir) {
  try {
    const { executeStdioBinding } = await import('./bindings/stdioBinding.js');
    const interaction = await executeStdioBinding(
      { ...binding.recover, interactive: false },
      { pursuitId, invocationId },
      baseDir
    );
    if (interaction.exitCode !== 0 || interaction.error) return 'RECOVERY_FAILED';
    return interaction.stdout?.result === 'SUCCESS' ? 'RECOVERED' : 'RECOVERY_FAILED';
  } catch {
    return 'RECOVERY_FAILED';
  }
}

async function recoverStack(stack, baseDir) {
  const counts = { recovered: 0, failed: 0, skipped: 0 };
  for (let i = stack.length - 1; i >= 0; i--) {
    const status = await recoverNode(stack[i], baseDir);
    if (status === 'RECOVERED') counts.recovered++;
    else if (status === 'RECOVERY_FAILED') counts.failed++;
    else counts.skipped++;
  }
  return counts;
}
