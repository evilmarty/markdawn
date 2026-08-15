import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FrontmatterDialog from './FrontmatterDialog'

describe('FrontmatterDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders rows and triggers save/cancel actions', async () => {
    const user = userEvent.setup()
    const setRows = vi.fn()
    const onCancel = vi.fn()
    const onSave = vi.fn()

    render(
      <FrontmatterDialog
        open
        rows={[{ id: '1', key: 'title', value: 'Demo' }]}
        setRows={setRows}
        validation={{ rowErrors: {}, message: null }}
        onRowsEdited={vi.fn()}
        onCancel={onCancel}
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not render when closed', () => {
    render(
      <FrontmatterDialog
        open={false}
        rows={[]}
        setRows={vi.fn()}
        validation={{ rowErrors: {}, message: null }}
        onRowsEdited={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    )
    expect(screen.queryByText('Edit front matter')).not.toBeInTheDocument()
  })

  it('edits rows, shows validation, and supports add/remove', async () => {
    const user = userEvent.setup()
    const setRows = vi.fn()
    const onRowsEdited = vi.fn()

    render(
      <FrontmatterDialog
        open
        rows={[{ id: '1', key: 'title', value: 'Demo' }]}
        setRows={setRows}
        validation={{ rowErrors: { '1': 'Bad yaml' }, message: 'Fix errors' }}
        onRowsEdited={onRowsEdited}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Fix errors')
    expect(screen.getByText('Bad yaml')).toBeInTheDocument()

    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'x')
    await user.type(inputs[1], 'y')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))
    await user.click(screen.getByRole('button', { name: 'Remove row' }))
    expect(onRowsEdited).toHaveBeenCalled()
    expect(setRows).toHaveBeenCalled()
  })
})
