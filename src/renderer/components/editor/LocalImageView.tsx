import { useEffect, useState, type FC, type PointerEvent as ReactPointerEvent } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { loadLocalImage } from '@/lib/localImages'
import { imageUrl } from '@/lib/remoteImages'
import { imageWidth } from '@/lib/imageDimensions'

export const LocalImageView: FC<NodeViewProps> = ({ node, selected, updateAttributes }) => {
  const location = useEditorStore(state => state.fileLocation)
  const documentId = useEditorStore(state => state.documentId)
  const source = String(node.attrs.src ?? '')
  const alt = String(node.attrs.alt ?? '')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [draftWidth, setDraftWidth] = useState<number | null>(null)
  const width = draftWidth ?? imageWidth(node.attrs.width)
  useEffect(() => {
    let active = true
    setUrl('')
    setError('')
    const remote = imageUrl(source)
    if (remote) {
      setUrl(remote)
      return
    }
    if (location?.kind !== 'local') {
      setError('Save locally to load this image.')
      return
    }
    void loadLocalImage(documentId, location.path, source)
      .then(value => {
        if (active) {
          setUrl(value)
        }
      })
      .catch(() => {
        if (active) {
          setError('Image unavailable. Check its path and format.')
        }
      })
    return () => {
      active = false
    }
  }, [location, documentId, source])
  const resize = (event: ReactPointerEvent<HTMLButtonElement>, direction: -1 | 1): void => {
    const picture = event.currentTarget.parentElement?.querySelector('img')
    if (!picture) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = picture.getBoundingClientRect().width
    const limit = Math.max(80, picture.closest('.tiptap')?.getBoundingClientRect().width ?? 2400)
    const widthAt = (x: number): number =>
      Math.round(Math.max(80, Math.min(limit, startWidth + (x - startX) * direction)))
    const move = (pointer: PointerEvent): void => setDraftWidth(widthAt(pointer.clientX))
    const stop = (pointer: PointerEvent): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      const next = widthAt(pointer.clientX)
      setDraftWidth(null)
      updateAttributes({ width: next, height: null })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }
  return (
    <NodeViewWrapper
      as="span"
      className={`managed-image relative inline-block max-w-full align-middle ${selected ? 'managed-image-selected' : ''}`}
    >
      {url ? (
        <>
          <img
            src={url}
            alt={alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="block max-w-full"
            style={{ width: width ? `${width}px` : undefined, height: 'auto' }}
            onError={() => {
              setUrl('')
              setError('Image unavailable. Check its URL or connection.')
            }}
          />
          <button
            type="button"
            contentEditable={false}
            className="image-resize-handle image-resize-left"
            aria-label="Resize image from left"
            onPointerDown={event => resize(event, -1)}
          />
          <button
            type="button"
            contentEditable={false}
            className="image-resize-handle image-resize-right"
            aria-label="Resize image from right"
            onPointerDown={event => resize(event, 1)}
          />
          {selected && (
            <span className="image-size-label" contentEditable={false}>
              {Math.round(width ?? 0) || 'Auto'}
              {width ? ' px' : ''}
            </span>
          )}
        </>
      ) : (
        <span role="img" aria-label={alt || 'Image'} className="text-xs text-text-secondary">
          {error || 'Loading image…'}
        </span>
      )}
    </NodeViewWrapper>
  )
}
