import { readFileSync, existsSync } from 'node:fs';
const mode = process.argv[2];
if (mode === 'conventional') {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString());
  process.stdout.write(JSON.stringify({ ticketId: input.ticketId, mode }));
} else {
  const inputFilePath = process.env.GRAIL_INPUTS_FILE;
  const input = JSON.parse(readFileSync(inputFilePath, 'utf8'));
  process.stderr.write('Refund amount: ');
  let line = '';
  for await (const chunk of process.stdin) line += chunk.toString();
  const amount = Number(line.trim());
  process.stdout.write(JSON.stringify({
    ticketId: input.ticketId,
    refundAmount: amount,
    refundReason: amount === 0 ? 'NOT_APPLICABLE' : 'HUMAN_REVIEW',
    inputFilePath,
    inputFileGone: !existsSync(inputFilePath)
  }));
  process.exitCode = Number(process.argv[3] || 0);
}
