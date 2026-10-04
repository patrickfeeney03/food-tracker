import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const port = process.env.PORT || '4173';
if (!/^\d{4,5}$/.test(port)) throw new Error('Invalid E2E port');
const persistence = resolve('.playwright', `d1-${port}`);
mkdirSync(resolve('.playwright'), { recursive: true });
rmSync(persistence, { recursive: true, force: true });
const wrangler = resolve('node_modules/.bin/wrangler');
function run(command, args) {
  const result = spawnSync(command, args, { env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Both suites exercise the deployed Worker output, including real static assets.
run('npm', ['run', 'build']);
run(wrangler, ['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persistence]);
const vars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_ALLOWED_EMAILS']
  .flatMap((name) => ['--var', `${name}:${process.env[name] ?? ''}`]);
const server = spawn(wrangler, ['dev', '--local', '--ip', '127.0.0.1', '--port', port,
  '--persist-to', persistence, ...vars], { env: process.env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { if (!server.killed) server.kill(signal); });
}
server.once('exit', (code) => process.exit(code ?? 1));
