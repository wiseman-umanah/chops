import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export interface StepCardProps {
  /** Card background colour / gradient */
  bg: string
  /** Default text colour on this card */
  color: string
  /** Rotation in degrees — positive = clockwise */
  rotation: number
  /** z-index controlling stack order */
  zIndex: number
  /** Whether this card is the front-most (active) */
  isActive: boolean
  /** Framer-motion animation delay */
  animDelay?: number
  children: ReactNode
}

/**
 * Base card shell shared by all three "How it works" step cards.
 * Fixed dimensions match the Figma spec: 413 × 458 px, 18 px border-radius.
 * Pass `rotation` per card and control stack order via `zIndex` + `isActive`.
 */
export default function StepCard({
  bg,
  color,
  rotation,
  zIndex,
  isActive,
  animDelay = 0,
  children,
}: StepCardProps) {
  return (
    <motion.div
      className="absolute top-0 left-1/2 overflow-hidden"
      style={{
        width: 'min(413px, 90vw)',
        height: 'min(458px, calc(90vw * 458 / 413))',
        borderRadius: 18,
        background: bg,
        color,
        zIndex,
        x: '-50%',
        transformOrigin: 'center bottom',
      }}
      animate={{
        rotate: rotation,
        scale: isActive ? 1 : 0.96,
        y: isActive ? 0 : 12,
      }}
      transition={{
        duration: 0.65,
        delay: animDelay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
