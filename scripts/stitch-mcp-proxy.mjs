/**
 * Stdio MCP proxy for Google Stitch.
 * Strips outputSchema from tools/list to avoid Cursor silently dropping tools (~287KB payload).
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', 'stitch-mcp'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env,
});

const rl = createInterface({ input: child.stdout });

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === 'tools/list' && msg.result?.tools) {
      msg.result.tools = msg.result.tools.map(({ outputSchema, ...tool }) => tool);
    }
    process.stdout.write(`${JSON.stringify(msg)}\n`);
  } catch {
    process.stdout.write(`${line}\n`);
  }
});

process.stdin.pipe(child.stdin);

child.on('exit', (code) => process.exit(code ?? 0));
