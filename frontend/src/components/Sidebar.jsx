import DonateBanner from './DonateBanner'

export default function Sidebar({
  files, globalFavoriteCount, config, activeFilter, onFilter, open, onClose,
  globalProjects, rootDir, onSwitchProject, onRemoveProject,
}) {
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
        <span>◇</span> DesignVault
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
                aria-current={isCurrent ? 'page' : undefined}
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
            Scan a folder to add a project
          </div>
        )}
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
      <DonateBanner />
    </aside>
  )
}
