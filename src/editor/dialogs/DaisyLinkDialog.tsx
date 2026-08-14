import { useEffect, useState } from 'react'
import { cancelLinkEdit$, linkDialogState$, showLinkTitleField$, updateLink$ } from '@mdxeditor/editor'
import { useCellValue, usePublisher } from '@mdxeditor/gurx'

function DaisyLinkDialog() {
  const linkDialogState = useCellValue(linkDialogState$)
  const showLinkTitleField = useCellValue(showLinkTitleField$)
  const updateLink = usePublisher(updateLink$)
  const cancelLinkEdit = usePublisher(cancelLinkEdit$)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (linkDialogState.type !== 'edit') return
    setUrl(linkDialogState.url ?? '')
    setText(linkDialogState.text ?? '')
    setTitle(linkDialogState.title ?? '')
  }, [linkDialogState])

  if (linkDialogState.type !== 'edit') return null

  return (
    <div className="modal modal-open z-[70]">
      <form
        className="modal-box w-full max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          updateLink({
            url: url.trim() || undefined,
            text: linkDialogState.withAnchorText ? text.trim() || undefined : undefined,
            title: showLinkTitleField ? title.trim() || undefined : undefined,
          })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelLinkEdit()
          }
        }}
      >
        <h3 className="mb-3 text-lg font-semibold">Edit link</h3>

        <div className="grid gap-3">
          <label className="form-control">
            <span className="label-text mb-1 text-sm">URL</span>
            <input
              className="input input-bordered w-full"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              autoFocus
            />
          </label>

          {linkDialogState.withAnchorText && (
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Anchor text</span>
              <input
                className="input input-bordered w-full"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </label>
          )}

          {showLinkTitleField && (
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Link title</span>
              <input
                className="input input-bordered w-full"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          )}
        </div>

        <div className="modal-action mt-4">
          <button className="btn" type="button" onClick={() => cancelLinkEdit()}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>
      <button className="modal-backdrop" type="button" onClick={() => cancelLinkEdit()}>
        Close
      </button>
    </div>
  )
}

export default DaisyLinkDialog
