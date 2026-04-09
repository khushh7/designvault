import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Card({ file, onClick, onContextMenu, onToggleFavorite }) {
  const hasVersions = file.versions && file.versions.length > 1
  const isCode = file.extension === 'jsx' || file.extension === 'tsx'
  const title = file.displayName || file.name
  const badgeLabel = file.kind === 'route' ? 'page' : file.extension
  const iframeTitle = file.previewUrl || title
  const [previewFailed, setPreviewFailed] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  useEffect(() => {
    setPreviewFailed(false)
    setIframeLoaded(false)
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
        ) : file.previewUrl && file.devServerUp === false ? (
          <div className="server-starting-fallback">
            <svg className="server-starting-mark" viewBox="0 0 144 144" aria-hidden="true">
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
            <span className="server-starting-text">Starting preview...</span>
          </div>
        ) : file.previewUrl && !previewFailed ? (
          <>
            {!iframeLoaded && (
              <div className="iframe-loading-placeholder">
                <svg className="iframe-loading-mark" viewBox="0 0 144 144" aria-hidden="true">
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
              </div>
            )}
            <iframe
              className={iframeLoaded ? 'iframe-loaded' : 'iframe-loading'}
              src={file.previewUrl}
              sandbox="allow-scripts"
              title={iframeTitle}
              loading="lazy"
              onLoad={() => setIframeLoaded(true)}
              onError={() => setPreviewFailed(true)}
            />
          </>
        ) : isCode ? (
          <div className="code-placeholder">
            <span className="code-placeholder-icon">{'</>'}</span>
            <span className="code-placeholder-ext">{file.extension.toUpperCase()}</span>
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
