const BASE = '';

function withRoot(url, rootDir) {
  if (!rootDir) return `${BASE}${url}`;
  const sep = url.includes('?') ? '&' : '?';
  return `${BASE}${url}${sep}rootDir=${encodeURIComponent(rootDir)}`;
}

async function jsonOrError(r) {
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export const api = {
  getFiles: () => fetch(`${BASE}/api/files`).then((r) => r.json()),
  getFavorites: () => fetch(`${BASE}/api/favorites`).then((r) => r.json()),
  getFileContent: (id, rootDir) => withRoot(`/api/files/${id}/content`, rootDir),
  renameFile: (id, newName, rootDir) =>
    fetch(`${BASE}/api/files/${id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName, rootDir }),
    }).then((r) => r.json()),
  moveFile: (id, destination, rootDir) =>
    fetch(`${BASE}/api/files/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, rootDir }),
    }).then((r) => r.json()),
  duplicateFile: (id, rootDir) =>
    fetch(`${BASE}/api/files/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootDir }),
    }).then((r) => r.json()),
  deleteFile: (id, rootDir) =>
    fetch(withRoot(`/api/files/${id}`, rootDir), { method: 'DELETE' }).then((r) => r.json()),
  restoreFile: (id, rootDir) =>
    fetch(`${BASE}/api/files/${id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootDir }),
    }).then((r) => r.json()),
  rescan: () => fetch(`${BASE}/api/rescan`, { method: 'POST' }).then((r) => r.json()),
  toggleFavorite: (id, rootDir) =>
    fetch(`${BASE}/api/config/favorite/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootDir }),
    }).then((r) => r.json()),
  setTags: (id, tags, rootDir) =>
    fetch(`${BASE}/api/config/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, rootDir }),
    }).then((r) => r.json()),
  setNote: (id, note, rootDir) =>
    fetch(`${BASE}/api/config/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, rootDir }),
    }).then((r) => r.json()),
  setStatus: (id, status, rootDir) =>
    fetch(`${BASE}/api/config/status/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rootDir }),
    }).then((r) => r.json()),
  setProject: (id, project, rootDir) =>
    fetch(`${BASE}/api/config/project/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, rootDir }),
    }).then((r) => r.json()),
  getConfig: () => fetch(`${BASE}/api/config`).then((r) => r.json()),
  updateConfig: (data) =>
    fetch(`${BASE}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  getInfo: () => fetch(`${BASE}/api/info`).then((r) => r.json()),
  pickDirectory: () =>
    fetch(`${BASE}/api/pick-directory`, {
      method: 'POST',
    }).then(jsonOrError),
  changeDir: (directory) =>
    fetch(`${BASE}/api/changedir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory }),
    }).then(jsonOrError),
  removeProject: (directory) =>
    fetch(`${BASE}/api/projects`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory }),
    }).then((r) => r.json()),
};

export function listenForUpdates(onUpdate) {
  const source = new EventSource(`${BASE}/api/events`);
  source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onUpdate(data);
  };
  return () => source.close();
}
