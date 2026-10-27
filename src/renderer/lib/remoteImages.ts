import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

export interface RemoteImageResult {
  title: string
  url: string
  thumbnail: string
  page: string
  mime: string
  source: 'Openverse' | 'Wikimedia Commons' | 'Imgflip'
  creator?: string
  license?: string
}

export interface DocumentImage {
  source: string
  alt: string
  width: number | null
  from: number
  to: number
}

export class ImageSearchError extends Error {
  constructor(
    source: string,
    public readonly status: number
  ) {
    super(`${source} returned ${status}.`)
  }
}

const imageMarkdownParser = unified().use(remarkParse).use(remarkGfm)

export function resizeImageMarkup(
  markup: string,
  image: DocumentImage,
  width: number
): string | null {
  if (!Number.isInteger(width) || width < 80 || width > 2400) {
    return null
  }
  if (/^<img\b/i.test(markup)) {
    return /\bwidth\s*=/i.test(markup)
      ? markup.replace(/\bwidth\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `width="${width}"`)
      : markup.replace(/\s*\/?\s*>$/, match => ` width="${width}"${match}`)
  }
  const escape = (value: string): string =>
    value.replace(
      /[&<>"']/g,
      character =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
        character
    )
  return `<img src="${escape(image.source)}" alt="${escape(image.alt)}" width="${width}">`
}

export function documentImages(content: string): DocumentImage[] {
  if (content.length > 200_000) {
    return []
  }
  const images: DocumentImage[] = []
  interface Node {
    type: string
    url?: string
    alt?: string
    value?: string
    children?: Node[]
    position?: { start: { offset?: number }; end: { offset?: number } }
  }
  const tree = imageMarkdownParser.parse(content) as Node
  let visited = 0
  const visit = (node: Node, depth: number): void => {
    if (++visited > 20_000 || depth > 50 || images.length >= 100) {
      return
    }
    const from = node.position?.start.offset
    const to = node.position?.end.offset
    if (typeof from === 'number' && typeof to === 'number') {
      if (node.type === 'image' && node.url) {
        images.push({ source: node.url, alt: node.alt ?? '', width: null, from, to })
      } else if (node.type === 'html' && /^<img\b/i.test(node.value ?? '')) {
        const markup = node.value ?? ''
        const source = markup.match(/\bsrc=["']([^"']+)["']/i)?.[1]
        const rawWidth = markup.match(/\bwidth=["']?(\d+)/i)?.[1]
        if (source) {
          images.push({
            source,
            alt: markup.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '',
            width: rawWidth ? Number(rawWidth) : null,
            from,
            to
          })
        }
      }
    }
    node.children?.forEach(child => visit(child, depth + 1))
  }
  visit(tree, 0)
  return images
}

export function imageUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password) {
      return null
    }
    return url.href.replaceAll('(', '%28').replaceAll(')', '%29')
  } catch {
    return null
  }
}

export function commonsImages(value: unknown): RemoteImageResult[] {
  if (!value || typeof value !== 'object' || !('query' in value)) {
    return []
  }
  const pages = (value as { query?: { pages?: unknown } }).query?.pages
  if (!Array.isArray(pages)) {
    return []
  }
  return pages.flatMap(page => {
    const info = page?.imageinfo?.[0]
    const mime = info?.mime
    const url = imageUrl(info?.url ?? '')
    const thumbnail = imageUrl(info?.thumburl ?? '')
    const source = imageUrl(info?.descriptionurl ?? '')
    if (
      typeof page?.title !== 'string' ||
      !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime) ||
      !url ||
      !thumbnail ||
      !source ||
      new URL(url).hostname !== 'upload.wikimedia.org' ||
      new URL(thumbnail).hostname !== 'upload.wikimedia.org' ||
      new URL(source).hostname !== 'commons.wikimedia.org'
    ) {
      return []
    }
    return [
      {
        title: page.title.replace(/^File:/, ''),
        url,
        thumbnail,
        page: source,
        mime,
        source: 'Wikimedia Commons' as const
      }
    ]
  })
}

