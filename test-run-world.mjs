import { runGrailWorld } from './index.js';
import { resolve } from 'node:path';

const result = await runGrailWorld({
  worldRoot: resolve(
    '../grail-worlds/nested-customer-onboarding'
  ),
  inputs: {
    customerId: 'C100'
  }
});

console.log(JSON.stringify(result, null, 2));
