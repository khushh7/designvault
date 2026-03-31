const fg = require('fast-glob');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.designvault',
  'coverage',
  '.turbo',
  '.vercel',
  'storybook-static',
  'test-app',
  'vite-test',
  'tests',
  'test',
  '__tests__',
  'fixtures',
  'examples',
  'example',
  'sandbox',
  'playground',
]);

const IGNORED_BASENAMES = new Set([
  'layout',
  'loading',
  'error',
  'not-found',
  '_app',
  '_document',
]);

const IGNORED_SVG_FILENAMES = new Set([
  'favicon.svg',
  'next.svg',
  'vercel.svg',
  'vite.svg',
  'react.svg',
  'file.svg',
  'globe.svg',
  'window.svg',
]);

const PAGE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.htm']);
const LOCAL_PREVIEW_PORT_PREFERENCE = [3000, 3001, 3002, 3003, 4173, 4321, 5173, 8080, 8787];
const PREVIEW_BASE_URL_CACHE_TTL_MS = 5000;
const previewBaseUrlCache = new Map();

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getBaseName(filename) {
  const ext = path.extname(filename);
  let name = path.basename(filename, ext);

  // Strategy: if the name contains a version marker like -v4, -v12, _v2,
  // strip from that marker onward. This groups:
  //   competitor-intelligence-v4-multiview  → competitor-intelligence
  //   competitor-intelligence-v8-final      → competitor-intelligence
  //   competitor-intelligence-v9-simplified  → competitor-intelligence
  // But NOT:
  //   competitor-intelligence-report        → competitor-intelligence-report (no -vN)
  //   competitor-intelligence-wizard        → competitor-intelligence-wizard (no -vN)
  const versionMatch = name.match(/^(.+?)[-_]v\d+/i);
  if (versionMatch) {
    return versionMatch[1].toLowerCase();
  }

  // No -vN found. Still strip trailing modifiers like -final, -copy, -2, etc.
  // so that "hero.html" and "hero-final.html" and "hero-copy.html" group together.
  name = name.replace(/[-_](final|copy|revised|new|old|backup|alt)$/i, '');
  name = name.replace(/[-_]\d+$/i, '');
  return name.toLowerCase();
}

function isIgnoredByDirectory(relativePath) {
  const segments = relativePath.split(/[\\/]/);
  return segments.some((segment) => IGNORED_DIR_NAMES.has(segment.toLowerCase()));
}

function isLikelyFrameworkBoilerplate(relativePath) {
  const filename = path.basename(relativePath);
  const ext = path.extname(filename).toLowerCase();
  const name = path.basename(filename, ext).toLowerCase();

  if (ext === '.svg' && IGNORED_SVG_FILENAMES.has(filename.toLowerCase())) {
    return true;
  }

  if ((ext === '.jsx' || ext === '.tsx') && IGNORED_BASENAMES.has(name)) {
    return true;
  }

  return false;
}

function normalizeSegments(relativePath) {
  return relativePath.split(/[\\/]/).filter(Boolean);
}

function isRouteGroupSegment(segment) {
  return /^\(.*\)$/.test(segment);
}

function isNonRoutableSegment(segment) {
  return isRouteGroupSegment(segment) || segment.startsWith('@');
}

function normalizeRouteSegments(segments) {
  return segments.filter((segment) => !isNonRoutableSegment(segment));
}

function buildRouteMeta(routePath) {
  return {
    routePath,
    displayName: routePath === '/' ? 'Home' : routePath,
  };
}

function getAppRouteMeta(relativePath) {
  const segments = normalizeSegments(relativePath);
  const appIndex = segments.indexOf('app');
  if (appIndex === -1) return null;

  const filename = segments[segments.length - 1];
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, ext).toLowerCase();
  if (!PAGE_EXTENSIONS.has(ext) || basename !== 'page') return null;

  const routeSegments = normalizeRouteSegments(segments.slice(appIndex + 1, -1));
  const routePath = routeSegments.length === 0 ? '/' : `/${routeSegments.join('/')}`;
  return {
    ...buildRouteMeta(routePath),
    kind: 'route',
    routeSource: 'app',
  };
}

function getPagesRouteMeta(relativePath) {
  const segments = normalizeSegments(relativePath);
  const pagesIndex = segments.findIndex((segment, index) => {
    if (segment !== 'pages') return false;
    return index === 0 || segments[index - 1] === 'src';
  });

  if (pagesIndex === -1) return null;

  const routeSegments = normalizeRouteSegments(segments.slice(pagesIndex + 1));
  if (routeSegments[0] === 'api' || routeSegments.length === 0) return null;

  const filename = routeSegments[routeSegments.length - 1];
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, ext).toLowerCase();
  if (!PAGE_EXTENSIONS.has(ext) || IGNORED_BASENAMES.has(basename)) return null;

  const routeParts = [...routeSegments];
  routeParts[routeParts.length - 1] = basename === 'index' ? '' : path.basename(filename, ext);
  const cleanParts = routeParts.filter(Boolean);
  const routePath = cleanParts.length === 0 ? '/' : `/${cleanParts.join('/')}`;
  return {
    ...buildRouteMeta(routePath),
    kind: 'route',
    routeSource: 'pages',
  };
}

