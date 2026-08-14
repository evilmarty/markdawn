import {
  activeEditor$,
  applyBlockType$,
  applyFormat$,
  applyListType$,
  currentBlockType$,
  currentFormat$,
  currentListType$,
  DEFAULT_FORMAT,
  insertCodeBlock$,
  insertTable$,
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_UNDERLINE,
  openLinkEditDialog$,
  openNewImageDialog$,
} from '@mdxeditor/editor'
import { useCellValue, usePublisher } from '@mdxeditor/gurx'
import { REDO_COMMAND, UNDO_COMMAND } from 'lexical'
import {
  Bold,
  Code,
  Ellipsis,
  ImagePlus,
  Italic,
  Link2,
  ListTree,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  SquareCode,
  Table2,
  Undo2,
  Underline,
} from './icons'

function ToolbarActionButton({ title, active = false, onClick, children }) {
  return (
    <button className={`btn btn-xs btn-ghost${active ? ' btn-active' : ''}`} type="button" aria-label={title} title={title} onClick={onClick}>
      {children}
    </button>
  )
}

function FrontmatterToolbarButton({ hasFrontmatter, onClick }) {
  return (
    <button
      className="btn btn-xs btn-ghost"
      type="button"
      aria-label={hasFrontmatter ? 'Edit frontmatter' : 'Insert frontmatter'}
      title={hasFrontmatter ? 'Edit frontmatter' : 'Insert frontmatter'}
      onClick={onClick}
    >
      <ListTree className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}

function UndoRedoButtons() {
  const activeEditor = useCellValue(activeEditor$)

  return (
    <div className="flex items-center gap-1">
      <ToolbarActionButton title="Undo" onClick={() => activeEditor?.dispatchCommand(UNDO_COMMAND, undefined)}>
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
      <ToolbarActionButton title="Redo" onClick={() => activeEditor?.dispatchCommand(REDO_COMMAND, undefined)}>
        <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
    </div>
  )
}

function InlineFormatButtons() {
  const currentFormat = useCellValue(currentFormat$) ?? DEFAULT_FORMAT
  const applyFormat = usePublisher(applyFormat$)

  return (
    <div className="flex items-center gap-1">
      <ToolbarActionButton title="Bold" active={(currentFormat & IS_BOLD) !== 0} onClick={() => applyFormat('bold')}>
        <Bold className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
      <ToolbarActionButton title="Italic" active={(currentFormat & IS_ITALIC) !== 0} onClick={() => applyFormat('italic')}>
        <Italic className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
      <ToolbarActionButton title="Underline" active={(currentFormat & IS_UNDERLINE) !== 0} onClick={() => applyFormat('underline')}>
        <Underline className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
      <ToolbarActionButton title="Inline code" active={(currentFormat & IS_CODE) !== 0} onClick={() => applyFormat('code')}>
        <Code className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
    </div>
  )
}

function InsertButtons() {
  const openLinkEditDialog = usePublisher(openLinkEditDialog$)
  const openNewImageDialog = usePublisher(openNewImageDialog$)
  const insertTable = usePublisher(insertTable$)
  const insertCodeBlock = usePublisher(insertCodeBlock$)

  return (
    <>
      <ToolbarActionButton title="Insert link" onClick={() => openLinkEditDialog()}>
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
      <ToolbarActionButton title="Insert image" onClick={() => openNewImageDialog()}>
        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
      <ToolbarActionButton title="Insert table" onClick={() => insertTable({ rows: 3, columns: 3 })}>
        <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
      <ToolbarActionButton title="Insert code block" onClick={() => insertCodeBlock({ language: 'txt' })}>
        <SquareCode className="h-3.5 w-3.5" aria-hidden="true" />
      </ToolbarActionButton>
    </>
  )
}

function BlockTypeWithListsSelect() {
  const currentBlockType = useCellValue(currentBlockType$)
  const currentListType = useCellValue(currentListType$)
  const applyBlockType = usePublisher(applyBlockType$)
  const applyListType = usePublisher(applyListType$)

  const selectedValue =
    currentListType === 'bullet' || currentListType === 'number'
      ? `list-${currentListType}`
      : currentBlockType === 'quote' ||
          currentBlockType === 'paragraph' ||
          currentBlockType === 'h1' ||
          currentBlockType === 'h2' ||
          currentBlockType === 'h3' ||
          currentBlockType === 'h4' ||
          currentBlockType === 'h5' ||
          currentBlockType === 'h6'
        ? currentBlockType
        : 'paragraph'

  return (
    <select
      className="select select-bordered select-xs min-w-36"
      aria-label="Block type"
      value={selectedValue}
      onChange={(event) => {
        const nextValue = event.target.value
        if (nextValue === 'list-bullet') {
          applyListType('bullet')
          return
        }
        if (nextValue === 'list-number') {
          applyListType('number')
          return
        }
        applyListType('')
        applyBlockType(nextValue)
      }}
    >
      <option value="paragraph">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="h5">Heading 5</option>
      <option value="h6">Heading 6</option>
      <option value="quote">Quote</option>
      <option value="list-bullet">Bulleted list</option>
      <option value="list-number">Numbered list</option>
    </select>
  )
}

function EditorToolbar({
  hasFrontmatter,
  mobileSidebarOpen,
  desktopSidebarOpen,
  onSaveFile,
  onToggleMobileSidebar,
  onToggleDesktopSidebar,
  onOpenFrontmatterDialog,
  saveButtonClass,
  supportsSaveFilePicker,
}) {
  return (
    <>
      <button
        className="btn btn-xs btn-ghost lg:hidden"
        type="button"
        aria-label={mobileSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        onClick={onToggleMobileSidebar}
      >
        <Menu className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        className="btn btn-xs btn-ghost hidden lg:inline-flex"
        type="button"
        aria-label={desktopSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        onClick={onToggleDesktopSidebar}
      >
        {desktopSidebarOpen ? (
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      <UndoRedoButtons />
      <InlineFormatButtons />
      <div className="dropdown dropdown-end lg:hidden">
        <button className="btn btn-xs btn-square" type="button" tabIndex={0} aria-label="More actions">
          <Ellipsis className="h-4 w-4" aria-hidden="true" />
        </button>
        <div
          tabIndex={0}
          className="dropdown-content menu z-50 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow"
        >
          <div className="flex flex-wrap gap-1">
            <BlockTypeWithListsSelect />
            <InsertButtons />
            <FrontmatterToolbarButton hasFrontmatter={hasFrontmatter} onClick={onOpenFrontmatterDialog} />
            {supportsSaveFilePicker && (
              <button className="btn btn-xs" type="button" onClick={() => void onSaveFile({ saveAs: true })}>
                Save As
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="hidden items-center gap-1 lg:flex">
        <BlockTypeWithListsSelect />
        <InsertButtons />
        <FrontmatterToolbarButton hasFrontmatter={hasFrontmatter} onClick={onOpenFrontmatterDialog} />
      </div>
      <div className="grow" />
      {supportsSaveFilePicker && (
        <button className="btn btn-xs hidden lg:inline-flex" type="button" onClick={() => void onSaveFile({ saveAs: true })}>
          Save As
        </button>
      )}
      <button className={`${saveButtonClass} mr-2`} type="button" onClick={() => void onSaveFile()}>
        Save
      </button>
    </>
  )
}

export default EditorToolbar
