import { useMemo } from 'react'
import type { RefObject } from 'react'
import type { JSX } from 'react'
import {
  codeBlockPlugin,
  codeMirrorPlugin,
  frontmatterPlugin,
  headingsPlugin,
  imagePlugin,
  lexicalTheme as mdxLexicalTheme,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import DaisyImageDialog from './editor/dialogs/DaisyImageDialog'
import DaisyLinkDialog from './editor/dialogs/DaisyLinkDialog'
import DaisyEditImageToolbar from './editor/image/DaisyEditImageToolbar'
import EditorToolbar from './editor/Toolbar'
import type { AppTab, EditorHandle, SaveFileOptions } from './types/app'

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

export type EditorWorkspaceProps = {
  activeTab: AppTab | null
  editorRef: RefObject<EditorHandle | null>
  hasFrontmatter: boolean
  mobileSidebarOpen: boolean
  desktopSidebarOpen: boolean
  onChange: (nextMarkdown: string, initialMarkdownNormalize: boolean) => void
  onSaveFile: (options?: SaveFileOptions) => Promise<void>
  onToggleMobileSidebar: () => void
  onToggleDesktopSidebar: () => void
  onOpenFrontmatterDialog: () => void
  saveButtonClass: string
  supportsSaveFilePicker: boolean
  imageUploadHandler: (imageFile: File) => Promise<string>
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
}: EditorWorkspaceProps) {
  const plugins = useMemo(
    () => [
      toolbarPlugin({
        toolbarContents: (): JSX.Element => (
          <EditorToolbar
            hasFrontmatter={hasFrontmatter}
            mobileSidebarOpen={mobileSidebarOpen}
            desktopSidebarOpen={desktopSidebarOpen}
            onSaveFile={onSaveFile}
            onToggleMobileSidebar={onToggleMobileSidebar}
            onToggleDesktopSidebar={onToggleDesktopSidebar}
            onOpenFrontmatterDialog={onOpenFrontmatterDialog}
            saveButtonClass={saveButtonClass}
            supportsSaveFilePicker={supportsSaveFilePicker}
          />
        ),
      }),
      headingsPlugin(),
      frontmatterPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin({ LinkDialog: DaisyLinkDialog as unknown as () => JSX.Element }),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
      codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
      markdownShortcutPlugin(),
      imagePlugin({
        imageUploadHandler,
        ImageDialog: DaisyImageDialog,
        EditImageToolbar: DaisyEditImageToolbar as unknown as () => JSX.Element,
      }),
    ],
    [
      hasFrontmatter,
      mobileSidebarOpen,
      desktopSidebarOpen,
      onSaveFile,
      onToggleMobileSidebar,
      onToggleDesktopSidebar,
      onOpenFrontmatterDialog,
      saveButtonClass,
      supportsSaveFilePicker,
      imageUploadHandler,
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
