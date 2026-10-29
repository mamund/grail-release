// Child-process fixture: a broken resolver must not hang the test runner.
import { Grail } from '../../../grail.js';

const scenario = process.argv[2];
const producer = (action, preconditions, effect) => ({
  action, preconditions, effects: [effect], inputs: {}, binding: { enabled: false }
});
const registry = {
  establishA: producer('establishA', ['conditionB'], 'conditionA'),
  establishB: producer('establishB', ['conditionA'], 'conditionB')
};
const worldstate = { conditionA: false, conditionB: false };

if (scenario === 'alternative') {
  // Choose the cyclic producer first; an alternative can establish B directly.
  registry.seedB = producer('seedB', [], 'conditionB');
  Math.random = () => 0;
} else if (scenario === 'multiple-preconditions') {
  // A requires both B and C. The first producer of B leads back to A;
  // the alternative can establish B directly. C must also be established.
  registry.establishA = producer('establishA', ['conditionB', 'conditionC'], 'conditionA');
  registry.seedB = producer('seedB', [], 'conditionB');
  registry.seedC = producer('seedC', [], 'conditionC');
  worldstate.conditionC = false;
  Math.random = () => 0;
} else if (scenario === 'nested-backtracking') {
  // A -> B -> C -> D -> B forms a cycle. The alternative for A
  // is available only after unwinding to the root decision point.
  registry.establishB = producer('establishB', ['conditionC'], 'conditionB');
  registry.establishC = producer('establishC', ['conditionD'], 'conditionC');
  registry.establishD = producer('establishD', ['conditionB'], 'conditionD');
  registry.seedA = producer('seedA', [], 'conditionA');
  worldstate.conditionC = false;
  worldstate.conditionD = false;
  Math.random = () => 0;
} else if (scenario === 'missing-producer-alternative') {
  // A requires B. The first producer for B requires C, which has no producer.
  // GRAIL must backtrack to the alternative producer for B.
  registry.establishB = producer('establishB', ['conditionC'], 'conditionB');
  registry.seedB = producer('seedB', [], 'conditionB');
  worldstate.conditionC = false;
  Math.random = () => 0;
} else if (scenario === 'initial-state') {
  worldstate.conditionB = true;
} else if (scenario !== 'unavoidable') {
  throw new Error(`Unknown scenario: ${scenario}`);
}

// No external capability should be invoked in any of these scenarios.
console.log = () => {};
const grail = new Grail({ registry, worldstate });
const stackEvents = [];
const pursuitTrace = { attach(client) {
  client.onStackEvent = event => stackEvents.push({ type: event.type, affordance: event.affordance, result: event.result });
  return () => {};
} };
const result = await grail.pursue('conditionA', { pursuitTrace });
process.stdout.write(JSON.stringify({
  reached: result.reached,
  worldstate: result.worldstate,
  observations: result.observations,
  unresolvable: grail.client.unresolvable,
  stackEvents
}) + '\n');
