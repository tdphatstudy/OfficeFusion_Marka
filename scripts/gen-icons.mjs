// scripts/gen-icons.mjs
// Converts resources/icon-1024.jpg → .ico (Win) + .icns (macOS) + PNG sizes
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'resources/icon-1024.jpg')
const OUT = resolve(ROOT, 'resources')

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const EXTRA_PNG_SIZES = [512, 1024]

console.log('🎨 Generating icons from', SRC)

// 1. Generate all PNG sizes
const pngBuffers = {}
for (const size of [...ICO_SIZES, ...EXTRA_PNG_SIZES]) {
  const buf = await sharp(SRC).resize(size, size).png().toBuffer()
  pngBuffers[size] = buf
  const outPath = resolve(OUT, `icon-${size}.png`)
  writeFileSync(outPath, buf)
  console.log(`  ✓ icon-${size}.png`)
}

// 2. Generate .ico (Windows) — embed multiple sizes
const icoBuffer = await pngToIco(ICO_SIZES.map(s => pngBuffers[s]))
writeFileSync(resolve(OUT, 'icon.ico'), icoBuffer)
console.log('  ✓ icon.ico (Windows)')

// 3. Generate .icns (macOS) — manual ICNS binary format
// ICNS format: 4-byte magic + 4-byte length + icon sets
function makeIcnsChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const lengthBytes = Buffer.alloc(4)
  lengthBytes.writeUInt32BE(data.length + 8)
  return Buffer.concat([typeBytes, lengthBytes, data])
}

const icnsChunks = [
  makeIcnsChunk('ic07', pngBuffers[128]),  // 128x128
  makeIcnsChunk('ic08', pngBuffers[256]),  // 256x256
  makeIcnsChunk('ic09', pngBuffers[512]),  // 512x512
  makeIcnsChunk('ic10', pngBuffers[1024]), // 1024x1024
  makeIcnsChunk('ic11', pngBuffers[32]),   // 32x32 @2x
  makeIcnsChunk('ic12', pngBuffers[64]),   // 64x64
  makeIcnsChunk('ic13', pngBuffers[256]),  // 256x256 @2x
  makeIcnsChunk('ic14', pngBuffers[512]),  // 512x512 @2x
]

const icnsBody = Buffer.concat(icnsChunks)
const icnsHeader = Buffer.alloc(8)
icnsHeader.write('icns', 0, 'ascii')
icnsHeader.writeUInt32BE(icnsBody.length + 8, 4)
const icnsBuffer = Buffer.concat([icnsHeader, icnsBody])
writeFileSync(resolve(OUT, 'icon.icns'), icnsBuffer)
console.log('  ✓ icon.icns (macOS)')

// 4. Main PNG for Linux
writeFileSync(resolve(OUT, 'icon.png'), pngBuffers[512])
console.log('  ✓ icon.png (Linux, 512x512)')

console.log('\n✅ All icons generated in resources/')
