import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { downloadTextFile, fileToDataUrl, loadDraftFromSession, makeTab } from './App'

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
  }) => {
    const [value, setValue] = useState(activeTab.markdown)

    useEffect(() => {
      setValue(activeTab.markdown)
    }, [activeTab.markdown])

    useImperativeHandle(editorRef, () => ({
      getMarkdown: () => value,
      setMarkdown: (next) => setValue(next),
      insertMarkdown: (next) => setValue((prev) => prev + next),
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
  const makeButton = (label) => function Button() {
    return <button type="button">{label}</button>
  }

  const toolbarPlugin = (params) => ({ __kind: 'toolbar', ...params })
  const plugin = (name) => () => ({ __kind: name })
  const imagePlugin = (params) => ({ __kind: 'image', ...params })
  const signal = Symbol('signal')
  const ButtonWithTooltip = ({ children, ...props }) => (
    <button type="button" {...props}>
      {children}
    </button>
  )

  const MDXEditor = forwardRef(function MockMDXEditor({ markdown, onChange, plugins }, ref) {
    const [value, setValue] = useState(markdown)

    useEffect(() => {
      setValue(markdown)
    }, [markdown])

    useImperativeHandle(ref, () => ({
      getMarkdown: () => value,
      setMarkdown: (next) => setValue(next),
      insertMarkdown: (next) => setValue((prev) => prev + next),
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
    ButtonWithTooltip,
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
    imageDialogState$: signal,
    linkDialogState$: signal,
    closeImageDialog$: signal,
    saveImage$: signal,
    openEditImageDialog$: signal,
    updateLink$: signal,
    cancelLinkEdit$: signal,
    showLinkTitleField$: signal,
    UndoRedo: makeButton('UndoRedo'),
    BoldItalicUnderlineToggles: makeButton('BoldItalicUnderlineToggles'),
    CodeToggle: makeButton('CodeToggle'),
    BlockTypeSelect: makeButton('BlockTypeSelect'),
    ListsToggle: makeButton('ListsToggle'),
    CreateLink: makeButton('CreateLink'),
    InsertImage: makeButton('InsertImage'),
    InsertTable: makeButton('InsertTable'),
    InsertCodeBlock: makeButton('InsertCodeBlock'),
    InsertFrontmatter: makeButton('InsertFrontmatter'),
    useLexicalNodeRemove: () => vi.fn(),
  }
})

function mockSavePicker(name = 'saved.md') {
  const write = vi.fn(async () => {})
  const close = vi.fn(async () => {})
  const createWritable = vi.fn(async () => ({ write, close }))
  const handle = { name, createWritable }
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: vi.fn(async () => handle),
  })
  return { handle, createWritable, write, close }
}

function mockOpenPicker(files) {
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
  const firstButton = (name) => screen.getAllByRole('button', { name })[0]

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
    expect(saveButton).toHaveClass('btn-outline')

    await user.click(firstButton('Mock Edit'))
    expect(saveButton).not.toHaveClass('btn-outline')

    await user.click(saveButton)
    expect(saveButton).toHaveClass('btn-outline')
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
      'markymark.session.v2',
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
    expect(firstButton('Save')).toHaveClass('btn-outline')
  })

  it('opens sidebar overlay from hamburger on small layout controls', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByLabelText('Show sidebar')[0])
    expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Close sidebar'))
    expect(screen.queryByLabelText('Close sidebar')).not.toBeInTheDocument()
  })

  it('loads stored session and keeps clean tab as non-dirty after normalize callback', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(
      'markymark.session.v2',
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
    expect(saveButton).toHaveClass('btn-outline')
    await user.click(firstButton('Mock Normalize'))
    expect(saveButton).toHaveClass('btn-outline')
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

    const hiddenFileInput = document.querySelector('input[type="file"]')
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
      'markymark.session.v2',
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
    const click = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName === 'a') {
        return { click, set href(_) {}, set download(_) {} }
      }
      return realCreateElement(tagName, options)
    })

    render(<App />)
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
    const hiddenFileInput = document.querySelector('input[type="file"]')
    fireEvent.change(hiddenFileInput, { target: { files: [] } })
    expect(screen.getAllByRole('button', { name: 'untitled.md' })[0]).toBeInTheDocument()
  })

  it('persists selected theme into session storage', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dracula')
    expect(sessionStorage.getItem('markymark.theme')).toBe('dracula')
  })

  it('flushes pending autosave on pagehide before debounce timer', async () => {
    render(<App />)

    fireEvent.click(firstButton('Mock Edit'))
    expect(firstButton('Save')).not.toHaveClass('btn-outline')
    const draftBeforePagehide = sessionStorage.getItem('markymark.session.v2')
    expect(draftBeforePagehide).toBeNull()

    window.dispatchEvent(new Event('pagehide'))
    const draftAfterPagehide = sessionStorage.getItem('markymark.session.v2')
    expect(draftAfterPagehide).toContain('edit')
  })

  it('writes autosave after debounce window without explicit flush', async () => {
    render(<App />)
    fireEvent.click(firstButton('Mock Edit'))
    expect(firstButton('Save')).not.toHaveClass('btn-outline')
    expect(sessionStorage.getItem('markymark.session.v2')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(sessionStorage.getItem('markymark.session.v2')).toContain('edit')
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
    expect(firstButton('Save')).not.toHaveClass('btn-outline')
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

  it('loads and migrates session drafts', () => {
    expect(loadDraftFromSession()).toBeNull()

    sessionStorage.setItem('markymark.session.v2', '{bad json')
    expect(loadDraftFromSession()).toBeNull()

    sessionStorage.removeItem('markymark.session.v2')
    sessionStorage.setItem(
      'markymark.session.v1',
      JSON.stringify({
        fileName: 'legacy.md',
        markdown: '# legacy',
      }),
    )
    const migrated = loadDraftFromSession()
    expect(migrated.tabs).toHaveLength(1)
    expect(migrated.tabs[0].fileName).toBe('legacy.md')
  })

  it('converts files to data url and handles failures', async () => {
    const RealFileReader = global.FileReader

    class SuccessfulReader {
      readAsDataURL() {
        this.result = 'data:text/plain;base64,Zm9v'
        this.onload()
      }
    }

    global.FileReader = SuccessfulReader
    await expect(fileToDataUrl(new File(['foo'], 'foo.txt'))).resolves.toBe('data:text/plain;base64,Zm9v')

    class FailedReader {
      readAsDataURL() {
        this.onerror()
      }
    }

    global.FileReader = FailedReader
    await expect(fileToDataUrl(new File(['foo'], 'foo.txt'))).rejects.toThrow('Failed to convert image to data URL.')
    global.FileReader = RealFileReader
  })

  it('uses image upload handler through editor plugin wiring', async () => {
    const user = userEvent.setup()
    const RealFileReader = global.FileReader
    class SuccessfulReader {
      readAsDataURL() {
        this.result = 'data:image/png;base64,Zm9v'
        this.onload()
      }
    }
    global.FileReader = SuccessfulReader
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Mock Image Upload' })[0])
    global.FileReader = RealFileReader
  })

  it('downloads markdown files through browser API', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.fn()
    const anchor = { click, set href(_) {}, set download(_) {} }
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    downloadTextFile('# hello', 'hello.md')

    expect(createObjectURL).toHaveBeenCalled()
    expect(createElement).toHaveBeenCalledWith('a')
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
