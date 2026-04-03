'use client'

import React from 'react'

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon in gradient circle */}
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-brand-green/20 via-brand-green/10 to-brand-navy/10 flex items-center justify-center animate-bounce-subtle">
          <Icon className="h-9 w-9 text-brand-green" />
        </div>
        {/* Soft glow ring */}
        <div className="absolute inset-0 rounded-full bg-brand-green/5 animate-ping-slow" />
      </div>

      {/* Text */}
      <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>

      {/* Optional action */}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-modern-green text-sm px-5 py-2.5 rounded-lg"
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
