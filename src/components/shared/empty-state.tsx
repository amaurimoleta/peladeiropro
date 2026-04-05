'use client'

import React from 'react'

type IllustrationType = 'empty-box' | 'no-data' | 'soccer' | 'money' | 'team' | 'calendar'
type SizeVariant = 'sm' | 'md' | 'lg'

interface EmptyStateProps {
  icon?: React.ElementType
  illustration?: IllustrationType
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  size?: SizeVariant
}

const sizeConfig = {
  sm: {
    wrapper: 'py-10 px-3',
    iconContainer: 'h-14 w-14',
    iconSize: 'h-6 w-6',
    svgSize: 64,
    title: 'text-base',
    description: 'text-xs max-w-xs',
    button: 'text-xs px-4 py-2',
    gap: 'mb-4',
  },
  md: {
    wrapper: 'py-16 px-4',
    iconContainer: 'h-20 w-20',
    iconSize: 'h-9 w-9',
    svgSize: 96,
    title: 'text-lg',
    description: 'text-sm max-w-sm',
    button: 'text-sm px-5 py-2.5',
    gap: 'mb-6',
  },
  lg: {
    wrapper: 'py-24 px-6',
    iconContainer: 'h-28 w-28',
    iconSize: 'h-12 w-12',
    svgSize: 132,
    title: 'text-xl',
    description: 'text-base max-w-md',
    button: 'text-base px-6 py-3',
    gap: 'mb-8',
  },
}

/* ------------------------------------------------------------------ */
/*  Inline SVG illustrations                                          */
/* ------------------------------------------------------------------ */

function EmptyBoxIllustration({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Box body */}
      <path
        d="M20 40L48 28L76 40V68L48 80L20 68V40Z"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Box center divider */}
      <path
        d="M48 80V52"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Box top-left edge */}
      <path
        d="M20 40L48 52L76 40"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Left flap */}
      <path
        d="M20 40L32 28L48 28"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
      {/* Right flap */}
      <path
        d="M76 40L64 28L48 28"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
      {/* Open flap left */}
      <path
        d="M20 40L12 32"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Open flap right */}
      <path
        d="M76 40L84 32"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Sparkle dots */}
      <circle cx="48" cy="18" r="1.5" className="fill-[#00C853] dark:fill-[#00E676]" opacity="0.5" />
      <circle cx="38" cy="22" r="1" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.4" />
      <circle cx="58" cy="22" r="1" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.4" />
    </svg>
  )
}

function NoDataIllustration({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Clipboard body */}
      <rect
        x="24" y="18" width="48" height="62" rx="4"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Clipboard clip */}
      <path
        d="M38 18V14C38 12.8954 38.8954 12 40 12H56C57.1046 12 58 12.8954 58 14V18"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Clip top bar */}
      <rect
        x="42" y="10" width="12" height="4" rx="2"
        className="fill-[#1B1F4B] dark:fill-[#8B8FC7]"
        opacity="0.5"
      />
      {/* Empty lines */}
      <line x1="34" y1="36" x2="62" y2="36" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <line x1="34" y1="46" x2="56" y2="46" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
      <line x1="34" y1="56" x2="58" y2="56" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="2" strokeLinecap="round" opacity="0.1" />
      {/* Question mark */}
      <path
        d="M44 64C44 60 48 58 48 58C48 58 52 60 52 64"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <circle cx="48" cy="70" r="1.2" className="fill-[#00C853] dark:fill-[#00E676]" opacity="0.6" />
    </svg>
  )
}

function SoccerIllustration({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ball outline */}
      <circle
        cx="48" cy="48" r="26"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Pentagon pattern */}
      <path
        d="M48 30L56 38L53 48L43 48L40 38Z"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      {/* Connecting lines to edge */}
      <line x1="48" y1="30" x2="48" y2="22" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="1.5" opacity="0.3" />
      <line x1="56" y1="38" x2="63" y2="33" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="1.5" opacity="0.3" />
      <line x1="53" y1="48" x2="62" y2="54" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="1.5" opacity="0.3" />
      <line x1="43" y1="48" x2="34" y2="54" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="1.5" opacity="0.3" />
      <line x1="40" y1="38" x2="33" y2="33" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="1.5" opacity="0.3" />
      {/* Bottom pentagons partial */}
      <path
        d="M43 48L38 56L44 64L52 64L58 56L53 48"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      {/* Sparkle top-right */}
      <path
        d="M78 16L80 20L84 18L80 22L78 26L76 22L72 24L76 20Z"
        className="fill-[#00C853] dark:fill-[#00E676]"
        opacity="0.6"
      />
      {/* Sparkle small */}
      <circle cx="18" cy="28" r="1.5" className="fill-[#00C853] dark:fill-[#00E676]" opacity="0.4" />
      <circle cx="80" cy="68" r="1.5" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.3" />
      {/* Sparkle bottom-left */}
      <path
        d="M16 70L17 73L20 72L17 74L16 77L15 74L12 75L15 73Z"
        className="fill-[#00C853] dark:fill-[#00E676]"
        opacity="0.4"
      />
    </svg>
  )
}

