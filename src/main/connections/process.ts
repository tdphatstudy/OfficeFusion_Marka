import { spawn } from 'node:child_process'

export interface ProcessOptions {
  input?: string
  signal?: AbortSignal
  maxBytes?: number
  timeoutMs?: number
}

export function runProcess(
  executable: string,
  args: string[],
  options: ProcessOptions = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new Error('Connection cancelled.'))
      return
    }
    const child = spawn(executable, args, {
      windowsHide: true,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    const chunks: Buffer[] = []
    let size = 0
    let stderr = ''
    let failure: Error | null = null
    const stop = (error: Error): void => {
      failure = error
      child.kill()
    }
    const abort = (): void => stop(new Error('Connection cancelled.'))
    const timer = setTimeout(
      () => stop(new Error('Connection timed out. Check the host and network.')),
      options.timeoutMs ?? 30_000
    )
    options.signal?.addEventListener('abort', abort, { once: true })
    const cleanup = (): void => {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
    }
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > (options.maxBytes ?? 5 * 1024 * 1024)) {
        stop(new Error('Document exceeds the 5 MB connection limit.'))
      } else {
        chunks.push(chunk)
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-4096)
    })
    child.stdin.on('error', (error: Error) => {
      failure ??= error
    })
    child.on('error', (error: Error) => {
      cleanup()
      reject(error)
    })
    child.on('close', code => {
      cleanup()
      if (failure) {
        reject(failure)
      } else if (code !== 0) {
        reject(new Error(stderr.trim() || `Connection exited with code ${code}.`))
      } else {
        resolve(Buffer.concat(chunks))
      }
    })
    child.stdin.end(options.input)
  })
}
