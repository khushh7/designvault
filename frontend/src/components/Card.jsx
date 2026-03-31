import { api } from '../api'

export default function Card({ file, onClick, onContextMenu, onToggleFavorite }) {
  const hasVersions = file.versions && file.versions.length > 1
  const isCode = file.extension === 'jsx' || file.extension === 'tsx'
  const title = file.displayName || file.name
  const badgeLabel = file.kind === 'route' ? 'page' : file.extension
  const iframeTitle = file.previewUrl || title

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div
      className={`card ${hasVersions ? 'has-versions' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', file.id)}
    >
      <div className="card-preview">
        {hasVersions && (
          <div className="version-badge">{file.versions.length}</div>
        )}
        {file.extension === 'svg' ? (
          <img src={api.getFileContent(file.id)} alt={title} />
        ) : file.previewUrl ? (
          <iframe
            src={file.previewUrl}
            title={iframeTitle}
            loading="lazy"
          />
        ) : isCode ? (
          <div className="code-placeholder">
            <span className="code-placeholder-icon">{'</>'}</span>
            <span className="code-placeholder-ext">{file.extension.toUpperCase()}</span>
          </div>
        ) : (
          <iframe
            src={api.getFileContent(file.id)}
            sandbox="allow-same-origin"
            title={iframeTitle}
            loading="lazy"
          />
        )}
      </div>

      <div className="card-info">
        <div className="card-info-top">
          <span className={`status-dot status-${file.status || 'draft'}`} />
          <span className="card-name">{title}</span>
          <button
            className={`card-fav ${file.favorite ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          >
            {file.favorite ? '★' : '☆'}
          </button>
        </div>
        <div className="card-meta">
          <span className={`badge badge-${badgeLabel}`}>{badgeLabel}</span>
          <span>·</span>
          <span>{timeAgo(file.modifiedAt)}</span>
          {file.routePath ? (
            <>
              <span>·</span>
              <span>{file.routePath}</span>
            </>
          ) : null}
          {hasVersions ? (
            <>
              <span>·</span>
              <span className="versions-text">{file.versions.length} versions</span>
            </>
          ) : file.project ? (
            <>
              <span>·</span>
              <span>{file.project}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
