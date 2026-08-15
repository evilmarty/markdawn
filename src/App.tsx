import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { FolderOpen, Plus, X } from 'lucide-react'
import packageJson from '../package.json'
import FrontmatterDialog from './components/FrontmatterDialog'
import EmojiCycler from './components/EmojiCycler'
import logoSvg from './assets/logo.svg?raw'
import {
  applyFrontmatter,
  makeFrontmatterRow,
  parseFrontmatterRows,
  rowsToFrontmatter,
  splitFrontmatter,
  validateFrontmatterRows,
} from './lib/frontmatter'
import { useSessionDraftPersistence } from './hooks/useSessionDraftPersistence'
import type { AppTab, EditorHandle, SaveFileOptions, SessionDraft } from './types/app'
import type { FrontmatterRow } from './lib/frontmatter'

const APP_NAME = packageJson.name

const EditorWorkspace = lazy(() => import('./EditorWorkspace'))
const STRIPPED_LOGO_SVG = logoSvg
  .replace(/<\?xml[\s\S]*?\?>\s*/i, '')
  .replace(/<!DOCTYPE[\s\S]*?>\s*/i, '')
const INLINE_LOGO_SVG = STRIPPED_LOGO_SVG
  .replace(
    /<svg\b([^>]*)>/i,
    '<svg$1 class="h-8 w-14 fill-current text-base" role="img" aria-label="Markdawn">',
  )
const DEFAULT_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  STRIPPED_LOGO_SVG
    .replace(/\bwidth="100%"/i, 'width="336"')
    .replace(/\bheight="100%"/i, 'height="192"'),
)}`

const SESSION_STORAGE_KEY = 'markdawn.session.v1'
const SESSION_THEME_KEY = 'markdawn.theme'
const DEFAULT_THEME = 'system'
const FOOTER_EMOJIS = ['❤️', '🍺', '🌯', '🥃', '🍦']
const DAISY_THEMES = [
  'system',
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
const DEFAULT_MARKDOWN = `![Markdawn logo](${DEFAULT_LOGO_DATA_URL})

# Markdawn

Welcome to Markdawn, your editable Markdown preview.

## What this editor does

- **Preview is the editor**: edit rendered content directly.
- **Session recovery**: your draft is saved in this tab session.
- **File support**: open and save Markdown files locally.
- **Image support**: add and edit images directly in your document.
- **Table support**: insert and edit Markdown tables from the toolbar.
- **Front matter support**: manage document metadata without leaving the editor.

