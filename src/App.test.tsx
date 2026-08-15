import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import packageJson from '../package.json'
import App from './App'
import { downloadTextFile, fileToDataUrl, loadDraftFromSession, makeTab } from './lib/utils'
import type { SaveFileOptions } from './types/app'

const APP_NAME = packageJson.name

type MockEditorWorkspaceProps = {
  activeTab: { markdown: string }
  editorRef: MutableRefObject<unknown>
  mobileSidebarOpen: boolean
  onChange?: (nextMarkdown: string, initialMarkdownNormalize: boolean) => void
  onOpenFrontmatterDialog: () => void
  onSaveFile: (options?: SaveFileOptions) => Promise<void>
  onToggleMobileSidebar: () => void
  saveButtonClass: string
  supportsSaveFilePicker: boolean
  imageUploadHandler?: (file: File) => Promise<string>
}

type MockEditorPlugin = {
  __kind?: string
  toolbarContents?: () => ReactNode
  imageUploadHandler?: (file: File) => Promise<string>
}

type MockMdxEditorProps = {
  markdown: string
  onChange?: (nextMarkdown: string, initialMarkdownNormalize: boolean) => void
  plugins?: MockEditorPlugin[]
}

vi.mock('./EditorWorkspace', () => {
  const MockEditorWorkspace = ({
    activeTab,
    editorRef,
    mobileSidebarOpen,
    onChange,
    onOpenFrontmatterDialog,
    onSaveFile,
    onToggleMobileSidebar,
    saveButtonClass,
    supportsSaveFilePicker,
    imageUploadHandler,
  }: MockEditorWorkspaceProps) => {
    const [value, setValue] = useState(activeTab.markdown)

    useEffect(() => {
      setValue(activeTab.markdown)
    }, [activeTab.markdown])

    useImperativeHandle(editorRef, () => ({
      getMarkdown: () => value,
      setMarkdown: (next: string) => setValue(next),
      insertMarkdown: (next: string) => setValue((prev) => prev + next),
      focus: () => {},
      getContentEditableHTML: () => value,
      getSelectionMarkdown: () => value,
    }))

    return (
      <div>
        <button
          type="button"
          aria-label={mobileSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          onClick={onToggleMobileSidebar}
        >
          Toggle Sidebar
        </button>
        <button type="button" onClick={onOpenFrontmatterDialog}>
          Open Frontmatter
        </button>
        {supportsSaveFilePicker && (
          <button type="button" onClick={() => void onSaveFile({ saveAs: true })}>
            Save As
          </button>
        )}
        <button className={saveButtonClass} type="button" onClick={() => void onSaveFile()}>
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            const next = `${value}\nedit`
            setValue(next)
            onChange?.(next, false)
          }}
        >
          Mock Edit
        </button>
        <button
          type="button"
          onClick={() => {
            const next = value.trim()
            setValue(next)
            onChange?.(next, true)
          }}
        >
          Mock Normalize
        </button>
        <button
          type="button"
          onClick={async () => {
            await imageUploadHandler?.(new File(['img'], 'img.png', { type: 'image/png' }))
          }}
        >
          Mock Image Upload
        </button>
      </div>
    )
  }

  return { default: MockEditorWorkspace }
})

