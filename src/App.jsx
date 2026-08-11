import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import YamlParser from 'js-yaml'
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

const SESSION_STORAGE_KEY = 'markymark.session.v2'
const SESSION_THEME_KEY = 'markymark.theme'
const DEFAULT_THEME = 'light'
const DAISY_THEMES = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
]
const DEFAULT_MARKDOWN = `# Markdawn

Welcome to Markdawn, your editable Markdown preview.

## What this editor does

- **Preview is the editor**: edit rendered content directly.
- **Session recovery**: your draft is saved in this tab session.
- **File support**: open and save Markdown files locally.
- **Images as data URLs**: inserted images are embedded in the document.

> Tip: use the toolbar above to insert rich content quickly.
`

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

function normalizeDimension(value) {
  return typeof value === 'number' ? value : ''
}

function parseDimension(value) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function splitFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return { frontmatter: '', body: markdown }
  return {
    frontmatter: match[1],
    body: markdown.slice(match[0].length),
  }
}

function applyFrontmatter(markdown, nextFrontmatter) {
  const { body } = splitFrontmatter(markdown)
  const cleanedBody = body.replace(/^\n+/, '')
  const trimmedFrontmatter = nextFrontmatter.trim()
  if (!trimmedFrontmatter) return cleanedBody
  return `---\n${trimmedFrontmatter}\n---\n\n${cleanedBody}`
}

