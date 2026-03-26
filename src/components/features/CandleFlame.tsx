'use client'

import { useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

interface CandleFlameProps {
  className?: string
}

export function CandleFlame({ className }: CandleFlameProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className={cn('inline-flex flex-col items-center', className)} aria-hidden="true">
      {/* Flame */}
      <div
        className={cn(
          'relative mb-[-2px] h-8 w-6 rounded-[50%_50%_50%_50%/65%_65%_35%_35%]',
          !reducedMotion && 'animate-flicker'
        )}
        style={{
          background:
            'radial-gradient(ellipse at bottom, #fff6e6 0%, #ffd700 20%, #ff8c00 50%, #ff4500 80%, transparent 100%)',
          filter: 'blur(0.5px)',
        }}
      >
        {/* Inner flame */}
        <div
          className="absolute bottom-[5px] left-[7px] h-[18px] w-[10px] rounded-full opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at bottom, #ffffcc 0%, #ffeb99 40%, transparent 70%)',
          }}
        />
      </div>

      {/* Glow */}
      <div
        className={cn(
          'absolute -top-3 h-[50px] w-[50px] rounded-full',
          !reducedMotion && 'animate-flicker'
        )}
        style={{
          background: 'radial-gradient(circle, rgba(255,200,100,0.3) 0%, transparent 70%)',
        }}
      />

      {/* Candle body */}
      <div
        className="h-20 w-8 rounded-sm"
        style={{
          background: 'linear-gradient(180deg, #fff8e1 0%, #ffe4b5 30%, #ffd4a3 70%, #ffcc99 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 -10px 15px rgba(139,69,19,0.15)',
        }}
      >
        {/* Wick top */}
        <div
          className="mx-auto -mt-[3px] h-[6px] w-7 rounded-full"
          style={{
            background: 'radial-gradient(ellipse, #8b4513 0%, #a0522d 100%)',
          }}
        />
      </div>
    </div>
  )
}
