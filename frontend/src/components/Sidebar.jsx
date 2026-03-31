import DonateBanner from './DonateBanner'

export default function Sidebar({
  files, config, activeFilter, onFilter, open, onClose,
  globalProjects, rootDir, onSwitchProject, onRemoveProject,
}) {
  const previewableFiles = files.filter((f) => f.previewable)
  const codeOnlyFiles = files.filter((f) => !f.previewable)
  const favoriteCount = files.filter((f) => f.favorite).length
  const htmlCount = files.filter((f) => f.extension === 'html' || f.extension === 'htm').length
  const jsxCount = files.filter((f) => f.extension === 'jsx' || f.extension === 'tsx').length
  const svgCount = files.filter((f) => f.extension === 'svg').length

  const isActive = (type, value) =>
    activeFilter.type === type && activeFilter.value === value

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <span>◇</span> DesignVault
      </div>

      {/* Current project library */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Library</div>
        <button
          className={`sidebar-item ${isActive('designs') ? 'active' : ''}`}
          onClick={() => { onFilter({ type: 'designs' }); onClose() }}
        >
          Designs <span className="count">{previewableFiles.length}</span>
        </button>
        <button
          className={`sidebar-item ${isActive('all') ? 'active' : ''}`}
          onClick={() => { onFilter({ type: 'all' }); onClose() }}
        >
          All files <span className="count">{files.length}</span>
        </button>
        <button
          className={`sidebar-item ${isActive('favorites') ? 'active' : ''}`}
          onClick={() => { onFilter({ type: 'favorites' }); onClose() }}
        >
          Favorites <span className="count">{favoriteCount}</span>
        </button>
        <button
          className={`sidebar-item ${isActive('recent') ? 'active' : ''}`}
          onClick={() => { onFilter({ type: 'recent' }); onClose() }}
        >
          Recent <span className="count">{Math.min(files.length, 10)}</span>
        </button>
        {codeOnlyFiles.length > 0 && (
          <button
            className={`sidebar-item ${isActive('code') ? 'active' : ''}`}
            onClick={() => { onFilter({ type: 'code' }); onClose() }}
          >
            Code only <span className="count">{codeOnlyFiles.length}</span>
          </button>
        )}
      </div>

      {/* Global projects — all scanned directories */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Projects</div>
        {(globalProjects || []).map((p) => {
          const isCurrent = p.directory === rootDir
          return (
            <div key={p.directory} className="sidebar-project-row">
              <button
                className={`sidebar-item ${isCurrent ? 'active' : ''}`}
                onClick={() => {
                  if (isCurrent) {
                    onFilter({ type: 'all' })
                  } else {
                    onSwitchProject(p.directory)
                  }
                  onClose()
                }}
                title={p.directory}
              >
                <span className="dot" style={{ background: p.color }} />
                <span className="sidebar-project-name">{p.name}</span>
                {isCurrent && <span className="current-indicator" />}
              </button>
              {!isCurrent && (
                <button
                  className="sidebar-remove-btn"
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
            Scan a folder to add a project
          </div>
        )}
      </div>

      {/* File types for current project */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">File Types</div>
        <button
          className={`sidebar-item ${isActive('extension', 'html') ? 'active' : ''}`}
          onClick={() => { onFilter({ type: 'extension', value: 'html' }); onClose() }}
        >
          HTML pages <span className="count">{htmlCount}</span>
        </button>
        <button
          className={`sidebar-item ${isActive('extension', 'jsx') ? 'active' : ''}`}
          onClick={() => { onFilter({ type: 'extension', value: 'jsx' }); onClose() }}
        >
          React components <span className="count">{jsxCount}</span>
        </button>
        <button
          className={`sidebar-item ${isActive('extension', 'svg') ? 'active' : ''}`}
          onClick={() => { onFilter({ type: 'extension', value: 'svg' }); onClose() }}
        >
          SVG assets <span className="count">{svgCount}</span>
        </button>
      </div>

      <div style={{ flex: 1 }} />
      <DonateBanner />
    </aside>
  )
}
