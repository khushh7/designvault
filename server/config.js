const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG_FILE = '.designvault.json';
const GLOBAL_CONFIG_FILE = path.join(os.homedir(), '.designvault.json');

const DEFAULTS = {
  favorites: [],
  tags: {},
  notes: {},
  projects: {},
  statuses: {},
  manualGroups: {},
  projectList: [],
};

function configPath(rootDir) {
  return path.join(rootDir, CONFIG_FILE);
}

async function loadConfig(rootDir) {
  const file = configPath(rootDir);
  try {
    const raw = await fs.promises.readFile(file, 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

async function saveConfig(rootDir, config) {
  const file = configPath(rootDir);
  await fs.promises.writeFile(file, JSON.stringify(config, null, 2), 'utf-8');
}

async function updateConfig(rootDir, partial) {
  const config = await loadConfig(rootDir);
  Object.assign(config, partial);
  await saveConfig(rootDir, config);
  return config;
}

// --- Global config (persists across restarts) ---

async function loadGlobalConfig() {
  try {
    const raw = await fs.promises.readFile(GLOBAL_CONFIG_FILE, 'utf-8');
    return { projects: [], lastDir: null, ...JSON.parse(raw) };
  } catch {
    return { projects: [], lastDir: null };
  }
}

async function saveGlobalConfig(data) {
  const existing = await loadGlobalConfig();
  const merged = { ...existing, ...data };
  await fs.promises.writeFile(GLOBAL_CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

// --- Project registry ---

const PROJECT_COLORS = ['#e67e22', '#27ae60', '#2563eb', '#8b5cf6', '#ec4899', '#14b8a6', '#0891b2', '#dc2626'];

async function registerProject(rootDir) {
  const folderName = path.basename(rootDir);
  if (!folderName) return;

  const global = await loadGlobalConfig();
  const existing = global.projects.find((p) => p.directory === rootDir);
  if (existing) {
    // Update lastScanned timestamp
    existing.lastScanned = new Date().toISOString();
    await saveGlobalConfig({ projects: global.projects });
    return;
  }

  const color = PROJECT_COLORS[global.projects.length % PROJECT_COLORS.length];
  global.projects.push({
    name: folderName,
    directory: rootDir,
    color,
    createdAt: new Date().toISOString(),
    lastScanned: new Date().toISOString(),
  });
  await saveGlobalConfig({ projects: global.projects });
}

async function removeProject(directory) {
  const global = await loadGlobalConfig();
  global.projects = global.projects.filter((p) => p.directory !== directory);
  await saveGlobalConfig({ projects: global.projects });
  return global;
}

module.exports = { loadConfig, saveConfig, updateConfig, loadGlobalConfig, saveGlobalConfig, registerProject, removeProject };
