const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const net = require('net');
const chokidar = require('chokidar');
const { scanDirectory } = require('./scanner');
const { pickDirectory } = require('./directoryPicker');
const { loadConfig, saveConfig, updateConfig, loadGlobalConfig, saveGlobalConfig, registerProject, removeProject, renameProject, favoriteKey } = require('./config');
const { renameFile, moveFile, duplicateFile, deleteFile, restoreFile } = require('./fileOps');
const { startDevServer, stopDevServer, getDevServerStatus } = require('./devServer');
const { version: APP_VERSION } = require('../package.json');

// SSE clients
let sseClients = [];

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter((res) => {
    try {
      res.write(msg);
      return true;
    } catch {
      return false;
    }
  });
}

function findPort(start) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(start, () => {
      server.close(() => resolve(start));
    });
    server.on('error', () => resolve(findPort(start + 1)));
  });
}

function getProjectPreviewDir(rootDir) {
  for (const dirName of ['dist', 'build']) {
    const candidate = path.join(rootDir, dirName);
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

function rewritePreviewHtml(html) {
  return html.replace(/(src|href)=("|')\/(?!\/)/g, '$1=$2/__project_preview__/');
}

function mergeConfigIntoFiles(files, config, globalFavorites = [], sourceRootDir = '', sourceProjectName = '') {
  return files.map((f) => ({
    ...f,
    favorite: globalFavorites.includes(favoriteKey(sourceRootDir, f.id)),
    tags: config.tags[f.id] || [],
    note: config.notes[f.id] || '',
    project: config.projects[f.id] || '',
    status: config.statuses[f.id] || 'draft',
    sourceRootDir,
    sourceProjectName,
  }));
}

const EMPTY_SCAN = { files: [], stats: { totalFiles: 0, previewableFiles: 0, scannedFiles: 0, versionStacks: 0, byExtension: {}, mode: 'files' } };
const EMPTY_CONFIG = { favorites: [], tags: {}, notes: {}, projects: {}, statuses: {} };

async function startServer(initialRootDir) {
  let rootDir = initialRootDir || null;
  let scanData = rootDir ? await scanDirectory(rootDir) : EMPTY_SCAN;
  let config = rootDir ? await loadConfig(rootDir) : EMPTY_CONFIG;
  if (rootDir) {
    await registerProject(rootDir);
    await saveGlobalConfig({ lastDir: rootDir });
  }
  let watcher = null;

  // Auto-start dev server if needed
  async function maybeStartDevServer() {
    if (!rootDir) return;
    const needsDevServer = scanData.files.some((f) => f.previewUrl && f.devServerUp === false && f.devCommand);
    if (!needsDevServer) return;
    const devCommand = scanData.files.find((f) => f.devCommand)?.devCommand;
    if (!devCommand) return;

    console.log(`  ◇ Starting dev server (${devCommand})...`);
    const result = await startDevServer(rootDir, devCommand, async (baseUrl) => {
      // Dev server is ready — rescan to pick up the local preview URLs
      console.log(`  ✓ Dev server ready at ${baseUrl}`);
      scanData = await scanDirectory(rootDir);
      config = await loadConfig(rootDir);
      broadcast(await filesResponse());
    });
    if (!result) {
      console.log('  ⚠ Dev server failed to start — previews may be limited');
    }
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve built frontend
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
  }

  // Helpers
  async function rescan() {
    if (!rootDir) return EMPTY_SCAN;
    scanData = await scanDirectory(rootDir);
    config = await loadConfig(rootDir);
    return scanData;
  }

  async function filesResponse() {
    const global = await loadGlobalConfig();
    return {
      files: rootDir ? mergeConfigIntoFiles(scanData.files, config, global.favorites || [], rootDir, '') : [],
      stats: scanData.stats,
      config,
      rootDir: rootDir || '',
      projects: global.projects || [],
      globalFavoritesCount: (global.favorites || []).length,
    };
  }

  async function favoritesResponse() {
    const global = await loadGlobalConfig();
    const projectDirs = [...new Set([...(global.projects || []).map((p) => p.directory), ...(rootDir ? [rootDir] : [])].filter(Boolean))];
    const favorites = [];

    for (const dir of projectDirs) {
      try {
        const [dirScanData, dirConfig] = await Promise.all([scanDirectory(dir), loadConfig(dir)]);
        const projectName = (global.projects || []).find((p) => p.directory === dir)?.name || path.basename(dir);
        const mergedFiles = mergeConfigIntoFiles(dirScanData.files, dirConfig, global.favorites || [], dir, projectName);
        favorites.push(...mergedFiles.filter((file) => file.favorite));
      } catch {}
    }

    favorites.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    return {
      files: favorites,
      count: favorites.length,
      projects: global.projects || [],
      rootDir,
    };
  }

  function getRequestedRoot(req) {
    const rawRoot =
      (req.body && req.body.rootDir) ||
      (req.query && req.query.rootDir) ||
      rootDir;
    return path.resolve(rawRoot);
  }

  async function getScanDataFor(targetRoot) {
    return targetRoot === rootDir ? scanData : scanDirectory(targetRoot);
  }

  async function getConfigFor(targetRoot) {
    return targetRoot === rootDir ? config : loadConfig(targetRoot);
  }

  // Validate that a resolved path is inside rootDir
  function assertInsideRoot(absPath) {
    if (!rootDir) throw new Error('No project directory set');
    const resolved = path.resolve(absPath);
    const root = path.resolve(rootDir);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new Error('Path traversal detected');
    }
  }

  // Setup file watcher for a directory
  function setupWatcher(dir) {
    if (watcher) watcher.close();
    if (!dir) return;
    let debounceTimer;
    watcher = chokidar.watch(dir, {
      ignored: [/(^|[/\\])node_modules/, /(^|[/\\])\.git/, /(^|[/\\])\.designvault/],
      ignoreInitial: true,
      persistent: true,
    });
    watcher.on('all', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await rescan();
        broadcast(await filesResponse());
      }, 300);
    });
  }

  // Start watching initial directory
  setupWatcher(rootDir);

  // --- API Routes ---

  // Server info — tells the frontend which directory is being scanned + all registered projects
  app.get('/api/info', async (_req, res) => {
    const global = await loadGlobalConfig();
    res.json({ rootDir, version: APP_VERSION, projects: global.projects || [] });
  });

  // Change the scanned directory at runtime
  app.post('/api/changedir', async (req, res) => {
    const rawDir = (req.body.directory || '').replace(/^['"""'']+|['"""'']+$/g, '').trim();
    const customName = (req.body.name || '').trim() || null;
    if (!rawDir) return res.status(400).json({ error: 'directory is required' });

    const resolved = path.resolve(rawDir);
    try {
      const stat = await fs.promises.stat(resolved);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch {
      return res.status(400).json({ error: `Directory not found: ${resolved}` });
    }

    try {
      await stopDevServer();
      rootDir = resolved;
      await rescan();
      setupWatcher(rootDir);
      await registerProject(rootDir, customName);
      await saveGlobalConfig({ lastDir: rootDir });
      console.log(`  ◇ Switched to: ${rootDir}`);
      res.json(await filesResponse());
      // Auto-start dev server for the new project (non-blocking)
      maybeStartDevServer();
    } catch (err) {
      res.status(500).json({ error: `Scan failed: ${err.message}` });
    }
  });

  app.post('/api/pick-directory', async (_req, res) => {
    try {
      const directory = await pickDirectory();
      res.json({
        directory: directory || null,
        cancelled: !directory,
      });
    } catch (err) {
      res.status(500).json({ error: `Could not open folder picker: ${err.message}` });
    }
  });

  app.get('/api/files', async (_req, res) => {
    res.json(await filesResponse());
  });

  app.get('/api/favorites', async (_req, res) => {
    res.json(await favoritesResponse());
  });

  app.get('/api/files/:id/content', async (req, res) => {
    const targetRoot = getRequestedRoot(req);
    const targetScanData = await getScanDataFor(targetRoot);
    const file = findFileByIdInScan(targetScanData, req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    try {
      const resolved = path.resolve(file.absolutePath);
      const root = path.resolve(targetRoot);
      if (!resolved.startsWith(root + path.sep) && resolved !== root) {
        throw new Error('Path traversal detected');
      }
    } catch {
      return res.status(403).json({ error: 'Access denied' });
    }

    const ext = file.extension || path.extname(file.absolutePath).slice(1);
    const types = { html: 'text/html', htm: 'text/html', svg: 'image/svg+xml', jsx: 'text/plain', tsx: 'text/plain' };
    res.setHeader('Content-Type', types[ext] || 'text/plain');
    res.sendFile(file.absolutePath);
  });

  app.get(['/__project_preview__', '/__project_preview__/*'], async (req, res) => {
    const previewDir = getProjectPreviewDir(rootDir);
    if (!previewDir) {
      return res.status(404).send('No built preview is available for this project');
    }

    const requestPath = req.path.replace(/^\/__project_preview__/, '') || '/';
    const relativePath = requestPath.replace(/^\/+/, '');
    const candidateFile = path.join(previewDir, relativePath);

    try {
      if (relativePath) {
        const stat = await fs.promises.stat(candidateFile).catch(() => null);
        if (stat?.isFile()) {
          return res.sendFile(candidateFile);
        }
      }

      const html = await fs.promises.readFile(path.join(previewDir, 'index.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(rewritePreviewHtml(html));
    } catch (err) {
      res.status(500).send(`Preview failed: ${err.message}`);
    }
  });

  // Reveal file in Finder (macOS) or file manager
  app.post('/api/files/:id/reveal', async (req, res) => {
    try {
      const targetRoot = getRequestedRoot(req);
      const targetScanData = await getScanDataFor(targetRoot);
      const file = findFileByIdInScan(targetScanData, req.params.id);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const { execFile: ef } = require('child_process');
      if (process.platform === 'darwin') {
        ef('open', ['-R', file.absolutePath]);
      } else if (process.platform === 'win32') {
        ef('explorer', ['/select,', file.absolutePath]);
      } else {
        ef('xdg-open', [path.dirname(file.absolutePath)]);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Open file's directory in a new terminal tab
  app.post('/api/files/:id/terminal', async (req, res) => {
    try {
      const targetRoot = getRequestedRoot(req);
      const targetScanData = await getScanDataFor(targetRoot);
      const file = findFileByIdInScan(targetScanData, req.params.id);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const dir = path.dirname(file.absolutePath);
      const { execFile: ef } = require('child_process');
      if (process.platform === 'darwin') {
        ef('osascript', ['-e', `tell application "Terminal" to do script "cd '${dir.replace(/'/g, "'\\''")}'"`]);
      } else if (process.platform === 'win32') {
        ef('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d "${dir}"`]);
      } else {
        ef('x-terminal-emulator', ['-e', `cd "${dir}" && $SHELL`]);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Open file's directory in a code editor / AI tool
  app.post('/api/files/:id/open-in', async (req, res) => {
    try {
      const targetRoot = getRequestedRoot(req);
      const targetScanData = await getScanDataFor(targetRoot);
      const file = findFileByIdInScan(targetScanData, req.params.id);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const tool = req.body.tool;
      const dir = path.dirname(file.absolutePath);
      const { execFile: ef } = require('child_process');
      const escapedDir = dir.replace(/'/g, "'\\''");

      function openInTerminalWith(cliCmd) {
        if (process.platform === 'darwin') {
          ef('osascript', ['-e',
            `tell application "Terminal"\n  activate\n  do script "cd '${escapedDir}' && ${cliCmd}"\nend tell`
          ]);
        } else if (process.platform === 'win32') {
          ef('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d "${dir}" && ${cliCmd}`]);
        } else {
          ef('x-terminal-emulator', ['-e', `cd "${dir}" && ${cliCmd}`]);
        }
      }

      const commands = {
        'claude-code': () => openInTerminalWith('claude'),
        'codex': () => openInTerminalWith('codex'),
        'cursor': () => ef('cursor', [dir]),
      };

      const launcher = commands[tool];
      if (!launcher) return res.status(400).json({ error: `Unknown tool: ${tool}` });
      launcher();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/files/:id/rename', async (req, res) => {
    try {
      const targetRoot = getRequestedRoot(req);
      const targetScanData = await getScanDataFor(targetRoot);
      await renameFile(targetRoot, req.params.id, req.body.newName, targetScanData);
      if (targetRoot === rootDir) {
        await rescan();
        return res.json(await filesResponse());
      }
      res.json({ ok: true, rootDir: targetRoot });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/files/:id/move', async (req, res) => {
    try {
      const targetRoot = getRequestedRoot(req);
      const targetScanData = await getScanDataFor(targetRoot);
      await moveFile(targetRoot, req.params.id, req.body.destination, targetScanData);
      if (targetRoot === rootDir) {
        await rescan();
        return res.json(await filesResponse());
      }
      res.json({ ok: true, rootDir: targetRoot });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/files/:id/duplicate', async (req, res) => {
    try {
      const targetRoot = getRequestedRoot(req);
      const targetScanData = await getScanDataFor(targetRoot);
      await duplicateFile(targetRoot, req.params.id, targetScanData);
      if (targetRoot === rootDir) {
        await rescan();
        return res.json(await filesResponse());
      }
      res.json({ ok: true, rootDir: targetRoot });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/files/:id', async (req, res) => {
    try {
      const targetRoot = getRequestedRoot(req);
      const targetScanData = await getScanDataFor(targetRoot);
      await deleteFile(targetRoot, req.params.id, targetScanData);
      if (targetRoot === rootDir) {
        await rescan();
        return res.json(await filesResponse());
      }
      res.json({ ok: true, rootDir: targetRoot });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/files/:id/restore', async (req, res) => {
    try {
      const targetRoot = getRequestedRoot(req);
      await restoreFile(targetRoot, req.params.id);
      if (targetRoot === rootDir) {
        await rescan();
        return res.json(await filesResponse());
      }
      res.json({ ok: true, rootDir: targetRoot });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/rescan', async (_req, res) => {
    try {
      await rescan();
      res.json(await filesResponse());
    } catch (err) {
      res.status(500).json({ error: `Scan failed: ${err.message}` });
    }
  });

  // Remove a project from the registry
  app.delete('/api/projects', async (req, res) => {
    const dir = req.body.directory;
    if (!dir) return res.status(400).json({ error: 'directory is required' });
    const global = await removeProject(dir);
    res.json({ projects: global.projects || [] });
  });

  app.put('/api/projects/rename', async (req, res) => {
    const { directory, name } = req.body;
    if (!directory || !name) return res.status(400).json({ error: 'directory and name are required' });
    const global = await renameProject(directory, name.trim());
    res.json({ projects: global.projects || [] });
  });

  app.get('/api/config', (_req, res) => {
    res.json(config);
  });

  app.put('/api/config', async (req, res) => {
    config = await updateConfig(rootDir, req.body);
    res.json(config);
  });

  app.put('/api/config/favorite/:id', async (req, res) => {
    const targetRoot = getRequestedRoot(req);
    const global = await loadGlobalConfig();
    const key = favoriteKey(targetRoot, req.params.id);
    const idx = (global.favorites || []).indexOf(key);
    if (idx >= 0) global.favorites.splice(idx, 1);
    else global.favorites.push(key);
    const updated = await saveGlobalConfig({ favorites: global.favorites });
    res.json({ favorites: updated.favorites || [] });
  });

  app.put('/api/config/tags/:id', async (req, res) => {
    const targetRoot = getRequestedRoot(req);
    const targetConfig = await getConfigFor(targetRoot);
    targetConfig.tags[req.params.id] = req.body.tags || [];
    await saveConfig(targetRoot, targetConfig);
    if (targetRoot === rootDir) config = targetConfig;
    res.json(targetConfig);
  });

  app.put('/api/config/notes/:id', async (req, res) => {
    const targetRoot = getRequestedRoot(req);
    const targetConfig = await getConfigFor(targetRoot);
    targetConfig.notes[req.params.id] = req.body.note || '';
    await saveConfig(targetRoot, targetConfig);
    if (targetRoot === rootDir) config = targetConfig;
    res.json(targetConfig);
  });

  app.put('/api/config/status/:id', async (req, res) => {
    const targetRoot = getRequestedRoot(req);
    const targetConfig = await getConfigFor(targetRoot);
    targetConfig.statuses[req.params.id] = req.body.status || 'draft';
    await saveConfig(targetRoot, targetConfig);
    if (targetRoot === rootDir) config = targetConfig;
    res.json(targetConfig);
  });

  app.put('/api/config/project/:id', async (req, res) => {
    const targetRoot = getRequestedRoot(req);
    const targetConfig = await getConfigFor(targetRoot);
    targetConfig.projects[req.params.id] = req.body.project || '';
    await saveConfig(targetRoot, targetConfig);
    if (targetRoot === rootDir) config = targetConfig;
    res.json(targetConfig);
  });

  // SSE endpoint
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter((c) => c !== res);
    });
  });

  // Dev server status endpoint
  app.get('/api/devserver', (_req, res) => {
    res.json(getDevServerStatus() || { running: false, starting: false });
  });

  // SPA fallback — serve index.html for non-API routes
  app.get('*', (_req, res) => {
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend not built. Run npm run build:frontend');
    }
  });

  // Find file by ID (searches top-level and versions)
  function findFileByIdInScan(targetScanData, id) {
    for (const file of targetScanData.files) {
      if (file.id === id) return file;
      if (file.versions) {
        for (const v of file.versions) {
          if (v.id === id) {
            const dir = path.dirname(file.absolutePath);
            return {
              ...v,
              absolutePath: path.join(dir, v.filename),
              extension: path.extname(v.filename).slice(1),
            };
          }
        }
      }
    }
    return null;
  }

  // Start listening
  const port = await findPort(4567);
  const server = app.listen(port);

  // Auto-start dev server after server is up (non-blocking)
  maybeStartDevServer();

  return { port, server, scanResult: rootDir ? scanData : null };
}

module.exports = { startServer };