function getHtmlRouteMeta(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext !== '.html' && ext !== '.htm') return null;

  const segments = normalizeSegments(relativePath);
  const filename = segments[segments.length - 1];
  const basename = path.basename(filename, ext).toLowerCase();
  const routeParts = [...segments];
  routeParts[routeParts.length - 1] = basename === 'index' ? '' : path.basename(filename, ext);
  const cleanParts = routeParts.filter(Boolean);
  const routePath = cleanParts.length === 0 ? '/' : `/${cleanParts.join('/')}`;
  return {
    ...buildRouteMeta(routePath),
    routeSource: 'html',
  };
}

function getRouteMeta(relativePath) {
  return getAppRouteMeta(relativePath) || getPagesRouteMeta(relativePath) || getHtmlRouteMeta(relativePath);
}

function normalizePreviewBaseUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return `https://${trimmed.replace(/\/+$/, '')}`;
  }

  return null;
}

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout || '');
    });
  });
}

async function detectRunningLocalPreviewBaseUrl(rootDir) {
  if (process.platform === 'win32') return null;

  let listeningPortsOutput;
  try {
    listeningPortsOutput = await execFileAsync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return null;
  }

  const candidates = [];
  const lines = listeningPortsOutput.split('\n').slice(1);

  for (const line of lines) {
    const match = line.match(/^\S+\s+(\d+)\s+\S+.*TCP\s+.*:(\d+)\s+\(LISTEN\)$/);
    if (!match) continue;

    const pid = match[1];
    const port = Number(match[2]);
    if (!Number.isFinite(port)) continue;

    try {
      const cwdOutput = await execFileAsync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']);
      const cwdLine = cwdOutput.split('\n').find((entry) => entry.startsWith('n'));
      const cwd = cwdLine ? cwdLine.slice(1) : '';
      if (cwd === rootDir) {
        candidates.push(port);
      }
    } catch {}
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aIndex = LOCAL_PREVIEW_PORT_PREFERENCE.indexOf(a);
    const bIndex = LOCAL_PREVIEW_PORT_PREFERENCE.indexOf(b);
    const aScore = aIndex === -1 ? LOCAL_PREVIEW_PORT_PREFERENCE.length + a : aIndex;
    const bScore = bIndex === -1 ? LOCAL_PREVIEW_PORT_PREFERENCE.length + b : bIndex;
    return aScore - bScore;
  });

  return `http://127.0.0.1:${candidates[0]}`;
}

