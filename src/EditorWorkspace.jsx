import { useEffect, useMemo, useState } from 'react'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ButtonWithTooltip,
  cancelLinkEdit$,
  closeImageDialog$,
  codeBlockPlugin,
  codeMirrorPlugin,
  CodeToggle,
  CreateLink,
  imageDialogState$,
  linkDialogState$,
  openEditImageDialog$,
  headingsPlugin,
  frontmatterPlugin,
  imagePlugin,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  lexicalTheme as mdxLexicalTheme,
  MDXEditor,
  quotePlugin,
  saveImage$,
  showLinkTitleField$,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
  updateLink$,
} from '@mdxeditor/editor'
import { useCellValue, usePublisher } from '@mdxeditor/gurx'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey } from 'lexical'

const CODE_BLOCK_LANGUAGES = {
  txt: 'Plain text',
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  json: 'JSON',
  py: 'Python',
  bash: 'Bash',
  css: 'CSS',
  html: 'HTML',
  md: 'Markdown',
  yaml: 'YAML',
}

const editorLexicalTheme = {
  ...mdxLexicalTheme,
  quote: 'mdx-quote',
  text: {
    ...mdxLexicalTheme.text,
    code: 'kbd kbd-sm',
  },
  list: {
    ...mdxLexicalTheme.list,
    listitem: 'mdx-listitem',
    listitemChecked: 'mdx-listitem-checked',
    listitemUnchecked: 'mdx-listitem-unchecked',
    nested: {
      ...mdxLexicalTheme.list?.nested,
      listitem: 'mdx-listitem-nested',
    },
  },
  admonition: {
    ...mdxLexicalTheme.admonition,
    note: 'mdx-admonition mdx-admonition-note',
    tip: 'mdx-admonition mdx-admonition-tip',
    info: 'mdx-admonition mdx-admonition-info',
    caution: 'mdx-admonition mdx-admonition-caution',
    danger: 'mdx-admonition mdx-admonition-danger',
  },
}

function normalizeDimension(value) {
  return typeof value === 'number' ? value : ''
}

function parseDimension(value) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function FrontmatterToolbarButton({ hasFrontmatter, onClick }) {
  return (
    <ButtonWithTooltip title={hasFrontmatter ? 'Edit frontmatter' : 'Insert frontmatter'} onClick={onClick}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 8.75V7.25H8.5V8.75H4.5Z" fill="currentColor" />
        <path d="M4.5 14.75V13.25H8.5V14.75H4.5Z" fill="currentColor" />
        <path d="M9.5 8.75V7.25H13.5V8.75H9.5Z" fill="currentColor" />
        <path d="M9.5 14.75V13.25H13.5V14.75H9.5Z" fill="currentColor" />
        <path d="M14.5 8.75V7.25H18.5V8.75H14.5Z" fill="currentColor" />
        <path d="M14.5 14.75V13.25H18.5V14.75H14.5Z" fill="currentColor" />
      </svg>
    </ButtonWithTooltip>
  )
}

function DaisyLinkDialog() {
  const linkDialogState = useCellValue(linkDialogState$)
  const showLinkTitleField = useCellValue(showLinkTitleField$)
  const updateLink = usePublisher(updateLink$)
  const cancelLinkEdit = usePublisher(cancelLinkEdit$)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (linkDialogState.type !== 'edit') return
    setUrl(linkDialogState.url ?? '')
    setText(linkDialogState.text ?? '')
    setTitle(linkDialogState.title ?? '')
  }, [linkDialogState])

  if (linkDialogState.type !== 'edit') return null

  return (
    <div className="modal modal-open z-[70]">
      <form
        className="modal-box w-full max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          updateLink({
            url: url.trim() || undefined,
            text: linkDialogState.withAnchorText ? text.trim() || undefined : undefined,
            title: showLinkTitleField ? title.trim() || undefined : undefined,
          })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelLinkEdit()
          }
        }}
      >
        <h3 className="mb-3 text-lg font-semibold">Edit link</h3>

        <div className="grid gap-3">
          <label className="form-control">
            <span className="label-text mb-1 text-sm">URL</span>
            <input
              className="input input-bordered w-full"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              autoFocus
            />
          </label>

          {linkDialogState.withAnchorText && (
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Anchor text</span>
              <input
                className="input input-bordered w-full"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </label>
          )}

          {showLinkTitleField && (
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Link title</span>
              <input
                className="input input-bordered w-full"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          )}
        </div>

        <div className="modal-action mt-4">
          <button className="btn" type="button" onClick={() => cancelLinkEdit()}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>
      <button className="modal-backdrop" type="button" onClick={() => cancelLinkEdit()}>
        Close
      </button>
    </div>
  )
}

