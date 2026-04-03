interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  variant?: 'full' | 'icon'
}

const dimensions = {
  sm: { height: 32, fontSize: 22, ballSize: 18 },
  md: { height: 40, fontSize: 28, ballSize: 22 },
  lg: { height: 52, fontSize: 36, ballSize: 28 },
  xl: { height: 68, fontSize: 48, ballSize: 38 },
  hero: { height: 90, fontSize: 64, ballSize: 50 },
}

function SoccerBall({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="flex-shrink-0"
      style={{ marginTop: size * -0.08 }}
    >
      {/* Ball shadow */}
      <ellipse cx="50" cy="96" rx="28" ry="4" fill="black" opacity="0.08" />
      {/* Main ball */}
      <defs>
        <radialGradient id="ballGrad" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#e8e8e8" />
          <stop offset="100%" stopColor="#d0d0d0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="48" r="42" fill="url(#ballGrad)" stroke="#bbb" strokeWidth="1.5" />
      {/* Pentagon patches */}
      <polygon points="50,20 58,28 55,38 45,38 42,28" fill="#2a2a2a" />
      <polygon points="72,36 78,46 72,55 63,50 64,40" fill="#2a2a2a" />
      <polygon points="28,36 36,40 37,50 28,55 22,46" fill="#2a2a2a" />
      <polygon points="36,65 45,60 55,60 64,65 58,75 42,75" fill="#2a2a2a" />
      {/* Lines connecting patches */}
      <line x1="50" y1="6" x2="50" y2="20" stroke="#ccc" strokeWidth="0.8" />
      <line x1="58" y1="28" x2="64" y2="40" stroke="#ccc" strokeWidth="0.8" />
      <line x1="42" y1="28" x2="36" y2="40" stroke="#ccc" strokeWidth="0.8" />
      <line x1="55" y1="38" x2="55" y2="60" stroke="#ccc" strokeWidth="0.8" />
      <line x1="45" y1="38" x2="45" y2="60" stroke="#ccc" strokeWidth="0.8" />
      <line x1="72" y1="55" x2="64" y2="65" stroke="#ccc" strokeWidth="0.8" />
      <line x1="28" y1="55" x2="36" y2="65" stroke="#ccc" strokeWidth="0.8" />
      <line x1="78" y1="46" x2="88" y2="42" stroke="#ccc" strokeWidth="0.8" />
      <line x1="22" y1="46" x2="12" y2="42" stroke="#ccc" strokeWidth="0.8" />
      <line x1="42" y1="75" x2="38" y2="85" stroke="#ccc" strokeWidth="0.8" />
      <line x1="58" y1="75" x2="62" y2="85" stroke="#ccc" strokeWidth="0.8" />
      {/* Highlight */}
      <circle cx="38" cy="32" r="8" fill="white" opacity="0.3" />
    </svg>
  )
}

export function Logo({ size = 'md', variant = 'full' }: LogoProps) {
  const d = dimensions[size]

  if (variant === 'icon') {
    return <SoccerBall size={d.ballSize * 1.5} />
  }

  return (
    <div className="flex items-center select-none" style={{ height: d.height }}>
      <span
        style={{
          fontSize: d.fontSize,
          color: '#1B1F4B',
          fontFamily: 'var(--font-jakarta), var(--font-inter), system-ui, sans-serif',
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: '-0.02em',
        }}
      >
        peladeiro
      </span>
      <SoccerBall size={d.ballSize} />
      <span
        style={{
          fontSize: d.fontSize,
          color: '#00C853',
          fontFamily: 'var(--font-jakarta), var(--font-inter), system-ui, sans-serif',
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: '-0.02em',
        }}
      >
        pro.
      </span>
    </div>
  )
}
