import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const directory = resolve(import.meta.dirname, '../resources')
for (const theme of ['light', 'dark']) {
  const dark = theme === 'dark'
  const icon = (await readFile(resolve(directory, dark ? 'icon-dark.svg' : 'icon.svg'))).toString(
    'base64'
  )
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" viewBox="0 0 640 160"><rect width="640" height="160" fill="${dark ? '#252729' : '#FFFFFF'}"/><image x="24" y="36" width="88" height="88" href="data:image/svg+xml;base64,${icon}"/><text x="136" y="87" fill="${dark ? '#E9EBED' : '#252A2F'}" font-family="Segoe UI, sans-serif" font-size="48" font-weight="600">Marka</text><text x="138" y="114" fill="${dark ? '#B7BCC1' : '#596168'}" font-family="Segoe UI, sans-serif" font-size="16">OfficeFusion</text></svg>`
  await writeFile(resolve(directory, `marka-${theme}.svg`), svg)
  await sharp(Buffer.from(svg))
    .png()
    .toFile(resolve(directory, `marka-${theme}.png`))
  if (dark) {
    await sharp(Buffer.from(svg)).png().toFile(resolve(directory, 'marka_lockup.png'))
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 95 })
      .toFile(resolve(directory, 'logo-lockup.jpg'))
  }
}
console.log('Generated light and dark Marka brand lockups')
