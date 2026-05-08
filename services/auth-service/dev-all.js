const { spawn } = require('child_process');

const isWin = process.platform === 'win32';

function start(cmd, args, options = {}) {
  // Windows + .cmd sometimes triggers spawn EINVAL with shell:false.
  // shell:true delegates to cmd.exe /c and makes execution reliable.
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: isWin,
    ...options,
  });
  return child;
}

const pnpmCmd = isWin ? 'pnpm.cmd' : 'pnpm';

const notifyCwd = require('path').join(__dirname, '..', 'notify-service');
const authCwd = __dirname;

// Start notify-service first (so auth-service can call it)
const notifyChild = start(
  pnpmCmd,
  ['-C', notifyCwd, 'dev'],
  { cwd: authCwd }
);

// Start auth-service (this script itself is inside auth-service, but we want to run the TS server)
const authChild = start(
  isWin ? 'npx.cmd' : 'npx',
  ['ts-node-dev', '--respawn', '--transpile-only', 'src/index.ts'],
  { cwd: authCwd }
);

function shutdown(signal) {
  try {
    if (notifyChild && !notifyChild.killed) notifyChild.kill(signal);
  } catch {}
  try {
    if (authChild && !authChild.killed) authChild.kill(signal);
  } catch {}
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

notifyChild.on('exit', (code) => {
  // If notify dies, also stop auth (otherwise send-code will keep failing)
  if (code !== 0) shutdown('SIGTERM');
});

authChild.on('exit', (code) => {
  if (code !== 0) shutdown('SIGTERM');
});