function makeFrontmatterRow(key = '', value = '') {
  return {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `fm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    key,
    value,
  }
}

function parseFrontmatterRows(markdown) {
  const { frontmatter } = splitFrontmatter(markdown)
  if (!frontmatter.trim()) return [makeFrontmatterRow()]

  try {
    const parsed = YamlParser.load(frontmatter)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [makeFrontmatterRow()]
    }
    const entries = Object.entries(parsed).map(([key, value]) =>
      makeFrontmatterRow(
        key,
        typeof value === 'string' ? value : value == null ? '' : YamlParser.dump(value).trim(),
      ),
    )
    return entries.length > 0 ? entries : [makeFrontmatterRow()]
  } catch {
    return [makeFrontmatterRow()]
  }
}

function rowsToFrontmatter(rows) {
  const data = {}

  for (const row of rows) {
    const key = row.key.trim()
    const value = row.value.trim()
    if (!key || !value) continue

    try {
      data[key] = YamlParser.load(value)
    } catch {
      data[key] = value
    }
  }

  if (Object.keys(data).length === 0) return ''
  return YamlParser.dump(data).trim()
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

function DaisyEditImageToolbar({
  nodeKey,
  imageSource,
  initialImagePath,
  title,
  alt,
  width,
  height,
}) {
  const openEditImageDialog = usePublisher(openEditImageDialog$)
  const [editor] = useLexicalComposerContext()

  return (
    <ul className="menu menu-xs menu-horizontal absolute right-2 top-2 z-10 rounded-box border border-base-300 bg-base-100/90 p-1 shadow backdrop-blur-sm">
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

export function makeTab({
  id,
  fileName = 'untitled.md',
  markdown = DEFAULT_MARKDOWN,
  fileHandle = null,
  savedMarkdown = markdown,
  isDirty,
} = {}) {
  const nextId =
    id ??
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  return {
    id: nextId,
    fileName,
    markdown,
    fileHandle,
    savedMarkdown,
    isDirty: typeof isDirty === 'boolean' ? isDirty : markdown !== savedMarkdown,
  }
}

export function loadDraftFromSession() {
  try {
    const rawV2 = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (rawV2) {
      const parsed = JSON.parse(rawV2)
      const tabs =
        Array.isArray(parsed?.tabs) && parsed.tabs.length > 0
          ? parsed.tabs
              .filter((tab) => typeof tab?.fileName === 'string' && typeof tab?.markdown === 'string')
              .map((tab) =>
                makeTab({
                  id: typeof tab.id === 'string' ? tab.id : undefined,
                  fileName: tab.fileName,
                  markdown: tab.markdown,
                  savedMarkdown: typeof tab.savedMarkdown === 'string' ? tab.savedMarkdown : tab.markdown,
                  isDirty: typeof tab.isDirty === 'boolean' ? tab.isDirty : undefined,
                }),
              )
          : []
      if (tabs.length > 0) {
        const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId) ? parsed.activeTabId : tabs[0].id
        return { tabs, activeTabId }
      }
    }

    // Migrate from v1 single-file format if present.
    const rawV1 = sessionStorage.getItem('markymark.session.v1')
    if (!rawV1) return null
    const parsedV1 = JSON.parse(rawV1)
    if (typeof parsedV1?.markdown !== 'string') return null
    const tab = makeTab({
      fileName: typeof parsedV1.fileName === 'string' ? parsedV1.fileName : 'untitled.md',
      markdown: parsedV1.markdown,
    })
    return { tabs: [tab], activeTabId: tab.id }
  } catch {
    return null
  }
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to convert image to data URL.'))
    reader.readAsDataURL(file)
  })
}

export function downloadTextFile(content, fileName) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(href)
}

function App() {
  const [draftFromSession] = useState(() => loadDraftFromSession())
  const [tabs, setTabs] = useState(() => draftFromSession?.tabs ?? [makeTab()])
  const [activeTabId, setActiveTabId] = useState(() => draftFromSession?.activeTabId ?? null)
  const [theme, setTheme] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_THEME_KEY) ?? DEFAULT_THEME
    } catch {
      return DEFAULT_THEME
    }
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [frontmatterDialogOpen, setFrontmatterDialogOpen] = useState(false)
  const [frontmatterRows, setFrontmatterRows] = useState(() => [makeFrontmatterRow()])
  const [, setStatusMessage] = useState(draftFromSession ? 'Recovered tabs from this browser session.' : 'Ready.')
  const editorRef = useRef(null)
  const fallbackOpenInputRef = useRef(null)

  const supportsOpenFilePicker =
    typeof window !== 'undefined' && 'showOpenFilePicker' in window
  const supportsSaveFilePicker =
    typeof window !== 'undefined' && 'showSaveFilePicker' in window

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const currentActiveTabId = activeTab?.id
  const hasFrontmatter = useMemo(
    () => Boolean(splitFrontmatter(activeTab?.markdown ?? '').frontmatter.trim()),
    [activeTab?.markdown],
  )

  const imageUploadHandler = useCallback(async (imageFile) => {
    const dataUrl = await fileToDataUrl(imageFile)
    return String(dataUrl)
  }, [])

  useEffect(() => {
    sessionStorage.setItem(SESSION_THEME_KEY, theme)
  }, [theme])

  const persistTabsToSession = useCallback((nextTabs, nextActiveTabId) => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        tabs: nextTabs.map(({ id, fileName, markdown, savedMarkdown, isDirty }) => ({
          id,
          fileName,
          markdown,
          savedMarkdown,
          isDirty,
        })),
        activeTabId: nextActiveTabId,
        updatedAt: Date.now(),
      }),
    )
  }, [])

  const updateTab = useCallback((tabId, updater) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id !== tabId) return tab
        return updater(tab)
      }),
    )
  }, [])

  const syncEditorValueIntoActiveTab = useCallback(() => {
    if (!activeTab) return
    const content = editorRef.current?.getMarkdown()
    if (typeof content !== 'string') return
    updateTab(activeTab.id, (tab) => ({
      ...tab,
      markdown: content,
      isDirty: content !== tab.savedMarkdown,
    }))
  }, [activeTab, updateTab])

  const handleNewTab = useCallback(() => {
    syncEditorValueIntoActiveTab()
    const nextTab = makeTab()
    setTabs((prevTabs) => {
      const nextTabs = [...prevTabs, nextTab]
      persistTabsToSession(nextTabs, nextTab.id)
      return nextTabs
    })
    setActiveTabId(nextTab.id)
    setStatusMessage('Created a new tab.')
  }, [persistTabsToSession, syncEditorValueIntoActiveTab])

  const handleSwitchTab = useCallback(
    (tabId) => {
      if (tabId === currentActiveTabId) return
      syncEditorValueIntoActiveTab()
      setActiveTabId(tabId)
      persistTabsToSession(tabs, tabId)
    },
    [currentActiveTabId, persistTabsToSession, syncEditorValueIntoActiveTab, tabs],
  )

  const handleCloseTab = useCallback(
    (tabId) => {
      const closingTab = tabs.find((tab) => tab.id === tabId)
      if (!closingTab) return
      const closingMarkdown =
        tabId === currentActiveTabId ? (editorRef.current?.getMarkdown() ?? closingTab.markdown) : closingTab.markdown
      const hasUnsavedChanges = tabId === currentActiveTabId ? closingMarkdown !== closingTab.savedMarkdown : closingTab.isDirty
      if (hasUnsavedChanges) {
        const shouldClose = window.confirm(
          `"${closingTab.fileName}" has unsaved changes. Close this tab without saving?`,
        )
        if (!shouldClose) return
      }

      syncEditorValueIntoActiveTab()

      if (tabs.length === 1) {
        const resetTab = makeTab()
        setTabs([resetTab])
        setActiveTabId(resetTab.id)
        persistTabsToSession([resetTab], resetTab.id)
        setStatusMessage('Closed tab and started a new draft.')
        return
      }

      const closingIndex = tabs.findIndex((tab) => tab.id === tabId)
      if (closingIndex === -1) return

      const nextTabs = tabs.filter((tab) => tab.id !== tabId)
      const fallbackIndex = Math.max(0, closingIndex - 1)
      const nextActiveTabId =
        tabId === currentActiveTabId ? (nextTabs[fallbackIndex] ?? nextTabs[0]).id : currentActiveTabId

      setTabs(nextTabs)
      setActiveTabId(nextActiveTabId)
      persistTabsToSession(nextTabs, nextActiveTabId)
      setStatusMessage('Tab closed.')
    },
    [currentActiveTabId, persistTabsToSession, syncEditorValueIntoActiveTab, tabs],
  )

  const handleOpenFile = useCallback(async () => {
    if (supportsOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Markdown files',
              accept: {
                'text/markdown': ['.md', '.markdown'],
                'text/plain': ['.txt'],
              },
            },
          ],
          excludeAcceptAllOption: false,
        })

        const loadedTabs = []
        for (const handle of handles) {
          const file = await handle.getFile()
          const text = await file.text()
          loadedTabs.push(makeTab({ fileName: file.name, markdown: text, fileHandle: handle, savedMarkdown: text }))
        }

        if (loadedTabs.length > 0) {
          syncEditorValueIntoActiveTab()
          setTabs((prevTabs) => {
            const nextTabs = [...prevTabs, ...loadedTabs]
            const nextActiveTabId = loadedTabs[loadedTabs.length - 1].id
            persistTabsToSession(nextTabs, nextActiveTabId)
            return nextTabs
          })
          setActiveTabId(loadedTabs[loadedTabs.length - 1].id)
          setStatusMessage(
            loadedTabs.length === 1 ? `Opened ${loadedTabs[0].fileName}.` : `Opened ${loadedTabs.length} files.`,
          )
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setStatusMessage(`Open failed: ${error.message}`)
        }
      }
      return
    }

    fallbackOpenInputRef.current?.click()
  }, [persistTabsToSession, supportsOpenFilePicker, syncEditorValueIntoActiveTab])

  const onFallbackFilePicked = useCallback(
    async (event) => {
      const selectedFiles = Array.from(event.target.files ?? [])
      if (selectedFiles.length === 0) return

      syncEditorValueIntoActiveTab()

      const loadedTabs = []
      for (const file of selectedFiles) {
        const text = await file.text()
        loadedTabs.push(makeTab({ fileName: file.name, markdown: text, savedMarkdown: text }))
      }

      setTabs((prevTabs) => {
        const nextTabs = [...prevTabs, ...loadedTabs]
        const nextActiveTabId = loadedTabs[loadedTabs.length - 1].id
        persistTabsToSession(nextTabs, nextActiveTabId)
        return nextTabs
      })
      setActiveTabId(loadedTabs[loadedTabs.length - 1].id)
      setStatusMessage(
        loadedTabs.length === 1 ? `Opened ${loadedTabs[0].fileName}.` : `Opened ${loadedTabs.length} files.`,
      )
      event.target.value = ''
    },
    [persistTabsToSession, syncEditorValueIntoActiveTab],
  )

  const handleSaveFile = useCallback(
    async ({ saveAs = false } = {}) => {
      if (!activeTab) return
      const content = editorRef.current?.getMarkdown() ?? activeTab.markdown

      if (supportsSaveFilePicker) {
        try {
          const handle =
            !saveAs && activeTab.fileHandle
              ? activeTab.fileHandle
              : await window.showSaveFilePicker({
                  suggestedName: activeTab.fileName,
                  types: [
                    {
                      description: 'Markdown file',
                      accept: { 'text/markdown': ['.md'] },
                    },
                  ],
                })

          const writable = await handle.createWritable()
          await writable.write(content)
          await writable.close()

          setTabs((prevTabs) => {
            const nextTabs = prevTabs.map((tab) =>
              tab.id === activeTab.id
                ? {
                    ...tab,
                    markdown: content,
                    fileHandle: handle,
                    fileName: handle.name ?? tab.fileName,
                    savedMarkdown: content,
                    isDirty: false,
                  }
                : tab,
            )
            persistTabsToSession(nextTabs, currentActiveTabId)
            return nextTabs
          })
          setStatusMessage(`Saved ${handle.name ?? activeTab.fileName}.`)
          return
        } catch (error) {
          if (error?.name !== 'AbortError') {
            setStatusMessage(`Save failed: ${error.message}`)
          }
          return
        }
      }

      downloadTextFile(content, activeTab.fileName)
      setTabs((prevTabs) => {
        const nextTabs = prevTabs.map((tab) =>
          tab.id === activeTab.id ? { ...tab, markdown: content, savedMarkdown: content, isDirty: false } : tab,
        )
        persistTabsToSession(nextTabs, currentActiveTabId)
        return nextTabs
      })
      setStatusMessage(`Downloaded ${activeTab.fileName} (save picker unavailable in this browser).`)
    },
    [activeTab, currentActiveTabId, persistTabsToSession, supportsSaveFilePicker],
  )

  const handleOpenFrontmatterDialog = useCallback(() => {
    if (!activeTab) return
    const content = editorRef.current?.getMarkdown() ?? activeTab.markdown
    setFrontmatterRows(parseFrontmatterRows(content))
    setFrontmatterDialogOpen(true)
  }, [activeTab])

  const handleSaveFrontmatter = useCallback(() => {
    if (!activeTab) return
    const content = editorRef.current?.getMarkdown() ?? activeTab.markdown
    const nextContent = applyFrontmatter(content, rowsToFrontmatter(frontmatterRows))
    editorRef.current?.setMarkdown(nextContent)
    setTabs((prevTabs) => {
      const nextTabs = prevTabs.map((tab) =>
        tab.id === activeTab.id ? { ...tab, markdown: nextContent, isDirty: nextContent !== tab.savedMarkdown } : tab,
      )
      persistTabsToSession(nextTabs, currentActiveTabId)
      return nextTabs
    })
    setFrontmatterDialogOpen(false)
    setStatusMessage('Updated front matter.')
  }, [activeTab, currentActiveTabId, frontmatterRows, persistTabsToSession])

  const saveButtonClass = activeTab?.isDirty ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-primary btn-outline'

  const plugins = useMemo(
    () => [
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <button
              className="btn btn-xs btn-ghost lg:hidden"
              type="button"
              aria-label={mobileSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              onClick={() => setMobileSidebarOpen((open) => !open)}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
                  <FrontmatterToolbarButton hasFrontmatter={hasFrontmatter} onClick={handleOpenFrontmatterDialog} />
                  {supportsSaveFilePicker && (
                    <button
                      className="btn btn-xs"
                      type="button"
                      onClick={() => void handleSaveFile({ saveAs: true })}
                    >
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
              <FrontmatterToolbarButton hasFrontmatter={hasFrontmatter} onClick={handleOpenFrontmatterDialog} />
            </div>
            <div className="grow" />
            {supportsSaveFilePicker && (
              <button
                className="btn btn-xs hidden lg:inline-flex"
                type="button"
                onClick={() => void handleSaveFile({ saveAs: true })}
              >
                Save As
              </button>
            )}
            <button className={saveButtonClass} type="button" onClick={() => void handleSaveFile()}>
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
      handleOpenFrontmatterDialog,
      handleSaveFile,
      imageUploadHandler,
      mobileSidebarOpen,
      saveButtonClass,
      supportsSaveFilePicker,
    ],
  )

  return (
    <main className="flex min-h-screen w-full bg-base-200" data-theme={theme}>
      {mobileSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col border-r border-base-300 bg-base-100 p-3 transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-3">
          <h1 className="text-base font-semibold">Markdawn</h1>
        </div>
        <div className="mb-3 flex gap-2">
          <button className="btn btn-sm flex-1" type="button" onClick={handleNewTab}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New
          </button>
          <button className="btn btn-sm flex-1" type="button" onClick={handleOpenFile}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M2.5 4.5h3l1.25 1.5h6.75v6.5h-11z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            Open
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul className="menu menu-sm w-full gap-1 p-0">
            {tabs.map((tab) => {
              const isActive = tab.id === currentActiveTabId
              return (
                <li key={tab.id}>
                  <div className={`flex w-full items-center gap-1 p-0 ${isActive ? 'menu-active' : ''}`}>
                    <button className="flex-1 truncate rounded-btn px-3 py-2 text-left" type="button" onClick={() => handleSwitchTab(tab.id)}>
                      {!isActive && tab.isDirty ? (
                        <span className="indicator">
                          <span className="indicator-item status status-warning" />
                          <span className="truncate">{tab.fileName}</span>
                        </span>
                      ) : (
                        tab.fileName
                      )}
                    </button>
                    <button
                      className="mr-2 grid h-6 w-6 place-items-center rounded-full bg-inherit text-inherit hover:bg-base-content/10"
                      type="button"
                      aria-label={`Close ${tab.fileName}`}
                      onClick={() => handleCloseTab(tab.id)}
                    >
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
                </li>
              )
            })}
          </ul>
        </div>
        <div className="join mt-3 w-full items-center">
          <label htmlFor="theme-select" className="btn btn-sm join-item">
            Theme
          </label>
          <select id="theme-select" className="select select-bordered select-sm join-item flex-1" value={theme} onChange={(event) => setTheme(event.target.value)}>
            {DAISY_THEMES.map((themeName) => (
              <option key={themeName} value={themeName}>
                {themeName}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <section className="flex h-screen flex-1">
        <div className="h-full w-full bg-base-100">
          {activeTab && (
            <MDXEditor
              key={activeTab.id}
              ref={editorRef}
              markdown={activeTab.markdown}
              onChange={(nextMarkdown, initialMarkdownNormalize) => {
                setTabs((prevTabs) => {
                  const nextTabs = prevTabs.map((tab) =>
                    tab.id === activeTab.id
                      ? {
                          ...tab,
                          markdown: nextMarkdown,
                          savedMarkdown:
                            initialMarkdownNormalize && !tab.isDirty ? nextMarkdown : tab.savedMarkdown,
                          isDirty:
                            initialMarkdownNormalize && !tab.isDirty
                              ? false
                              : nextMarkdown !== tab.savedMarkdown,
                        }
                      : tab,
                  )
                  persistTabsToSession(nextTabs, currentActiveTabId)
                  return nextTabs
                })
              }}
              className="mdxeditor h-full"
              contentEditableClassName="prose prose-slate max-w-none"
              plugins={plugins}
            />
          )}
        </div>
      </section>

      <input
        ref={fallbackOpenInputRef}
        className="hidden"
        type="file"
        multiple
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        onChange={onFallbackFilePicked}
      />

      {frontmatterDialogOpen && (
        <div className="modal modal-open z-[70]">
          <div className="modal-box w-full max-w-2xl">
            <h3 className="mb-3 text-lg font-semibold">Edit front matter</h3>
            <div className="mb-2 grid grid-cols-[2fr_3fr_auto] gap-2 px-1 text-xs font-semibold text-base-content/70">
              <span>Key</span>
              <span>Value</span>
              <span />
            </div>
            <div className="space-y-2">
              {frontmatterRows.map((row, index) => (
                <div key={row.id} className="join w-full">
                  <input
                    className="input input-bordered input-sm join-item w-2/5"
                    value={row.key}
                    onChange={(event) =>
                      setFrontmatterRows((prevRows) =>
                        prevRows.map((entry) =>
                          entry.id === row.id ? { ...entry, key: event.target.value } : entry,
                        ),
                      )
                    }
                    autoFocus={index === 0}
                  />
                  <input
                    className="input input-bordered input-sm join-item w-3/5"
                    value={row.value}
                    onChange={(event) =>
                      setFrontmatterRows((prevRows) =>
                        prevRows.map((entry) =>
                          entry.id === row.id ? { ...entry, value: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                  <button
                    className="btn btn-secondary btn-sm join-item"
                    type="button"
                    aria-label="Remove row"
                    onClick={() =>
                      setFrontmatterRows((prevRows) => {
                        const nextRows = prevRows.filter((entry) => entry.id !== row.id)
                        return nextRows.length > 0 ? nextRows : [makeFrontmatterRow()]
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setFrontmatterRows((prevRows) => [...prevRows, makeFrontmatterRow()])}
              >
                Add entry
              </button>
              <div className="flex gap-2">
                <button className="btn" type="button" onClick={() => setFrontmatterDialogOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="button" onClick={handleSaveFrontmatter}>
                  Save
                </button>
              </div>
            </div>
          </div>
          <button className="modal-backdrop" type="button" onClick={() => setFrontmatterDialogOpen(false)}>
            Close
          </button>
        </div>
      )}
    </main>
  )
}

export default App