async function isReachablePreviewBaseUrl(baseUrl) {
  if (!baseUrl) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(baseUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    return response.ok || (response.status >= 300 && response.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function detectPreviewBaseUrl(rootDir) {
  const cached = previewBaseUrlCache.get(rootDir);
  if (cached && Date.now() - cached.timestamp < PREVIEW_BASE_URL_CACHE_TTL_MS) {
    return cached.value;
  }

  const remember = (value) => {
    previewBaseUrlCache.set(rootDir, { value, timestamp: Date.now() });
    return value;
  };

  const localPreviewBaseUrl = await detectRunningLocalPreviewBaseUrl(rootDir);
  if (localPreviewBaseUrl) return remember(localPreviewBaseUrl);

  const configFile = path.join(rootDir, '.designvault.json');
  try {
    const config = JSON.parse(await fs.promises.readFile(configFile, 'utf8'));
    const configuredUrl =
      config.previewBaseUrl ||
      config.preview_base_url ||
      config.siteUrl ||
      config.site_url;
    const normalizedConfigUrl = normalizePreviewBaseUrl(configuredUrl);
    if (normalizedConfigUrl) return remember(normalizedConfigUrl);
  } catch {}

  const packageJsonFile = path.join(rootDir, 'package.json');
  let packageName = null;
  try {
    const pkg = JSON.parse(await fs.promises.readFile(packageJsonFile, 'utf8'));
    packageName = typeof pkg.name === 'string' ? pkg.name.trim() : null;
    const normalizedHomepage = normalizePreviewBaseUrl(pkg.homepage);
    if (normalizedHomepage) return remember(normalizedHomepage);
  } catch {}

  const layoutCandidates = [
    path.join(rootDir, 'app', 'layout.tsx'),
    path.join(rootDir, 'app', 'layout.jsx'),
    path.join(rootDir, 'src', 'app', 'layout.tsx'),
    path.join(rootDir, 'src', 'app', 'layout.jsx'),
  ];

  for (const layoutFile of layoutCandidates) {
    try {
      const layout = await fs.promises.readFile(layoutFile, 'utf8');
      const metadataBaseMatch = layout.match(/metadataBase:\s*new URL\((["'`])([^"'`]+)\1\)/);
      const normalizedMetadataBase = normalizePreviewBaseUrl(metadataBaseMatch && metadataBaseMatch[2]);
      if (normalizedMetadataBase) return remember(normalizedMetadataBase);

      const canonicalMatch = layout.match(/canonical:\s*(["'`])([^"'`]+)\1/);
      const normalizedCanonical = normalizePreviewBaseUrl(canonicalMatch && canonicalMatch[2]);
      if (normalizedCanonical) return remember(normalizedCanonical);

      const titleMatch = layout.match(/title:\s*["'`]([^"'`]+)["'`]/);
      const normalizedTitleUrl = normalizePreviewBaseUrl(titleMatch && titleMatch[1]);
      if (normalizedTitleUrl) return remember(normalizedTitleUrl);
    } catch {}
  }

  const vercelProjectFile = path.join(rootDir, '.vercel', 'project.json');
  try {
    const vercelProject = JSON.parse(await fs.promises.readFile(vercelProjectFile, 'utf8'));
    const vercelName =
      vercelProject.projectName ||
      vercelProject.name ||
      packageName;
    const normalizedVercelUrl = normalizePreviewBaseUrl(vercelName && `${vercelName}.vercel.app`);
    if (await isReachablePreviewBaseUrl(normalizedVercelUrl)) {
      return remember(normalizedVercelUrl);
    }
  } catch {}

  if (packageName) {
    const normalizedVercelUrl = normalizePreviewBaseUrl(`${packageName}.vercel.app`);
    if (await isReachablePreviewBaseUrl(normalizedVercelUrl)) {
      return remember(normalizedVercelUrl);
    }
  }

  return remember(null);
}

async function scanDirectory(rootDir) {
  const previewBaseUrl = await detectPreviewBaseUrl(rootDir);
  const entries = await fg(['**/*.{html,htm,jsx,tsx,svg}'], {
    cwd: rootDir,
    ignore: [
      '**/node_modules/**',
      '**/.*/**',       // all dotfiles/dotfolders (.git, .Trash, .cache, etc.)
      '.*/**',          // top-level dotfolders
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.designvault/**',
    ],
    stats: true,
    absolute: false,
    suppressErrors: true,   // skip EPERM / EACCES directories silently
  });

  const files = (await Promise.all(
    entries.map(async (entry) => {
      const relativePath = typeof entry === 'string' ? entry : entry.path;
      if (isIgnoredByDirectory(relativePath) || isLikelyFrameworkBoilerplate(relativePath)) {
        return null;
      }

      const absolutePath = path.join(rootDir, relativePath);
      try {
        const stat = await fs.promises.stat(absolutePath);
        const ext = path.extname(relativePath).slice(1);
        const filename = path.basename(relativePath);
        const name = path.basename(relativePath, path.extname(relativePath));
        const routeMeta = getRouteMeta(relativePath);
        const previewUrl =
          routeMeta?.kind === 'route' && previewBaseUrl
            ? `${previewBaseUrl}${routeMeta.routePath === '/' ? '' : routeMeta.routePath}`
            : null;

        // A file is previewable if it can render visually in a browser
        const isHtmlLike = ext === 'html' || ext === 'htm';
        const isSvg = ext === 'svg';
        const previewable = isHtmlLike || isSvg || !!previewUrl;

        return {
          id: simpleHash(relativePath),
          name,
          filename,
          extension: ext,
          relativePath,
          absolutePath,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
          previewable,
          ...routeMeta,
          previewUrl,
        };
      } catch {
        // Skip files we can't stat (permission denied, etc.)
        return null;
      }
    })
  )).filter(Boolean);

  const hasProjectRoutes = files.some((file) => file.routeSource === 'app' || file.routeSource === 'pages');
  const visibleFiles = hasProjectRoutes
    ? files.filter((file) => file.kind === 'route')
    : files;

  // Group by base name + directory
  const groups = {};
  for (const file of visibleFiles) {
    const dir = path.dirname(file.relativePath);
    const base = getBaseName(file.filename);
    const key = `${dir}::${base}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  }

  // Build version stacks
  let versionStacks = 0;
  const result = [];
  const byExtension = {};

  for (const key of Object.keys(groups)) {
    const group = groups[key].sort((a, b) => new Date(a.modifiedAt) - new Date(b.modifiedAt));

    if (group.length > 1) {
      versionStacks++;
      // Mark the most recent as current
      group.forEach((f, i) => (f.current = i === group.length - 1));

      const current = group[group.length - 1];
      const versions = group.map((f, i) => ({
        id: f.id,
        filename: f.filename,
        label: `v${i + 1}`,
        modifiedAt: f.modifiedAt,
        current: f.current,
      }));

      result.push({ ...current, versions });
    } else {
      result.push({ ...group[0], versions: null });
    }

    for (const f of group) {
      byExtension[f.extension] = (byExtension[f.extension] || 0) + 1;
    }
  }

  const previewableCount = result.filter((f) => f.previewable).length;

  return {
    files: result,
    stats: {
      totalFiles: result.length,
      previewableFiles: previewableCount,
      scannedFiles: files.length,
      versionStacks,
      byExtension,
      mode: hasProjectRoutes ? 'routes' : 'files',
    },
  };
}

module.exports = { scanDirectory, simpleHash };
