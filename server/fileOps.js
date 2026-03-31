const path = require('path');
const fs = require('fs');

function findFile(fileId, scanData) {
  // Check top-level files and also version entries
  for (const file of scanData.files) {
    if (file.id === fileId) return file;
    if (file.versions) {
      for (const v of file.versions) {
        if (v.id === fileId) {
          // Find the full file entry in the flat list via absolutePath
          // versions don't have absolutePath, so we reconstruct
          const dir = path.dirname(file.absolutePath);
          return {
            ...v,
            absolutePath: path.join(dir, v.filename),
            relativePath: path.join(path.dirname(file.relativePath), v.filename),
            extension: path.extname(v.filename).slice(1),
            name: path.basename(v.filename, path.extname(v.filename)),
          };
        }
      }
    }
  }
  return null;
}

function validatePath(rootDir, filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(rootDir);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

async function renameFile(rootDir, fileId, newName, scanData) {
  const file = findFile(fileId, scanData);
  if (!file) throw new Error('File not found');

  const oldPath = validatePath(rootDir, file.absolutePath);
  const ext = path.extname(oldPath);
  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, newName + ext);
  validatePath(rootDir, newPath);

  await fs.promises.rename(oldPath, newPath);
  return newPath;
}

async function moveFile(rootDir, fileId, destinationDir, scanData) {
  const file = findFile(fileId, scanData);
  if (!file) throw new Error('File not found');

  const oldPath = validatePath(rootDir, file.absolutePath);
  const destDir = path.resolve(rootDir, destinationDir);
  validatePath(rootDir, destDir);

  await fs.promises.mkdir(destDir, { recursive: true });
  const newPath = path.join(destDir, path.basename(oldPath));
  await fs.promises.rename(oldPath, newPath);
  return newPath;
}

async function duplicateFile(rootDir, fileId, scanData) {
  const file = findFile(fileId, scanData);
  if (!file) throw new Error('File not found');

  const oldPath = validatePath(rootDir, file.absolutePath);
  const ext = path.extname(oldPath);
  const base = path.basename(oldPath, ext);
  const dir = path.dirname(oldPath);

  let suffix = '-copy';
  let counter = 1;
  let newPath = path.join(dir, base + suffix + ext);
  while (fs.existsSync(newPath)) {
    counter++;
    newPath = path.join(dir, `${base}-copy-${counter}${ext}`);
  }

  await fs.promises.copyFile(oldPath, newPath);
  return newPath;
}

async function deleteFile(rootDir, fileId, scanData) {
  const file = findFile(fileId, scanData);
  if (!file) throw new Error('File not found');

  const oldPath = validatePath(rootDir, file.absolutePath);
  const relPath = path.relative(rootDir, oldPath);
  const trashDir = path.join(rootDir, '.designvault', 'trash');
  const trashPath = path.join(trashDir, relPath);

  await fs.promises.mkdir(path.dirname(trashPath), { recursive: true });
  await fs.promises.rename(oldPath, trashPath);

  // Update manifest
  const manifestPath = path.join(trashDir, 'manifest.json');
  let manifest = [];
  try {
    manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
  } catch {}

  manifest.push({
    id: fileId,
    originalPath: relPath,
    trashPath: path.relative(rootDir, trashPath),
    deletedAt: new Date().toISOString(),
  });
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return trashPath;
}

async function restoreFile(rootDir, fileId) {
  const trashDir = path.join(rootDir, '.designvault', 'trash');
  const manifestPath = path.join(trashDir, 'manifest.json');

  let manifest = [];
  try {
    manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
  } catch {
    throw new Error('No trash manifest found');
  }

  const entry = manifest.find((m) => m.id === fileId);
  if (!entry) throw new Error('File not found in trash');

  const trashPath = path.join(rootDir, entry.trashPath);
  const originalPath = path.join(rootDir, entry.originalPath);

  await fs.promises.mkdir(path.dirname(originalPath), { recursive: true });
  await fs.promises.rename(trashPath, originalPath);

  // Remove from manifest
  const updated = manifest.filter((m) => m.id !== fileId);
  await fs.promises.writeFile(manifestPath, JSON.stringify(updated, null, 2), 'utf-8');

  return originalPath;
}

module.exports = { renameFile, moveFile, duplicateFile, deleteFile, restoreFile };
