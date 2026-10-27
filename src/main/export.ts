import { Worker } from 'node:worker_threads'
import { join } from 'node:path'

export async function renderExport(
  content: string,
  title: string,
  format: string
): Promise<string> {
  const worker = new Worker(join(import.meta.dirname, 'exportWorker.js'), {
    workerData: { content, title, format },
    resourceLimits: { maxOldGenerationSizeMb: 128 }
  })
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Export rendering timed out. Try a smaller section.')),
        10_000
      )
      const finish = (error?: Error, output?: string): void => {
        clearTimeout(timer)
        if (error) {
          reject(error)
        } else {
          resolve(output ?? '')
        }
      }
      worker.once('error', error => finish(error))
      worker.once('exit', code => finish(new Error(`Export worker stopped (${code}).`)))
      worker.once('message', (value: unknown) => {
        if (
          value &&
          typeof value === 'object' &&
          'output' in value &&
          typeof value.output === 'string' &&
          value.output.length <= 3 * 1024 * 1024
        ) {
          finish(undefined, value.output)
        } else {
          finish(
            new Error(
              value &&
                typeof value === 'object' &&
                'error' in value &&
                typeof value.error === 'string'
                ? value.error
                : 'Invalid export result.'
            )
          )
        }
      })
    })
  } finally {
    await worker.terminate()
  }
}
