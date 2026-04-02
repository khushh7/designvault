import { useState } from 'react'
import { api } from '../api'
import SidebarFlowers from './SidebarFlowers'

export default function Sidebar({
  files, globalFavoriteCount, config, activeFilter, onFilter, open, onClose,
  globalProjects, rootDir, onSwitchProject, onRemoveProject, onAddProject, onRenameProject,
}) {
  const [pickingFolder, setPickingFolder] = useState(false)
  const [editingDir, setEditingDir] = useState(null)
  const [editName, setEditName] = useState('')
  const previewableFiles = files.filter((f) => f.previewable)
  const codeOnlyFiles = files.filter((f) => !f.previewable)
  const favoriteCount = globalFavoriteCount ?? files.filter((f) => f.favorite).length
  const htmlCount = files.filter((f) => f.extension === 'html' || f.extension === 'htm').length
  const jsxCount = files.filter((f) => f.extension === 'jsx' || f.extension === 'tsx').length
  const svgCount = files.filter((f) => f.extension === 'svg').length

  const isActive = (type, value) =>
    activeFilter.type === type && activeFilter.value === value

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <svg className="dv-mark" viewBox="0 0 144 144" aria-hidden="true">
          <rect className="cell-1" x="16" y="16" width="32" height="32" rx="4" fill="currentColor" />
          <rect className="cell-2" x="56" y="16" width="32" height="32" rx="4" fill="currentColor" />
          <rect className="cell-3" x="96" y="16" width="32" height="32" rx="4" fill="currentColor" />
          <rect className="cell-4" x="16" y="56" width="32" height="32" rx="4" fill="currentColor" />
          <rect className="cell-5" x="56" y="56" width="32" height="32" rx="4" fill="currentColor" />
          <rect className="cell-6" x="96" y="56" width="32" height="32" rx="4" fill="currentColor" />
          <rect className="cell-7" x="16" y="96" width="32" height="32" rx="4" fill="currentColor" />
          <rect className="cell-8" x="56" y="96" width="32" height="32" rx="4" fill="currentColor" />
          <rect className="cell-9" x="96" y="96" width="32" height="32" rx="4" fill="currentColor" />
        </svg>
        DesignVault
      </div>

      {/* Global projects — all scanned directories */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Projects</div>
        {(globalProjects || []).map((p) => {
          const isCurrent = p.directory === rootDir
          const isEditing = editingDir === p.directory
          return (
            <div key={p.directory} className="sidebar-project-row">
              <button
                className={`sidebar-item ${isCurrent ? 'active' : ''}`}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => {
                  if (isEditing) return
                  if (isCurrent) {
                    onFilter({ type: 'all' })
                  } else {
                    onSwitchProject(p.directory)
                  }
                  onClose()
                }}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  setEditingDir(p.directory)
                  setEditName(p.name)
                }}
                title={p.directory}
              >
                <span className="dot" style={{ background: p.color }} />
                {isEditing ? (
                  <input
                    className="sidebar-rename-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = editName.trim()
                        if (trimmed && trimmed !== p.name) onRenameProject(p.directory, trimmed)
                        setEditingDir(null)
                      }
                      if (e.key === 'Escape') setEditingDir(null)
                    }}
                    onBlur={() => {
                      const trimmed = editName.trim()
                      if (trimmed && trimmed !== p.name) onRenameProject(p.directory, trimmed)
                      setEditingDir(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="sidebar-project-name">{p.name}</span>
                )}
                {isCurrent && !isEditing && <span className="current-indicator" />}
              </button>
              {!isCurrent && (
                <button
                  className="sidebar-remove-btn"
                  aria-label={`Remove ${p.name} from saved projects`}
                  onClick={(e) => { e.stopPropagation(); onRemoveProject(p.directory) }}
                  title="Remove project"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
        {(!globalProjects || globalProjects.length === 0) && (
          <div className="sidebar-empty">
            No projects yet
          </div>
        )}
        <button
          className="sidebar-add-project"
          disabled={pickingFolder}
          onClick={async () => {
            setPickingFolder(true)
            try {
              const result = await api.pickDirectory()
              if (!result.cancelled && result.directory) {
                await onAddProject(result.directory)
              }
            } finally {
              setPickingFolder(false)
            }
          }}
        >
          <span className="sidebar-add-icon">+</span>
          {pickingFolder ? 'Opening...' : 'Add project'}
        </button>
      </div>

      {/* Library */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Library</div>
        <button
          className={`sidebar-item ${isActive('favorites') ? 'active' : ''}`}
          aria-pressed={isActive('favorites')}
          onClick={() => { onFilter({ type: 'favorites' }); onClose() }}
        >
          Favorites <span className="count">{favoriteCount}</span>
        </button>
      </div>

      <div style={{ flex: 1 }} />
      <SidebarFlowers />
    </aside>
  )
}
