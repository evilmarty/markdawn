import { makeFrontmatterRow } from '../lib/frontmatter'

function FrontmatterDialog({ open, rows, setRows, onCancel, onSave }) {
  if (!open) return null

  return (
    <div className="modal modal-open z-[70]">
      <div className="modal-box w-full max-w-2xl">
        <h3 className="mb-3 text-lg font-semibold">Edit front matter</h3>
        <div className="mb-2 grid grid-cols-[2fr_3fr_auto] gap-2 px-1 text-xs font-semibold text-base-content/70">
          <span>Key</span>
          <span>Value</span>
          <span />
        </div>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={row.id} className="join w-full">
              <input
                className="input input-bordered input-sm join-item w-2/5"
                value={row.key}
                onChange={(event) =>
                  setRows((prevRows) =>
                    prevRows.map((entry) =>
                      entry.id === row.id ? { ...entry, key: event.target.value } : entry,
                    ),
                  )
                }
                autoFocus={index === 0}
              />
              <input
                className="input input-bordered input-sm join-item w-3/5"
                value={row.value}
                onChange={(event) =>
                  setRows((prevRows) =>
                    prevRows.map((entry) =>
                      entry.id === row.id ? { ...entry, value: event.target.value } : entry,
                    ),
                  )
                }
              />
              <button
                className="btn btn-secondary btn-sm join-item"
                type="button"
                aria-label="Remove row"
                onClick={() =>
                  setRows((prevRows) => {
                    const nextRows = prevRows.filter((entry) => entry.id !== row.id)
                    return nextRows.length > 0 ? nextRows : [makeFrontmatterRow()]
                  })
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setRows((prevRows) => [...prevRows, makeFrontmatterRow()])}
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
