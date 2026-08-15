import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DaisyImageDialog from './DaisyImageDialog'

const mocks = vi.hoisted(() => ({
  signals: {
    imageDialogState$: Symbol('imageDialogState'),
    closeImageDialog$: Symbol('closeImageDialog'),
    saveImage$: Symbol('saveImage'),
  },
  state: {
    imageDialogState: { type: 'inactive' } as
      | { type: 'inactive' }
      | { type: 'new' }
      | { type: 'editing'; initialValues: { src?: string; altText?: string; title?: string; width?: number; height?: number } },
  },
  closeImageDialog: vi.fn(),
  saveImage: vi.fn(),
}))

vi.mock('@mdxeditor/editor', () => mocks.signals)
vi.mock('@mdxeditor/gurx', () => ({
  useCellValue: (signal: symbol) => (signal === mocks.signals.imageDialogState$ ? mocks.state.imageDialogState : null),
  usePublisher: (signal: symbol) => {
    if (signal === mocks.signals.closeImageDialog$) return mocks.closeImageDialog
    if (signal === mocks.signals.saveImage$) return mocks.saveImage
    return vi.fn()
  },
}))

vi.mock('../icons', () => ({ X: () => null }))

describe('DaisyImageDialog', () => {
  beforeEach(() => {
    mocks.state.imageDialogState = { type: 'inactive' }
    mocks.closeImageDialog.mockReset()
    mocks.saveImage.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when inactive', () => {
    render(<DaisyImageDialog />)
    expect(screen.queryByText('Insert image')).not.toBeInTheDocument()
  })

  it('submits edited image payload and closes', async () => {
    const user = userEvent.setup()
    mocks.state.imageDialogState = {
      type: 'editing',
      initialValues: { src: ' https://x ', altText: ' alt ', title: ' title ', width: 100, height: 200 },
    }
    render(<DaisyImageDialog />)

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: ' https://img ' } })
    fireEvent.change(inputs[1], { target: { value: ' alt text ' } })
    fireEvent.change(inputs[2], { target: { value: ' title text ' } })

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mocks.saveImage).toHaveBeenCalledWith({
      src: 'https://img',
      altText: 'alt text',
      title: 'title text',
      width: 100,
      height: 200,
    })
    expect(mocks.closeImageDialog).toHaveBeenCalled()
  })

  it('handles new image flow and cancel actions', async () => {
    const user = userEvent.setup()
    mocks.state.imageDialogState = { type: 'new' }
    render(<DaisyImageDialog />)

    const fileInput = screen.getByLabelText('Upload from device') as HTMLInputElement
    const file = new File(['img'], 'img.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(mocks.closeImageDialog).toHaveBeenCalled()
  })
})
