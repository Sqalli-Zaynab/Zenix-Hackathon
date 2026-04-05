const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const backendRoot = path.join(repoRoot, 'backend');
const backendHost = '127.0.0.1';
const backendPort = 3000;

let backendProcess = null;
let frontendProcess = null;

function isBackendReachable(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.createConnection(
      { host: backendHost, port: backendPort },
      () => {
        socket.end();
        resolve(true);
      },
    );

    socket.setTimeout(timeoutMs);
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function waitForBackend(timeoutMs = 15000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = async () => {
      if (await isBackendReachable()) {
        resolve();
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(
          new Error(
            `Backend did not become reachable on http://${backendHost}:${backendPort} within ${timeoutMs}ms.`,
          ),
        );
        return;
      }

      setTimeout(check, 500);
    };

    void check();
  });
}

function spawnBackend() {
  console.log(`Afaq: starting backend on http://${backendHost}:${backendPort} ...`);

  backendProcess = spawn('cmd.exe', ['/c', 'npm', 'start'], {
    cwd: backendRoot,
    stdio: 'inherit',
    windowsHide: false,
  });

  backendProcess.on('exit', (code) => {
    backendProcess = null;

    if (code && code !== 0 && frontendProcess) {
      console.error(`Afaq: backend exited with code ${code}.`);
    }
  });
}

function spawnFrontend() {
  const ngCliPath = path.join(
    frontendRoot,
    'node_modules',
    '@angular',
    'cli',
    'bin',
    'ng.js',
  );
  const args = [ngCliPath, 'serve', ...process.argv.slice(2)];

  frontendProcess = spawn(process.execPath, args, {
    cwd: frontendRoot,
    stdio: 'inherit',
    windowsHide: false,
  });

  frontendProcess.on('exit', (code) => {
    if (backendProcess) {
      backendProcess.kill();
    }

    process.exit(code ?? 0);
  });
}

async function main() {
  const backendAlreadyRunning = await isBackendReachable();

  if (!backendAlreadyRunning) {
    spawnBackend();
    await waitForBackend();
  } else {
    console.log(`Afaq: using existing backend on http://${backendHost}:${backendPort}.`);
  }

  spawnFrontend();
}

function shutdown() {
  if (frontendProcess) {
    frontendProcess.kill();
  }

  if (backendProcess) {
    backendProcess.kill();
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((error) => {
  console.error(`Afaq dev startup failed: ${error.message}`);
  shutdown();
  process.exit(1);
});
