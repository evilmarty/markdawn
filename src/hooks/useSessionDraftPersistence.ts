import { useCallback, useEffect, useRef } from 'react'
import type { AppTab } from '../types/app'

const SESSION_PERSIST_DEBOUNCE_MS = 350

type PersistPayload = {
  tabs: Pick<AppTab, 'id' | 'fileName' | 'markdown' | 'savedMarkdown' | 'isDirty'>[]
  activeTabId: string
  updatedAt: number
}

type UseSessionDraftPersistenceParams = {
  sessionKey: string
  setStatusMessage: (message: string) => void
}

type PersistOptions = {
  flush?: boolean
}

export function formatPersistError(error: unknown): string {
  const name = error instanceof Error ? error.name : undefined
  if (name === 'QuotaExceededError') {
    return 'Autosave paused: browser session storage is full.'
  }
  const message = error instanceof Error ? error.message : 'Failed to write draft data.'
  return `Autosave paused: ${message}`
}

export function useSessionDraftPersistence({ sessionKey, setStatusMessage }: UseSessionDraftPersistenceParams) {
  const sessionPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSessionPayloadRef = useRef<PersistPayload | null>(null)
  const didReportPersistFailureRef = useRef(false)

  const writeSessionPayload = useCallback(
    (payload: PersistPayload): boolean => {
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(payload))
        if (didReportPersistFailureRef.current) {
          setStatusMessage('Autosave restored.')
        }
        didReportPersistFailureRef.current = false
        return true
      } catch (error) {
        const parsedError = error instanceof Error ? error : new Error('Unknown persistence error')
        if (!didReportPersistFailureRef.current) {
          setStatusMessage(formatPersistError(parsedError))
          didReportPersistFailureRef.current = true
        }
        return false
      }
    },
    [sessionKey, setStatusMessage],
  )

  const flushSessionPersist = useCallback(() => {
    const payload = pendingSessionPayloadRef.current
    if (!payload) return
    pendingSessionPayloadRef.current = null
    if (sessionPersistTimerRef.current) {
      clearTimeout(sessionPersistTimerRef.current)
      sessionPersistTimerRef.current = null
    }
    writeSessionPayload(payload)
  }, [writeSessionPayload])

  const persistTabsToSession = useCallback(
    (nextTabs: AppTab[], nextActiveTabId: string, { flush = false }: PersistOptions = {}) => {
      pendingSessionPayloadRef.current = {
        tabs: nextTabs.map(({ id, fileName, markdown, savedMarkdown, isDirty }) => ({
          id,
          fileName,
          markdown,
          savedMarkdown,
          isDirty,
        })),
        activeTabId: nextActiveTabId,
        updatedAt: Date.now(),
      }

      if (flush) {
        flushSessionPersist()
        return
      }

      if (sessionPersistTimerRef.current) clearTimeout(sessionPersistTimerRef.current)
      sessionPersistTimerRef.current = setTimeout(() => {
        sessionPersistTimerRef.current = null
        flushSessionPersist()
      }, SESSION_PERSIST_DEBOUNCE_MS)
    },
    [flushSessionPersist],
  )

  useEffect(
    () => () => {
      flushSessionPersist()
      if (sessionPersistTimerRef.current) clearTimeout(sessionPersistTimerRef.current)
    },
    [flushSessionPersist],
  )

  useEffect(() => {
    const flushOnPageExit = (): void => flushSessionPersist()
    const flushOnVisibilityHidden = () => {
      if (document.visibilityState === 'hidden') flushSessionPersist()
    }
    window.addEventListener('pagehide', flushOnPageExit)
    window.addEventListener('beforeunload', flushOnPageExit)
    document.addEventListener('visibilitychange', flushOnVisibilityHidden)
    return () => {
      window.removeEventListener('pagehide', flushOnPageExit)
      window.removeEventListener('beforeunload', flushOnPageExit)
      document.removeEventListener('visibilitychange', flushOnVisibilityHidden)
    }
  }, [flushSessionPersist])

  return {
    persistTabsToSession,
    flushSessionPersist,
  }
}
