import { useState } from 'react'
import Card from './Card'
import { api } from '../api'

export default function CardGrid({ files, loading, onSelect, onContextMenu, onToggleFavorite, onChangeDir }) {
  const [pickingFolder, setPickingFolder] = useState(false)

  const handlePickFolder = async () => {
    setPickingFolder(true)
    try {
      const result = await api.pickDirectory()
      if (!result.cancelled && result.directory) {
        await onChangeDir(result.directory)
      }
    } finally {
      setPickingFolder(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <svg className="loading-mark" viewBox="0 0 144 144" aria-hidden="true">
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
        <p className="loading-text">Scanning files...</p>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="welcome-state">
        <div className="welcome-visual">
          <div className="welcome-slider-mask">
            <div className="welcome-slider-track">
              {/* HTML - landing page */}
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><rect x="8" y="8" width="30" height="6" rx="3" fill="#4a7c59"/><rect x="8" y="18" width="64" height="4" rx="2" fill="#81c784" opacity=".5"/><rect x="8" y="26" width="48" height="4" rx="2" fill="#81c784" opacity=".35"/><rect x="8" y="38" width="22" height="10" rx="4" fill="#4a7c59"/><rect x="34" y="38" width="22" height="10" rx="4" fill="#a5d6a7" opacity=".5"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge html">HTML</span>hero.html</div>
              </div>
              {/* SVG - logo */}
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><circle cx="40" cy="24" r="14" fill="#e91e63" opacity=".25"/><path d="M33 24l5 5 9-10" stroke="#e91e63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="24" y="44" width="32" height="4" rx="2" fill="#f48fb1" opacity=".4"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge svg">SVG</span>logo.svg</div>
              </div>
              {/* JSX - component */}
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #ede7f6, #d1c4e9)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><rect x="10" y="8" width="60" height="8" rx="4" fill="#7e57c2" opacity=".2"/><rect x="10" y="20" width="28" height="28" rx="4" fill="#b39ddb" opacity=".3"/><rect x="42" y="20" width="28" height="12" rx="4" fill="#b39ddb" opacity=".3"/><rect x="42" y="36" width="28" height="12" rx="4" fill="#b39ddb" opacity=".3"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge jsx">JSX</span>Card.jsx</div>
              </div>
              {/* HTML - pricing */}
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><rect x="8" y="6" width="20" height="44" rx="4" fill="#ffb74d" opacity=".25"/><rect x="30" y="10" width="20" height="36" rx="4" fill="#fb8c00" opacity=".3"/><rect x="52" y="14" width="20" height="28" rx="4" fill="#ffb74d" opacity=".25"/><rect x="12" y="38" width="12" height="6" rx="3" fill="#fb8c00"/><rect x="34" y="34" width="12" height="6" rx="3" fill="#fb8c00"/><rect x="56" y="30" width="12" height="6" rx="3" fill="#fb8c00"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge html">HTML</span>pricing.html</div>
              </div>
              {/* SVG - icon set */}
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #e0f7fa, #b2ebf2)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><rect x="10" y="8" width="16" height="16" rx="4" fill="#00acc1" opacity=".3"/><rect x="32" y="8" width="16" height="16" rx="4" fill="#00acc1" opacity=".3"/><rect x="54" y="8" width="16" height="16" rx="4" fill="#00acc1" opacity=".3"/><rect x="10" y="30" width="16" height="16" rx="4" fill="#00acc1" opacity=".3"/><rect x="32" y="30" width="16" height="16" rx="4" fill="#00acc1" opacity=".3"/><rect x="54" y="30" width="16" height="16" rx="4" fill="#00acc1" opacity=".3"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge svg">SVG</span>icons.svg</div>
              </div>
              {/* HTML - dashboard */}
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #e3f2fd, #bbdefb)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><rect x="8" y="8" width="18" height="40" rx="3" fill="#42a5f5" opacity=".15"/><rect x="30" y="8" width="42" height="6" rx="3" fill="#42a5f5" opacity=".3"/><rect x="30" y="18" width="20" height="14" rx="3" fill="#90caf9" opacity=".35"/><rect x="52" y="18" width="20" height="14" rx="3" fill="#90caf9" opacity=".35"/><rect x="30" y="36" width="42" height="12" rx="3" fill="#90caf9" opacity=".2"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge html">HTML</span>dashboard.html</div>
              </div>
              {/* Duplicate first 3 for seamless loop */}
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><rect x="8" y="8" width="30" height="6" rx="3" fill="#4a7c59"/><rect x="8" y="18" width="64" height="4" rx="2" fill="#81c784" opacity=".5"/><rect x="8" y="26" width="48" height="4" rx="2" fill="#81c784" opacity=".35"/><rect x="8" y="38" width="22" height="10" rx="4" fill="#4a7c59"/><rect x="34" y="38" width="22" height="10" rx="4" fill="#a5d6a7" opacity=".5"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge html">HTML</span>hero.html</div>
              </div>
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><circle cx="40" cy="24" r="14" fill="#e91e63" opacity=".25"/><path d="M33 24l5 5 9-10" stroke="#e91e63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="24" y="44" width="32" height="4" rx="2" fill="#f48fb1" opacity=".4"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge svg">SVG</span>logo.svg</div>
              </div>
              <div className="welcome-card">
                <div className="welcome-card-preview" style={{ background: 'linear-gradient(135deg, #ede7f6, #d1c4e9)' }}>
                  <svg viewBox="0 0 80 56" fill="none" className="welcome-card-icon"><rect x="10" y="8" width="60" height="8" rx="4" fill="#7e57c2" opacity=".2"/><rect x="10" y="20" width="28" height="28" rx="4" fill="#b39ddb" opacity=".3"/><rect x="42" y="20" width="28" height="12" rx="4" fill="#b39ddb" opacity=".3"/><rect x="42" y="36" width="28" height="12" rx="4" fill="#b39ddb" opacity=".3"/></svg>
                </div>
                <div className="welcome-card-label"><span className="welcome-card-badge jsx">JSX</span>Card.jsx</div>
              </div>
            </div>
          </div>
        </div>

        <div className="welcome-content">
          <h1 className="welcome-title">Browse your AI-generated designs</h1>
          <p className="welcome-subtitle">
            Point DesignVault to any project folder to see live previews of every HTML, SVG, and JSX file your AI tools have created.
          </p>

          <div className="welcome-actions">
            <button
              className="welcome-btn primary"
              onClick={handlePickFolder}
              disabled={pickingFolder}
            >
              {pickingFolder ? 'Opening...' : 'Choose a folder'}
            </button>
          </div>

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
