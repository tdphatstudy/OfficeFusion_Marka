import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'resources')

const lockupSvg = `<svg width="800" height="200" viewBox="0 0 800 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="800" y2="200" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0b0f19"/>
      <stop offset="100%" stop-color="#030712"/>
    </linearGradient>
    <linearGradient id="facet-l-top" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
    <linearGradient id="facet-r-top" x1="60" y1="0" x2="0" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
    <linearGradient id="facet-l-blade" x1="0" y1="0" x2="50" y2="80" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="facet-r-blade" x1="50" y1="0" x2="0" y2="80" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="facet-c-l" x1="0" y1="0" x2="20" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#e0e7ff"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="facet-c-r" x1="20" y1="0" x2="0" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f5d0fe"/>
      <stop offset="100%" stop-color="#5b21b6"/>
    </linearGradient>
    <radialGradient id="gem" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </radialGradient>
    <linearGradient id="nib" x1="0" y1="0" x2="0" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="text-grad" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e0e7ff"/>
    </linearGradient>
  </defs>

  <rect width="800" height="200" rx="20" fill="url(#bg)"/>
  <rect width="800" height="200" rx="20" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

  <!-- Icon scaled and positioned at x=50, y=30, size=140x140 -->
  <g transform="translate(60, 30) scale(0.14)">
    <circle cx="512" cy="512" r="380" fill="#6366f1" opacity="0.25"/>
    <polygon points="512,185 310,370 425,495 512,390" fill="url(#facet-l-top)"/>
    <polygon points="512,185 714,370 599,495 512,390" fill="url(#facet-r-top)"/>
    <polygon points="310,370 425,495 365,640 260,505" fill="url(#facet-l-blade)"/>
    <polygon points="714,370 599,495 659,640 764,505" fill="url(#facet-r-blade)"/>
    <polygon points="512,390 425,495 365,640 504,775 504,545" fill="url(#facet-c-l)"/>
    <polygon points="512,390 599,495 659,640 520,775 520,545" fill="url(#facet-c-r)"/>
    <polygon points="512,460 550,512 512,564 474,512" fill="url(#gem)"/>
    <polygon points="504,775 520,775 512,828" fill="url(#nib)"/>
    <line x1="512" y1="568" x2="512" y2="826" stroke="#ffffff" stroke-width="4"/>
  </g>

  <!-- Typography -->
  <text x="240" y="112" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="64" fill="url(#text-grad)" letter-spacing="-1.5">Marka</text>
  <rect x="450" y="74" width="76" height="24" rx="12" fill="#6366f1" fill-opacity="0.2"/>
  <text x="466" y="90" font-family="Inter, system-ui, sans-serif" font-weight="600" font-size="12" fill="#818cf8" letter-spacing="1">PRO</text>
  <text x="242" y="145" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="16" fill="#94a3b8" letter-spacing="0.5">by OfficeFusion Suite</text>
</svg>`

async function main() {
  const buf = await sharp(Buffer.from(lockupSvg)).png().toBuffer()
  writeFileSync(resolve(OUT, 'marka_lockup.png'), buf)
  console.log('Saved marka_lockup.png')
}

main().catch(console.error)
