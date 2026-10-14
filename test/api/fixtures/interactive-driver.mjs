import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { executeStdioBinding } from '../../../bindings/stdioBinding.js';

// Test-only override of terminal detection; stdin remains a controlled pipe.
process.stdin.isTTY = true;
const fixture = process.argv[2];
const exitCode = process.argv[3];
const result = await executeStdioBinding({
  protocol: 'stdio', command: process.execPath,
  args: [fixture, 'interactive', exitCode], interactive: true
}, { ticketId: 'T-1042' }, path.dirname(fixture));
const cleanedUp = !existsSync(result.stdout.inputFilePath);
process.stdout.write(JSON.stringify({ ...result, cleanedUp }));
