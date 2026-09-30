// ==========================================
// © Қармақ — Group A Device Fingerprinting
// useFingerprint.ts
// ==========================================

import { useCallback, useEffect, useState } from 'react'
import { collectCompleteFingerprint } from './collector'
import type { CompleteFingerprint } from './types'

export interface UseFingerprintState {
  data: CompleteFingerprint | null
  loading: boolean
  progress: number
  step: string
  error: string | null
  refresh: () => void
}

export function useFingerprint(): UseFingerprintState {
  const [data, setData] = useState<CompleteFingerprint | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [progress, setProgress] = useState<number>(0)
  const [step, setStep] = useState<string>('Инициализация...')
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async () => {
    setLoading(true)
    setProgress(0)
    setError(null)
    setStep('Басталуда...')

    try {
      const result = await collectCompleteFingerprint((currentStep, percent) => {
        setStep(currentStep)
        setProgress(percent)
      })
      setData(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Белгісіз қате пайда болды')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    scan()
  }, [scan])

  return {
    data,
    loading,
    progress,
    step,
    error,
    refresh: scan,
  }
}
