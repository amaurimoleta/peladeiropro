'use client'

import { useEffect, useState, useMemo } from 'react'

const COLORS = ['#00C853', '#FFD700', '#4285F4', '#FFFFFF'] // brand green, gold, blue, white
const PARTICLE_COUNT = 40

interface Particle {
  id: number
  x: number        // % from left
  delay: number     // ms
  duration: number  // ms
  color: string
  size: number      // px
  shape: 'circle' | 'square'
  drift: number     // horizontal drift in px
  rotation: number  // end rotation deg
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 600,
    duration: 1400 + Math.random() * 800,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 5 + Math.random() * 6,
    shape: Math.random() > 0.5 ? 'circle' : 'square',
    drift: (Math.random() - 0.5) * 120,
    rotation: Math.random() * 360,
  }))
}

export function Confetti({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false)
  const particles = useMemo(() => generateParticles(), [])

  useEffect(() => {
    if (active) {
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [active])

  if (!visible) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className={`absolute top-0 confetti-particle ${p.shape === 'circle' ? 'rounded-full' : 'rounded-[1px]'}`}
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            '--drift': `${p.drift}px`,
            '--rotation': `${p.rotation}deg`,
          } as React.CSSProperties}
        />
      ))}

      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) translateX(0) rotate(0deg);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rotation));
            opacity: 0;
          }
        }
        .confetti-particle {
          animation: confetti-fall ease-out forwards;
        }
      `}</style>
    </div>
  )
}
