export function createLatestTask<Input, Output>(
  execute: (input: Input, signal: AbortSignal) => Promise<Output>,
  deliver: (output: Output) => void,
  fail: () => void,
  timeoutMs = 5000
): { submit: (input: Input) => void; dispose: () => void } {
  let generation = 0
  let pending: { input: Input; generation: number } | null = null
  let active: AbortController | null = null
  let disposed = false
  const run = (): void => {
    if (disposed || active || !pending) {
      return
    }
    const job = pending
    pending = null
    const controller = new AbortController()
    active = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    let execution: Promise<Output>
    try {
      execution = execute(job.input, controller.signal)
    } catch (error: unknown) {
      execution = Promise.reject(error)
    }
    void Promise.race([
      execution,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('Task timed out.'))
        }, timeoutMs)
      })
    ])
      .then(output => {
        if (!disposed && job.generation === generation) {
          deliver(output)
        }
      })
      .catch(() => {
        if (!disposed && job.generation === generation) {
          fail()
        }
      })
      .finally(() => {
        clearTimeout(timer)
        active = null
        run()
      })
  }
  return {
    submit: input => {
      pending = { input, generation: ++generation }
      run()
    },
    dispose: () => {
      disposed = true
      pending = null
      active?.abort()
    }
  }
}
