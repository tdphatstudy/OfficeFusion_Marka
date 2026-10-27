import { useEffect, type FC } from 'react'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

export const Notifications: FC = () => {
  const notice = useUIStore(state => state.notice)
  useEffect(() => {
    if (!notice || notice.error) {
      return
    }
    const timer = setTimeout(() => useUIStore.getState().dismissNotice(), 5000)
    return () => {
      clearTimeout(timer)
    }
  }, [notice])
  if (!notice) {
    return null
  }
  return (
    <div
      role={notice.error ? 'alert' : 'status'}
      className="fixed bottom-10 right-4 z-[100] flex max-w-[min(460px,90vw)] items-start gap-3 rounded border border-border bg-surface p-3 text-xs shadow-lg"
    >
      {notice.error ? (
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-700 dark:text-red-400" />
      ) : (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />
      )}
      <p className="flex-1 break-words">{notice.message}</p>
      <button
        type="button"
        onClick={useUIStore.getState().dismissNotice}
        aria-label="Dismiss notification"
        className="icon-button"
      >
        <X size={14} />
      </button>
    </div>
  )
}
