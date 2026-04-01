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
      <div className="dir-bar">
        <div className="dir-bar-inner">
          <span className="dir-bar-label">Current library</span>
          <div className="dir-bar-path" title={rootDir}>
            {rootDir || 'No folder selected'}
          </div>
          <button
            className="dir-select-btn"
            onClick={handlePickFolder}
            disabled={pickingFolder || scanning}
            aria-label="Choose a folder from your computer"
            title="Choose a folder from your computer"
          >
            {pickingFolder ? 'Opening picker...' : 'Choose folder'}
          </button>
          <button
            className="rescan-btn"
            onClick={handleRescan}
            disabled={scanning || pickingFolder}
            aria-label="Rescan current folder"
            title="Rescan directory for changes"
          >
            {scanning ? 'Scanning...' : 'Rescan'}
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-bar-inner">
          <button className="hamburger" onClick={onHamburger} aria-label="Open project navigation">
            <span className="sr-only">Open project navigation</span>
            ☰
          </button>
          <input
            className="search-input"
            type="text"
            aria-label={stats?.mode === 'routes' ? 'Search pages, tags, and projects' : 'Search files, tags, and projects'}
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
    </div>
  )
}
