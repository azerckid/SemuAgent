'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

const TYPEWRITER_INTERVAL_MS = 18
const CHARACTERS_PER_TICK = 2

export function SebiseoTypewriter({
  text,
  onComplete,
}: {
  readonly text: string
  readonly onComplete: Dispatch<SetStateAction<boolean>>
}) {
  const [displayedLength, setDisplayedLength] = useState(0)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) {
      setDisplayedLength(text.length)
      return
    }

    let length = 0
    setDisplayedLength(0)
    const intervalId = window.setInterval(() => {
      length = Math.min(text.length, length + CHARACTERS_PER_TICK)
      setDisplayedLength(length)
      if (length >= text.length) window.clearInterval(intervalId)
    }, TYPEWRITER_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [text])

  const isComplete = displayedLength >= text.length

  useEffect(() => {
    if (isComplete) onComplete(true)
  }, [isComplete, onComplete])

  return (
    <p aria-live={isComplete ? 'polite' : 'off'} className='whitespace-pre-wrap'>
      {text.slice(0, displayedLength)}
    </p>
  )
}
