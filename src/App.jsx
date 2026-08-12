import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FrontmatterDialog from './components/FrontmatterDialog'
import logoSvg from './assets/logo.svg?raw'
import {
  applyFrontmatter,
  makeFrontmatterRow,
  parseFrontmatterRows,
  rowsToFrontmatter,
  splitFrontmatter,
} from './lib/frontmatter'
import { useSessionDraftPersistence } from './hooks/useSessionDraftPersistence'

const EditorWorkspace = lazy(() => import('./EditorWorkspace'))
const INLINE_LOGO_SVG = logoSvg
  .replace(/<\?xml[\s\S]*?\?>\s*/i, '')
  .replace(/<!DOCTYPE[\s\S]*?>\s*/i, '')
  .replace(
    /<svg\b([^>]*)>/i,
    '<svg$1 class="h-8 w-14 fill-current text-base" role="img" aria-label="Markdawn">',
  )

const SESSION_STORAGE_KEY = 'markdawn.session.v1'
const SESSION_THEME_KEY = 'markdawn.theme'
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
    const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (rawSession) {
      const parsed = JSON.parse(rawSession)
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

    return null
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

  const supportsOpenFilePicker = typeof window !== 'undefined' && 'showOpenFilePicker' in window
  const supportsSaveFilePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window

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
    try {
      sessionStorage.setItem(SESSION_THEME_KEY, theme)
    } catch (error) {
      setStatusMessage(`Theme preference not saved: ${error?.message ?? 'storage unavailable'}`)
    }
    document.body.setAttribute('data-theme', theme)
    return () => {
      document.body.removeAttribute('data-theme')
    }
  }, [theme])

  const { persistTabsToSession } = useSessionDraftPersistence({
    sessionKey: SESSION_STORAGE_KEY,
    setStatusMessage,
  })

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
      persistTabsToSession(nextTabs, nextTab.id, { flush: true })
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
      persistTabsToSession(tabs, tabId, { flush: true })
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
        persistTabsToSession([resetTab], resetTab.id, { flush: true })
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
      persistTabsToSession(nextTabs, nextActiveTabId, { flush: true })
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
            persistTabsToSession(nextTabs, nextActiveTabId, { flush: true })
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
        persistTabsToSession(nextTabs, nextActiveTabId, { flush: true })
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
            persistTabsToSession(nextTabs, currentActiveTabId, { flush: true })
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
        persistTabsToSession(nextTabs, currentActiveTabId, { flush: true })
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
      persistTabsToSession(nextTabs, currentActiveTabId, { flush: true })
      return nextTabs
    })
    setFrontmatterDialogOpen(false)
    setStatusMessage('Updated front matter.')
  }, [activeTab, currentActiveTabId, frontmatterRows, persistTabsToSession])

  const saveButtonClass = activeTab?.isDirty ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-primary btn-outline'

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
        <div
          className="mb-3 flex justify-center text-base-content"
          dangerouslySetInnerHTML={{ __html: INLINE_LOGO_SVG }}
        />
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
                          <span className="indicator-item indicator-start status status-warning" />
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
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-base-100" />}>
              <EditorWorkspace
                activeTab={activeTab}
                editorRef={editorRef}
                hasFrontmatter={hasFrontmatter}
                mobileSidebarOpen={mobileSidebarOpen}
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
                onSaveFile={handleSaveFile}
                onToggleMobileSidebar={() => setMobileSidebarOpen((open) => !open)}
                onOpenFrontmatterDialog={handleOpenFrontmatterDialog}
                saveButtonClass={saveButtonClass}
                supportsSaveFilePicker={supportsSaveFilePicker}
                imageUploadHandler={imageUploadHandler}
              />
            </Suspense>
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

      <FrontmatterDialog
        open={frontmatterDialogOpen}
        rows={frontmatterRows}
        setRows={setFrontmatterRows}
        onCancel={() => setFrontmatterDialogOpen(false)}
        onSave={handleSaveFrontmatter}
      />
    </main>
  )
}

export default App
