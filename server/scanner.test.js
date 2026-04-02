const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scanDirectory } = require('./scanner');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function makeTempProject(prefix = 'designvault-scanner-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function byRelativePath(files, relativePath) {
  return files.find((file) => file.relativePath === relativePath);
}

test('standalone HTML libraries stay in file mode and use direct file previews', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  writeFile(path.join(rootDir, 'case-study.html'), '<!doctype html><title>Case Study</title>');
  writeFile(path.join(rootDir, 'architecture-search-wireframe.html'), '<!doctype html><title>Wireframe</title>');

  const result = await scanDirectory(rootDir);
  const caseStudy = byRelativePath(result.files, 'case-study.html');

  assert.equal(result.stats.mode, 'files');
  assert.equal(result.stats.totalFiles, 2);
  assert.equal(caseStudy.previewable, true);
  assert.equal(caseStudy.previewUrl, null);
  assert.equal(caseStudy.kind, undefined);
  assert.equal(caseStudy.routePath, '/case-study');
});

test('Next app routes support dynamic segments and guessed local previews', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  writeFile(
    path.join(rootDir, 'package.json'),
    JSON.stringify({
      dependencies: { next: '15.0.0' },
      scripts: { dev: 'next dev -p 3010' },
    }, null, 2)
  );
  writeFile(path.join(rootDir, 'app', 'blog', '[slug]', 'page.tsx'), 'export default function Page() { return null }');

  const result = await scanDirectory(rootDir);
  const page = byRelativePath(result.files, path.join('app', 'blog', '[slug]', 'page.tsx'));

  assert.equal(result.stats.mode, 'routes');
  assert.equal(page.kind, 'route');
  assert.equal(page.routeSource, 'app');
  assert.equal(page.routePath, '/blog/:slug');
  assert.equal(page.previewUrl, 'http://localhost:3010/blog/preview');
  assert.equal(page.devCommand, 'npm run dev');
  assert.equal(page.devServerUp, false);
});

test('Astro pages can use configured site URLs from config files', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  writeFile(
    path.join(rootDir, 'package.json'),
    JSON.stringify({
      dependencies: { astro: '4.0.0' },
      scripts: { dev: 'astro dev' },
    }, null, 2)
  );
  writeFile(path.join(rootDir, 'astro.config.mjs'), "export default { site: 'https://preview.example.com' }\n");
  writeFile(path.join(rootDir, 'src', 'pages', 'posts', '[slug].astro'), '---\n---\n<div />');

  const result = await scanDirectory(rootDir);
  const page = byRelativePath(result.files, path.join('src', 'pages', 'posts', '[slug].astro'));

  assert.equal(result.stats.mode, 'routes');
  assert.equal(page.routePath, '/posts/:slug');
  assert.equal(page.previewUrl, 'https://preview.example.com/posts/preview');
});

test('SvelteKit routes handle catch-all segments', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  writeFile(
    path.join(rootDir, 'package.json'),
    JSON.stringify({
      dependencies: { '@sveltejs/kit': '2.0.0', vite: '5.0.0' },
      scripts: { dev: 'vite dev --port 4111' },
    }, null, 2)
  );
  writeFile(path.join(rootDir, 'src', 'routes', 'docs', '[...parts]', '+page.svelte'), '<div />');

  const result = await scanDirectory(rootDir);
  const page = byRelativePath(result.files, path.join('src', 'routes', 'docs', '[...parts]', '+page.svelte'));

  assert.equal(result.stats.mode, 'routes');
  assert.equal(page.routeSource, 'sveltekit');
  assert.equal(page.routePath, '/docs/*');
  assert.equal(page.previewUrl, 'http://localhost:4111/docs/preview');
});

test('Remix routes normalize pathless layouts and dynamic params', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  writeFile(
    path.join(rootDir, 'package.json'),
    JSON.stringify({
      dependencies: {
        '@remix-run/dev': '2.0.0',
        '@remix-run/react': '2.0.0',
      },
      scripts: { dev: 'remix dev' },
    }, null, 2)
  );
  writeFile(path.join(rootDir, 'app', 'routes', '_auth.login.tsx'), 'export default function Page() { return null }');
  writeFile(path.join(rootDir, 'app', 'routes', 'projects.$id.tsx'), 'export default function Page() { return null }');

  const result = await scanDirectory(rootDir);
  const loginPage = byRelativePath(result.files, path.join('app', 'routes', '_auth.login.tsx'));
  const projectPage = byRelativePath(result.files, path.join('app', 'routes', 'projects.$id.tsx'));

  assert.equal(result.stats.mode, 'routes');
  assert.equal(loginPage.routePath, '/login');
  assert.equal(loginPage.previewUrl, 'http://localhost:3000/login');
  assert.equal(projectPage.routePath, '/projects/:id');
  assert.equal(projectPage.previewUrl, 'http://localhost:3000/projects/preview');
});

test('built output provides preview URLs without surfacing output files as cards', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  writeFile(path.join(rootDir, 'package.json'), JSON.stringify({}, null, 2));
  writeFile(path.join(rootDir, 'out', 'index.html'), '<!doctype html><title>Built App</title>');
  writeFile(path.join(rootDir, 'pages', 'about.jsx'), 'export default function About() { return null }');

  const result = await scanDirectory(rootDir);
  const aboutPage = byRelativePath(result.files, path.join('pages', 'about.jsx'));

  assert.equal(result.stats.mode, 'routes');
  assert.equal(result.files.some((file) => file.relativePath.startsWith('out/')), false);
  assert.equal(aboutPage.previewUrl, '/__project_preview__/about');
  assert.equal(aboutPage.devServerUp, true);
});
