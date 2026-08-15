import type { AppTab, SessionDraft } from '../types/app'

export const SESSION_STORAGE_KEY = 'markdawn.session.v1'

type MakeTabOptions = Partial<Omit<AppTab, 'id' | 'isDirty'>> & {
  id?: string
  isDirty?: boolean
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
  markdown = '',
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

export function loadDraftFromSession(sessionKey = SESSION_STORAGE_KEY): SessionDraft | null {
  try {
    const rawSession = sessionStorage.getItem(sessionKey)
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
