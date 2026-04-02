import { useEffect, useRef } from 'react'

export default function SidebarFlowers() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    const width = canvas.width
    const height = canvas.height

    const palette = {
      petalLight: '#f6c700',
      petalMid: '#f08a00',
      petalDark: '#b95a00',
      center: '#2b1a14',
      stem: '#2f6b2f',
      stemDark: '#183d1d',
    }

    let seed = 20260402 >>> 0
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    const chance = (v) => rng() < v

    const fillPixel = (x, y, color, alpha = 1) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
      ctx.globalAlpha = 1
    }

    const hash2 = (x, y, s = 0) => {
      const v = Math.sin((x * 127.1 + y * 311.7 + s * 74.7) * 0.1) * 43758.5453
      return v - Math.floor(v)
    }

    const ditherTone = (x, y, light, mid, dark, bias = 0.5) => {
      const n = hash2(x, y, 1)
      if (n > bias + 0.18) return light
      if (n > bias - 0.12) return mid
      return dark
    }

    const drawLine = (x0, y0, x1, y1, color, thickness = 1) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps
        const x = x0 + (x1 - x0) * t
        const y = y0 + (y1 - y0) * t
        for (let ox = -thickness; ox <= thickness; ox++) {
          for (let oy = -thickness; oy <= thickness; oy++) {
            if (ox * ox + oy * oy <= thickness * thickness + 0.3)
              fillPixel(x + ox, y + oy, color, 0.95)
          }
        }
      }
    }

    const drawCurve = (points, color, thickness = 1) => {
      for (let i = 0; i < points.length - 2; i += 2) {
        const [x0, y0] = points[i]
        const [cx, cy] = points[i + 1]
        const [x1, y1] = points[i + 2]
        let prevX = x0, prevY = y0
        for (let step = 1; step <= 24; step++) {
          const t = step / 24, inv = 1 - t
          const x = inv * inv * x0 + 2 * inv * t * cx + t * t * x1
          const y = inv * inv * y0 + 2 * inv * t * cy + t * t * y1
          drawLine(prevX, prevY, x, y, color, thickness)
          prevX = x; prevY = y
        }
      }
    }

    const drawPetal = (cx, cy, angle, length, widthR, lean = 0) => {
      const cos = Math.cos(angle), sin = Math.sin(angle)
      for (let py = -Math.ceil(length); py <= Math.ceil(length); py++) {
        for (let px = -Math.ceil(widthR * 1.5); px <= Math.ceil(widthR * 1.5); px++) {
          const nx = px / widthR, ny = py / length
          const shape = nx * nx + Math.pow(ny * 1.15, 2)
          if (shape > 1) continue
          const warp = Math.sin((ny + 1.2) * Math.PI) * lean
          const lx = px + warp * widthR * 0.55, ly = py
          const x = cx + lx * cos - ly * sin, y = cy + lx * sin + ly * cos
          const bias = (1 - Math.max(0, ny + 0.2)) * 0.6 + hash2(x, y, 7) * 0.18
          const color = ditherTone(x, y, palette.petalLight, palette.petalMid, palette.petalDark, bias)
          if (chance(0.84 - shape * 0.22)) fillPixel(x, y, color, 1)
        }
      }
    }

    const drawCenter = (cx, cy, radius) => {
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          if ((x * x + y * y) / (radius * radius) > 1) continue
          const c = hash2(cx + x, cy + y, 11) > 0.52 ? palette.center : '#4a3025'
          if (chance(0.92)) fillPixel(cx + x, cy + y, c)
        }
      }
      for (let i = 0; i < 18; i++) {
        const a = (Math.PI * 2 * i) / 18 + rng() * 0.18
        const r = radius + 3 + Math.floor(rng() * 4)
        drawLine(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, '#3b241b', 0)
      }
    }

    const drawFlower = ({ centerX, centerY, petals, bloomScale, rotation, stemPoints }) => {
      drawCurve(stemPoints, palette.stemDark, 1)
      drawCurve(stemPoints, palette.stem, 0)
      for (let i = 0; i < petals; i++) {
        const angle = rotation + (Math.PI * 2 * i) / petals + (rng() - 0.5) * 0.18
        const length = bloomScale * (10 + rng() * 4)
        const widthR = bloomScale * (4.2 + rng() * 1.4)
        const offset = bloomScale * (7 + rng() * 3)
        drawPetal(
          centerX + Math.cos(angle) * offset,
          centerY + Math.sin(angle) * offset * 0.78,
          angle + Math.PI / 2, length, widthR, rng() - 0.5
        )
      }
      drawCenter(centerX, centerY, Math.round(bloomScale * 4.8))
    }

    // Draw grass blades
    const drawGrass = () => {
      for (let x = 0; x < width; x += 1) {
        if (!chance(0.35)) continue
        const h = 4 + Math.floor(rng() * 10)
        const lean = (rng() - 0.5) * 3
        const c = rng() > 0.5 ? palette.stem : palette.stemDark
        for (let y = 0; y < h; y++) {
          const t = y / h
          const gx = x + lean * t
          fillPixel(gx, height - y, c, 0.6 + rng() * 0.35)
        }
      }
    }

    ctx.clearRect(0, 0, width, height)

    // Grass first (behind stems)
    drawGrass()

    // Three flowers
    drawFlower({
      centerX: 50, centerY: 48,
      petals: 13, bloomScale: 1.4, rotation: -0.68,
      stemPoints: [[65, height],[60, 145],[56, 120],[52, 90],[51, 68],[50, 54],[50, 48]],
    })
    drawFlower({
      centerX: 140, centerY: 76,
      petals: 11, bloomScale: 1.1, rotation: 0.34,
      stemPoints: [[144, height],[142, 140],[140, 120],[139, 100],[138, 86],[139, 80],[140, 76]],
    })
    // Small flower on the left
    drawFlower({
      centerX: 14, centerY: 108,
      petals: 9, bloomScale: 0.8, rotation: 0.9,
      stemPoints: [[20, height],[18, 148],[16, 132],[15, 120],[14, 112],[14, 108]],
    })
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={170}
      className="sidebar-flowers"
      aria-hidden="true"
    />
  )
}
