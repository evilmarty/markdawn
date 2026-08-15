import { act, renderHook, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorHandle, AppTab } from '../types/app'
import { useFileOperations } from './useFileOperations'

function createTab(overrides: Partial<AppTab> = {}): AppTab {
  return {
    id: 't1',
    fileName: 'note.md',
    markdown: '# note',
    fileHandle: null,
    savedMarkdown: '# note',
    isDirty: false,
    ...overrides,
  }
}

function createEditorRef(markdown = '# content'): { current: EditorHandle } {
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

describe('useFileOperations', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })
  it('uses fallback open input when picker unsupported', async () => {
    const click = vi.fn()
    const fallbackOpenInputRef = { current: { click } as Pick<HTMLInputElement, 'click'> as HTMLInputElement }
    const setTabs = vi.fn()
    const setActiveTabId = vi.fn()
    const setStatusMessage = vi.fn()

    const { result } = renderHook(() =>
      useFileOperations({
        activeTab: createTab(),
        currentActiveTabId: 't1',
        editorRef: createEditorRef(),
        fallbackOpenInputRef,
        persistTabsToSession: vi.fn(),
        setActiveTabId,
        setStatusMessage,
        setTabs,
        supportsOpenFilePicker: false,
        supportsSaveFilePicker: false,
        syncEditorValueIntoActiveTab: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.handleOpenFile()
    })
    expect(click).toHaveBeenCalled()
  })

  it('handles save picker abort and fallback download', async () => {
    const fallbackOpenInputRef = { current: null }
    const persistTabsToSession = vi.fn()
    const setStatusMessage = vi.fn()
    const setActiveTabId = vi.fn()
    const setTabs = vi.fn((updater) => updater([createTab()]))
    const activeTab = createTab({ isDirty: true })

    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn(async () => {
        throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
      }),
    })

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchor = document.createElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(() => {})
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    const { result } = renderHook(() =>
      useFileOperations({
        activeTab,
        currentActiveTabId: 't1',
        editorRef: createEditorRef('# saved'),
        fallbackOpenInputRef,
        persistTabsToSession,
        setActiveTabId,
        setStatusMessage,
        setTabs,
        supportsOpenFilePicker: false,
        supportsSaveFilePicker: true,
        syncEditorValueIntoActiveTab: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.handleSaveFile()
    })
    expect(setStatusMessage).not.toHaveBeenCalledWith(expect.stringContaining('Save failed'))

    const second = renderHook(() =>
      useFileOperations({
        activeTab,
        currentActiveTabId: 't1',
        editorRef: createEditorRef('# saved'),
        fallbackOpenInputRef,
        persistTabsToSession,
        setActiveTabId,
        setStatusMessage,
        setTabs,
        supportsOpenFilePicker: false,
        supportsSaveFilePicker: false,
        syncEditorValueIntoActiveTab: vi.fn(),
      }),
    )
    await act(async () => {
      await second.result.current.handleSaveFile()
    })
    second.unmount()

    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('reports non-abort open and save errors', async () => {
    const fallbackOpenInputRef = { current: null }
    const setStatusMessage = vi.fn()

    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error('picker exploded')
      }),
    })
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error('disk full')
      }),
    })

    const { result } = renderHook(() =>
      useFileOperations({
        activeTab: createTab({ isDirty: true }),
        currentActiveTabId: 't1',
        editorRef: createEditorRef('# note'),
        fallbackOpenInputRef,
        persistTabsToSession: vi.fn(),
        setActiveTabId: vi.fn(),
        setStatusMessage,
        setTabs: vi.fn(),
        supportsOpenFilePicker: true,
        supportsSaveFilePicker: true,
        syncEditorValueIntoActiveTab: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.handleOpenFile()
      await result.current.handleSaveFile()
    })

    expect(setStatusMessage).toHaveBeenCalledWith('Open failed: picker exploded')
    expect(setStatusMessage).toHaveBeenCalledWith('Save failed: disk full')
  })

  it('keeps save picker path as no-op when content already saved', async () => {
    const fallbackOpenInputRef = { current: null }
    const persistTabsToSession = vi.fn()
    const setStatusMessage = vi.fn()
    const write = vi.fn(async () => {})
    const close = vi.fn(async () => {})
    const createWritable = vi.fn(async () => ({ write, close }))
    const handle = { name: 'note.md', createWritable } as unknown as FileSystemFileHandle
    const setTabs = vi.fn((updater) => updater([createTab({ fileHandle: handle })]))

    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn(async () => handle),
    })

    const { result } = renderHook(() =>
      useFileOperations({
        activeTab: createTab({
          fileHandle: handle,
          markdown: '# note',
          savedMarkdown: '# note',
          isDirty: false,
        }),
        currentActiveTabId: 't1',
        editorRef: createEditorRef('# note'),
        fallbackOpenInputRef,
        persistTabsToSession,
        setActiveTabId: vi.fn(),
        setStatusMessage,
        setTabs,
        supportsOpenFilePicker: false,
        supportsSaveFilePicker: true,
        syncEditorValueIntoActiveTab: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.handleSaveFile()
    })

    expect(persistTabsToSession).not.toHaveBeenCalled()
    expect(setStatusMessage).toHaveBeenCalledWith('Saved note.md.')
    expect(write).toHaveBeenCalledWith('# note')
  })
})