> Tip: use the toolbar above to insert rich content quickly.
`

type MakeTabOptions = Partial<Omit<AppTab, 'id' | 'isDirty'>> & {
  id?: string
  isDirty?: boolean
}

type FrontmatterValidationState = {
  message: string | null
  rowErrors: Record<string, string>
}

function emptyFrontmatterValidationState(): FrontmatterValidationState {
  return {
    message: null,
    rowErrors: {},
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown error')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPersistedTab(value: unknown): value is Pick<AppTab, 'id' | 'fileName' | 'markdown' | 'savedMarkdown' | 'isDirty'> {
  if (!isRecord(value)) return false
  return typeof value.fileName === 'string' && typeof value.markdown === 'string'
}

export function makeTab({
  id,
  fileName = 'untitled.md',
  markdown = DEFAULT_MARKDOWN,
  fileHandle = null,
  savedMarkdown = markdown,
  isDirty,
}: MakeTabOptions = {}): AppTab {
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
      const parsed: unknown = JSON.parse(rawSession)
      if (!isRecord(parsed)) return null
      const tabs =
        Array.isArray(parsed.tabs) && parsed.tabs.length > 0
          ? parsed.tabs
              .filter((tab): tab is Pick<AppTab, 'id' | 'fileName' | 'markdown' | 'savedMarkdown' | 'isDirty'> => isPersistedTab(tab))
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
        const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId) ? (parsed.activeTabId as string) : tabs[0].id
        return { tabs, activeTabId }
      }
    }

    return null
  } catch {
    return null
  }
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to convert image to data URL.'))
    reader.readAsDataURL(file)
  })
}

export function downloadTextFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(href)
}

function App() {
  const [draftFromSession] = useState<SessionDraft | null>(() => loadDraftFromSession())
  const [tabs, setTabs] = useState<AppTab[]>(() => draftFromSession?.tabs ?? [makeTab()])
  const [activeTabId, setActiveTabId] = useState<string | null>(() => draftFromSession?.activeTabId ?? null)
  const [theme, setTheme] = useState<string>(() => {
    try {
      return sessionStorage.getItem(SESSION_THEME_KEY) ?? DEFAULT_THEME
    } catch {
      return DEFAULT_THEME
    }
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [frontmatterDialogOpen, setFrontmatterDialogOpen] = useState(false)
  const [frontmatterRows, setFrontmatterRows] = useState<FrontmatterRow[]>(() => [makeFrontmatterRow()])
  const [frontmatterValidation, setFrontmatterValidation] = useState<FrontmatterValidationState>(
    () => emptyFrontmatterValidationState(),
  )
  const [, setStatusMessage] = useState(draftFromSession ? 'Recovered tabs from this browser session.' : 'Ready.')
  const editorRef = useRef<EditorHandle | null>(null)
  const fallbackOpenInputRef = useRef<HTMLInputElement | null>(null)

  const supportsOpenFilePicker = typeof window !== 'undefined' && 'showOpenFilePicker' in window
  const supportsSaveFilePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const currentActiveTabId = activeTab?.id
  const hasFrontmatter = useMemo(
    () => Boolean(splitFrontmatter(activeTab?.markdown ?? '').frontmatter.trim()),
    [activeTab?.markdown],
  )

  const imageUploadHandler = useCallback(async (imageFile: File): Promise<string> => {
    const dataUrl = await fileToDataUrl(imageFile)
    return String(dataUrl)
  }, [])

  useEffect(() => {
    document.title = activeTab ? `${activeTab.fileName} · ${APP_NAME}` : APP_NAME
  }, [activeTab])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_THEME_KEY, theme)
    } catch (error) {
      setStatusMessage(`Theme preference not saved: ${asError(error).message || 'storage unavailable'}`)
    }
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme')
      return () => {
        document.documentElement.removeAttribute('data-theme')
      }
    }

    document.documentElement.setAttribute('data-theme', theme)
    return () => {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [theme])

  const { persistTabsToSession } = useSessionDraftPersistence({
    sessionKey: SESSION_STORAGE_KEY,
    setStatusMessage,
  })

  const updateTab = useCallback((tabId: string, updater: (tab: AppTab) => AppTab) => {
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
    (tabId: string) => {
      if (tabId === currentActiveTabId) return
      syncEditorValueIntoActiveTab()
      setActiveTabId(tabId)
      persistTabsToSession(tabs, tabId, { flush: true })
    },
    [currentActiveTabId, persistTabsToSession, syncEditorValueIntoActiveTab, tabs],
  )

  const handleCloseTab = useCallback(
    (tabId: string) => {
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
    if (supportsOpenFilePicker && typeof window.showOpenFilePicker === 'function') {
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

        const loadedTabs: AppTab[] = []
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
        const parsedError = asError(error)
        if (parsedError.name !== 'AbortError') {
          setStatusMessage(`Open failed: ${parsedError.message}`)
        }
      }
      return
    }

    fallbackOpenInputRef.current?.click()
  }, [persistTabsToSession, supportsOpenFilePicker, syncEditorValueIntoActiveTab])

  const onFallbackFilePicked = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? [])
      if (selectedFiles.length === 0) return

      syncEditorValueIntoActiveTab()

      const loadedTabs: AppTab[] = []
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
    async ({ saveAs = false }: SaveFileOptions = {}) => {
      if (!activeTab) return
      const content = editorRef.current?.getMarkdown() ?? activeTab.markdown

      if (supportsSaveFilePicker && typeof window.showSaveFilePicker === 'function') {
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
          const parsedError = asError(error)
          if (parsedError.name !== 'AbortError') {
            setStatusMessage(`Save failed: ${parsedError.message}`)
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
    setFrontmatterValidation(emptyFrontmatterValidationState())
    setFrontmatterDialogOpen(true)
  }, [activeTab])

  const clearFrontmatterValidationState = useCallback(() => {
    setFrontmatterValidation(emptyFrontmatterValidationState())
  }, [])

  const handleSaveFrontmatter = useCallback(() => {
    if (!activeTab) return
    const rowErrors = validateFrontmatterRows(frontmatterRows)
    if (Object.keys(rowErrors).length > 0) {
      setFrontmatterValidation({
        message: 'Fix invalid YAML values before saving front matter.',
        rowErrors,
      })
      return
    }

    const content = editorRef.current?.getMarkdown() ?? activeTab.markdown
    let nextContent: string
    try {
      nextContent = applyFrontmatter(content, rowsToFrontmatter(frontmatterRows))
    } catch (error) {
      setFrontmatterValidation({
        message: `Could not save front matter: ${asError(error).message}`,
        rowErrors: {},
      })
      return
    }

    editorRef.current?.setMarkdown(nextContent)
    setTabs((prevTabs) => {
      const nextTabs = prevTabs.map((tab) =>
        tab.id === activeTab.id ? { ...tab, markdown: nextContent, isDirty: nextContent !== tab.savedMarkdown } : tab,
      )
      persistTabsToSession(nextTabs, currentActiveTabId, { flush: true })
      return nextTabs
    })
    clearFrontmatterValidationState()
    setFrontmatterDialogOpen(false)
    setStatusMessage('Updated front matter.')
  }, [activeTab, clearFrontmatterValidationState, currentActiveTabId, frontmatterRows, persistTabsToSession])

  const saveButtonClass = activeTab?.isDirty ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-primary btn-soft'

  return (
    <main className="flex min-h-screen w-full bg-base-200">
      {mobileSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col border-r border-base-300 bg-base-100 p-3 transition-all duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${desktopSidebarOpen ? 'lg:w-72 lg:p-3 lg:border-r' : 'lg:w-0 lg:p-0 lg:border-r-0 lg:overflow-hidden'}`}
      >
        <div
          className="mb-3 flex justify-center text-base-content"
          dangerouslySetInnerHTML={{ __html: INLINE_LOGO_SVG }}
        />
        <div className="mb-3 flex gap-2">
          <button className="btn btn-sm flex-1" type="button" onClick={handleNewTab}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New
          </button>
          <button className="btn btn-sm flex-1" type="button" onClick={handleOpenFile}>
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
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
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
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
        <footer className="footer footer-horizontal mt-4 w-full items-center justify-between border-t border-base-300 pt-3 text-base-content">
          <aside className="grid-flow-col items-center justify-start gap-1 text-sm text-left">
            Made with
            <EmojiCycler emojis={FOOTER_EMOJIS} className="inline-block" />
            by
            <a href="https://marty.zalega.me" className="link link-accent" title="Website" target="_blank" rel="noreferrer">
              evilmarty
            </a>
          </aside>
          <nav className="grid-flow-col items-center justify-self-end gap-3 text-xs">
            <a
              href="https://mastadon.social/evilmarty"
              className="link link-hover"
              title="Mastadon"
              target="_blank"
              rel="noreferrer"
              aria-label="Mastadon"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 74 79"
                className="h-4 w-4 fill-current"
                aria-hidden="true"
              >
                <path d="M73.7014 17.4323C72.5616 9.05152 65.1774 2.4469 56.424 1.1671C54.9472 0.950843 49.3518 0.163818 36.3901 0.163818H36.2933C23.3281 0.163818 20.5465 0.950843 19.0697 1.1671C10.56 2.41145 2.78877 8.34604 0.903306 16.826C-0.00357854 21.0022 -0.100361 25.6322 0.068112 29.8793C0.308275 35.9699 0.354874 42.0498 0.91406 48.1156C1.30064 52.1448 1.97502 56.1419 2.93215 60.0769C4.72441 67.3445 11.9795 73.3925 19.0876 75.86C26.6979 78.4332 34.8821 78.8603 42.724 77.0937C43.5866 76.8952 44.4398 76.6647 45.2833 76.4024C47.1867 75.8033 49.4199 75.1332 51.0616 73.9562C51.0841 73.9397 51.1026 73.9184 51.1156 73.8938C51.1286 73.8693 51.1359 73.8421 51.1368 73.8144V67.9366C51.1364 67.9107 51.1302 67.8852 51.1186 67.862C51.1069 67.8388 51.0902 67.8184 51.0695 67.8025C51.0489 67.7865 51.0249 67.7753 50.9994 67.7696C50.9738 67.764 50.9473 67.7641 50.9218 67.7699C45.8976 68.9569 40.7491 69.5519 35.5836 69.5425C26.694 69.5425 24.3031 65.3699 23.6184 63.6327C23.0681 62.1314 22.7186 60.5654 22.5789 58.9744C22.5775 58.9477 22.5825 58.921 22.5934 58.8965C22.6043 58.8721 22.621 58.8505 22.6419 58.8336C22.6629 58.8167 22.6876 58.8049 22.714 58.7992C22.7404 58.7934 22.7678 58.794 22.794 58.8007C27.7345 59.9796 32.799 60.5746 37.8813 60.5733C39.1036 60.5733 40.3223 60.5733 41.5447 60.5414C46.6562 60.3996 52.0437 60.1408 57.0728 59.1694C57.1983 59.1446 57.3237 59.1233 57.4313 59.0914C65.3638 57.5847 72.9128 52.8555 73.6799 40.8799C73.7086 40.4084 73.7803 35.9415 73.7803 35.4523C73.7839 33.7896 74.3216 23.6576 73.7014 17.4323ZM61.4925 47.3144H53.1514V27.107C53.1514 22.8528 51.3591 20.6832 47.7136 20.6832C43.7061 20.6832 41.6988 23.2499 41.6988 28.3194V39.3803H33.4078V28.3194C33.4078 23.2499 31.3969 20.6832 27.3894 20.6832C23.7654 20.6832 21.9552 22.8528 21.9516 27.107V47.3144H13.6176V26.4937C13.6176 22.2395 14.7157 18.8598 16.9118 16.3545C19.1772 13.8552 22.1488 12.5719 25.8373 12.5719C30.1064 12.5719 33.3325 14.1955 35.4832 17.4394L37.5587 20.8853L39.6377 17.4394C41.7884 14.1955 45.0145 12.5719 49.2765 12.5719C52.9614 12.5719 55.9329 13.8552 58.2055 16.3545C60.4017 18.8574 61.4997 22.2371 61.4997 26.4937L61.4925 47.3144Z" />
              </svg>
            </a>
            <a
              href="https://github.com/evilmarty/markdawn"
              className="link link-hover"
              title="GitHub"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.337-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </nav>
        </footer>
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
                desktopSidebarOpen={desktopSidebarOpen}
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
                onToggleDesktopSidebar={() => setDesktopSidebarOpen((open) => !open)}
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
        validation={frontmatterValidation}
        onRowsEdited={clearFrontmatterValidationState}
        onCancel={() => {
          clearFrontmatterValidationState()
          setFrontmatterDialogOpen(false)
        }}
        onSave={handleSaveFrontmatter}
      />
    </main>
  )
}

export default App
