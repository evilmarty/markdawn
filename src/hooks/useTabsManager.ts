import { useCallback, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import type { AppTab, EditorHandle, SessionDraft } from '../types/app'
import { makeTab } from '../lib/utils'

type PersistTabsToSession = (
  nextTabs: AppTab[],
  nextActiveTabId: string,
  options?: { flush?: boolean },
) => void

type UseTabsManagerParams = {
  draftFromSession: SessionDraft | null
  defaultMarkdown: string
  editorRef: RefObject<EditorHandle | null>
  persistTabsToSession: PersistTabsToSession
  setStatusMessage: (message: string) => void
}

function updateTabContentIfChanged(
  prevTabs: AppTab[],
  tabId: string,
  updater: (tab: AppTab) => AppTab,
): AppTab[] {
  const tabIndex = prevTabs.findIndex((tab) => tab.id === tabId)
  if (tabIndex === -1) return prevTabs
  const currentTab = prevTabs[tabIndex]
  const nextTab = updater(currentTab)
  if (
    currentTab.markdown === nextTab.markdown &&
    currentTab.savedMarkdown === nextTab.savedMarkdown &&
    currentTab.isDirty === nextTab.isDirty &&
    currentTab.fileHandle === nextTab.fileHandle &&
    currentTab.fileName === nextTab.fileName
  ) {
    return prevTabs
  }
  const nextTabs = [...prevTabs]
  nextTabs[tabIndex] = nextTab
  return nextTabs
}

export function useTabsManager({
  draftFromSession,
  defaultMarkdown,
  editorRef,
  persistTabsToSession,
  setStatusMessage,
}: UseTabsManagerParams) {
  const [tabs, setTabs] = useState<AppTab[]>(() => draftFromSession?.tabs ?? [makeTab({ markdown: defaultMarkdown })])
  const [activeTabId, setActiveTabId] = useState<string | null>(() => draftFromSession?.activeTabId ?? null)

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0], [activeTabId, tabs])
  const currentActiveTabId = activeTab?.id ?? ''

  const syncEditorValueIntoActiveTab = useCallback(() => {
    if (!activeTab) return
    const content = editorRef.current?.getMarkdown()
    if (typeof content !== 'string') return
    setTabs((prevTabs) =>
      updateTabContentIfChanged(prevTabs, activeTab.id, (tab) => {
        const nextIsDirty = content !== tab.savedMarkdown
        return {
          ...tab,
          markdown: content,
          isDirty: nextIsDirty,
        }
      }),
    )
  }, [activeTab, editorRef])

  const handleNewTab = useCallback(() => {
    syncEditorValueIntoActiveTab()
    const nextTab = makeTab({ markdown: defaultMarkdown })
    setTabs((prevTabs) => {
      const nextTabs = [...prevTabs, nextTab]
      persistTabsToSession(nextTabs, nextTab.id, { flush: true })
      return nextTabs
    })
    setActiveTabId(nextTab.id)
    setStatusMessage('Created a new tab.')
  }, [defaultMarkdown, persistTabsToSession, setStatusMessage, syncEditorValueIntoActiveTab])

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
        const resetTab = makeTab({ markdown: defaultMarkdown })
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
      const nextActiveId =
        tabId === currentActiveTabId ? (nextTabs[fallbackIndex] ?? nextTabs[0]).id : currentActiveTabId

      setTabs(nextTabs)
      setActiveTabId(nextActiveId)
      persistTabsToSession(nextTabs, nextActiveId, { flush: true })
      setStatusMessage('Tab closed.')
    },
    [currentActiveTabId, defaultMarkdown, editorRef, persistTabsToSession, setStatusMessage, syncEditorValueIntoActiveTab, tabs],
  )

  const applyEditorChange = useCallback(
    (nextMarkdown: string, initialMarkdownNormalize: boolean) => {
      if (!activeTab) return
      setTabs((prevTabs) => {
        const nextTabs = updateTabContentIfChanged(prevTabs, activeTab.id, (tab) => {
          const nextSavedMarkdown =
            initialMarkdownNormalize && !tab.isDirty ? nextMarkdown : tab.savedMarkdown
          const nextIsDirty =
            initialMarkdownNormalize && !tab.isDirty ? false : nextMarkdown !== tab.savedMarkdown
          return {
            ...tab,
            markdown: nextMarkdown,
            savedMarkdown: nextSavedMarkdown,
            isDirty: nextIsDirty,
          }
        })
        if (nextTabs === prevTabs) return prevTabs
        if (currentActiveTabId) persistTabsToSession(nextTabs, currentActiveTabId)
        return nextTabs
      })
    },
    [activeTab, currentActiveTabId, persistTabsToSession],
  )

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    currentActiveTabId,
    syncEditorValueIntoActiveTab,
    handleNewTab,
    handleSwitchTab,
    handleCloseTab,
    applyEditorChange,
  }
}