export function openverseImages(value: unknown): RemoteImageResult[] {
  if (!value || typeof value !== 'object' || !('results' in value)) {
    return []
  }
  const results = (value as { results?: unknown }).results
  if (!Array.isArray(results)) {
    return []
  }
  return results.flatMap(item => {
    const url = imageUrl(item?.url ?? '')
    const thumbnail = imageUrl(item?.thumbnail ?? '')
    const page = imageUrl(item?.foreign_landing_url ?? '')
    const filetype = String(item?.filetype ?? '').toLowerCase()
    if (!url || !thumbnail || !page || !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(filetype)) {
      return []
    }
    return [
      {
        title: String(item?.title || 'Untitled image').slice(0, 200),
        url,
        thumbnail,
        page,
        mime: `image/${filetype === 'jpg' ? 'jpeg' : filetype}`,
        source: 'Openverse' as const,
        creator: typeof item?.creator === 'string' ? item.creator.slice(0, 100) : undefined,
        license: typeof item?.license === 'string' ? item.license.slice(0, 40) : undefined
      }
    ]
  })
}

const memeMimes: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg'
}

export function imgflipMemes(value: unknown): RemoteImageResult[] {
  const memes = (value as { data?: { memes?: unknown } } | null)?.data?.memes
  if (!Array.isArray(memes)) {
    return []
  }
  return memes.flatMap(item => {
    const id = String(item?.id ?? '')
    const url = imageUrl(item?.url ?? '')
    if (
      !/^\d{1,20}$/.test(id) ||
      !url ||
      new URL(url).hostname !== 'i.imgflip.com' ||
      !/\.(?:png|jpe?g|webp)$/i.test(new URL(url).pathname) ||
      typeof item?.name !== 'string'
    ) {
      return []
    }
    const extension = new URL(url).pathname.split('.').pop()?.toLowerCase()
    const mime = memeMimes[extension ?? ''] ?? 'image/jpeg'
    return [
      {
        title: item.name.slice(0, 200),
        url,
        thumbnail: url,
        page: `https://imgflip.com/memegenerator/${id}`,
        mime,
        source: 'Imgflip' as const
      }
    ]
  })
}

let cachedTopMemes: { expires: number; items: RemoteImageResult[] } | null = null

export async function searchTopMemes(
  query: string,
  signal?: AbortSignal
): Promise<RemoteImageResult[]> {
  if (!cachedTopMemes || cachedTopMemes.expires < Date.now()) {
    const response = await fetch('https://api.imgflip.com/get_memes?type=image', {
      signal,
      referrerPolicy: 'no-referrer'
    })
    if (!response.ok) {
      throw new Error(`Imgflip returned ${response.status}.`)
    }
    cachedTopMemes = {
      expires: Date.now() + 5 * 60_000,
      items: imgflipMemes(await response.json())
    }
  }
  const term = query.trim().toLocaleLowerCase()
  return term
    ? cachedTopMemes.items.filter(item => item.title.toLocaleLowerCase().includes(term))
    : cachedTopMemes.items
}

export async function searchOpenverse(
  query: string,
  gifs: boolean,
  signal?: AbortSignal
): Promise<RemoteImageResult[]> {
  const term = query.trim().slice(0, 100)
  if (!term) {
    return []
  }
  const url = new URL('https://api.openverse.org/v1/images/')
  url.searchParams.set('q', term)
  url.searchParams.set('page_size', '20')
  url.searchParams.set('extension', gifs ? 'gif' : 'jpg,jpeg,png,webp,gif')
  const response = await fetch(url, { signal, referrerPolicy: 'no-referrer' })
  if (!response.ok) {
    throw new ImageSearchError('Openverse', response.status)
  }
  return openverseImages(await response.json())
}

export async function searchCommons(
  query: string,
  signal?: AbortSignal
): Promise<RemoteImageResult[]> {
  const term = query.trim().slice(0, 100)
  if (!term) {
    return []
  }
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  for (const [key, value] of Object.entries({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: term,
    gsrnamespace: '6',
    gsrlimit: '36',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '320'
  })) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url, { signal, referrerPolicy: 'no-referrer' })
  if (!response.ok) {
    throw new Error(`Wikimedia Commons returned ${response.status}.`)
  }
  return commonsImages(await response.json())
}
