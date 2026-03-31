const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const net = require('net');
const chokidar = require('chokidar');
const { scanDirectory } = require('./scanner');
const { pickDirectory } = require('./directoryPicker');
const { loadConfig, saveConfig, updateConfig, loadGlobalConfig, saveGlobalConfig, registerProject, removeProject } = require('./config');
const { renameFile, moveFile, duplicateFile, deleteFile, restoreFile } = require('./fileOps');

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

function mergeConfigIntoFiles(files, config) {
  return files.map((f) => ({
    ...f,
    favorite: config.favorites.includes(f.id),
    tags: config.tags[f.id] || [],
    note: config.notes[f.id] || '',
    project: config.projects[f.id] || '',
    status: config.statuses[f.id] || 'draft',
  }));
}

async function startServer(initialRootDir) {
  let rootDir = initialRootDir;
  let scanData = await scanDirectory(rootDir);
  let config = await loadConfig(rootDir);
  await registerProject(rootDir);
  await saveGlobalConfig({ lastDir: rootDir });
  let watcher = null;

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
    scanData = await scanDirectory(rootDir);
    config = await loadConfig(rootDir);
    return scanData;
  }

  async function filesResponse() {
    const global = await loadGlobalConfig();
    return {
      files: mergeConfigIntoFiles(scanData.files, config),
      stats: scanData.stats,
      config,
      rootDir,
      projects: global.projects || [],
    };
  }

  // Validate that a resolved path is inside rootDir
  function assertInsideRoot(absPath) {
    const resolved = path.resolve(absPath);
    const root = path.resolve(rootDir);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new Error('Path traversal detected');
    }
  }

  // Setup file watcher for a directory
  function setupWatcher(dir) {
    if (watcher) watcher.close();
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
    res.json({ rootDir, version: '1.0.0', projects: global.projects || [] });
  });

  // Change the scanned directory at runtime
  app.post('/api/changedir', async (req, res) => {
    const rawDir = (req.body.directory || '').replace(/^['"""'']+|['"""'']+$/g, '').trim();
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
      // Switch everything to the new directory
      rootDir = resolved;
      await rescan();
      setupWatcher(rootDir);
      await registerProject(rootDir);
      await saveGlobalConfig({ lastDir: rootDir });
      console.log(`  ◇ Switched to: ${rootDir}`);
      res.json(await filesResponse());
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

  app.get('/api/files/:id/content', (req, res) => {
    const file = findFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    try {
      assertInsideRoot(file.absolutePath);
    } catch {
      return res.status(403).json({ error: 'Access denied' });
    }

    const ext = file.extension || path.extname(file.absolutePath).slice(1);
    const types = { html: 'text/html', htm: 'text/html', svg: 'image/svg+xml', jsx: 'text/plain', tsx: 'text/plain' };
    res.setHeader('Content-Type', types[ext] || 'text/plain');
    res.sendFile(file.absolutePath);
  });

  app.post('/api/files/:id/rename', async (req, res) => {
    try {
      await renameFile(rootDir, req.params.id, req.body.newName, scanData);
      await rescan();
      res.json(await filesResponse());
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/files/:id/move', async (req, res) => {
    try {
      await moveFile(rootDir, req.params.id, req.body.destination, scanData);
      await rescan();
      res.json(await filesResponse());
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/files/:id/duplicate', async (req, res) => {
    try {
      await duplicateFile(rootDir, req.params.id, scanData);
      await rescan();
      res.json(await filesResponse());
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/files/:id', async (req, res) => {
    try {
      await deleteFile(rootDir, req.params.id, scanData);
      await rescan();
      res.json(await filesResponse());
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/files/:id/restore', async (req, res) => {
    try {
      await restoreFile(rootDir, req.params.id);
      await rescan();
      res.json(await filesResponse());
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

  app.get('/api/config', (_req, res) => {
    res.json(config);
  });

  app.put('/api/config', async (req, res) => {
    config = await updateConfig(rootDir, req.body);
    res.json(config);
  });

  app.put('/api/config/favorite/:id', async (req, res) => {
    const id = req.params.id;
    const idx = config.favorites.indexOf(id);
    if (idx >= 0) config.favorites.splice(idx, 1);
    else config.favorites.push(id);
    await saveConfig(rootDir, config);
    res.json(config);
  });

  app.put('/api/config/tags/:id', async (req, res) => {
    config.tags[req.params.id] = req.body.tags || [];
    await saveConfig(rootDir, config);
    res.json(config);
  });

  app.put('/api/config/notes/:id', async (req, res) => {
    config.notes[req.params.id] = req.body.note || '';
    await saveConfig(rootDir, config);
    res.json(config);
  });

  app.put('/api/config/status/:id', async (req, res) => {
    config.statuses[req.params.id] = req.body.status || 'draft';
    await saveConfig(rootDir, config);
    res.json(config);
  });

  app.put('/api/config/project/:id', async (req, res) => {
    config.projects[req.params.id] = req.body.project || '';
    await saveConfig(rootDir, config);
    res.json(config);
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
  function findFileById(id) {
    for (const file of scanData.files) {
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

  return { port, server, scanResult: scanData };
}

module.exports = { startServer };
