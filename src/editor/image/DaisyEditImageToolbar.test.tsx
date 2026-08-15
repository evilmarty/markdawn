import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DaisyEditImageToolbar from './DaisyEditImageToolbar'

const mocks = vi.hoisted(() => ({
  openEditImageDialog$: Symbol('openEditImageDialog'),
  openEditImageDialog: vi.fn(),
  remove: vi.fn(),
  update: vi.fn((callback: () => void) => callback()),
}))

vi.mock('@mdxeditor/editor', () => ({ openEditImageDialog$: mocks.openEditImageDialog$ }))
vi.mock('@mdxeditor/gurx', () => ({
  usePublisher: (signal: symbol) => (signal === mocks.openEditImageDialog$ ? mocks.openEditImageDialog : vi.fn()),
}))
vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [{ update: mocks.update }],
}))
vi.mock('lexical', () => ({
  $getNodeByKey: () => ({ remove: mocks.remove }),
}))
vi.mock('../icons', () => ({
  Pencil: () => null,
  X: () => null,
}))

describe('DaisyEditImageToolbar', () => {
  beforeEach(() => {
    mocks.openEditImageDialog.mockReset()
    mocks.remove.mockReset()
    mocks.update.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('returns null when required props are missing', () => {
    const { container } = render(<DaisyEditImageToolbar />)
    expect(container.firstChild).toBeNull()
  })

  it('opens edit dialog and removes image', async () => {
    const user = userEvent.setup()
    render(<DaisyEditImageToolbar nodeKey="n1" imageSource="source.png" initialImagePath="initial.png" alt="a" title="t" width={10} height={20} />)

    await user.click(screen.getByRole('button', { name: 'Edit image' }))
    expect(mocks.openEditImageDialog).toHaveBeenCalledWith({
      nodeKey: 'n1',
      initialValues: {
        src: 'initial.png',
        title: 't',
        altText: 'a',
        width: 10,
        height: 20,
      },
    })

    await user.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(mocks.update).toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalled()
  })
})
