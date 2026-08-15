import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DaisyLinkDialog from './DaisyLinkDialog'

type LinkDialogState =
  | { type: 'inactive'; withAnchorText?: boolean; url?: string; text?: string; title?: string }
  | { type: 'edit'; withAnchorText?: boolean; url?: string; text?: string; title?: string }

const mocks = vi.hoisted(() => ({
  signals: {
    linkDialogState$: Symbol('linkDialogState'),
    showLinkTitleField$: Symbol('showLinkTitleField'),
    updateLink$: Symbol('updateLink'),
    cancelLinkEdit$: Symbol('cancelLinkEdit'),
  },
  state: {
    linkDialogState: { type: 'inactive', withAnchorText: false, url: '', text: '', title: '' } as LinkDialogState,
    showLinkTitleField: false,
  },
  updateLink: vi.fn(),
  cancelLinkEdit: vi.fn(),
}))

vi.mock('@mdxeditor/editor', () => mocks.signals)
vi.mock('@mdxeditor/gurx', () => ({
  useCellValue: (signal: symbol) => {
    if (signal === mocks.signals.linkDialogState$) return mocks.state.linkDialogState
    if (signal === mocks.signals.showLinkTitleField$) return mocks.state.showLinkTitleField
    return null
  },
  usePublisher: (signal: symbol) => {
    if (signal === mocks.signals.updateLink$) return mocks.updateLink
    if (signal === mocks.signals.cancelLinkEdit$) return mocks.cancelLinkEdit
    return vi.fn()
  },
}))

describe('DaisyLinkDialog', () => {
  beforeEach(() => {
    mocks.state.linkDialogState = { type: 'inactive', withAnchorText: false, url: '', text: '', title: '' }
    mocks.state.showLinkTitleField = false
    mocks.updateLink.mockReset()
    mocks.cancelLinkEdit.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when inactive', () => {
    render(<DaisyLinkDialog />)
    expect(screen.queryByText('Edit link')).not.toBeInTheDocument()
  })

  it('submits trimmed values and supports cancel/escape', async () => {
    const user = userEvent.setup()
    mocks.state.linkDialogState = {
      type: 'edit',
      withAnchorText: true,
      url: ' https://example.com ',
      text: ' hello ',
      title: ' t ',
    }
    mocks.state.showLinkTitleField = true
    render(<DaisyLinkDialog />)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mocks.updateLink).toHaveBeenCalledWith({
      url: 'https://example.com',
      text: 'hello',
      title: 't',
    })

    fireEvent.keyDown(screen.getByRole('button', { name: 'Save' }).closest('form')!, { key: 'Escape' })
    expect(mocks.cancelLinkEdit).toHaveBeenCalled()
  })

  it('supports url-only save and cancel buttons', async () => {
    const user = userEvent.setup()
    mocks.state.linkDialogState = { type: 'edit', withAnchorText: false, url: 'https://only-url.test' }
    mocks.state.showLinkTitleField = false
    render(<DaisyLinkDialog />)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mocks.updateLink).toHaveBeenCalledWith({
      url: 'https://only-url.test',
      text: undefined,
      title: undefined,
    })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(mocks.cancelLinkEdit).toHaveBeenCalled()
  })
})
