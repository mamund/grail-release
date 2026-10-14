import { readFileSync } from 'node:fs';
const inputs = JSON.parse(readFileSync(process.env.GRAIL_INPUTS_FILE, 'utf8'));
process.stderr.write('\x1b[');
await new Promise(resolve => setTimeout(resolve, 15));
process.stderr.write('1G\x1b[0JRefund amount: \r\n25\rDecision recorded\n');
let input = '';
for await (const chunk of process.stdin) input += chunk.toString();
process.stdout.write(JSON.stringify({
  refundAmount: Number(input.trim()),
  refundReason: 'HUMAN_REVIEW',
  ticketId: inputs.ticketId,
  inputFilePath: process.env.GRAIL_INPUTS_FILE
}));
