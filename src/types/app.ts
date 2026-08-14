export type SaveFileOptions = {
  saveAs?: boolean
}

export type EditorHandle = {
  getMarkdown: () => string
  setMarkdown: (markdown: string) => void
  insertMarkdown: (markdown: string) => void
  focus: () => void
  getContentEditableHTML: () => string
  getSelectionMarkdown: () => string
}

export type AppTab = {
  id: string
  fileName: string
  markdown: string
  fileHandle: FileSystemFileHandle | null
  savedMarkdown: string
  isDirty: boolean
}

export type SessionDraft = {
  tabs: AppTab[]
  activeTabId: string
}
