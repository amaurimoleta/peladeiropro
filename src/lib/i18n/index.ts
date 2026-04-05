import ptBR from './locales/pt-BR'
import en from './locales/en'

export type Language = 'pt-BR' | 'en'

export interface Translations {
  common: {
    save: string
    cancel: string
    delete: string
    edit: string
    add: string
    loading: string
    search: string
    filter: string
    back: string
    next: string
    previous: string
    confirm: string
    close: string
    share: string
    copy: string
    copied: string
    noData: string
    seeMore: string
    error: string
    success: string
  }
  nav: {
    dashboard: string
    myArea: string
    matches: string
    tournaments: string
    teams: string
    members: string
    finance: string
    settings: string
    gameDay: string
    logout: string
  }
  dashboard: {
    greeting: { morning: string; afternoon: string; evening: string }
    groupBalance: string
    accumulatedBalance: string
    initialBalance: string
    revenue: string
    expenses: string
    finalBalance: string
    monthlyFees: string
    guestPlayers: string
    overdue: string
    paid: string
    pending: string
    totalRevenue: string
    totalExpenses: string
  }
  members: {
    title: string
    addMember: string
    name: string
    phone: string
    role: string
    position: string
    team: string
    type: string
    active: string
    inactive: string
    admin: string
    treasurer: string
    member: string
  }
  finance: {
    title: string
    fees: string
    guests: string
    expensesTab: string
    revenueTab: string
    dre: string
    generateFees: string
    markAsPaid: string
    addExpense: string
    addRevenue: string
    addGuest: string
    amount: string
    date: string
    status: string
    category: string
    description: string
    receipt: string
  }
  gameDay: {
    title: string
    confirmed: string
    guests: string
    collected: string
    present: string
    absent: string
    markAllPresent: string
    addGuest: string
    addExpense: string
    summary: string
    shareWhatsApp: string
  }
}

const translations: Record<Language, Translations> = {
  'pt-BR': ptBR,
  en,
}

export const DEFAULT_LOCALE: Language = 'pt-BR'

export function getTranslation(locale: string): Translations {
  if (locale in translations) {
    return translations[locale as Language]
  }
  return translations[DEFAULT_LOCALE]
}

export { useTranslation } from './provider'
