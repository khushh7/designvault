const fg = require('fast-glob');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.output',
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

const GENERAL_FILE_EXTENSIONS = new Set(['.html', '.htm', '.jsx', '.tsx', '.svg']);
const ROUTE_FILE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.vue', '.svelte', '.astro', '.md', '.mdx']);
const SVELTE_PAGE_EXTENSIONS = new Set(['.svelte', '.md', '.svx']);
const SRC_ROUTES_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx']);
const CONFIG_SITE_FILE_CANDIDATES = [
  'astro.config.mjs',
  'astro.config.mts',
  'astro.config.ts',
  'astro.config.js',
  'astro.config.cjs',
  'nuxt.config.ts',
  'nuxt.config.js',
  'nuxt.config.mjs',
  'nuxt.config.cjs',
  'vitepress.config.ts',
  'vitepress.config.js',
  '.vitepress/config.ts',
  '.vitepress/config.js',
  'docusaurus.config.ts',
  'docusaurus.config.js',
  'docusaurus.config.mjs',
  'docusaurus.config.cjs',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
];
const CONFIG_URL_KEY_REGEX = /\b(site|url|siteUrl|site_url|metadataBase|canonical)\s*:\s*(?:new URL\()?(["'`])([^"'`]+)\2/g;
const SCRIPT_PORT_PATTERNS = [
  /(?:^|\s)--port(?:=|\s+)(\d{2,5})(?=\s|$)/i,
  /(?:^|\s)-p\s+(\d{2,5})(?=\s|$)/i,
  /(?:^|\s)PORT=(\d{2,5})(?=\s|$)/i,
];
const SCRIPT_HOST_PATTERNS = [
  /(?:^|\s)--host(?:=|\s+)([^\s]+)(?=\s|$)/i,
  /(?:^|\s)-H\s+([^\s]+)(?=\s|$)/i,
  /(?:^|\s)HOST=([^\s]+)(?=\s|$)/i,
];
const LOCAL_PREVIEW_PORT_PREFERENCE = [3000, 3001, 3002, 3003, 4173, 4321, 5173, 8080, 8787];
const PREVIEW_BASE_URL_CACHE_TTL_MS = 5000;
const previewBaseUrlCache = new Map();
const LOCAL_DIST_PREVIEW_BASE = '/__project_preview__';

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

function sanitizeRouteParamName(value) {
  return (value || 'param').replace(/^\.{3}/, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'param';
}

function isRouteGroupSegment(segment) {
  return /^\(.*\)$/.test(segment);
}

function isNonRoutableSegment(segment) {
  return isRouteGroupSegment(segment) || segment.startsWith('@');
}

function normalizeBracketRouteSegment(segment) {
  const optionalCatchAllMatch = segment.match(/^\[\[\.\.\.(.+)\]\]$/);
  if (optionalCatchAllMatch) return '*';

  const catchAllMatch = segment.match(/^\[\.\.\.(.+)\]$/);
  if (catchAllMatch) return '*';

  const optionalParamMatch = segment.match(/^\[\[(.+)\]\]$/);
  if (optionalParamMatch) return `:${sanitizeRouteParamName(optionalParamMatch[1])}?`;

  const paramMatch = segment.match(/^\[(.+)\]$/);
  if (paramMatch) return `:${sanitizeRouteParamName(paramMatch[1])}`;

  return segment;
}

function normalizeRouteSegment(segment, options = {}) {
  if (!segment) return null;
  if (isNonRoutableSegment(segment)) return null;

  if (options.framework === 'remix') {
    if (segment === 'index' || segment === '_index') return '';
    if (segment === '$') return '*';
    if (segment.startsWith('$')) {
      return `:${sanitizeRouteParamName(segment.slice(1))}`;
    }
    if (segment.startsWith('_')) return null;
    if (segment.endsWith('_')) segment = segment.slice(0, -1);
  }

  return normalizeBracketRouteSegment(segment);
}

function normalizeRouteSegments(segments, options = {}) {
  return segments
    .map((segment) => normalizeRouteSegment(segment, options))
    .filter((segment) => segment !== null && segment !== '');
}

function buildRoutePathFromSegments(segments, options = {}) {
  const normalizedSegments = normalizeRouteSegments(segments, options);
  return normalizedSegments.length === 0 ? '/' : `/${normalizedSegments.join('/')}`.replace(/\/+/g, '/');
}

function buildRoutePathFromFile(dirSegments, fileStem, options = {}) {
  const segments = [...dirSegments];
  const normalizedStem = normalizeRouteSegment(fileStem, options);
  if (normalizedStem) {
    segments.push(normalizedStem);
  }
  return buildRoutePathFromSegments(segments, options);
}

function joinRoutePaths(parentPath, childPath, isIndex = false) {
  if (isIndex) return parentPath || '/';
  if (!childPath) return parentPath || '/';
  if (childPath.startsWith('/')) return childPath;

  const base = parentPath && parentPath !== '/' ? parentPath.replace(/\/+$/, '') : '';
  return `${base}/${childPath}`.replace(/\/+/g, '/');
}

function createPreviewRoutePath(routePath) {
  if (!routePath) return '/';
  return routePath
    .replace(/:([A-Za-z0-9_]+)\??/g, 'preview')
    .replace(/\*/g, 'preview')
    .replace(/\/+/g, '/');
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
  if (!ROUTE_FILE_EXTENSIONS.has(ext) || basename !== 'page') return null;

  const routePath = buildRoutePathFromSegments(segments.slice(appIndex + 1, -1));
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

  const rawFilename = segments[segments.length - 1];
  const ext = path.extname(rawFilename).toLowerCase();
  const basename = path.basename(rawFilename, ext).toLowerCase();
  if (!ROUTE_FILE_EXTENSIONS.has(ext) || IGNORED_BASENAMES.has(basename)) return null;

  const dirSegments = segments.slice(pagesIndex + 1, -1);
  if (dirSegments[0] === 'api') return null;
  const routePath = basename === 'index'
    ? buildRoutePathFromSegments(dirSegments)
    : buildRoutePathFromFile(dirSegments, path.basename(rawFilename, ext));
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
  const routePath = basename === 'index'
    ? buildRoutePathFromSegments(segments.slice(0, -1))
    : buildRoutePathFromFile(segments.slice(0, -1), path.basename(filename, ext));
  return {
    ...buildRouteMeta(routePath),
    routeSource: 'html',
  };
}

function getRemixRouteMeta(relativePath, frameworkHints = {}) {
  if (!frameworkHints.remix) return null;

  const segments = normalizeSegments(relativePath);
  const routesIndex = segments.indexOf('routes');
  if (routesIndex === -1 || segments[routesIndex - 1] !== 'app') return null;

  const filename = segments[segments.length - 1];
  const ext = path.extname(filename).toLowerCase();
  if (!ROUTE_FILE_EXTENSIONS.has(ext)) return null;

  const basename = path.basename(filename, ext);
  const basenameLower = basename.toLowerCase();
  if (IGNORED_BASENAMES.has(basenameLower) || basenameLower.endsWith('.server')) return null;

  const dirSegments = segments.slice(routesIndex + 1, -1);
  const fileSegments = basename.split('.');
  const routePath = buildRoutePathFromSegments([...dirSegments, ...fileSegments], { framework: 'remix' });
  return {
    ...buildRouteMeta(routePath),
    kind: 'route',
    routeSource: 'remix',
  };
}

function getSvelteKitRouteMeta(relativePath, frameworkHints = {}) {
  if (!frameworkHints.svelteKit) return null;

  const segments = normalizeSegments(relativePath);
  if (segments[0] !== 'src' || segments[1] !== 'routes') return null;

  const filename = segments[segments.length - 1];
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, ext).toLowerCase();
  if (!SVELTE_PAGE_EXTENSIONS.has(ext) || basename !== '+page') return null;

  const dirSegments = segments.slice(2, -1);
  if (dirSegments[0] === 'api') return null;
  const routePath = buildRoutePathFromSegments(dirSegments);
  return {
    ...buildRouteMeta(routePath),
    kind: 'route',
    routeSource: 'sveltekit',
  };
}

function getSrcRoutesRouteMeta(relativePath, frameworkHints = {}) {
  if (!frameworkHints.qwik && !frameworkHints.solidStart) return null;

  const segments = normalizeSegments(relativePath);
  if (segments[0] !== 'src' || segments[1] !== 'routes') return null;

  const filename = segments[segments.length - 1];
  const ext = path.extname(filename).toLowerCase();
  if (!SRC_ROUTES_EXTENSIONS.has(ext)) return null;

  const basename = path.basename(filename, ext).toLowerCase();
  if (IGNORED_BASENAMES.has(basename) || basename.startsWith('+')) return null;

  const dirSegments = segments.slice(2, -1);
  if (dirSegments[0] === 'api' || basename === 'api') return null;

  const routePath = basename === 'index'
    ? buildRoutePathFromSegments(dirSegments)
    : buildRoutePathFromFile(dirSegments, path.basename(filename, ext));
  return {
    ...buildRouteMeta(routePath),
    kind: 'route',
    routeSource: frameworkHints.qwik ? 'qwik-city' : 'src-routes',
  };
}

function getRouteMeta(relativePath, frameworkHints = {}) {
  return (
    getRemixRouteMeta(relativePath, frameworkHints) ||
    getSvelteKitRouteMeta(relativePath, frameworkHints) ||
    getSrcRoutesRouteMeta(relativePath, frameworkHints) ||
    getAppRouteMeta(relativePath) ||
    getPagesRouteMeta(relativePath) ||
    getHtmlRouteMeta(relativePath)
  );
}

function findMatchingBracket(text, startIndex, openChar, closeChar) {
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaping = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === openChar) depth++;
    if (char === closeChar) depth--;
    if (depth === 0) return i;
  }

  return -1;
}

function tokenizeRouteConfig(source) {
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    if (char === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    if ('{}[]:,'.includes(char)) {
      tokens.push({ type: char, value: char });
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      i++;
      while (i < source.length) {
        const current = source[i];
        if (current === '\\') {
          value += source[i + 1] || '';
          i += 2;
          continue;
        }
        if (current === quote) {
          i++;
          break;
        }
        value += current;
        i++;
      }
      tokens.push({ type: 'string', value });
      continue;
    }

    const identifierMatch = source.slice(i).match(/^[A-Za-z_$][A-Za-z0-9_$-]*/);
    if (identifierMatch) {
      const value = identifierMatch[0];
      tokens.push({
        type: value === 'true' || value === 'false' ? 'boolean' : 'identifier',
        value: value === 'true' ? true : value === 'false' ? false : value,
      });
      i += value.length;
      continue;
    }

    i++;
  }

  return tokens;
}

function parseRouteConfigValue(tokens, index = 0) {
  const token = tokens[index];
  if (!token) return { value: null, nextIndex: index };

  if (token.type === 'string' || token.type === 'boolean') {
    return { value: token.value, nextIndex: index + 1 };
  }

  if (token.type === 'identifier') {
    return { value: { type: 'identifier', value: token.value }, nextIndex: index + 1 };
  }

  if (token.type === '[') {
    const items = [];
    let cursor = index + 1;
    while (tokens[cursor] && tokens[cursor].type !== ']') {
      if (tokens[cursor].type === ',') {
        cursor++;
        continue;
      }
      const parsed = parseRouteConfigValue(tokens, cursor);
      items.push(parsed.value);
      cursor = parsed.nextIndex;
      if (tokens[cursor] && tokens[cursor].type === ',') cursor++;
    }
    return { value: items, nextIndex: cursor + 1 };
  }

  if (token.type === '{') {
    const obj = {};
    let cursor = index + 1;
    while (tokens[cursor] && tokens[cursor].type !== '}') {
      if (tokens[cursor].type === ',') {
        cursor++;
        continue;
      }
      const keyToken = tokens[cursor];
      const key = keyToken?.type === 'identifier' || keyToken?.type === 'string' ? keyToken.value : null;
      cursor++;
      if (tokens[cursor] && tokens[cursor].type === ':') cursor++;
      const parsed = parseRouteConfigValue(tokens, cursor);
      obj[key] = parsed.value;
      cursor = parsed.nextIndex;
      if (tokens[cursor] && tokens[cursor].type === ',') cursor++;
    }
    return { value: obj, nextIndex: cursor + 1 };
  }

  return { value: null, nextIndex: index + 1 };
}

function resolveImportPath(importerRelativePath, importPath) {
  if (!importPath.startsWith('.')) return null;

  const importerDir = path.dirname(importerRelativePath);
  const candidateBase = path.posix.normalize(path.posix.join(importerDir, importPath));
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.js`,
    `${candidateBase}.jsx`,
    path.posix.join(candidateBase, 'index.ts'),
    path.posix.join(candidateBase, 'index.tsx'),
    path.posix.join(candidateBase, 'index.js'),
    path.posix.join(candidateBase, 'index.jsx'),
  ];

  return candidates;
}

async function detectReactRouterRoutes(rootDir) {
  const routeFiles = await fg(['**/routes.{js,jsx,ts,tsx}'], {
    cwd: rootDir,
    ignore: [
      '**/node_modules/**',
      '**/.*/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
    ],
    absolute: false,
    suppressErrors: true,
  });

  const routeMap = new Map();

  for (const routeFile of routeFiles) {
    let source;
    try {
      source = await fs.promises.readFile(path.join(rootDir, routeFile), 'utf8');
    } catch {
      continue;
    }

    if (!source.includes('createBrowserRouter')) continue;

    const importMap = new Map();
    const importRegex = /import\s+(?:\{([^}]+)\}|([A-Za-z_$][\w$]*))\s+from\s+["']([^"']+)["'];?/g;
    let importMatch;
    while ((importMatch = importRegex.exec(source))) {
      const namedImports = importMatch[1];
      const defaultImport = importMatch[2];
      const importPath = importMatch[3];
      const resolvedCandidates = resolveImportPath(routeFile, importPath);
      if (!resolvedCandidates) continue;

      if (defaultImport) {
        importMap.set(defaultImport, resolvedCandidates);
      }

      if (namedImports) {
        namedImports
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .forEach((entry) => {
            const parts = entry.split(/\s+as\s+/i).map((part) => part.trim());
            const localName = parts[1] || parts[0];
            importMap.set(localName, resolvedCandidates);
          });
      }
    }

    const startToken = 'createBrowserRouter';
    const routerIndex = source.indexOf(startToken);
    if (routerIndex === -1) continue;
    const arrayStart = source.indexOf('[', routerIndex);
    if (arrayStart === -1) continue;
    const arrayEnd = findMatchingBracket(source, arrayStart, '[', ']');
    if (arrayEnd === -1) continue;

    const routeArraySource = source.slice(arrayStart, arrayEnd + 1);
    const parsed = parseRouteConfigValue(tokenizeRouteConfig(routeArraySource), 0);
    const routes = Array.isArray(parsed.value) ? parsed.value : [];

    const registerRoutes = (nodes, parentPath = '') => {
      for (const node of nodes) {
        if (!node || typeof node !== 'object' || Array.isArray(node)) continue;

        const childPath = typeof node.path === 'string' ? node.path : '';
        const isIndex = node.index === true;
        const fullPath = joinRoutePaths(parentPath, childPath, isIndex);
        const children = Array.isArray(node.children) ? node.children : [];
        const componentIdentifier = node.Component?.type === 'identifier' ? node.Component.value : null;

        if (componentIdentifier && children.length === 0) {
          const candidates = importMap.get(componentIdentifier) || [];
          for (const candidate of candidates) {
            routeMap.set(candidate, {
              ...buildRouteMeta(fullPath),
              kind: 'route',
              routeSource: 'react-router',
            });
          }
        }

        if (children.length > 0) {
          registerRoutes(children, fullPath);
        }
      }
    };

    registerRoutes(routes);
  }

  return routeMap;
}

async function readPackageJson(rootDir) {
  try {
    return JSON.parse(await fs.promises.readFile(path.join(rootDir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

function getPackageDependencySet(pkg) {
  return new Set(
    Object.keys({
      ...(pkg?.dependencies || {}),
      ...(pkg?.devDependencies || {}),
      ...(pkg?.peerDependencies || {}),
    })
  );
}

function hasAnyDependency(dependencies, names) {
  return names.some((name) => dependencies.has(name));
}

function detectFrameworkHints(rootDir, pkg) {
  const dependencies = getPackageDependencySet(pkg);
  const exists = (relativePath) => fs.existsSync(path.join(rootDir, relativePath));

  return {
    next: hasAnyDependency(dependencies, ['next']) || exists('next.config.js') || exists('next.config.mjs') || exists('next.config.ts'),
    astro: hasAnyDependency(dependencies, ['astro']) || exists('astro.config.mjs') || exists('astro.config.ts') || exists('astro.config.js'),
    nuxt: hasAnyDependency(dependencies, ['nuxt', 'nuxi']) || exists('nuxt.config.ts') || exists('nuxt.config.js'),
    remix: hasAnyDependency(dependencies, ['@remix-run/dev', '@remix-run/react', 'remix']),
    svelteKit: hasAnyDependency(dependencies, ['@sveltejs/kit']) || exists('svelte.config.js') || exists('svelte.config.ts'),
    qwik: hasAnyDependency(dependencies, ['@builder.io/qwik-city', '@builder.io/qwik']),
    solidStart: hasAnyDependency(dependencies, ['@solidjs/start', 'solid-start']),
    vite: hasAnyDependency(dependencies, ['vite']) || exists('vite.config.ts') || exists('vite.config.js') || exists('vite.config.mjs'),
    vitepress: hasAnyDependency(dependencies, ['vitepress']) || exists('.vitepress/config.ts') || exists('.vitepress/config.js'),
    docusaurus: hasAnyDependency(dependencies, ['@docusaurus/core']),
  };
}

function detectPackageManager(rootDir, pkg) {
  const configured = typeof pkg?.packageManager === 'string' ? pkg.packageManager.split('@')[0] : '';
  if (configured) return configured;
  if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(rootDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(rootDir, 'bun.lockb')) || fs.existsSync(path.join(rootDir, 'bun.lock'))) return 'bun';
  return 'npm';
}

function buildScriptCommand(packageManager, scriptName) {
  if (!scriptName) return null;
  if (packageManager === 'yarn') return `yarn ${scriptName}`;
  if (packageManager === 'pnpm') return `pnpm ${scriptName}`;
  if (packageManager === 'bun') return `bun run ${scriptName}`;
  if (scriptName === 'start') return 'npm start';
  return `npm run ${scriptName}`;
}

function extractScriptMatch(script, patterns) {
  for (const pattern of patterns) {
    const match = script.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function normalizePreviewHost(host) {
  if (!host) return 'localhost';
  const normalized = host.replace(/^['"`]|['"`]$/g, '');
  if (normalized === '0.0.0.0' || normalized === '::' || normalized === '[::]' || normalized === '[::1]') {
    return 'localhost';
  }
  return normalized;
}

function detectDefaultPreviewPort(frameworkHints, scriptBody = '') {
  if (frameworkHints.astro) return 4321;
  if (frameworkHints.vite || frameworkHints.svelteKit || frameworkHints.qwik || frameworkHints.solidStart || frameworkHints.vitepress || /\bvite\b/i.test(scriptBody)) {
    return 5173;
  }
  if (frameworkHints.next || frameworkHints.nuxt || frameworkHints.remix || frameworkHints.docusaurus) {
    return 3000;
  }
  return 3000;
}

function detectPortFromConfigFiles(rootDir) {
  for (const relativePath of CONFIG_SITE_FILE_CANDIDATES) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    try {
      const source = fs.readFileSync(absolutePath, 'utf8');
      const portMatch = source.match(/\bport\s*:\s*(\d{2,5})\b/);
      if (portMatch) return Number(portMatch[1]);
    } catch {}
  }
  return null;
}

