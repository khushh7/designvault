import { useState, useEffect } from 'react'

const DELAY_MS = 7 * 60 * 1000 // 7 minutes

export default function StarPopup() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('dv_star_dismissed')) return
    const timer = setTimeout(() => setVisible(true), DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    sessionStorage.setItem('dv_star_dismissed', '1')
  }

  return (
    <div className="star-popup">
      <button className="star-popup-close" onClick={dismiss} aria-label="Dismiss">
        &times;
      </button>
      <a
        href="https://github.com/khushh7/designvault"
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
      >
        <img className="star-popup-img" src="/star-banner.webp" alt="Star on GitHub" />
      </a>
    </div>
  )
}
