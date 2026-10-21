import { useEffect, useState, type FC } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { loadLocalImage } from '@/lib/localImages'

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
        <img src={url} alt={alt} className="max-w-full" />
      ) : (
        <span role="img" aria-label={alt || 'Image'} className="text-xs text-text-secondary">
          {error || 'Loading image…'}
        </span>
      )}
    </NodeViewWrapper>
  )
}
