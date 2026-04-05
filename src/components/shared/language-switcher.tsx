'use client'

import { useTranslation } from '@/lib/i18n/provider'
import type { Language } from '@/lib/i18n'
import { Globe } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'pt-BR', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
]

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const current = languages.find((l) => l.code === locale) || languages[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Idioma / Language"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{current.flag}</span>
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px] slide-in-bottom">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLocale(lang.code)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors ${
                locale === lang.code ? 'text-brand-green font-semibold' : 'text-foreground'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
