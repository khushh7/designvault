import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import VersionTimeline from './VersionTimeline'
import CompareView from './CompareView'
import useDialogA11y from './useDialogA11y'

export default function DetailPanel({ file, onClose, onRename, onSetStatus, onSetTags, onSetNote, onDelete, onDuplicate, onMove, showToast }) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(file.name)
  const [addingTag, setAddingTag] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [noteValue, setNoteValue] = useState(file.note || '')
  const [showCompare, setShowCompare] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const panelRef = useRef(null)

  useDialogA11y(panelRef, onClose, '.detail-close')

  useEffect(() => {
    setNameValue(file.name)
    setNoteValue(file.note || '')
    setShowCompare(false)
    setEditingName(false)
    setAddingTag(false)
    setPreviewFailed(false)
  }, [file.id, file.name, file.note])

  const handleNameSubmit = () => {
    if (nameValue.trim() && nameValue !== file.name) {
      onRename(file, nameValue.trim())
    }
    setEditingName(false)
  }

  const handleAddTag = () => {
    if (tagInput.trim()) {
      const tags = [...(file.tags || []), tagInput.trim()]
      onSetTags(file.id, tags)
      setTagInput('')
    }
    setAddingTag(false)
  }

  const handleRemoveTag = (tag) => {
    const tags = (file.tags || []).filter((t) => t !== tag)
    onSetTags(file.id, tags)
  }

  const copyCode = async () => {
    try {
      const res = await fetch(api.getFileContent(file.id, file.sourceRootDir))
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      showToast('Code copied to clipboard')
    } catch {
      showToast('Failed to copy')
    }
  }

  const isCode = file.extension === 'jsx' || file.extension === 'tsx'
  const hasVersions = file.versions && file.versions.length > 1
  const title = file.displayName || file.name
  const browserTarget = file.previewUrl || api.getFileContent(file.id, file.sourceRootDir)

  return (
    <>
      <div className="detail-overlay" onClick={onClose} />
      <div
        ref={panelRef}
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-panel-title"
      >
        <button className="detail-close" aria-label="Close detail panel" onClick={onClose}>×</button>

        <div className="detail-preview">
          {file.extension === 'svg' ? (
            <img src={api.getFileContent(file.id, file.sourceRootDir)} alt={title} />
          ) : file.previewUrl && !previewFailed ? (
            <iframe
              src={file.previewUrl}
              title={title}
              onError={() => setPreviewFailed(true)}
            />
          ) : file.previewUrl && previewFailed ? (
            <div className="preview-fallback detail-preview-fallback">
              <span className="preview-fallback-title">Preview unavailable</span>
              <span className="preview-fallback-copy">This page could not be embedded, but you can still open it in a browser.</span>
              <button className="detail-action-btn primary" onClick={() => window.open(browserTarget, '_blank')}>
                Open live page
              </button>
            </div>
          ) : isCode ? (
            <CodePreview fileId={file.id} rootDir={file.sourceRootDir} />
          ) : (
            <iframe
              src={api.getFileContent(file.id, file.sourceRootDir)}
              sandbox="allow-same-origin"
              title={title}
            />
          )}
        </div>

        <div className="detail-body">
          {/* Name */}
          {editingName && !file.routePath ? (
            <input
              id="detail-panel-title"
              className="detail-name"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit(); if (e.key === 'Escape') setEditingName(false) }}
              autoFocus
            />
          ) : (
            file.routePath ? (
              <h2 id="detail-panel-title" className="detail-name detail-heading">{title}</h2>
            ) : (
              <button
                id="detail-panel-title"
                className="detail-name detail-title-button"
                onClick={() => setEditingName(true)}
                aria-label={`Rename ${title}`}
              >
                {title}
              </button>
            )
          )}

          {/* Meta */}
          <div className="detail-meta">
            <span>{file.kind === 'route' ? 'Page route' : `.${file.extension}`}</span>
            {file.routePath && <><span>·</span><span>{file.routePath}</span></>}
            {file.project && <><span>·</span><span>{file.project}</span></>}
            <span>·</span>
            <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
          </div>

          {/* Versions */}
          {hasVersions && (
            <div>
              <div className="detail-section-title">Versions</div>
              <div className="version-section">
                <div className="version-header">
                  <span className="version-header-title">{file.versions.length} versions</span>
                  <button className="compare-btn" onClick={() => setShowCompare(!showCompare)}>
                    {showCompare ? 'Hide compare' : 'Compare'}
                  </button>
                </div>
                {showCompare && <CompareView versions={file.versions} rootDir={file.sourceRootDir} />}
                <VersionTimeline versions={file.versions} rootDir={file.sourceRootDir} showToast={showToast} />
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <div className="detail-section-title">Status</div>
            <div className="status-pills">
              {['draft', 'wip', 'done'].map((s) => (
                <button
                  key={s}
                  className={`status-pill ${file.status === s ? `active-${s}` : ''}`}
                  aria-pressed={file.status === s}
                  onClick={() => onSetStatus(file.id, s)}
                >
                  {s === 'wip' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="detail-section-title">Tags</div>
            <div className="tags-row">
              {(file.tags || []).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                  <button className="remove-tag" aria-label={`Remove tag ${tag}`} onClick={() => handleRemoveTag(tag)}>×</button>
                </span>
              ))}
              {addingTag ? (
                <input
                  className="tag-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onBlur={handleAddTag}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setAddingTag(false) }}
                  autoFocus
                  aria-label="Add a tag"
                  placeholder="tag name..."
                />
              ) : (
                <button className="add-tag-btn" onClick={() => setAddingTag(true)}>+ add tag</button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="detail-section-title">Notes</div>
            <textarea
              className="note-textarea"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onBlur={() => onSetNote(file.id, noteValue)}
              aria-label="Notes"
              placeholder="Add notes about this design..."
            />
          </div>

          {/* Source path */}
          <div>
            <div className="detail-section-title">Source</div>
            <div className="source-path">{file.relativePath}</div>
          </div>

          {/* Actions */}
          <div className="detail-actions">
            <button className="detail-action-btn primary" onClick={() => window.open(browserTarget, '_blank')}>
              {file.previewUrl ? 'Open live page' : 'Open in browser'}
            </button>
            <button className="detail-action-btn" onClick={copyCode}>
              Copy code
            </button>
            <button className="detail-action-btn" onClick={() => onDuplicate(file)}>
              Duplicate
            </button>
            <button className="detail-action-btn" onClick={() => onMove(file)}>
              Move
            </button>
            <button className="detail-action-btn danger" onClick={() => onDelete(file)}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function CodePreview({ fileId, rootDir }) {
  const [code, setCode] = useState('')
  useEffect(() => {
    fetch(api.getFileContent(fileId, rootDir))
      .then((r) => r.text())
      .then((t) => setCode(t.split('\n').slice(0, 30).join('\n')))
      .catch(() => {})
  }, [fileId, rootDir])

  return (
    <div className="code-preview" style={{ padding: 16, height: '100%', overflow: 'hidden' }}>
      {code || '// Loading...'}
    </div>
  )
}