function detectHostFromConfigFiles(rootDir) {
  for (const relativePath of CONFIG_SITE_FILE_CANDIDATES) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    try {
      const source = fs.readFileSync(absolutePath, 'utf8');
      const hostMatch = source.match(/\bhost\s*:\s*(["'`])([^"'`]+)\1/);
      if (hostMatch) return normalizePreviewHost(hostMatch[2]);
    } catch {}
  }
  return null;
}

async function detectDevServerInfo(rootDir, pkg, frameworkHints) {
  const scripts = pkg?.scripts || {};
  const scriptName = ['dev', 'start', 'serve', 'preview'].find((name) => typeof scripts[name] === 'string' && scripts[name].trim());
  const packageManager = detectPackageManager(rootDir, pkg);

  if (!scriptName) {
    return { command: null, scriptName: null, scriptBody: '', packageManager, port: null, host: null };
  }

  const scriptBody = scripts[scriptName].trim();
  const parsedPort = extractScriptMatch(scriptBody, SCRIPT_PORT_PATTERNS);
  const parsedHost = extractScriptMatch(scriptBody, SCRIPT_HOST_PATTERNS);
  const configuredPort = detectPortFromConfigFiles(rootDir);
  const configuredHost = detectHostFromConfigFiles(rootDir);

  return {
    command: buildScriptCommand(packageManager, scriptName),
    scriptName,
    scriptBody,
    packageManager,
    port: Number(parsedPort || configuredPort || detectDefaultPreviewPort(frameworkHints, scriptBody)),
    host: normalizePreviewHost(parsedHost || configuredHost || 'localhost'),
  };
}

function detectLocalBuiltPreviewRoot(rootDir) {
  for (const dirName of ['dist', 'build', 'out', '.output/public']) {
    const indexFile = path.join(rootDir, dirName, 'index.html');
    if (fs.existsSync(indexFile)) {
      return LOCAL_DIST_PREVIEW_BASE;
    }
  }
  return null;
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

async function detectRunningLocalPreviewBaseUrl(rootDir, preferredPorts = []) {
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
    const match = line.match(/^\S+\s+(\d+)\s+\S+.*TCP\s+(.+):(\d+)\s+\(LISTEN\)$/);
    if (!match) continue;

    const pid = match[1];
    const address = match[2];
    const port = Number(match[3]);
    if (!Number.isFinite(port)) continue;

    try {
      const cwdOutput = await execFileAsync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']);
      const cwdLine = cwdOutput.split('\n').find((entry) => entry.startsWith('n'));
      const cwd = cwdLine ? cwdLine.slice(1) : '';
      if (cwd === rootDir) {
        candidates.push({ port, address });
      }
    } catch {}
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aPreferredIndex = preferredPorts.indexOf(a.port);
    const bPreferredIndex = preferredPorts.indexOf(b.port);
    if (aPreferredIndex !== -1 || bPreferredIndex !== -1) {
      const aScore = aPreferredIndex === -1 ? preferredPorts.length + 100 : aPreferredIndex;
      const bScore = bPreferredIndex === -1 ? preferredPorts.length + 100 : bPreferredIndex;
      if (aScore !== bScore) return aScore - bScore;
    }

    const aIndex = LOCAL_PREVIEW_PORT_PREFERENCE.indexOf(a.port);
    const bIndex = LOCAL_PREVIEW_PORT_PREFERENCE.indexOf(b.port);
    const aScore = aIndex === -1 ? LOCAL_PREVIEW_PORT_PREFERENCE.length + a.port : aIndex;
    const bScore = bIndex === -1 ? LOCAL_PREVIEW_PORT_PREFERENCE.length + b.port : bIndex;
    return aScore - bScore;
  });

  for (const candidate of candidates) {
    const urls = [
      `http://localhost:${candidate.port}`,
      candidate.address.includes('::') ? `http://[::1]:${candidate.port}` : null,
      `http://127.0.0.1:${candidate.port}`,
    ].filter(Boolean);

    for (const url of urls) {
      if (await isReachablePreviewBaseUrl(url)) {
        return url;
      }
    }
  }

  return `http://localhost:${candidates[0].port}`;
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

function detectConfiguredSiteUrl(rootDir) {
  for (const relativePath of CONFIG_SITE_FILE_CANDIDATES) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    try {
      const source = fs.readFileSync(absolutePath, 'utf8');
      let match;
      while ((match = CONFIG_URL_KEY_REGEX.exec(source))) {
        const normalized = normalizePreviewBaseUrl(match[3]);
        if (normalized) {
          CONFIG_URL_KEY_REGEX.lastIndex = 0;
          return normalized;
        }
      }
      CONFIG_URL_KEY_REGEX.lastIndex = 0;
    } catch {}
  }

  const cnameFile = path.join(rootDir, 'CNAME');
  if (fs.existsSync(cnameFile)) {
    try {
      const normalized = normalizePreviewBaseUrl(fs.readFileSync(cnameFile, 'utf8').trim());
      if (normalized) return normalized;
    } catch {}
  }

  return null;
}

function detectLikelyLocalPreviewBaseUrl(devServerInfo) {
  if (!devServerInfo?.command || !Number.isFinite(devServerInfo.port) || devServerInfo.port <= 0) {
    return null;
  }
  return `http://${normalizePreviewHost(devServerInfo.host)}:${devServerInfo.port}`;
}

async function detectPreviewBaseUrl(rootDir, options = {}) {
  const cached = previewBaseUrlCache.get(rootDir);
  if (cached && Date.now() - cached.timestamp < PREVIEW_BASE_URL_CACHE_TTL_MS) {
    return cached.value;
  }

  const remember = (value) => {
    previewBaseUrlCache.set(rootDir, { value, timestamp: Date.now() });
    return value;
  };

  const pkg = options.pkg || await readPackageJson(rootDir);
  const frameworkHints = options.frameworkHints || detectFrameworkHints(rootDir, pkg);
  const devServerInfo = options.devServerInfo || await detectDevServerInfo(rootDir, pkg, frameworkHints);

  const localPreviewBaseUrl = await detectRunningLocalPreviewBaseUrl(
    rootDir,
    Number.isFinite(devServerInfo.port) ? [devServerInfo.port] : []
  );
  if (localPreviewBaseUrl) return remember(localPreviewBaseUrl);

  const localBuiltPreviewBase = detectLocalBuiltPreviewRoot(rootDir);
  if (localBuiltPreviewBase) return remember(localBuiltPreviewBase);

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

  const packageName = typeof pkg?.name === 'string' ? pkg.name.trim() : null;
  const normalizedHomepage = normalizePreviewBaseUrl(pkg?.homepage);
  if (normalizedHomepage) return remember(normalizedHomepage);

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

  const configuredSiteUrl = detectConfiguredSiteUrl(rootDir);
  if (configuredSiteUrl) return remember(configuredSiteUrl);

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

  const likelyLocalPreviewBaseUrl = detectLikelyLocalPreviewBaseUrl(devServerInfo);
  if (likelyLocalPreviewBaseUrl) return remember(likelyLocalPreviewBaseUrl);

  return remember(null);
}

async function scanDirectory(rootDir) {
  const pkg = await readPackageJson(rootDir);
  const frameworkHints = detectFrameworkHints(rootDir, pkg);
  const devServerInfo = await detectDevServerInfo(rootDir, pkg, frameworkHints);
  const previewBaseUrl = await detectPreviewBaseUrl(rootDir, { pkg, frameworkHints, devServerInfo });
  const reactRouterRoutes = await detectReactRouterRoutes(rootDir);
  const entries = await fg(['**/*.{html,htm,jsx,tsx,js,ts,svg,vue,svelte,astro,md,mdx,svx}'], {
    cwd: rootDir,
    ignore: [
      '**/node_modules/**',
      '**/.*/**',       // all dotfiles/dotfolders (.git, .Trash, .cache, etc.)
      '.*/**',          // top-level dotfolders
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.output/**',
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
        const extWithDot = path.extname(relativePath).toLowerCase();
        const ext = extWithDot.slice(1);
        const filename = path.basename(relativePath);
        const name = path.basename(relativePath, path.extname(relativePath));
        const routeMeta = reactRouterRoutes.get(relativePath) || getRouteMeta(relativePath, frameworkHints);
        if (!GENERAL_FILE_EXTENSIONS.has(extWithDot) && !routeMeta) {
          return null;
        }

        const previewPath = routeMeta?.kind === 'route' ? createPreviewRoutePath(routeMeta.routePath) : '';
        const previewUrl =
          routeMeta?.kind === 'route' && previewBaseUrl
            ? `${previewBaseUrl}${previewPath === '/' ? '' : previewPath}`
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

  const hasProjectRoutes = files.some((file) => file.kind === 'route');
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

  // Check if the preview source is reachable
  let devServerUp = false;
  let devCommand = devServerInfo.command;
  let isLocal = false;
  if (previewBaseUrl) {
    const isBuiltPreview = previewBaseUrl.startsWith('/');
    const runningLocalPreviewBaseUrl = await detectRunningLocalPreviewBaseUrl(
      rootDir,
      Number.isFinite(devServerInfo.port) ? [devServerInfo.port] : []
    );
    const hasMatchingRunningLocalPreview =
      !!runningLocalPreviewBaseUrl &&
      previewBaseUrl.replace(/\/+$/, '') === runningLocalPreviewBaseUrl.replace(/\/+$/, '');

    if (isBuiltPreview) {
      isLocal = true;
      devServerUp = true;
    } else if (hasMatchingRunningLocalPreview) {
      isLocal = true;
      devServerUp = true;
    } else {
      try {
        const urlObj = new URL(previewBaseUrl);
        isLocal = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname === '::1';
      } catch {}
    }

    if (isBuiltPreview || hasMatchingRunningLocalPreview) {
      devServerUp = true;
    } else if (isLocal) {
      // Local dev server — ping to check if it's running
      if (devServerInfo.command) {
        devServerUp = false;
      } else {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(previewBaseUrl, { method: 'HEAD', signal: controller.signal });
          clearTimeout(t);
          devServerUp = res.ok || res.status < 500;
        } catch {
          devServerUp = false;
        }
      }
    } else {
      // Remote URL (vercel, netlify, etc.) — this is a fallback because
      // no local dev server was detected. Show the offline nudge so the
      // user knows to start their local server for proper previews.
      const hasLocalFramework = !!devServerInfo.command;
      devServerUp = !hasLocalFramework;
    }

    for (const file of result) {
      if (file.previewUrl) {
        file.devServerUp = devServerUp;
        file.devCommand = devCommand;
        file.isLocalPreview = isLocal;
      }
    }
  }

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

async function detectDevCommand(rootDir) {
  const pkg = await readPackageJson(rootDir);
  const frameworkHints = detectFrameworkHints(rootDir, pkg);
  const info = await detectDevServerInfo(rootDir, pkg, frameworkHints);
  return info.command;
}

module.exports = { scanDirectory, simpleHash };
