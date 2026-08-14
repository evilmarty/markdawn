import { openEditImageDialog$ } from '@mdxeditor/editor'
import { usePublisher } from '@mdxeditor/gurx'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey } from 'lexical'
import { Pencil, X } from '../icons'

function DaisyEditImageToolbar({ nodeKey, imageSource, initialImagePath, title, alt, width, height }) {
  const openEditImageDialog = usePublisher(openEditImageDialog$)
  const [editor] = useLexicalComposerContext()

  return (
    <ul className="mdx-image-edit-toolbar menu menu-xs menu-horizontal absolute right-2 top-2 z-10 rounded-box border border-base-300 bg-base-100/90 p-1 shadow backdrop-blur-sm">
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
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
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
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
  )
}

export default DaisyEditImageToolbar
