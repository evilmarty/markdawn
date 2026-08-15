import type { Dispatch, SetStateAction } from 'react'
import { X } from 'lucide-react'
import { makeFrontmatterRow } from '../lib/frontmatter'
import type { FrontmatterRow } from '../lib/frontmatter'

type FrontmatterDialogProps = {
  open: boolean
  rows: FrontmatterRow[]
  setRows: Dispatch<SetStateAction<FrontmatterRow[]>>
  validation: {
    rowErrors: Record<string, string>
    message: string | null
  }
  onRowsEdited: () => void
  onCancel: () => void
  onSave: () => void
}

function FrontmatterDialog({
  open,
  rows,
  setRows,
  validation,
  onRowsEdited,
  onCancel,
  onSave,
}: FrontmatterDialogProps) {
  if (!open) return null

  return (
    <div className="modal modal-open z-[70]">
      <div className="modal-box w-full max-w-2xl">
        <h3 className="mb-3 text-lg font-semibold">Edit front matter</h3>
        {validation.message && (
          <div className="alert alert-error mb-3 py-2" role="alert">
            <span>{validation.message}</span>
          </div>
        )}
        <div className="mb-2 grid grid-cols-[2fr_3fr_auto] gap-2 px-1 text-xs font-semibold text-base-content/70">
          <span>Key</span>
          <span>Value</span>
          <span />
        </div>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={row.id} className="space-y-1">
              <div className="join w-full">
                <input
                  className={`input input-bordered input-sm join-item w-2/5${validation.rowErrors[row.id] ? ' input-error' : ''}`}
                  value={row.key}
                  onChange={(event) => {
                    onRowsEdited()
                    setRows((prevRows) =>
                      prevRows.map((entry) =>
                        entry.id === row.id ? { ...entry, key: event.target.value } : entry,
                      ),
                    )
                  }}
                  autoFocus={index === 0}
                />
                <input
                  className={`input input-bordered input-sm join-item w-3/5${validation.rowErrors[row.id] ? ' input-error' : ''}`}
                  value={row.value}
                  onChange={(event) => {
                    onRowsEdited()
                    setRows((prevRows) =>
                      prevRows.map((entry) =>
                        entry.id === row.id ? { ...entry, value: event.target.value } : entry,
                      ),
                    )
                  }}
                />
                <button
                  className="btn btn-secondary btn-sm join-item"
                  type="button"
                  aria-label="Remove row"
                  onClick={() => {
                    onRowsEdited()
                    setRows((prevRows) => {
                      const nextRows = prevRows.filter((entry) => entry.id !== row.id)
                      return nextRows.length > 0 ? nextRows : [makeFrontmatterRow()]
                    })
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {validation.rowErrors[row.id] && <p className="px-1 text-xs text-error">{validation.rowErrors[row.id]}</p>}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              onRowsEdited()
              setRows((prevRows) => [...prevRows, makeFrontmatterRow()])
            }}
          >
            Add entry
          </button>
          <div className="flex gap-2">
            <button className="btn" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" onClick={onSave}>
              Save
            </button>
          </div>
        </div>
      </div>
      <button className="modal-backdrop" type="button" onClick={onCancel}>
        Close
      </button>
    </div>
  )
}

export default FrontmatterDialog