vi.mock('@mdxeditor/editor', async () => {
  const toolbarPlugin = (params: Record<string, unknown>) => ({ __kind: 'toolbar', ...params })
  const plugin = (name: string) => () => ({ __kind: name })
  const imagePlugin = (params: Record<string, unknown>) => ({ __kind: 'image', ...params })
  const signal = Symbol('signal')

  const MDXEditor = forwardRef(function MockMDXEditor({ markdown, onChange, plugins }: MockMdxEditorProps, ref) {
    const [value, setValue] = useState(markdown)

    useEffect(() => {
      setValue(markdown)
    }, [markdown])

    useImperativeHandle(ref, () => ({
      getMarkdown: () => value,
      setMarkdown: (next: string) => setValue(next),
      insertMarkdown: (next: string) => setValue((prev) => prev + next),
      focus: () => {},
      getContentEditableHTML: () => value,
      getSelectionMarkdown: () => value,
    }))

    const toolbar = plugins?.find((entry) => entry?.__kind === 'toolbar')
    const image = plugins?.find((entry) => entry?.__kind === 'image')

    return (
      <div>
        <div data-testid="mock-toolbar">{toolbar?.toolbarContents?.()}</div>
        <div data-testid="mock-editor-value">{value}</div>
        <button
          type="button"
          onClick={() => {
            const next = `${value}\nedit`
            setValue(next)
            onChange?.(next, false)
          }}
        >
          Mock Edit
        </button>
        <button
          type="button"
          onClick={() => {
            const next = value.trim()
            setValue(next)
            onChange?.(next, true)
          }}
        >
          Mock Normalize
        </button>
        <button
          type="button"
          onClick={async () => {
            await image?.imageUploadHandler?.(new File(['img'], 'img.png', { type: 'image/png' }))
          }}
        >
          Mock Image Upload
        </button>
      </div>
    )
  })

  return {
    MDXEditor,
    toolbarPlugin,
    headingsPlugin: plugin('headings'),
    frontmatterPlugin: plugin('frontmatter'),
    listsPlugin: plugin('lists'),
    quotePlugin: plugin('quote'),
    thematicBreakPlugin: plugin('thematicBreak'),
    linkPlugin: plugin('link'),
    linkDialogPlugin: plugin('linkDialog'),
    tablePlugin: plugin('table'),
    codeBlockPlugin: plugin('codeBlock'),
    codeMirrorPlugin: plugin('codeMirror'),
    markdownShortcutPlugin: plugin('markdownShortcut'),
    imagePlugin,
    currentBlockType$: signal,
    currentListType$: signal,
    convertSelectionToNode$: signal,
    applyListType$: signal,
    imageDialogState$: signal,
    linkDialogState$: signal,
    closeImageDialog$: signal,
    saveImage$: signal,
    openEditImageDialog$: signal,
    updateLink$: signal,
    cancelLinkEdit$: signal,
    showLinkTitleField$: signal,
  }
})

function mockSavePicker(name = 'saved.md') {
  const write = vi.fn(async () => {})
  const close = vi.fn(async () => {})
  const createWritable = vi.fn(async () => ({ write, close }))
  const handle = { name, createWritable } as unknown as FileSystemFileHandle
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: vi.fn(async () => handle),
  })
  return { handle, createWritable, write, close }
}

function mockOpenPicker(files: { name: string; content: string }[]) {
  const handles = files.map((file) => ({
    name: file.name,
    getFile: async () => ({
      name: file.name,
      text: async () => file.content,
    }),
  }))
  Object.defineProperty(window, 'showOpenFilePicker', {
    configurable: true,
    value: vi.fn(async () => handles),
  })
}