function DaisyImageDialog() {
  const imageDialogState = useCellValue(imageDialogState$)
  const closeImageDialog = usePublisher(closeImageDialog$)
  const saveImage = usePublisher(saveImage$)
  const isOpen = imageDialogState.type !== 'inactive'

  const [src, setSrc] = useState('')
  const [altText, setAltText] = useState('')
  const [title, setTitle] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [fileList, setFileList] = useState(null)

  useEffect(() => {
    if (imageDialogState.type === 'editing') {
      const initial = imageDialogState.initialValues
      setSrc(initial.src ?? '')
      setAltText(initial.altText ?? '')
      setTitle(initial.title ?? '')
      setWidth(String(normalizeDimension(initial.width)))
      setHeight(String(normalizeDimension(initial.height)))
      setFileList(null)
      return
    }

    if (imageDialogState.type === 'new') {
      setSrc('')
      setAltText('')
      setTitle('')
      setWidth('')
      setHeight('')
      setFileList(null)
    }
  }, [imageDialogState])

  if (!isOpen) return null

  return (
    <div className="modal modal-open z-[60]">
      <form
        className="modal-box w-full max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          const payload = {
            src: src.trim() || undefined,
            altText: altText.trim() || undefined,
            title: title.trim() || undefined,
            width: parseDimension(width),
            height: parseDimension(height),
          }
          if (fileList && fileList.length > 0) payload.file = fileList
          saveImage(payload)
          closeImageDialog()
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {imageDialogState.type === 'editing' ? 'Edit image' : 'Insert image'}
          </h3>
          <button className="btn btn-sm btn-circle btn-ghost" type="button" onClick={() => closeImageDialog()}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="grid gap-3">
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Upload from device</span>
            <input
              className="file-input file-input-bordered w-full"
              type="file"
              accept="image/*"
              onChange={(event) => setFileList(event.target.files)}
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-sm">Image URL or data URL</span>
            <input
              className="input input-bordered w-full font-mono text-sm"
              value={src}
              onChange={(event) => setSrc(event.target.value)}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Alt text</span>
              <input
                className="input input-bordered w-full"
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Title</span>
              <input
                className="input input-bordered w-full"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="modal-action mt-4">
          <button className="btn" type="button" onClick={() => closeImageDialog()}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>
      <button className="modal-backdrop" type="button" onClick={() => closeImageDialog()}>
        Close
      </button>
    </div>
  )
}

function DaisyEditImageToolbar({ nodeKey, imageSource, initialImagePath, title, alt, width, height }) {
  const openEditImageDialog = usePublisher(openEditImageDialog$)
  const [editor] = useLexicalComposerContext()

  return (
    <ul className="mdx-image-edit-toolbar menu menu-xs menu-horizontal absolute right-2 top-2 z-10 rounded-box border border-base-300 bg-base-100/90 p-1 shadow backdrop-blur-sm">
      <li className="!my-0 pl-0">
        <button
          type="button"
          aria-label="Edit image"
          title="Edit image"
          onClick={() => {
            openEditImageDialog({
              nodeKey,
              initialValues: {
                src: initialImagePath ?? imageSource,
                title,
                altText: alt,
                width: typeof width === 'number' ? width : undefined,
                height: typeof height === 'number' ? height : undefined,
              },
            })
          }}
        >
          <span className="text-sm leading-none" aria-hidden="true">
            ✎
          </span>
        </button>
      </li>
      <li className="!my-0">
        <button
          type="button"
          aria-label="Remove image"
          title="Remove image"
          onClick={() => {
            editor.update(() => {
              $getNodeByKey(nodeKey)?.remove()
            })
          }}
        >
          <span className="text-sm leading-none" aria-hidden="true">
            ✕
          </span>
        </button>
      </li>
    </ul>
  )
}

function EditorWorkspace({
  activeTab,
  editorRef,
  hasFrontmatter,
  mobileSidebarOpen,
  desktopSidebarOpen,
  onChange,
  onSaveFile,
  onToggleMobileSidebar,
  onToggleDesktopSidebar,
  onOpenFrontmatterDialog,
  saveButtonClass,
  supportsSaveFilePicker,
  imageUploadHandler,
}) {
  const plugins = useMemo(
    () => [
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <button
              className="btn btn-xs btn-ghost lg:hidden"
              type="button"
              aria-label={mobileSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              onClick={onToggleMobileSidebar}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              className="btn btn-xs btn-ghost hidden lg:inline-flex"
              type="button"
              aria-label={desktopSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              onClick={onToggleDesktopSidebar}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 3.5h12M2 8h12M2 12.5h12" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <UndoRedo />
            <BoldItalicUnderlineToggles />
            <ListsToggle />
            <div className="dropdown dropdown-end lg:hidden">
              <button className="btn btn-xs btn-square" type="button" tabIndex={0} aria-label="More actions">
                <svg className="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="3.5" cy="8" r="1.25" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.25" fill="currentColor" />
                  <circle cx="12.5" cy="8" r="1.25" fill="currentColor" />
                </svg>
              </button>
              <div
                tabIndex={0}
                className="dropdown-content menu z-50 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow"
              >
                <div className="flex flex-wrap gap-1">
                  <CodeToggle />
                  <BlockTypeSelect />
                  <CreateLink />
                  <InsertImage />
                  <InsertTable />
                  <InsertCodeBlock />
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
              <CodeToggle />
              <BlockTypeSelect />
              <CreateLink />
              <InsertImage />
              <InsertTable />
              <InsertCodeBlock />
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
        ),
      }),
      headingsPlugin(),
      frontmatterPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin({ LinkDialog: DaisyLinkDialog }),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
      codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
      markdownShortcutPlugin(),
      imagePlugin({
        imageUploadHandler,
        ImageDialog: DaisyImageDialog,
        EditImageToolbar: DaisyEditImageToolbar,
      }),
    ],
    [
      hasFrontmatter,
      imageUploadHandler,
      desktopSidebarOpen,
      mobileSidebarOpen,
      onOpenFrontmatterDialog,
      onSaveFile,
      onToggleDesktopSidebar,
      onToggleMobileSidebar,
      saveButtonClass,
      supportsSaveFilePicker,
    ],
  )

  if (!activeTab) return null

  return (
    <MDXEditor
      key={activeTab.id}
      ref={editorRef}
      markdown={activeTab.markdown}
      onChange={onChange}
      className="mdxeditor h-full"
      contentEditableClassName="prose max-w-none text-base-content"
      lexicalTheme={editorLexicalTheme}
      plugins={plugins}
    />
  )
}

export default EditorWorkspace
