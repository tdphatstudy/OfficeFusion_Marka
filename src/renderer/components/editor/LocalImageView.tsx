import { useEffect, useState, type FC } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { loadLocalImage } from '@/lib/localImages'
import { imageUrl } from '@/lib/remoteImages'

export const LocalImageView: FC<NodeViewProps> = ({ node }) => {
  const location = useEditorStore(state => state.fileLocation)
  const documentId = useEditorStore(state => state.documentId)
  const source = String(node.attrs.src ?? '')
  const alt = String(node.attrs.alt ?? '')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
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
  return (
    <NodeViewWrapper as="span" className="inline-block max-w-full align-middle">
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="max-w-full"
          onError={() => {
            setUrl('')
            setError('Image unavailable. Check its URL or connection.')
          }}
        />
      ) : (
        <span role="img" aria-label={alt || 'Image'} className="text-xs text-text-secondary">
          {error || 'Loading image…'}
        </span>
      )}
    </NodeViewWrapper>
  )
}