describe('App', () => {
  const firstButton = (name: string): HTMLButtonElement => screen.getAllByRole('button', { name })[0] as HTMLButtonElement

  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    delete window.showSaveFilePicker
    delete window.showOpenFilePicker
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('starts with clean save state and turns dirty only after edits', async () => {
    const user = userEvent.setup()
    mockSavePicker()
    render(<App />)

    const saveButton = await screen.findByRole('button', { name: 'Save' })
    expect(saveButton).toHaveClass('btn-soft')

    await user.click(firstButton('Mock Edit'))
    expect(saveButton).not.toHaveClass('btn-soft')

    await user.click(saveButton)
    expect(saveButton).toHaveClass('btn-soft')
  })

  it('does not confirm when closing a fresh new tab', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(firstButton('New'))
    const closeButtons = screen.getAllByLabelText('Close untitled.md')
    await user.click(closeButtons[closeButtons.length - 1])

    expect(window.confirm).not.toHaveBeenCalled()
  })

  it('confirms when closing an unsaved active tab', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App />)

    await user.click(firstButton('Mock Edit'))
    await user.click(screen.getAllByLabelText('Close untitled.md')[0])

    expect(confirmSpy).toHaveBeenCalledOnce()
  })

  it('shows dirty indicator on non-active tabs', async () => {
    sessionStorage.setItem(
      'markdawn.session.v1',
      JSON.stringify({
        tabs: [
          { id: 'a', fileName: 'active.md', markdown: '# active', savedMarkdown: '# active', isDirty: false },
          { id: 'b', fileName: 'dirty.md', markdown: '# changed', savedMarkdown: '# original', isDirty: true },
        ],
        activeTabId: 'a',
      }),
    )
    render(<App />)

    expect(document.querySelectorAll('.status-warning')).toHaveLength(1)
  })

  it('saves through file picker and renames active tab', async () => {
    const user = userEvent.setup()
    const { write, close } = mockSavePicker('renamed.md')
    render(<App />)

    await user.click(firstButton('Mock Edit'))
    await user.click(firstButton('Save'))

    expect(write).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'renamed.md' })[0]).toBeInTheDocument()
    expect(firstButton('Save')).toHaveClass('btn-soft')
  })

  it('opens sidebar overlay from hamburger on small layout controls', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByLabelText('Show sidebar')[0])
    expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Close sidebar'))
    expect(screen.queryByLabelText('Close sidebar')).not.toBeInTheDocument()
  })

  it('updates the window title with the active document filename', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(document.title).toBe(`untitled.md · ${APP_NAME}`)

    await user.click(firstButton('Open'))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['# notes'], 'notes.md', { type: 'text/markdown' })
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(document.title).toBe(`notes.md · ${APP_NAME}`)
    })
  })

  it('loads stored session and keeps clean tab as non-dirty after normalize callback', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(
      'markdawn.session.v1',
      JSON.stringify({
        tabs: [
          {
            id: 't1',
            fileName: 'saved.md',
            markdown: '# title',
            savedMarkdown: '# title',
            isDirty: false,
          },
        ],
        activeTabId: 't1',
      }),
    )
    render(<App />)

    const saveButton = firstButton('Save')
    expect(saveButton).toHaveClass('btn-soft')
    await user.click(firstButton('Mock Normalize'))
    expect(saveButton).toHaveClass('btn-soft')
  })

  it('handles file picker save-as and open file error paths', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn(async () => {
        throw Object.assign(new Error('save failed'), { name: 'NotAllowedError' })
      }),
    })
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: vi.fn(async () => {
        throw Object.assign(new Error('open failed'), { name: 'NotAllowedError' })
      }),
    })

    render(<App />)
    await user.click(firstButton('Save As'))
    await user.click(firstButton('Open'))
    await waitFor(() => {
      expect(window.showSaveFilePicker).toHaveBeenCalled()
      expect(window.showOpenFilePicker).toHaveBeenCalled()
    })
  })

  it('uses fallback file input open path when picker is unavailable', async () => {
    const user = userEvent.setup()
    render(<App />)

    const hiddenFileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(hiddenFileInput, 'click')
    await user.click(firstButton('Open'))
    expect(clickSpy).toHaveBeenCalled()

    const file = new File(['# from fallback'], 'fallback.md', { type: 'text/markdown' })
    fireEvent.change(hiddenFileInput, { target: { files: [file] } })
    expect(await screen.findByRole('button', { name: 'fallback.md' })).toBeInTheDocument()
  })

  it('supports close confirmation for non-active dirty tabs', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(
      'markdawn.session.v1',
      JSON.stringify({
        tabs: [
          { id: 'a', fileName: 'active.md', markdown: '# active', savedMarkdown: '# active', isDirty: false },
          { id: 'b', fileName: 'dirty.md', markdown: '# changed', savedMarkdown: '# original', isDirty: true },
        ],
        activeTabId: 'a',
      }),
    )
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App />)
    await user.click(screen.getAllByLabelText('Close dirty.md')[0])
    expect(confirmSpy).toHaveBeenCalledOnce()
  })

  it('opens files through picker success path and tab switching early-return path', async () => {
    const user = userEvent.setup()
    mockOpenPicker([
      { name: 'first.md', content: '# first' },
      { name: 'second.md', content: '# second' },
    ])
    render(<App />)

    await user.click(firstButton('Open'))
    expect(screen.getAllByRole('button', { name: 'first.md' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'second.md' })[0]).toBeInTheDocument()

    // Click active tab again to hit the no-op switch guard.
    await user.click(firstButton('second.md'))
  })

  it('handles fallback save branch without file picker', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:save')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    render(<App />)

    const click = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    const anchor = document.createElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(click)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'a') {
        return anchor
      }
      return realCreateElement(tagName, options)
    })

    await user.click(firstButton('Mock Edit'))
    await user.click(firstButton('Save'))

    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:save')
  })

  it('uses desktop save-as action path', async () => {
    const user = userEvent.setup()
    const { write } = mockSavePicker('desktop.md')
    render(<App />)

    const saveAsButtons = screen.getAllByRole('button', { name: 'Save As' })
    await user.click(saveAsButtons[saveAsButtons.length - 1])
    expect(write).toHaveBeenCalled()
  })

  it('closes the only open tab by resetting to a fresh draft', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByLabelText('Close untitled.md')[0])
    expect(screen.getAllByRole('button', { name: 'untitled.md' }).length).toBeGreaterThanOrEqual(1)
  })

  it('ignores empty fallback file selection', () => {
    render(<App />)
    const hiddenFileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(hiddenFileInput, { target: { files: [] } })
    expect(screen.getAllByRole('button', { name: 'untitled.md' })[0]).toBeInTheDocument()
  })

  it('persists selected theme into session storage', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dracula')
    expect(sessionStorage.getItem('markdawn.theme')).toBe('dracula')
  })

  it('defaults theme to system and keeps data-theme unset', () => {
    render(<App />)
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('system')
    expect(sessionStorage.getItem('markdawn.theme')).toBe('system')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('removes html data-theme when switching to system', async () => {
    const user = userEvent.setup()
    render(<App />)
    const themeSelect = screen.getByRole('combobox', { name: 'Theme' })

    await user.selectOptions(themeSelect, 'dracula')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dracula')

    await user.selectOptions(themeSelect, 'system')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('flushes pending autosave on pagehide before debounce timer', async () => {
    render(<App />)

    fireEvent.click(firstButton('Mock Edit'))
    expect(firstButton('Save')).not.toHaveClass('btn-soft')
    const draftBeforePagehide = sessionStorage.getItem('markdawn.session.v1')
    expect(draftBeforePagehide).toBeNull()

    window.dispatchEvent(new Event('pagehide'))
    const draftAfterPagehide = sessionStorage.getItem('markdawn.session.v1')
    expect(draftAfterPagehide).toContain('edit')
  })

  it('writes autosave after debounce window without explicit flush', async () => {
    render(<App />)
    fireEvent.click(firstButton('Mock Edit'))
    expect(firstButton('Save')).not.toHaveClass('btn-soft')
    expect(sessionStorage.getItem('markdawn.session.v1')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(sessionStorage.getItem('markdawn.session.v1')).toContain('edit')
  })

  it('opens frontmatter dialog and saves frontmatter into the active document', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(firstButton('Open Frontmatter'))
    expect(screen.getByText('Edit front matter')).toBeInTheDocument()

    const inputs = screen.getAllByRole('textbox')
    await user.clear(inputs[0])
    await user.type(inputs[0], 'title')
    await user.clear(inputs[1])
    await user.type(inputs[1], 'Demo')
    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    await user.click(saveButtons[saveButtons.length - 1])

    expect(screen.queryByText('Edit front matter')).not.toBeInTheDocument()
    expect(firstButton('Save')).not.toHaveClass('btn-soft')
  })

  it('blocks frontmatter save when a row contains invalid yaml value', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(firstButton('Open Frontmatter'))
    const inputs = screen.getAllByRole('textbox')
    await user.clear(inputs[0])
    await user.type(inputs[0], 'tags')
    fireEvent.change(inputs[1], { target: { value: '[' } })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    await user.click(saveButtons[saveButtons.length - 1])

    expect(screen.getByRole('alert')).toHaveTextContent('Fix invalid YAML values before saving front matter.')
    expect(screen.getByText('Edit front matter')).toBeInTheDocument()
  })
})

describe('App helpers', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('creates clean and dirty tabs correctly', () => {
    const clean = makeTab({ markdown: '# hi', savedMarkdown: '# hi' })
    const dirty = makeTab({ markdown: '# hi', savedMarkdown: '# bye' })
    expect(clean.isDirty).toBe(false)
    expect(dirty.isDirty).toBe(true)
  })

  it('loads only current session draft format', () => {
    expect(loadDraftFromSession()).toBeNull()

    sessionStorage.setItem('markdawn.session.v1', '{bad json')
    expect(loadDraftFromSession()).toBeNull()

    sessionStorage.setItem(
      'markdawn.session.v1',
      JSON.stringify({
        tabs: [{ id: 't1', fileName: 'saved.md', markdown: '# saved', savedMarkdown: '# saved', isDirty: false }],
        activeTabId: 't1',
      }),
    )
    const loaded = loadDraftFromSession()
    expect(loaded).not.toBeNull()
    expect(loaded!.tabs).toHaveLength(1)
    expect(loaded!.tabs[0].fileName).toBe('saved.md')

    sessionStorage.setItem(
      'markdawn.session.v1',
      JSON.stringify({
        fileName: 'legacy.md',
        markdown: '# legacy',
      }),
    )
    expect(loadDraftFromSession()).toBeNull()
  })

  it('converts files to data url and handles failures', async () => {
    const RealFileReader = globalThis.FileReader

    class SuccessfulReader {
      result: string | ArrayBuffer | null = null
      onload: null | (() => void) = null

      readAsDataURL() {
        this.result = 'data:text/plain;base64,Zm9v'
        this.onload?.()
      }
    }

    globalThis.FileReader = SuccessfulReader as unknown as typeof FileReader
    await expect(fileToDataUrl(new File(['foo'], 'foo.txt'))).resolves.toBe('data:text/plain;base64,Zm9v')

    class FailedReader {
      onerror: null | (() => void) = null

      readAsDataURL() {
        this.onerror?.()
      }
    }

    globalThis.FileReader = FailedReader as unknown as typeof FileReader
    await expect(fileToDataUrl(new File(['foo'], 'foo.txt'))).rejects.toThrow('Failed to convert image to data URL.')
    globalThis.FileReader = RealFileReader
  })

  it('uses image upload handler through editor plugin wiring', async () => {
    const user = userEvent.setup()
    const RealFileReader = globalThis.FileReader
    class SuccessfulReader {
      result: string | ArrayBuffer | null = null
      onload: null | (() => void) = null

      readAsDataURL() {
        this.result = 'data:image/png;base64,Zm9v'
        this.onload?.()
      }
    }
    globalThis.FileReader = SuccessfulReader as unknown as typeof FileReader
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Mock Image Upload' })[0])
    globalThis.FileReader = RealFileReader
  })

  it('downloads markdown files through browser API', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    downloadTextFile('# hello', 'hello.md')

    expect(createObjectURL).toHaveBeenCalled()
    expect(createElement).toHaveBeenCalledWith('a')
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
