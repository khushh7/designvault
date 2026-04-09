#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { startServer } = require('./server/index.js');
const { loadGlobalConfig } = require('./server/config.js');
const { trackFirstRun } = require('./server/telemetry.js');
const { version: VERSION } = require('./package.json');

async function main() {
  let targetDir = null;
  let restored = false;

  if (process.argv[2]) {
    targetDir = path.resolve(process.argv[2]);
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      console.error(`\n  ✗ Directory not found: ${targetDir}\n`);
      process.exit(1);
    }
  }

  console.log(`\n  ◇ DesignVault v${VERSION}`);

  if (targetDir) {
    console.log(`  Scanning ${targetDir}...`);
  } else {
    console.log(`  Starting — choose a project folder in the browser`);
  }

  const { port, scanResult } = await startServer(targetDir);

  if (scanResult) {
    const { totalFiles, versionStacks } = scanResult.stats;
    console.log(`  Found ${totalFiles} design files (${versionStacks} version stacks)`);
  }
  console.log(`  ✓ Ready! Opening http://localhost:${port}\n`);

  trackFirstRun(VERSION);

  const open = (await import('open')).default;
  await open(`http://localhost:${port}`);
}

process.on('SIGINT', async () => {
  console.log('\n  Shutting down...');
  try {
    const { stopDevServer } = require('./server/devServer');
    await stopDevServer();
  } catch {}
  process.exit(0);
});

main().catch((err) => {
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
});
