import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  variant?: 'dark' | 'white'
}

// Logo SVG is 600x110 (aspect ratio ~5.45:1)
// Heights defined per size, widths calculated from aspect ratio
const heights = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 56,
  hero: 72,
}

const ASPECT_RATIO = 600 / 110 // ~5.45

export function Logo({ size = 'md', variant = 'dark' }: LogoProps) {
  const h = heights[size]
  const w = Math.round(h * ASPECT_RATIO)
  const src = variant === 'white' ? '/logo-white.svg' : '/logo.svg'

  return (
    <Image
      src={src}
      alt="PeladeiroPro"
      width={w}
      height={h}
      className="select-none"
      priority={size === 'hero' || size === 'xl'}
    />
  )
}
