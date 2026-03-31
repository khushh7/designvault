import { useState } from 'react'
import { api } from '../api'

export default function FilterBar({ searchQuery, onSearch, stats, onHamburger, onRescan, rootDir, onChangeDir }) {
  const [scanning, setScanning] = useState(false)
  const [pickingFolder, setPickingFolder] = useState(false)
  const itemLabel = stats?.mode === 'routes' ? 'pages' : 'files'

  const handleRescan = async () => {
    setScanning(true)
    try {
      await onRescan()
    } finally {
      setScanning(false)
    }
  }

  const handlePickFolder = async () => {
    setPickingFolder(true)
    try {
      const result = await api.pickDirectory()
      if (result.cancelled || !result.directory || result.directory === rootDir) {
        return
      }

      await onChangeDir(result.directory)
    } finally {
      setPickingFolder(false)
    }
  }

  return (
    <div className="filter-bar-wrapper">
      {/* Directory path bar */}
      <div className="dir-bar">
        <span className="dir-bar-label">Scanning</span>
        <div className="dir-bar-path" title={rootDir}>
          {rootDir || 'No folder selected'}
        </div>
        <button
          className="dir-select-btn"
          onClick={handlePickFolder}
          disabled={pickingFolder || scanning}
          title="Choose a folder from your computer"
        >
          {pickingFolder ? 'Opening picker...' : 'Choose folder'}
        </button>
        <button
          className="rescan-btn"
          onClick={handleRescan}
          disabled={scanning || pickingFolder}
          title="Rescan directory for changes"
        >
          {scanning ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      {/* Search & stats bar */}
      <div className="filter-bar">
        <button className="hamburger" onClick={onHamburger}>
          ☰
        </button>
        <input
          className="search-input"
          type="text"
          placeholder={stats?.mode === 'routes' ? 'Search pages, tags, projects...' : 'Search files, tags, projects...'}
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
        {stats && (
          <span className="stats">
            {stats.previewableFiles || 0} designs · {stats.totalFiles} total · {stats.versionStacks} stacks
          </span>
        )}
      </div>
    </div>
  )
}
