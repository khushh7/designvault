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
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>◇</div>
        <div style={{ fontSize: 14 }}>No design files found</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
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
          onContextMenu={(e) => {
            e.preventDefault()
            onContextMenu({ x: e.clientX, y: e.clientY, file })
          }}
          onToggleFavorite={() => onToggleFavorite(file.id)}
        />
      ))}
    </div>
  )
}
