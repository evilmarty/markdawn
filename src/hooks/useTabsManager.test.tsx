import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorHandle } from '../types/app'
import { useTabsManager } from './useTabsManager'

function makeEditorRef(markdown: string): { current: EditorHandle } {
  return {
    current: {
      getMarkdown: () => markdown,
      setMarkdown: vi.fn(),
      insertMarkdown: vi.fn(),
      focus: vi.fn(),
      getContentEditableHTML: vi.fn(() => ''),
      getSelectionMarkdown: vi.fn(() => ''),
    },
  }
}

describe('useTabsManager', () => {
  it('creates, switches, closes, and applies editor changes', () => {
    const persistTabsToSession = vi.fn()
    const setStatusMessage = vi.fn()
    const editorRef = makeEditorRef('# edited')
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const { result } = renderHook(() =>
      useTabsManager({
        draftFromSession: null,
        defaultMarkdown: '# default',
        editorRef,
        persistTabsToSession,
        setStatusMessage,
      }),
    )

    act(() => {
      result.current.handleNewTab()
    })
    expect(result.current.tabs.length).toBe(2)
    expect(setStatusMessage).toHaveBeenCalledWith('Created a new tab.')

    const firstId = result.current.tabs[0].id
    act(() => {
      result.current.handleSwitchTab(firstId)
    })
    expect(result.current.activeTab?.id).toBe(firstId)

    act(() => {
      result.current.applyEditorChange('# changed', false)
    })
    expect(result.current.activeTab?.markdown).toBe('# changed')

    act(() => {
      result.current.handleCloseTab(firstId)
    })
    expect(setStatusMessage).toHaveBeenCalledWith('Tab closed.')
    expect(persistTabsToSession).toHaveBeenCalled()
  })

  it('handles cancel-close and single-tab reset', () => {
    const persistTabsToSession = vi.fn()
    const setStatusMessage = vi.fn()
    const editorRef = makeEditorRef('# dirty')
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const { result } = renderHook(() =>
      useTabsManager({
        draftFromSession: null,
        defaultMarkdown: '# default',
        editorRef,
        persistTabsToSession,
        setStatusMessage,
      }),
    )

    const onlyTabId = result.current.tabs[0].id
    const initialTabId = result.current.activeTab!.id
    act(() => {
      result.current.handleCloseTab(onlyTabId)
    })
    expect(result.current.tabs.length).toBe(1)
    expect(result.current.activeTab?.id).toBe(initialTabId)

    const confirmMock = vi.mocked(window.confirm)
    confirmMock.mockReturnValue(true)
    act(() => {
      result.current.handleCloseTab(onlyTabId)
    })
    expect(result.current.tabs.length).toBe(1)
    expect(setStatusMessage).toHaveBeenCalledWith('Closed tab and started a new draft.')
  })

  it('supports normalize flow and no-op switch guard', () => {
    const persistTabsToSession = vi.fn()
    const setStatusMessage = vi.fn()
    const editorRef = makeEditorRef('# default')

    const { result } = renderHook(() =>
      useTabsManager({
        draftFromSession: null,
        defaultMarkdown: '# default',
        editorRef,
        persistTabsToSession,
        setStatusMessage,
      }),
    )

    const currentId = result.current.activeTab!.id
    act(() => {
      result.current.handleSwitchTab(currentId)
      result.current.applyEditorChange('# default', true)
    })

    expect(result.current.activeTab?.isDirty).toBe(false)
  })
})
