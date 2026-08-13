import { forwardRef, useImperativeHandle, useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EditorWorkspace from './EditorWorkspace'

vi.mock('@mdxeditor/gurx', () => ({
  useCellValue: () => ({
    type: 'inactive',
    valueOf: () => 0,
  }),
  usePublisher: () => vi.fn(),
}))

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [{ update: (cb) => cb() }],
}))

vi.mock('lexical', () => ({
  $getNodeByKey: () => ({ remove: vi.fn() }),
  UNDO_COMMAND: Symbol('UNDO_COMMAND'),
  REDO_COMMAND: Symbol('REDO_COMMAND'),
}))

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
    const toolbar = plugins?.find((entry) => entry?.__kind === 'toolbar')

    useImperativeHandle(ref, () => ({
      getMarkdown: () => value,
      setMarkdown: (next) => setValue(next),
    }))

    return (
      <div>
        <div data-testid="mock-toolbar">{toolbar?.toolbarContents?.()}</div>
        <button
          type="button"
          onClick={() => {
            setValue(`${value}\nchange`)
            onChange?.(`${value}\nchange`, false)
          }}
        >
          Trigger Change
        </button>
      </div>
    )
  })

  return {
    MDXEditor,
    ButtonWithTooltip,
    lexicalTheme: {
      text: {
        code: 'mock-inline-code',
      },
    },
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
    activeEditor$: signal,
    applyFormat$: signal,
    currentBlockType$: signal,
    currentFormat$: signal,
    currentListType$: signal,
    DEFAULT_FORMAT: 0,
    IS_BOLD: 1,
    IS_ITALIC: 2,
    IS_UNDERLINE: 8,
    IS_CODE: 16,
    insertCodeBlock$: signal,
    insertTable$: signal,
    openLinkEditDialog$: signal,
    openNewImageDialog$: signal,
    applyBlockType$: signal,
    applyListType$: signal,
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
  }
})

function renderWorkspace(overrides = {}) {
  const props = {
    activeTab: { id: 'tab-1', markdown: '# test' },
    editorRef: { current: null },
    hasFrontmatter: false,
    mobileSidebarOpen: false,
    desktopSidebarOpen: true,
    onChange: vi.fn(),
    onSaveFile: vi.fn(),
    onToggleMobileSidebar: vi.fn(),
    onToggleDesktopSidebar: vi.fn(),
    onOpenFrontmatterDialog: vi.fn(),
    saveButtonClass: 'btn btn-xs btn-primary btn-soft',
    supportsSaveFilePicker: true,
    imageUploadHandler: vi.fn(async () => 'data:image/png;base64,Zm9v'),
    ...overrides,
  }
  render(<EditorWorkspace {...props} />)
  return props
}

describe('EditorWorkspace', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders save controls and triggers save callbacks', async () => {
    const user = userEvent.setup()
    const props = renderWorkspace()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.onSaveFile).toHaveBeenCalledWith()

    await user.click(screen.getAllByRole('button', { name: 'Save As' })[0])
    expect(props.onSaveFile).toHaveBeenCalledWith({ saveAs: true })
  })

  it('omits save as controls when save picker is unavailable', () => {
    renderWorkspace({ supportsSaveFilePicker: false })
    expect(screen.queryByRole('button', { name: 'Save As' })).not.toBeInTheDocument()
  })

  it('toggles mobile sidebar and frontmatter actions from toolbar', async () => {
    const user = userEvent.setup()
    const props = renderWorkspace({ hasFrontmatter: true, mobileSidebarOpen: true })

    await user.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(props.onToggleMobileSidebar).toHaveBeenCalledOnce()

    await user.click(screen.getAllByTitle('Edit frontmatter')[0])
    expect(props.onOpenFrontmatterDialog).toHaveBeenCalledOnce()
  })

  it('passes editor onChange through to parent callback', async () => {
    const user = userEvent.setup()
    const props = renderWorkspace()

    await user.click(screen.getByRole('button', { name: 'Trigger Change' }))
    expect(props.onChange).toHaveBeenCalledWith('# test\nchange', false)
  })

  it('returns null when there is no active tab', () => {
    renderWorkspace({ activeTab: null })
    expect(screen.queryByTestId('mock-toolbar')).not.toBeInTheDocument()
  })
})
