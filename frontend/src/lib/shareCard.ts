/** Renders a downloadable "result card" PNG for a successful Shor's Lab run -- a shareable
 * artifact of the actual factorization, not a screenshot. N and a already live in the page URL
 * (see ShorLabPage.tsx), so the card just embeds that same URL rather than inventing a separate
 * share mechanism -- opening it replays the exact worked example. Colors are this site's own
 * palette tokens (see index.css's --color-* variables), not generic OG-card defaults, so a
 * downloaded card still visually belongs to the site once it's out of context on its own. */

export type ShareCardData = {
  n: number
  factors: [number, number]
  backend: string
  elapsedSeconds: number
  attempts: number
  shareUrl: string
}

const WIDTH = 1200
const HEIGHT = 630

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.strokeStyle = 'rgba(238, 232, 218, 0.05)'
  ctx.lineWidth = 1
  const step = 32
  for (let x = 0; x <= WIDTH; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, HEIGHT)
    ctx.stroke()
  }
  for (let y = 0; y <= HEIGHT; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WIDTH, y)
    ctx.stroke()
  }
  ctx.restore()
}

/** Echoes Layout.tsx's BridgeEmblem SVG (arch + three deck lines + a horizontal deck) at canvas
 * scale, so the card carries the same small brand mark used in the site header. */
function drawBridgeEmblem(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.strokeStyle = '#c99545'
  ctx.lineCap = 'round'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(2, 14)
  ctx.bezierCurveTo(2, 5, 26, 5, 26, 14)
  ctx.stroke()
  ctx.globalAlpha = 0.7
  ;[6, 14, 22].forEach((dx) => {
    ctx.beginPath()
    ctx.moveTo(dx, dx === 14 ? 5.5 : 9)
    ctx.lineTo(dx, 14)
    ctx.stroke()
  })
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#204a66'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(0, 14.5)
  ctx.lineTo(28, 14.5)
  ctx.stroke()
  ctx.restore()
}

export function renderShorResultCard(canvas: HTMLCanvasElement, data: ShareCardData) {
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#070a0f'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  drawGrid(ctx)

  const glow = ctx.createRadialGradient(WIDTH / 2, 210, 40, WIDTH / 2, 210, 460)
  glow.addColorStop(0, 'rgba(227,180,94,0.14)')
  glow.addColorStop(1, 'rgba(227,180,94,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.strokeStyle = 'rgba(201,149,69,0.4)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2)

  ctx.fillStyle = '#c99545'
  ctx.font = '600 22px ui-monospace, Menlo, monospace'
  ctx.fillText("// SHOR'S LAB — CRACKED", 64, 96)

  ctx.fillStyle = '#eee8da'
  ctx.font = '600 84px Georgia, serif'
  const headline = `${data.n} = ${data.factors[0]} × ${data.factors[1]}`
  ctx.fillText(headline, 64, 226)

  ctx.fillStyle = '#8c919b'
  ctx.font = '400 25px ui-monospace, Menlo, monospace'
  ctx.fillText(
    `Recovered via the ${data.backend} backend in ${data.elapsedSeconds.toFixed(3)}s (${data.attempts} attempt${data.attempts !== 1 ? 's' : ''})`,
    64,
    276,
  )

  ctx.strokeStyle = '#1b2430'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(64, 470)
  ctx.lineTo(WIDTH - 64, 470)
  ctx.stroke()

  drawBridgeEmblem(ctx, 64, 512, 2.3)
  ctx.fillStyle = '#eee8da'
  ctx.font = "600 24px Georgia, serif"
  ctx.fillText("Shor's Lab", 130, 528)
  ctx.fillStyle = '#8c919b'
  ctx.font = '400 16px ui-monospace, Menlo, monospace'
  ctx.fillText('Quantum security research — educational demo', 130, 552)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#e3b45e'
  ctx.font = '400 20px ui-monospace, Menlo, monospace'
  const maxUrlWidth = WIDTH - 64 - 320
  let url = data.shareUrl
  while (ctx.measureText(url).width > maxUrlWidth && url.length > 8) {
    url = url.slice(0, -2)
  }
  if (url !== data.shareUrl) url = url.slice(0, -1) + '…'
  ctx.fillText(url, WIDTH - 64, 528)
  ctx.textAlign = 'left'
}

/** Renders the card in-memory (never mounted in the DOM) and triggers a browser download -- no
 * server round-trip, since everything needed to draw the card is already in `data`. */
export function downloadShorResultCard(data: ShareCardData) {
  const canvas = document.createElement('canvas')
  renderShorResultCard(canvas, data)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `shors-lab-${data.n}-${data.factors[0]}x${data.factors[1]}.png`
    link.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
