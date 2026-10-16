import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const directory = resolve(import.meta.dirname, '../resources')
const icon = (await readFile(resolve(directory, 'icon.svg'))).toString('base64')
for (const theme of ['light', 'dark']) {
  const dark = theme === 'dark'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" viewBox="0 0 640 160"><rect width="640" height="160" rx="24" fill="${dark ? '#151820' : '#F6F7FC'}"/><image x="28" y="28" width="104" height="104" href="data:image/svg+xml;base64,${icon}"/><text x="158" y="88" fill="${dark ? '#F8FAFC' : '#1A2030'}" font-family="Segoe UI, sans-serif" font-size="56" font-weight="700" letter-spacing="-2">Marka</text><text x="162" y="118" fill="${dark ? '#A6ADBD' : '#626D84'}" font-family="Segoe UI, sans-serif" font-size="13" letter-spacing="3">OFFICEFUSION</text></svg>`
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
