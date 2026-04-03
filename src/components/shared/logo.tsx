import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  variant?: 'dark' | 'white'
}

const dimensions = {
  sm: 36,
  md: 48,
  lg: 64,
  xl: 80,
  hero: 110,
}

export function Logo({ size = 'md', variant = 'dark' }: LogoProps) {
  const h = dimensions[size]
  const src = variant === 'white' ? '/logo-white.svg' : '/logo.svg'

  return (
    <Image
      src={src}
      alt="PeladeiroPro"
      width={h}
      height={h}
      className="select-none"
      priority={size === 'hero' || size === 'xl'}
    />
  )
}
