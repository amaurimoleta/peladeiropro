'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { getTranslation, DEFAULT_LOCALE, type Language, type Translations } from './index'

interface I18nContextValue {
  locale: Language
  t: Translations
  setLocale: (locale: Language) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

interface I18nProviderProps {
  children: ReactNode
  initialLocale?: Language
}

export function I18nProvider({ children, initialLocale = DEFAULT_LOCALE }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Language>(initialLocale)

  const setLocale = useCallback((newLocale: Language) => {
    setLocaleState(newLocale)
  }, [])

  const t = getTranslation(locale)

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return context
}
