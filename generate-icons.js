// Generate PWA icons matching the app favicon (favicon.svg):
// solid #0B0B12 background + purple heartbeat/pulse line.
// Run: node generate-icons.js
//
// The favicon is a 48x48 viewBox; everything below is that design scaled
// 512/48 = 10.667x onto a 512 canvas. The background is a full-bleed rect
// (every pixel opaque) so no OS mask or launcher plate can ever show white
// through the corners. The rounded-corner look comes from whichever OS
// renders the icon, as with the favicon itself.

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(__dirname, 'public/icons')

// favicon.svg scaled to 512x512: "M40 24h-6l-4 12L18 12l-4 12H8" with stroke 3.2
const pulsePath = 'M427 256h-64l-43 128L192 128l-43 128H85'
const strokeWidth = 34 // 3.2 * 10.667 ≈ 34

const iconSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#A855F7" />
      <stop offset="1" stop-color="#7E14FF" />
    </linearGradient>
  </defs>
  <!-- Rounded-corner background matching favicon.svg's rx (11/48 → 117 at 512).
       Corners come out transparent; the dark background_color fills them on the
       PWA splash, so they render dark, never white. -->
  <rect width="512" height="512" rx="117" fill="#0B0B12" />
  <!-- Heartbeat pulse line, matching favicon.svg -->
  <path d="${pulsePath}" stroke="url(#p)" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>
`

// Maskable variant: same design but the mark scaled to 84% so the whole
// pulse (including stroke caps) fits inside the central 80% safe circle
// (radius 205 at 512px). Farthest reachable point: the pulse spans x85..427,
// y128..384 (the extremal left/right ends are ~171px and the top/bottom
// vertices ~143px from center), scaled 0.84 that's ~144px, plus ~14px of
// half-stroke = ~158px < 205. Safe.
const maskableSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#A855F7" />
      <stop offset="1" stop-color="#7E14FF" />
    </linearGradient>
  </defs>
  <!-- Full-bleed opaque background: covers every pixel the mask can reveal -->
  <rect width="512" height="512" fill="#0B0B12" />
  <g transform="translate(256 256) scale(0.84) translate(-256 -256)">
    <path d="${pulsePath}" stroke="url(#p)" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </g>
</svg>
`

// Generate icons at multiple sizes
const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

async function generateIcons() {
  const svgBuffer = Buffer.from(iconSVG)

  for (const { name, size } of sizes) {
    const outputPath = resolve(outputDir, name)
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toFile(outputPath)

    console.log(`✅ Generated ${name} (${size}x${size}) — favicon pulse design`)
  }

  // Also generate a maskable version with safe zone (central 80%)
  const maskablePath = resolve(outputDir, 'icon-512-maskable.png')
  await sharp(Buffer.from(maskableSVG))
    .resize(512, 512, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(maskablePath)

  console.log('✅ Generated icon-512-maskable.png (512x512) — pulse within safe zone')

  console.log('\n✨ All icons generated successfully!')
  console.log('Next steps:')
  console.log('1. Copy fixed icons to dist/icons/ after build')
  console.log('2. Rebuild and test PWA')
}

generateIcons().catch(console.error)