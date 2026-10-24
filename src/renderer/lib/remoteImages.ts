export interface CommonsImage {
  title: string
  url: string
  thumbnail: string
  page: string
  mime: string
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

export function commonsImages(value: unknown): CommonsImage[] {
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
    return [{ title: page.title.replace(/^File:/, ''), url, thumbnail, page: source, mime }]
  })
}

export async function searchCommons(query: string, signal?: AbortSignal): Promise<CommonsImage[]> {
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
