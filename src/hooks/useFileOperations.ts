import { useCallback } from 'react'
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'
import { downloadTextFile, makeTab } from '../lib/utils'
import type { AppTab, EditorHandle, SaveFileOptions } from '../types/app'

type PersistTabsToSession = (
  nextTabs: AppTab[],
  nextActiveTabId: string,
  options?: { flush?: boolean },
) => void

type UseFileOperationsParams = {
  activeTab: AppTab | null
  currentActiveTabId: string
  editorRef: RefObject<EditorHandle | null>
  fallbackOpenInputRef: RefObject<HTMLInputElement | null>
  persistTabsToSession: PersistTabsToSession
  setActiveTabId: (tabId: string) => void
  setStatusMessage: (message: string) => void
  setTabs: Dispatch<SetStateAction<AppTab[]>>
  supportsOpenFilePicker: boolean
  supportsSaveFilePicker: boolean
  syncEditorValueIntoActiveTab: () => void
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown error')
}

export function useFileOperations({
  activeTab,
  currentActiveTabId,
  editorRef,
  fallbackOpenInputRef,
  persistTabsToSession,
  setActiveTabId,
  setStatusMessage,
  setTabs,
  supportsOpenFilePicker,
  supportsSaveFilePicker,
  syncEditorValueIntoActiveTab,
}: UseFileOperationsParams) {
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

        const loadedTabs = await Promise.all(
          handles.map(async (handle) => {
            const file = await handle.getFile()
            const text = await file.text()
            return makeTab({ fileName: file.name, markdown: text, fileHandle: handle, savedMarkdown: text })
          }),
        )

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
  }, [
    fallbackOpenInputRef,
    persistTabsToSession,
    setActiveTabId,
    setStatusMessage,
    setTabs,
    supportsOpenFilePicker,
    syncEditorValueIntoActiveTab,
  ])

  const onFallbackFilePicked = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? [])
      if (selectedFiles.length === 0) return

      syncEditorValueIntoActiveTab()

      const loadedTabs = await Promise.all(
        selectedFiles.map(async (file) => {
          const text = await file.text()
          return makeTab({ fileName: file.name, markdown: text, savedMarkdown: text })
        }),
      )

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
    [persistTabsToSession, setActiveTabId, setStatusMessage, setTabs, syncEditorValueIntoActiveTab],
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
            const tabIndex = prevTabs.findIndex((tab) => tab.id === activeTab.id)
            if (tabIndex === -1) return prevTabs
            const currentTab = prevTabs[tabIndex]
            const nextFileName = handle.name ?? currentTab.fileName
            const noChange =
              currentTab.markdown === content &&
              currentTab.fileHandle === handle &&
              currentTab.fileName === nextFileName &&
              currentTab.savedMarkdown === content &&
              currentTab.isDirty === false
            if (noChange) return prevTabs

            const nextTabs = [...prevTabs]
            nextTabs[tabIndex] = {
              ...currentTab,
              markdown: content,
              fileHandle: handle,
              fileName: nextFileName,
              savedMarkdown: content,
              isDirty: false,
            }
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
        const tabIndex = prevTabs.findIndex((tab) => tab.id === activeTab.id)
        if (tabIndex === -1) return prevTabs
        const currentTab = prevTabs[tabIndex]
        const noChange =
          currentTab.markdown === content &&
          currentTab.savedMarkdown === content &&
          currentTab.isDirty === false
        if (noChange) return prevTabs

        const nextTabs = [...prevTabs]
        nextTabs[tabIndex] = {
          ...currentTab,
          markdown: content,
          savedMarkdown: content,
          isDirty: false,
        }
        persistTabsToSession(nextTabs, currentActiveTabId, { flush: true })
        return nextTabs
      })
      setStatusMessage(`Downloaded ${activeTab.fileName} (save picker unavailable in this browser).`)
    },
    [activeTab, currentActiveTabId, editorRef, persistTabsToSession, setStatusMessage, setTabs, supportsSaveFilePicker],
  )

  return {
    handleOpenFile,
    onFallbackFilePicked,
    handleSaveFile,
  }
}
