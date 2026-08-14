import { useEffect, useState } from 'react'

function EmojiCycler({ emojis, delay = 1000, className = '' }) {
  const [currentEmojiIndex, setCurrentEmojiIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentEmojiIndex((prevIndex) => (prevIndex + 1) % emojis.length)
    }, delay)

    return () => window.clearInterval(intervalId)
  }, [delay, emojis.length])

  return <span className={`${className} animate-bounce`}>{emojis[currentEmojiIndex]}</span>
}

export default EmojiCycler
