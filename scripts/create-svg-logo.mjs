import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'resources')

const svgMark = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bg-glow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.8"/>
      <stop offset="45%" stop-color="#0f172a" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="1"/>
    </radialGradient>
    <radialGradient id="ambient-core" cx="50%" cy="52%" r="42%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.32"/>
      <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>

    <!-- Facet Gradients for Geometric Crystal Quill -->
    <!-- Left Top Wing -->
    <linearGradient id="facet-left-top" x1="280" y1="260" x2="480" y2="520" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>

    <!-- Right Top Wing -->
    <linearGradient id="facet-right-top" x1="744" y1="260" x2="544" y2="520" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="50%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>

    <!-- Left Main Blade -->
    <linearGradient id="facet-left-blade" x1="320" y1="440" x2="502" y2="780" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="35%" stop-color="#0ea5e9"/>
      <stop offset="70%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>

    <!-- Right Main Blade -->
    <linearGradient id="facet-right-blade" x1="704" y1="440" x2="522" y2="780" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="40%" stop-color="#9333ea"/>
      <stop offset="80%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>

    <!-- Left Center Shard -->
    <linearGradient id="facet-center-left" x1="440" y1="360" x2="502" y2="740" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#e0e7ff"/>
      <stop offset="30%" stop-color="#a5b4fc"/>
      <stop offset="70%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>

    <!-- Right Center Shard -->
    <linearGradient id="facet-center-right" x1="584" y1="360" x2="522" y2="740" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f5d0fe"/>
      <stop offset="30%" stop-color="#d8b4fe"/>
      <stop offset="70%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#5b21b6"/>
    </linearGradient>

    <!-- Nib Tip Glow -->
    <linearGradient id="nib-tip" x1="512" y1="680" x2="512" y2="825" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="#67e8f9"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>

    <!-- Center Breather Hole Gem -->
    <radialGradient id="gem-glow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#38bdf8"/>
      <stop offset="80%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#312e81"/>
    </radialGradient>

    <!-- Drop Shadow Filters -->
    <filter id="shadow-deep" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="32" flood-color="#000000" flood-opacity="0.6"/>
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#4f46e5" flood-opacity="0.35"/>
    </filter>

    <filter id="inner-border-glow">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#ffffff" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Squircle Canvas Base -->
  <rect x="32" y="32" width="960" height="960" rx="224" fill="url(#bg-glow)"/>
  <rect x="32" y="32" width="960" height="960" rx="224" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>
  <rect x="36" y="36" width="952" height="952" rx="220" stroke="rgba(99,102,241,0.2)" stroke-width="2"/>

  <!-- Core Ambient Glow -->
  <circle cx="512" cy="512" r="380" fill="url(#ambient-core)"/>

  <!-- Prism Crystal Quill Assembly -->
  <g filter="url(#shadow-deep)">
    <!-- Top Left Facet -->
    <polygon points="512,185 310,370 425,495 512,390" fill="url(#facet-left-top)"/>

    <!-- Top Right Facet -->
    <polygon points="512,185 714,370 599,495 512,390" fill="url(#facet-right-top)"/>

    <!-- Left Outer Wing Blade -->
    <polygon points="310,370 425,495 365,640 260,505" fill="url(#facet-left-blade)" opacity="0.95"/>

    <!-- Right Outer Wing Blade -->
    <polygon points="714,370 599,495 659,640 764,505" fill="url(#facet-right-blade)" opacity="0.95"/>

    <!-- Left Main Body Shard -->
    <polygon points="512,390 425,495 365,640 504,775 504,545" fill="url(#facet-center-left)"/>

    <!-- Right Main Body Shard -->
    <polygon points="512,390 599,495 659,640 520,775 520,545" fill="url(#facet-center-right)"/>

    <!-- Central Floating Diamond Breather Gem -->
    <polygon points="512,460 550,512 512,564 474,512" fill="url(#gem-glow)"/>

    <!-- Nib Tip Pen Point (Sharp Precision Arrowhead) -->
    <polygon points="504,775 520,775 512,828" fill="url(#nib-tip)"/>

    <!-- High-Precision Center Slit Light -->
    <line x1="512" y1="568" x2="512" y2="826" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.85"/>

    <!-- Geometric Facet Specular Accents -->
    <line x1="512" y1="185" x2="310" y2="370" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"/>
    <line x1="512" y1="185" x2="714" y2="370" stroke="rgba(255,255,255,0.6)" stroke-width="3"/>
    <line x1="512" y1="185" x2="512" y2="390" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
    <line x1="425" y1="495" x2="512" y2="390" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <line x1="599" y1="495" x2="512" y2="390" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    <line x1="512" y1="460" x2="550" y2="512" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>
    <line x1="474" y1="512" x2="512" y2="460" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
  </g>
</svg>`

async function main() {
  const svgPath = resolve(OUT, 'icon.svg')
  writeFileSync(svgPath, svgMark)
  console.log('Saved SVG icon to', svgPath)

  const png1024 = await sharp(Buffer.from(svgMark)).png().toBuffer()
  writeFileSync(resolve(OUT, 'icon-1024.png'), png1024)
  writeFileSync(resolve(OUT, 'icon-1024.jpg'), await sharp(Buffer.from(svgMark)).jpeg({ quality: 95 }).toBuffer())
  console.log('Rendered 1024px icon PNG and JPG')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
