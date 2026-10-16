import { useEffect, useState } from 'react'

export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const sync = (): void => setCompact(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return compact
}
