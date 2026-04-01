import Card from './Card'

export default function CardGrid({ files, loading, onSelect, onContextMenu, onToggleFavorite }) {
  if (loading) {
    return (
      <div className="card-grid loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-mark">◇</div>
        <div className="empty-state-title">No designs surfaced yet</div>
        <div className="empty-state-copy">
          Drop HTML, JSX, or SVG files in this directory
        </div>
      </div>
    )
  }

  return (
    <div className="card-grid">
      {files.map((file) => (
        <Card
          key={file.id}
          file={file}
          onClick={() => onSelect(file)}
          onContextMenu={onContextMenu}
          onToggleFavorite={() => onToggleFavorite(file)}
        />
      ))}
    </div>
  )
}
