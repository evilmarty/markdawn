/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface OpenFilePickerOptions {
  multiple?: boolean
  types?: FilePickerAcceptType[]
  excludeAcceptAllOption?: boolean
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
}

interface FileSystemWritableFileStream {
  write: (data: string | Blob) => Promise<void>
  close: () => Promise<void>
}

interface FileSystemFileHandle {
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<FileSystemWritableFileStream>
}

interface Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}
