import { useCallback, useEffect, useRef } from 'react'

const SESSION_PERSIST_DEBOUNCE_MS = 350

export function formatPersistError(error) {
  const name = error?.name
  if (name === 'QuotaExceededError') {
    return 'Autosave paused: browser session storage is full.'
  }
  return `Autosave paused: ${error?.message ?? 'Failed to write draft data.'}`
}

export function useSessionDraftPersistence({ sessionKey, setStatusMessage }) {
  const sessionPersistTimerRef = useRef(null)
  const pendingSessionPayloadRef = useRef(null)
  const didReportPersistFailureRef = useRef(false)

  const writeSessionPayload = useCallback(
    (payload) => {
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(payload))
        if (didReportPersistFailureRef.current) {
          setStatusMessage('Autosave restored.')
        }
        didReportPersistFailureRef.current = false
        return true
      } catch (error) {
        if (!didReportPersistFailureRef.current) {
          setStatusMessage(formatPersistError(error))
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
    (nextTabs, nextActiveTabId, { flush = false } = {}) => {
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
    const flushOnPageExit = () => flushSessionPersist()
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
