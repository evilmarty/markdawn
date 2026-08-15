import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AppTab, EditorHandle } from '../types/app'
import { useFrontmatterWorkflow } from './useFrontmatterWorkflow'

function createTab(overrides: Partial<AppTab> = {}): AppTab {
  return {
    id: 't1',
    fileName: 'note.md',
    markdown: '# body',
    fileHandle: null,
    savedMarkdown: '# body',
    isDirty: false,
    ...overrides,
  }
}

function createEditorRef(markdown = '# body'): { current: EditorHandle } {
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

describe('useFrontmatterWorkflow', () => {
  it('opens dialog and blocks invalid yaml save', () => {
    const setTabs = vi.fn()
    const persistTabsToSession = vi.fn()
    const setStatusMessage = vi.fn()

    const { result } = renderHook(() =>
      useFrontmatterWorkflow({
        activeTab: createTab(),
        currentActiveTabId: 't1',
        editorRef: createEditorRef('---\ntitle: x\n---\n\n# body'),
        persistTabsToSession,
        setStatusMessage,
        setTabs,
      }),
    )

    act(() => {
      result.current.handleOpenFrontmatterDialog()
    })
    act(() => {
      result.current.setFrontmatterRows([{ id: '1', key: 'tags', value: '[' }])
    })
    act(() => {
      result.current.handleSaveFrontmatter()
    })

    expect(result.current.frontmatterValidation.message).toBe('Fix invalid YAML values before saving front matter.')
    expect(persistTabsToSession).not.toHaveBeenCalled()
  })

  it('saves valid frontmatter and clears dialog state', () => {
    const setTabs = vi.fn((updater) => updater([createTab()]))
    const persistTabsToSession = vi.fn()
    const setStatusMessage = vi.fn()
    const editorRef = createEditorRef('# body')

    const { result } = renderHook(() =>
      useFrontmatterWorkflow({
        activeTab: createTab(),
        currentActiveTabId: 't1',
        editorRef,
        persistTabsToSession,
        setStatusMessage,
        setTabs,
      }),
    )

    act(() => {
      result.current.setFrontmatterRows([{ id: '1', key: 'title', value: 'Demo' }])
      result.current.handleSaveFrontmatter()
    })

    expect(editorRef.current.setMarkdown).toHaveBeenCalled()
    expect(setStatusMessage).toHaveBeenCalledWith('Updated front matter.')
    expect(result.current.frontmatterDialogOpen).toBe(false)
  })
})
