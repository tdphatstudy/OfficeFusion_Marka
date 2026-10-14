import type { FC } from 'react'
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'
import { Info, AlertTriangle, Lightbulb, AlertOctagon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CalloutType = 'info' | 'warning' | 'tip' | 'danger'

const calloutConfig: Record<
  CalloutType,
  { label: string; icon: typeof Info; borderClass: string; bgClass: string; textClass: string }
> = {
  info: {
    label: 'Info',
    icon: Info,
    borderClass: 'border-blue-500/40',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-500'
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    borderClass: 'border-amber-500/40',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-500'
  },
  tip: {
    label: 'Tip',
    icon: Lightbulb,
    borderClass: 'border-emerald-500/40',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-500'
  },
  danger: {
    label: 'Danger',
    icon: AlertOctagon,
    borderClass: 'border-red-500/40',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-500'
  }
}

export const CalloutBlock: FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const currentType = (node.attrs['type'] as CalloutType) || 'info'
  const config = calloutConfig[currentType] ?? calloutConfig.info
  const IconComponent = config.icon

  const cycleType = (): void => {
    const types: CalloutType[] = ['info', 'tip', 'warning', 'danger']
    const nextIndex = (types.indexOf(currentType) + 1) % types.length
    const nextType = types[nextIndex] ?? 'info'
    updateAttributes({ type: nextType })
  }

  return (
    <NodeViewWrapper className="my-3">
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border p-3.5 transition-colors',
          config.borderClass,
          config.bgClass
        )}
      >
        <button
          type="button"
          onClick={cycleType}
          title={`Type: ${config.label}. Click to cycle.`}
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded transition-opacity hover:opacity-80',
            config.textClass
          )}
        >
          <IconComponent size={18} />
        </button>
        <NodeViewContent className="min-w-0 flex-1 outline-none text-text-primary text-sm leading-relaxed" />
      </div>
    </NodeViewWrapper>
  )
}
