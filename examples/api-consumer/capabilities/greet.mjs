let input = '';
for await (const chunk of process.stdin) input += chunk.toString();
const { name } = JSON.parse(input);
process.stdout.write(JSON.stringify({ greeting: `Hello, ${name}!` }));
