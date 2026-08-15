import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatPersistError, useSessionDraftPersistence } from './useSessionDraftPersistence'

const mockTabs = [
  {
    id: 't1',
    fileName: 'a.md',
    markdown: '# a',
    savedMarkdown: '# a',
    fileHandle: null,
    isDirty: false,
  },
]

describe('useSessionDraftPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('formats persist errors', () => {
    const quotaError = new Error('quota')
    quotaError.name = 'QuotaExceededError'
    expect(formatPersistError(quotaError)).toContain('storage is full')
    expect(formatPersistError(new Error('bad'))).toContain('bad')
  })

  it('debounces writes and flushes pending payload', () => {
    const setStatusMessage = vi.fn()
    const { result } = renderHook(() =>
      useSessionDraftPersistence({ sessionKey: 'session-key', setStatusMessage }),
    )

    act(() => {
      result.current.persistTabsToSession(mockTabs, 't1')
    })
    expect(sessionStorage.getItem('session-key')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(360)
    })
    expect(sessionStorage.getItem('session-key')).toContain('"activeTabId":"t1"')

    act(() => {
      result.current.persistTabsToSession(mockTabs, 't1')
      result.current.flushSessionPersist()
    })
    expect(sessionStorage.getItem('session-key')).toContain('"tabs"')
  })

  it('reports write failures once and reports restored state', () => {
    const setStatusMessage = vi.fn()
    vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new Error('write failed')
    })

    const { result } = renderHook(() =>
      useSessionDraftPersistence({ sessionKey: 'session-key', setStatusMessage }),
    )

    act(() => {
      result.current.persistTabsToSession(mockTabs, 't1', { flush: true })
      result.current.persistTabsToSession(mockTabs, 't1', { flush: true })
    })
    expect(setStatusMessage).toHaveBeenCalledWith('Autosave paused: write failed')

    act(() => {
      result.current.persistTabsToSession(mockTabs, 't1', { flush: true })
    })
    expect(setStatusMessage).toHaveBeenCalledWith('Autosave restored.')
  })

  it('flushes on pagehide', () => {
    const setStatusMessage = vi.fn()
    const { result } = renderHook(() =>
      useSessionDraftPersistence({ sessionKey: 'session-key', setStatusMessage }),
    )

    act(() => {
      result.current.persistTabsToSession(mockTabs, 't1')
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(sessionStorage.getItem('session-key')).toContain('"tabs"')
  })
})
