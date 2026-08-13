import { useEffect, useState } from 'react'
import { closeImageDialog$, imageDialogState$, saveImage$ } from '@mdxeditor/editor'
import { useCellValue, usePublisher } from '@mdxeditor/gurx'
import { X } from '../icons'

function normalizeDimension(value) {
  return typeof value === 'number' ? value : ''
}

function parseDimension(value) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function DaisyImageDialog() {
  const imageDialogState = useCellValue(imageDialogState$)
  const closeImageDialog = usePublisher(closeImageDialog$)
  const saveImage = usePublisher(saveImage$)
  const isOpen = imageDialogState.type !== 'inactive'

  const [src, setSrc] = useState('')
  const [altText, setAltText] = useState('')
  const [title, setTitle] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [fileList, setFileList] = useState(null)

  useEffect(() => {
    if (imageDialogState.type === 'editing') {
      const initial = imageDialogState.initialValues
      setSrc(initial.src ?? '')
      setAltText(initial.altText ?? '')
      setTitle(initial.title ?? '')
      setWidth(String(normalizeDimension(initial.width)))
      setHeight(String(normalizeDimension(initial.height)))
      setFileList(null)
      return
    }

    if (imageDialogState.type === 'new') {
      setSrc('')
      setAltText('')
      setTitle('')
      setWidth('')
      setHeight('')
      setFileList(null)
    }
  }, [imageDialogState])

  if (!isOpen) return null

  return (
    <div className="modal modal-open z-[60]">
      <form
        className="modal-box w-full max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          const payload = {
            src: src.trim() || undefined,
            altText: altText.trim() || undefined,
            title: title.trim() || undefined,
            width: parseDimension(width),
            height: parseDimension(height),
          }
          if (fileList && fileList.length > 0) payload.file = fileList
          saveImage(payload)
          closeImageDialog()
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {imageDialogState.type === 'editing' ? 'Edit image' : 'Insert image'}
          </h3>
          <button className="btn btn-sm btn-circle btn-ghost" type="button" onClick={() => closeImageDialog()}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Upload from device</span>
            <input
              className="file-input file-input-bordered w-full"
              type="file"
              accept="image/*"
              onChange={(event) => setFileList(event.target.files)}
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-sm">Image URL or data URL</span>
            <input
              className="input input-bordered w-full font-mono text-sm"
              value={src}
              onChange={(event) => setSrc(event.target.value)}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Alt text</span>
              <input
                className="input input-bordered w-full"
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Title</span>
              <input
                className="input input-bordered w-full"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="modal-action mt-4">
          <button className="btn" type="button" onClick={() => closeImageDialog()}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>
      <button className="modal-backdrop" type="button" onClick={() => closeImageDialog()}>
        Close
      </button>
    </div>
  )
}

export default DaisyImageDialog
