import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Card({ file, onClick, onContextMenu, onToggleFavorite }) {
  const hasVersions = file.versions && file.versions.length > 1
  const isCode = file.extension === 'jsx' || file.extension === 'tsx'
  const title = file.displayName || file.name
  const badgeLabel = file.kind === 'route' ? 'page' : file.extension
  const iframeTitle = file.previewUrl || title
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => {
    setPreviewFailed(false)
  }, [file.id, file.previewUrl])

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const openMenu = (x, y) => {
    onContextMenu({ x, y, file })
  }

  const handleCardKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }

    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      openMenu(rect.right - 12, rect.top + 44)
    }
  }

  return (
    <article
      className={`card ${hasVersions ? 'has-versions' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Open ${title}`}
      aria-haspopup="dialog"
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      onContextMenu={(event) => {
        event.preventDefault()
        openMenu(event.clientX, event.clientY)
      }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', file.id)}
    >
      <div className="card-accent-strip" />
      <div className="card-preview">
        {hasVersions && (
          <div className="version-badge">{file.versions.length} Versions</div>
        )}
        {file.extension === 'svg' ? (
          <img src={api.getFileContent(file.id, file.sourceRootDir)} alt={title} />
        ) : file.previewUrl && !previewFailed ? (
          <iframe
            src={file.previewUrl}
            title={iframeTitle}
            loading="lazy"
            onError={() => setPreviewFailed(true)}
          />
        ) : isCode ? (
          <div className="code-placeholder">
            <span className="code-placeholder-icon">{'</>'}</span>
            <span className="code-placeholder-ext">{file.extension.toUpperCase()}</span>
          </div>
        ) : file.previewUrl && previewFailed ? (
          <div className="preview-fallback">
            <span className="preview-fallback-title">Preview unavailable</span>
            <span className="preview-fallback-copy">Open the detail panel to launch the page directly.</span>
          </div>
        ) : (
          <iframe
            src={api.getFileContent(file.id, file.sourceRootDir)}
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
            className="card-menu-btn"
            aria-haspopup="menu"
            aria-label={`Open actions for ${title}`}
            onClick={(event) => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              openMenu(rect.left, rect.bottom + 8)
            }}
          >
            ⋯
          </button>
          <button
            className={`card-fav ${file.favorite ? 'active' : ''}`}
            aria-pressed={file.favorite}
            aria-label={file.favorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
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
          ) : file.sourceProjectName ? (
            <>
              <span>·</span>
              <span>{file.sourceProjectName}</span>
            </>
          ) : file.project ? (
            <>
              <span>·</span>
              <span>{file.project}</span>
            </>
          ) : null}
        </div>
      </div>
    </article>
  )
}