function MoneyIllustration({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bill background */}
      <rect
        x="16" y="32" width="52" height="32" rx="3"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Bill inner border */}
      <rect
        x="22" y="38" width="40" height="20" rx="2"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="1.5"
        fill="none"
        opacity="0.25"
      />
      {/* Dollar sign on bill */}
      <path
        d="M42 42V54M38 45C38 43.3 39.8 42 42 42C44.2 42 46 43.3 46 45C46 46.7 44.2 48 42 48C39.8 48 38 49.3 38 51C38 52.7 39.8 54 42 54C44.2 54 46 52.7 46 51"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Coin 1 */}
      <ellipse
        cx="72" cy="52" rx="12" ry="12"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2.5"
        fill="none"
        opacity="0.7"
      />
      <ellipse
        cx="72" cy="52" rx="8" ry="8"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      {/* Coin dollar */}
      <text
        x="72" y="56"
        textAnchor="middle"
        className="fill-[#1B1F4B] dark:fill-[#8B8FC7]"
        fontSize="12"
        fontWeight="bold"
        opacity="0.5"
      >$</text>
      {/* Coin 2 (stacked behind) */}
      <ellipse
        cx="72" cy="46" rx="12" ry="4"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      {/* Floating sparkle */}
      <circle cx="28" cy="24" r="1.5" className="fill-[#00C853] dark:fill-[#00E676]" opacity="0.5" />
      <circle cx="80" cy="32" r="1" className="fill-[#00C853] dark:fill-[#00E676]" opacity="0.4" />
    </svg>
  )
}

function TeamIllustration({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Center person (front) */}
      <circle
        cx="48" cy="34" r="8"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="M32 68C32 56 39 50 48 50C57 50 64 56 64 68"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Left person */}
      <circle
        cx="24" cy="38" r="6"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M12 66C12 56 17 52 24 52C28 52 31 53.5 33 56"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Right person */}
      <circle
        cx="72" cy="38" r="6"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M84 66C84 56 79 52 72 52C68 52 65 53.5 63 56"
        className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Connection dots */}
      <circle cx="36" cy="76" r="1.5" className="fill-[#00C853] dark:fill-[#00E676]" opacity="0.3" />
      <circle cx="48" cy="78" r="1.5" className="fill-[#00C853] dark:fill-[#00E676]" opacity="0.4" />
      <circle cx="60" cy="76" r="1.5" className="fill-[#00C853] dark:fill-[#00E676]" opacity="0.3" />
    </svg>
  )
}

function CalendarIllustration({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Calendar body */}
      <rect
        x="18" y="24" width="60" height="56" rx="4"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Header bar */}
      <line x1="18" y1="40" x2="78" y2="40" className="stroke-[#00C853] dark:stroke-[#00E676]" strokeWidth="2.5" />
      {/* Hanger rings */}
      <line x1="34" y1="18" x2="34" y2="30" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <line x1="62" y1="18" x2="62" y2="30" className="stroke-[#1B1F4B] dark:stroke-[#8B8FC7]" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      {/* Grid dots for days */}
      <circle cx="30" cy="50" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.2" />
      <circle cx="42" cy="50" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.2" />
      <circle cx="54" cy="50" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.2" />
      <circle cx="66" cy="50" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.2" />
      <circle cx="30" cy="60" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.2" />
      <circle cx="42" cy="60" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.2" />
      <circle cx="66" cy="60" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.2" />
      <circle cx="30" cy="70" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.15" />
      <circle cx="42" cy="70" r="2" className="fill-[#1B1F4B] dark:fill-[#8B8FC7]" opacity="0.15" />
      {/* Checkmark circle highlight */}
      <circle
        cx="54" cy="64" r="10"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2"
        fill="none"
        opacity="0.3"
      />
      {/* Checkmark */}
      <path
        d="M49 64L52 67L59 60"
        className="stroke-[#00C853] dark:stroke-[#00E676]"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Illustration map                                                   */
/* ------------------------------------------------------------------ */

const illustrationMap: Record<IllustrationType, React.FC<{ size: number }>> = {
  'empty-box': EmptyBoxIllustration,
  'no-data': NoDataIllustration,
  'soccer': SoccerIllustration,
  'money': MoneyIllustration,
  'team': TeamIllustration,
  'calendar': CalendarIllustration,
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  size = 'md',
}: EmptyStateProps) {
  const s = sizeConfig[size]
  const IllustrationComponent = illustration ? illustrationMap[illustration] : null

  return (
    <div className={`flex flex-col items-center justify-center ${s.wrapper} text-center`}>
      {/* Visual: illustration or icon */}
      <div className={`relative ${s.gap}`}>
        {IllustrationComponent ? (
          <div className="animate-bounce-subtle">
            <IllustrationComponent size={s.svgSize} />
          </div>
        ) : Icon ? (
          <div
            className={`${s.iconContainer} rounded-full bg-gradient-to-br from-brand-green/20 via-brand-green/10 to-brand-navy/10 flex items-center justify-center animate-bounce-subtle`}
          >
            <Icon className={`${s.iconSize} text-brand-green`} />
          </div>
        ) : null}
        {/* Soft glow ring (only shown for icon mode) */}
        {Icon && !IllustrationComponent && (
          <div className="absolute inset-0 rounded-full bg-brand-green/5 animate-ping-slow" />
        )}
      </div>

      {/* Text */}
      <h3 className={`${s.title} font-heading font-semibold text-foreground mb-2`}>
        {title}
      </h3>
      <p className={`${s.description} text-muted-foreground ${s.gap}`}>
        {description}
      </p>

      {/* Optional action */}
      {action && (
        <button
          onClick={action.onClick}
          className={`btn-modern-green ${s.button} rounded-lg`}
        >
          {action.label}
        </button>
      )}

      {/* Inline keyframes for the subtle bounce and slow ping */}
      <style jsx>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.4; }
          75%, 100% { transform: scale(1.4); opacity: 0; }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2.5s ease-in-out infinite;
        }
        .animate-ping-slow {
          animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  )
}
