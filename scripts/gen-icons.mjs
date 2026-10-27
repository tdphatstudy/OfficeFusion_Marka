import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const directory = resolve(import.meta.dirname, '../resources')
const source = await readFile(resolve(directory, 'icon.svg'))
const nativeSource = size =>
  Buffer.from(
    source
      .toString('utf8')
      .replace(
        '<path fill-rule=',
        `<path stroke="#E3E8EC" stroke-width="${size <= 32 ? 2 : 1.25}" stroke-linejoin="round" paint-order="stroke fill" fill-rule=`
      )
  )
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const images = new Map()
for (const size of sizes) {
  const png = await sharp(nativeSource(size)).resize(size, size).png().toBuffer()
  images.set(size, png)
  await writeFile(resolve(directory, `icon-${size}.png`), png)
}
await writeFile(resolve(directory, 'icon.png'), images.get(512))
await writeFile(
  resolve(directory, 'icon.ico'),
  await pngToIco(sizes.filter(size => size <= 256).map(size => images.get(size)))
)
await sharp(nativeSource(1024))
  .flatten({ background: '#ffffff' })
  .jpeg({ quality: 95 })
  .toFile(resolve(directory, 'icon-1024.jpg'))
const chunks = [
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512]
].map(([type, size]) => {
  const data = images.get(size)
  const header = Buffer.alloc(8)
  header.write(type, 0, 'ascii')
  header.writeUInt32BE(data.length + 8, 4)
  return Buffer.concat([header, data])
})
const body = Buffer.concat(chunks)
const header = Buffer.alloc(8)
header.write('icns', 0, 'ascii')
header.writeUInt32BE(body.length + 8, 4)
await writeFile(resolve(directory, 'icon.icns'), Buffer.concat([header, body]))
console.log('Generated Marka PNG, ICO and ICNS icons from resources/icon.svg')
