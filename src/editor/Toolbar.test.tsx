import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorToolbar from './Toolbar'

const mocks = vi.hoisted(() => ({
  signals: {
    activeEditor$: Symbol('activeEditor'),
    applyBlockType$: Symbol('applyBlockType'),
    applyFormat$: Symbol('applyFormat'),
    applyListType$: Symbol('applyListType'),
    currentBlockType$: Symbol('currentBlockType'),
    currentFormat$: Symbol('currentFormat'),
    currentListType$: Symbol('currentListType'),
    DEFAULT_FORMAT: 0,
    insertCodeBlock$: Symbol('insertCodeBlock'),
    insertTable$: Symbol('insertTable'),
    IS_BOLD: 1,
    IS_CODE: 8,
    IS_ITALIC: 2,
    IS_UNDERLINE: 4,
    openLinkEditDialog$: Symbol('openLinkEditDialog'),
    openNewImageDialog$: Symbol('openNewImageDialog'),
  },
  UNDO_COMMAND: Symbol('undo'),
  REDO_COMMAND: Symbol('redo'),
  callMap: new Map<symbol, ReturnType<typeof vi.fn>>(),
  cellValues: new Map<symbol, unknown>(),
}))

vi.mock('@mdxeditor/editor', () => mocks.signals)
vi.mock('@mdxeditor/gurx', () => ({
  useCellValue: (signal: symbol) => mocks.cellValues.get(signal),
  usePublisher: (signal: symbol) => {
    if (!mocks.callMap.has(signal)) mocks.callMap.set(signal, vi.fn())
    return mocks.callMap.get(signal)
  },
}))
vi.mock('lexical', () => ({ UNDO_COMMAND: mocks.UNDO_COMMAND, REDO_COMMAND: mocks.REDO_COMMAND }))
vi.mock('./icons', () => ({
  Bold: () => null,
  Code: () => null,
  Ellipsis: () => null,
  ImagePlus: () => null,
  Italic: () => null,
  Link2: () => null,
  ListTree: () => null,
  Menu: () => null,
  PanelLeftClose: () => null,
  PanelLeftOpen: () => null,
  Redo2: () => null,
  SquareCode: () => null,
  Table2: () => null,
  Undo2: () => null,
  Underline: () => null,
}))

function resetMocks() {
  mocks.callMap.clear()
  mocks.cellValues = new Map<symbol, unknown>([
    [mocks.signals.currentFormat$, mocks.signals.IS_BOLD | mocks.signals.IS_ITALIC | mocks.signals.IS_UNDERLINE | mocks.signals.IS_CODE],
    [mocks.signals.currentListType$, ''],
    [mocks.signals.currentBlockType$, 'paragraph'],
    [mocks.signals.activeEditor$, { dispatchCommand: vi.fn() }],
  ])
}

function renderToolbar(overrides: Partial<Parameters<typeof EditorToolbar>[0]> = {}) {
  const props = {
    hasFrontmatter: true,
    mobileSidebarOpen: true,
    desktopSidebarOpen: true,
    onSaveFile: vi.fn(async () => {}),
    onToggleMobileSidebar: vi.fn(),
    onToggleDesktopSidebar: vi.fn(),
    onOpenFrontmatterDialog: vi.fn(),
    saveButtonClass: 'btn btn-xs btn-primary',
    supportsSaveFilePicker: true,
    ...overrides,
  }
  render(<EditorToolbar {...props} />)
  return props
}

describe('EditorToolbar', () => {
  beforeEach(() => {
    resetMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('triggers toolbar actions and save buttons', async () => {
    const user = userEvent.setup()
    const props = renderToolbar()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    const dispatchCommand = (mocks.cellValues.get(mocks.signals.activeEditor$) as { dispatchCommand: ReturnType<typeof vi.fn> }).dispatchCommand
    expect(dispatchCommand).toHaveBeenCalledWith(mocks.UNDO_COMMAND, undefined)
    expect(dispatchCommand).toHaveBeenCalledWith(mocks.REDO_COMMAND, undefined)

    await user.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(props.onToggleMobileSidebar).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(props.onToggleDesktopSidebar).toHaveBeenCalled()

    await user.click(screen.getAllByRole('button', { name: 'Save As' })[0])
    expect(props.onSaveFile).toHaveBeenCalledWith({ saveAs: true })

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.onSaveFile).toHaveBeenCalledWith()
  })

  it('applies formatting, insertion, and block/list changes', async () => {
    const user = userEvent.setup()
    const props = renderToolbar()

    await user.click(screen.getByRole('button', { name: 'Bold' }))
    await user.click(screen.getByRole('button', { name: 'Italic' }))
    await user.click(screen.getByRole('button', { name: 'Underline' }))
    await user.click(screen.getByRole('button', { name: 'Inline code' }))
    expect(mocks.callMap.get(mocks.signals.applyFormat$)).toHaveBeenCalledTimes(4)

    await user.click(screen.getAllByRole('button', { name: 'Insert link' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Insert image' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Insert table' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Insert code block' })[0])
    expect(mocks.callMap.get(mocks.signals.openLinkEditDialog$)).toHaveBeenCalled()
    expect(mocks.callMap.get(mocks.signals.openNewImageDialog$)).toHaveBeenCalled()
    expect(mocks.callMap.get(mocks.signals.insertTable$)).toHaveBeenCalledWith({ rows: 3, columns: 3 })
    expect(mocks.callMap.get(mocks.signals.insertCodeBlock$)).toHaveBeenCalledWith({ language: 'txt' })

    const select = screen.getAllByRole('combobox', { name: 'Block type' })[0]
    fireEvent.change(select, { target: { value: 'list-bullet' } })
    fireEvent.change(select, { target: { value: 'list-number' } })
    fireEvent.change(select, { target: { value: 'h2' } })
    expect(mocks.callMap.get(mocks.signals.applyListType$)).toHaveBeenCalledWith('bullet')
    expect(mocks.callMap.get(mocks.signals.applyListType$)).toHaveBeenCalledWith('number')
    expect(mocks.callMap.get(mocks.signals.applyBlockType$)).toHaveBeenCalledWith('h2')

    await user.click(screen.getAllByRole('button', { name: 'Edit frontmatter' })[0])
    expect(props.onOpenFrontmatterDialog).toHaveBeenCalled()
  })

  it('omits save as when picker is unsupported', () => {
    renderToolbar({ supportsSaveFilePicker: false, hasFrontmatter: false, mobileSidebarOpen: false, desktopSidebarOpen: false })
    expect(screen.queryByRole('button', { name: 'Save As' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Insert frontmatter' }).length).toBeGreaterThan(0)
  })
})
