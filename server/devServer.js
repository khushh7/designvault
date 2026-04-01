const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let active = null; // { proc, rootDir, port, baseUrl, ready }

const READY_PATTERNS = [
  /ready on (https?:\/\/localhost:\d+)/i,
  /local:\s+(https?:\/\/localhost:\d+)/i,
  /started server on .*(https?:\/\/localhost:\d+)/i,
  /listening on (https?:\/\/localhost:\d+)/i,
  /dev server running at (https?:\/\/localhost:\d+)/i,
  /➜\s+Local:\s+(https?:\/\/localhost:\d+)/i,
  /(https?:\/\/localhost:\d+)/,
];

function parseUrlFromOutput(text) {
  for (const re of READY_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

async function pollUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(t);
      if (res.ok || res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Start the dev server for a project.
 * Returns { port, baseUrl } once ready, or null on failure.
 */
async function startDevServer(rootDir, devCommand, onReady) {
  await stopDevServer();

  const [cmd, ...args] = (devCommand || 'npm run dev').split(' ');

  const proc = spawn(cmd, args, {
    cwd: rootDir,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none', FORCE_COLOR: '0' },
  });

  let detectedUrl = null;
  let resolved = false;
  const logFile = path.join(rootDir, '.designvault', '.devserver.log');

  // Ensure .designvault dir exists
  try {
    await fs.promises.mkdir(path.join(rootDir, '.designvault'), { recursive: true });
  } catch {}

  const logStream = fs.createWriteStream(logFile, { flags: 'w' });

  active = { proc, rootDir, port: null, baseUrl: null, ready: false };

  return new Promise((resolve) => {
    const finish = (url) => {
      if (resolved) return;
      resolved = true;
      if (url && active) {
        try {
          const parsed = new URL(url);
          active.port = parseInt(parsed.port, 10);
          active.baseUrl = url.replace(/\/$/, '');
          active.ready = true;
        } catch {}
      }
      if (active?.ready) {
        resolve({ port: active.port, baseUrl: active.baseUrl });
        if (onReady) onReady(active.baseUrl);
      } else {
        resolve(null);
      }
    };

    const handleOutput = (data) => {
      const text = data.toString();
      logStream.write(text);
      if (!detectedUrl) {
        detectedUrl = parseUrlFromOutput(text);
        if (detectedUrl) {
          // Confirm it's reachable then finish
          pollUrl(detectedUrl, 15000).then((ok) => {
            if (ok) finish(detectedUrl);
          });
        }
      }
    };

    proc.stdout.on('data', handleOutput);
    proc.stderr.on('data', handleOutput);

    proc.on('error', () => {
      finish(null);
    });

    proc.on('exit', () => {
      logStream.end();
      if (active?.proc === proc) {
        active = null;
      }
      finish(null);
    });

    // Fallback timeout — if we never detect a URL from output, give up
    setTimeout(() => finish(null), 35000);
  });
}

async function stopDevServer() {
  if (!active) return;
  const { proc } = active;
  active = null;

  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
    // Give it 3 seconds then force kill
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch {}
        resolve();
      }, 3000);
      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}

function getDevServerStatus() {
  if (!active) return null;
  return {
    running: active.ready,
    starting: !active.ready,
    rootDir: active.rootDir,
    port: active.port,
    baseUrl: active.baseUrl,
  };
}

function isDevServerRunningFor(rootDir) {
  return active?.rootDir === rootDir && active?.ready;
}

module.exports = { startDevServer, stopDevServer, getDevServerStatus, isDevServerRunningFor };
