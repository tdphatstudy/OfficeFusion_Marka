import type { FC } from 'react'
import { ScrollArea } from '@/components/ui'

const Sidebar: FC = () => {
  return (
    <ScrollArea className="h-full w-full">
      <div className="p-3">
        <p className="text-xs text-text-muted">No folder open</p>
      </div>
    </ScrollArea>
  )
}

export default Sidebar
