#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { startServer } = require('./server/index.js');
const { loadGlobalConfig } = require('./server/config.js');

const VERSION = '1.0.0';

async function main() {
  let targetDir;
  let restored = false;

  if (process.argv[2]) {
    targetDir = path.resolve(process.argv[2]);
  } else {
    const global = await loadGlobalConfig();
    if (global.lastDir && fs.existsSync(global.lastDir)) {
      targetDir = global.lastDir;
      restored = true;
    } else {
      targetDir = process.cwd();
    }
  }

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`\n  ✗ Directory not found: ${targetDir}\n`);
    process.exit(1);
  }

  console.log(`\n  ◇ DesignVault v${VERSION}`);
  if (restored) {
    console.log(`  Restoring last session: ${targetDir}`);
  }
  console.log(`  Scanning ${targetDir}...`);

  const { port, scanResult } = await startServer(targetDir);

  const { totalFiles, versionStacks } = scanResult.stats;
  console.log(`  Found ${totalFiles} design files (${versionStacks} version stacks)`);
  console.log(`  ✓ Ready! Opening http://localhost:${port}\n`);

  const open = (await import('open')).default;
  await open(`http://localhost:${port}`);
}

process.on('SIGINT', () => {
  console.log('\n  Shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
});
