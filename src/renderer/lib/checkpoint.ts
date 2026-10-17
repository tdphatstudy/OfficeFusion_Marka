export function createCheckpoint(
  write: () => void,
  idleMs = 600,
  maximumMs = 5000
): {
  schedule: (immediate?: boolean) => void
  reset: () => void
} {
  let idle: ReturnType<typeof setTimeout> | undefined
  let maximum: ReturnType<typeof setTimeout> | undefined
  const reset = (): void => {
    clearTimeout(idle)
    clearTimeout(maximum)
    idle = undefined
    maximum = undefined
  }
  const flush = (): void => {
    reset()
    write()
  }
  return {
    reset,
    schedule: immediate => {
      clearTimeout(idle)
      idle = setTimeout(flush, immediate ? 0 : idleMs)
      maximum ??= setTimeout(flush, maximumMs)
    }
  }
}
