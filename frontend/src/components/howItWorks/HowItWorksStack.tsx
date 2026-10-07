import { useEffect, useState } from 'react'
import StepCard from './StepCard'
import StepCardCreate from './StepCardCreate'
import StepCardShare from './StepCardShare'
import StepCardSettle from './StepCardSettle'

const INTERVAL_MS = 10000 // 20 s per card

/**
 * Three step-cards stacked on top of each other.
 * Every INTERVAL_MS the next card cycles to the front.
 * The active card is flat (rotate: 0); back cards use their resting rotation.
 */

const CARDS = [
  {
    id: 'create',
    bg: '#FF8904',
    color: '#ffffff',
    /** resting rotation when not active */
    rotation: 8.22,
    content: <StepCardCreate />,
  },
  {
    id: 'share',
    bg: '#1a1a1a',
    color: '#ffffff',
    rotation: -1.07,
    content: <StepCardShare />,
  },
  {
    id: 'settle',
    bg: '#FFEDD4',
    color: '#FF6900',
    rotation: -8.42,
    content: <StepCardSettle />,
  },
]

export default function HowItWorksStack() {
  // Index of the card currently at the front
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % CARDS.length)
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className="relative mx-auto"
      style={{
        width: 'min(413px, 90vw)',
        height: 'min(458px, calc(90vw * 458 / 413))',
      }}
    >
      {CARDS.map((card, i) => {
        const isActive = i === activeIdx
        // Cards behind the active one get progressively lower z-index
        const distanceFromActive = (i - activeIdx + CARDS.length) % CARDS.length
        const zIndex = CARDS.length - distanceFromActive

        return (
          <StepCard
            key={card.id}
            bg={card.bg}
            color={card.color}
            rotation={card.rotation}
            zIndex={zIndex}
            isActive={isActive}
          >
            {card.content}
          </StepCard>
        )
      })}

      {/* Dot indicators */}
      <div
        className="absolute -bottom-8 left-1/2 flex gap-2"
        style={{ transform: 'translateX(-50%)', zIndex: CARDS.length + 1 }}
      >
        {CARDS.map((card, i) => (
          <button
            key={card.id}
            aria-label={`Show step ${i + 1}`}
            onClick={() => setActiveIdx(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === activeIdx ? 20 : 8,
              height: 8,
              background: i === activeIdx ? '#FF6900' : '#d1d5db',
            }}
          />
        ))}
      </div>
    </div>
  )
}
