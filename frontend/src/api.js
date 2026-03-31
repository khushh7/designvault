const BASE = '';

async function jsonOrError(r) {
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export const api = {
  getFiles: () => fetch(`${BASE}/api/files`).then((r) => r.json()),
  getFileContent: (id) => `${BASE}/api/files/${id}/content`,
  renameFile: (id, newName) =>
    fetch(`${BASE}/api/files/${id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    }).then((r) => r.json()),
  moveFile: (id, destination) =>
    fetch(`${BASE}/api/files/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination }),
    }).then((r) => r.json()),
  duplicateFile: (id) =>
    fetch(`${BASE}/api/files/${id}/duplicate`, { method: 'POST' }).then((r) => r.json()),
  deleteFile: (id) =>
    fetch(`${BASE}/api/files/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  restoreFile: (id) =>
    fetch(`${BASE}/api/files/${id}/restore`, { method: 'POST' }).then((r) => r.json()),
  rescan: () => fetch(`${BASE}/api/rescan`, { method: 'POST' }).then((r) => r.json()),
  toggleFavorite: (id) =>
    fetch(`${BASE}/api/config/favorite/${id}`, { method: 'PUT' }).then((r) => r.json()),
  setTags: (id, tags) =>
    fetch(`${BASE}/api/config/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    }).then((r) => r.json()),
  setNote: (id, note) =>
    fetch(`${BASE}/api/config/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    }).then((r) => r.json()),
  setStatus: (id, status) =>
    fetch(`${BASE}/api/config/status/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then((r) => r.json()),
  setProject: (id, project) =>
    fetch(`${BASE}/api/config/project/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
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
