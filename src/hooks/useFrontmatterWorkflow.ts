import { useCallback, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import {
  applyFrontmatter,
  makeFrontmatterRow,
  parseFrontmatterRows,
  rowsToFrontmatter,
  validateFrontmatterRows,
} from '../lib/frontmatter'
import type { FrontmatterRow } from '../lib/frontmatter'
import type { AppTab, EditorHandle } from '../types/app'

type PersistTabsToSession = (
  nextTabs: AppTab[],
  nextActiveTabId: string,
  options?: { flush?: boolean },
) => void

type FrontmatterValidationState = {
  message: string | null
  rowErrors: Record<string, string>
}

type UseFrontmatterWorkflowParams = {
  activeTab: AppTab | null
  currentActiveTabId: string
  editorRef: RefObject<EditorHandle | null>
  persistTabsToSession: PersistTabsToSession
  setStatusMessage: (message: string) => void
  setTabs: Dispatch<SetStateAction<AppTab[]>>
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

export function useFrontmatterWorkflow({
  activeTab,
  currentActiveTabId,
  editorRef,
  persistTabsToSession,
  setStatusMessage,
  setTabs,
}: UseFrontmatterWorkflowParams) {
  const [frontmatterDialogOpen, setFrontmatterDialogOpen] = useState(false)
  const [frontmatterRows, setFrontmatterRows] = useState<FrontmatterRow[]>(() => [makeFrontmatterRow()])
  const [frontmatterValidation, setFrontmatterValidation] = useState<FrontmatterValidationState>(
    () => emptyFrontmatterValidationState(),
  )

  const clearFrontmatterValidationState = useCallback(() => {
    setFrontmatterValidation(emptyFrontmatterValidationState())
  }, [])

  const handleOpenFrontmatterDialog = useCallback(() => {
    if (!activeTab) return
    const content = editorRef.current?.getMarkdown() ?? activeTab.markdown
    setFrontmatterRows(parseFrontmatterRows(content))
    setFrontmatterValidation(emptyFrontmatterValidationState())
    setFrontmatterDialogOpen(true)
  }, [activeTab, editorRef])

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
      const tabIndex = prevTabs.findIndex((tab) => tab.id === activeTab.id)
      if (tabIndex === -1) return prevTabs
      const currentTab = prevTabs[tabIndex]
      const nextIsDirty = nextContent !== currentTab.savedMarkdown
      if (currentTab.markdown === nextContent && currentTab.isDirty === nextIsDirty) {
        return prevTabs
      }
      const nextTabs = [...prevTabs]
      nextTabs[tabIndex] = {
        ...currentTab,
        markdown: nextContent,
        isDirty: nextIsDirty,
      }
      persistTabsToSession(nextTabs, currentActiveTabId, { flush: true })
      return nextTabs
    })
    clearFrontmatterValidationState()
    setFrontmatterDialogOpen(false)
    setStatusMessage('Updated front matter.')
  }, [
    activeTab,
    clearFrontmatterValidationState,
    currentActiveTabId,
    editorRef,
    frontmatterRows,
    persistTabsToSession,
    setStatusMessage,
    setTabs,
  ])

  return {
    frontmatterDialogOpen,
    setFrontmatterDialogOpen,
    frontmatterRows,
    setFrontmatterRows,
    frontmatterValidation,
    clearFrontmatterValidationState,
    handleOpenFrontmatterDialog,
    handleSaveFrontmatter,
  }
}
