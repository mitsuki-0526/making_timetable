import { useState, useRef, useCallback } from 'react'
import type { SolverInput, SolverResult, SolverWorkerResponse } from '@/domain/solver/types'

type SolverState = {
  running: boolean
  progress: { iteration: number; bestScore: number } | null
  result: SolverResult | null
  error: string | null
}

export function useSolverWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [state, setState] = useState<SolverState>({
    running: false, progress: null, result: null, error: null,
  })

  const start = useCallback((input: SolverInput, mode: 'full' | 'empty_only', maxIterations = 100) => {
    // 既存のWorkerがあれば終了
    workerRef.current?.terminate()

    setState({ running: true, progress: null, result: null, error: null })

    const worker = new Worker(
      new URL('../domain/solver/jsSolver.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<SolverWorkerResponse>) => {
      switch (e.data.type) {
        case 'progress': {
          const { iteration, bestScore } = e.data
          setState((prev) => ({ ...prev, progress: { iteration, bestScore } }))
        }
          break
        case 'done':
          setState({ running: false, progress: null, result: e.data.result, error: null })
          worker.terminate()
          workerRef.current = null
          break
        case 'error':
          setState({ running: false, progress: null, result: null, error: e.data.message })
          worker.terminate()
          workerRef.current = null
          break
      }
    }

    worker.onerror = (err) => {
      setState({ running: false, progress: null, result: null, error: err.message })
      worker.terminate()
      workerRef.current = null
    }

    worker.postMessage({ type: 'start', input, mode, maxIterations })
  }, [])

  const cancel = useCallback(() => {
    workerRef.current?.postMessage({ type: 'cancel' })
  }, [])

  return { ...state, start, cancel }
}
