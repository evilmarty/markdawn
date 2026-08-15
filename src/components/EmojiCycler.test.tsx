import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EmojiCycler from './EmojiCycler'

describe('EmojiCycler', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders first emoji and cycles over time', () => {
    vi.useFakeTimers()
    render(<EmojiCycler emojis={['😀', '🚀']} delay={100} className="custom" />)
    const span = screen.getByText('😀')
    expect(span).toHaveClass('custom')
    expect(span).toHaveClass('animate-bounce')

    act(() => {
      vi.advanceTimersByTime(110)
    })
    expect(screen.getByText('🚀')).toBeInTheDocument()
  })
})
