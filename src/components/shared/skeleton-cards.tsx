'use client'

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card-modern-elevated rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-lg bg-muted animate-pulse" />
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
            <div className="h-3 w-32 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <div className="card-modern-elevated rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-muted/30">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded-md bg-muted animate-pulse"
            style={{ width: `${Math.floor(100 / cols)}%` }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-4 rounded-md bg-muted animate-pulse"
              style={{
                width: `${Math.floor(100 / cols)}%`,
                animationDelay: `${(rowIdx * cols + colIdx) * 75}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card-modern-elevated rounded-xl p-4 flex items-center gap-4"
        >
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div
              className="h-4 w-3/5 rounded-md bg-muted animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
            <div
              className="h-3 w-2/5 rounded-md bg-muted animate-pulse"
              style={{ animationDelay: `${i * 100 + 50}ms` }}
            />
          </div>
          <div
            className="h-8 w-16 rounded-lg bg-muted animate-pulse shrink-0"
            style={{ animationDelay: `${i * 100 + 100}ms` }}
          />
        </div>
      ))}
    </div>
  )
}
