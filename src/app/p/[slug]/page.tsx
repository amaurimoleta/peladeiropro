'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DollarSign, TrendingUp, TrendingDown, CheckCircle2, Clock,
  AlertCircle, Stethoscope, CalendarDays, MapPin, ChevronLeft,
  ChevronRight, Users, Camera, Share2, Trophy, Award, Megaphone, Pin,
} from 'lucide-react'
import { format, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EXPENSE_CATEGORIES, PIX_KEY_TYPES, TOURNAMENT_STATUSES, TOURNAMENT_FORMATS } from '@/lib/types'
import { ShareButton } from '@/components/shared/share-button'
import { CopyPixButton } from '@/components/shared/copy-pix-button'
import { Logo } from '@/components/shared/logo'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { ExportPdf } from '@/components/shared/export-pdf'
import { PixQrCode } from '@/components/shared/pix-qr-code'

// ── Animated Number Component ──
function AnimatedNumber({ value, prefix = '', suffix = '', className = '' }: {
  value: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    const start = prevValue.current
    const end = value
    const duration = 600
    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (end - start) * eased
      setDisplay(current)
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevValue.current = end
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  return <span className={className}>{prefix}{display.toFixed(2)}{suffix}</span>
}

// ── Receipt Modal Component ──
function ReceiptViewer({ receiptUrl, memberName }: { receiptUrl: string; memberName: string }) {
  return (
    <Dialog>
      <DialogTrigger>
        <button
          className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
          title="Ver comprovante"
        >
          <Camera className="h-3 w-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comprovante - {memberName}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center p-2">
          <img
            src={receiptUrl}
            alt={`Comprovante de ${memberName}`}
            className="max-w-full max-h-[60vh] rounded-lg object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function PublicPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [group, setGroup] = useState<any>(null)
  const [fees, setFees] = useState<any[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [matchAttendance, setMatchAttendance] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('mensal')

  // Annual view state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [annualFees, setAnnualFees] = useState<any[]>([])
  const [annualGuests, setAnnualGuests] = useState<any[]>([])
  const [annualExpenses, setAnnualExpenses] = useState<any[]>([])
  const [annualMatches, setAnnualMatches] = useState<any[]>([])
  const [annualMembers, setAnnualMembers] = useState<any[]>([])
  const [annualLoading, setAnnualLoading] = useState(false)

  // Campeonatos state
  const [campYear, setCampYear] = useState(new Date().getFullYear())
  const [campTournaments, setCampTournaments] = useState<any[]>([])
  const [campMatches, setCampMatches] = useState<any[]>([])
  const [campLoading, setCampLoading] = useState(false)

  // Mural de avisos state
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(false)

  const currentMonth = format(currentDate, 'yyyy-MM')

  useEffect(() => {
    async function loadGroup() {
      const { data } = await supabase.from('groups').select('*').eq('public_slug', slug).single()
      if (!data) { setNotFound(true); setLoading(false); return }
      setGroup(data)
    }
    loadGroup()
  }, [slug])

  // Monthly data
  useEffect(() => {
    if (!group) return
    async function loadData() {
      setLoading(true)
      const [{ data: feesData }, { data: guestsData }, { data: expensesData }, { data: matchesData }] = await Promise.all([
        supabase.from('monthly_fees').select('*, member:group_members(name, member_type)').eq('group_id', group.id).eq('reference_month', currentMonth),
        supabase.from('guest_players').select('*').eq('group_id', group.id).gte('match_date', `${currentMonth}-01`).lte('match_date', format(endOfMonth(currentDate), 'yyyy-MM-dd')),
        supabase.from('expenses').select('*').eq('group_id', group.id).gte('expense_date', `${currentMonth}-01`).lte('expense_date', format(endOfMonth(currentDate), 'yyyy-MM-dd')).order('expense_date', { ascending: false }),
        supabase.from('matches').select('*').eq('group_id', group.id).gte('match_date', `${currentMonth}-01`).lte('match_date', format(endOfMonth(currentDate), 'yyyy-MM-dd')).order('match_date', { ascending: false }),
      ])

      // Load attendance counts for each match
      const matchIds = (matchesData || []).map((m: any) => m.id)
      const attendanceCounts: Record<string, number> = {}
      if (matchIds.length > 0) {
        const { data: attendanceData } = await supabase
          .from('match_attendance')
          .select('match_id')
          .in('match_id', matchIds)
        if (attendanceData) {
          attendanceData.forEach((a: any) => {
            attendanceCounts[a.match_id] = (attendanceCounts[a.match_id] || 0) + 1
          })
        }
      }

      setFees(feesData || [])
      setGuests(guestsData || [])
      setExpenses(expensesData || [])
      setMatches(matchesData || [])
      setMatchAttendance(attendanceCounts)
      setLoading(false)
    }
    loadData()
  }, [group, currentMonth])

  // Annual data
  useEffect(() => {
    if (!group) return
    async function loadAnnualData() {
      setAnnualLoading(true)
      const year = selectedYear
      const [{ data: feesData }, { data: guestsData }, { data: expensesData }, { data: matchesData }, { data: membersData }] = await Promise.all([
        supabase.from('monthly_fees').select('*, member:group_members(name, member_type)').eq('group_id', group.id)
          .gte('reference_month', `${year}-01`).lte('reference_month', `${year}-12`),
        supabase.from('guest_players').select('*').eq('group_id', group.id)
          .gte('match_date', `${year}-01-01`).lte('match_date', `${year}-12-31`),
        supabase.from('expenses').select('*').eq('group_id', group.id)
          .gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`),
        supabase.from('matches').select('*').eq('group_id', group.id)
          .gte('match_date', `${year}-01-01`).lte('match_date', `${year}-12-31`),
        supabase.from('group_members').select('*').eq('group_id', group.id).eq('status', 'active').eq('member_type', 'mensalista'),
      ])
      setAnnualFees(feesData || [])
      setAnnualGuests(guestsData || [])
      setAnnualExpenses(expensesData || [])
      setAnnualMatches(matchesData || [])
      setAnnualMembers(membersData || [])
      setAnnualLoading(false)
    }
    loadAnnualData()
  }, [group, selectedYear])

  // Mural de avisos
  useEffect(() => {
    if (!group) return
    async function loadAnnouncements() {
      setAnnouncementsLoading(true)
      const { data } = await supabase
        .from('announcements')
        .select('*, author:group_members(name)')
        .eq('group_id', group.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20)
      setAnnouncements(data || [])
      setAnnouncementsLoading(false)
    }
    loadAnnouncements()
  }, [group])

  // Campeonatos data
  useEffect(() => {
    if (!group) return
    async function loadCampData() {
      setCampLoading(true)
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })

      const all = tournamentsData || []
      const yearFiltered = all.filter((t: any) => {
        const d = t.start_date || t.created_at
        if (!d) return false
        // Extract year from string to avoid timezone issues
        const y = t.start_date ? parseInt(t.start_date.substring(0, 4), 10) : new Date(d).getFullYear()
        return y === campYear
      })
      setCampTournaments(yearFiltered)

      const ids = yearFiltered.map((t: any) => t.id)
      if (ids.length > 0) {
        const { data: matchesData } = await supabase
          .from('matches')
          .select('*')
          .in('tournament_id', ids)
          .order('match_date', { ascending: true })
        setCampMatches(matchesData || [])
      } else {
        setCampMatches([])
      }
      setCampLoading(false)
    }
    loadCampData()
  }, [group, campYear])

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-surface">
        <div className="text-center">
          <Logo size="lg" />
          <p className="text-muted-foreground mt-4">Grupo nao encontrado.</p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-surface">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  // Monthly calculations
  const totalFeesPaid = fees.filter(f => f.status === 'paid').reduce((s: number, f: any) => s + Number(f.amount), 0)
  const totalGuestsPaid = guests.filter(g => g.paid).reduce((s: number, g: any) => s + Number(g.amount), 0)
  const totalIncome = totalFeesPaid + totalGuestsPaid
  const totalExpenses_ = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
  const balance = totalIncome - totalExpenses_
  const paidCount = fees.filter(f => f.status === 'paid').length
  const totalFeesCount = fees.length

  // Annual calculations
  const monthsData = Array.from({ length: 12 }, (_, i) => {
    const month = `${selectedYear}-${String(i + 1).padStart(2, '0')}`
    const monthFees = annualFees?.filter(f => f.reference_month === month && f.status === 'paid') || []
    const monthGuests = annualGuests?.filter(g => g.match_date.startsWith(month) && g.paid) || []
    const monthExpenses = annualExpenses?.filter(e => e.expense_date.startsWith(month)) || []
    const income = monthFees.reduce((s: number, f: any) => s + Number(f.amount), 0) + monthGuests.reduce((s: number, g: any) => s + Number(g.amount), 0)
    const expense = monthExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
    return { month, monthIndex: i, income, expense, balance: income - expense }
  }).filter(m => m.income > 0 || m.expense > 0)

  const annualTotalIncome = monthsData.reduce((s, m) => s + m.income, 0)
  const annualTotalExpense = monthsData.reduce((s, m) => s + m.expense, 0)
  const annualBalance = annualTotalIncome - annualTotalExpense

  const annualTotalMatches = annualMatches.length
  const annualGuestRevenue = annualGuests.filter(g => g.paid).reduce((s: number, g: any) => s + Number(g.amount), 0)

  // Member compliance for annual view
  const memberCompliance = annualMembers.map((member: any) => {
    const memberFees = annualFees.filter(f => f.member_id === member.id)
    const totalMonths = memberFees.length
    const paidMonths = memberFees.filter(f => f.status === 'paid').length
    const percentage = totalMonths > 0 ? Math.round((paidMonths / totalMonths) * 100) : 0
    return { name: member.name, paidMonths, totalMonths, percentage }
  }).sort((a, b) => b.percentage - a.percentage)

  function feeStatusDisplay(fee: any) {
    if (fee.status === 'paid') {
      return <span className="flex items-center gap-1.5 text-brand-green font-medium text-xs"><CheckCircle2 className="h-3.5 w-3.5" />Pago</span>
    }
    if (fee.status === 'dm_leave') {
      return <span className="flex items-center gap-1.5 text-blue-500 font-medium text-xs"><Stethoscope className="h-3.5 w-3.5" />Afastado DM</span>
    }
    if (fee.status === 'overdue') {
      return <span className="flex items-center gap-1.5 text-red-500 font-medium text-xs"><AlertCircle className="h-3.5 w-3.5" />Atrasado</span>
    }
    if (fee.status === 'waived') {
      return <span className="text-muted-foreground text-xs">Dispensado</span>
    }
    return <span className="flex items-center gap-1.5 text-amber-500 font-medium text-xs"><Clock className="h-3.5 w-3.5" />Pendente</span>
  }

  function formatMonthName(monthStr: string) {
    const [y, m] = monthStr.split('-')
    const date = new Date(Number(y), Number(m) - 1, 1)
    return format(date, 'MMMM', { locale: ptBR })
  }

  function complianceColor(percentage: number) {
    if (percentage >= 100) return 'text-brand-green'
    if (percentage >= 50) return 'text-amber-500'
    return 'text-red-500'
  }

  function complianceBg(percentage: number) {
    if (percentage >= 100) return 'bg-brand-green/10'
    if (percentage >= 50) return 'bg-amber-50'
    return 'bg-red-50'
  }

  function handleWhatsAppShare() {
    const url = `${window.location.origin}/p/${slug}`
    const text = `Confira a prestacao de contas da ${group.name}`
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
    window.open(waUrl, '_blank')
  }

  return (
    <div className="min-h-screen gradient-surface pb-20 sm:pb-8">
      {/* ── Sticky Header with blur ── */}
      <header className="gradient-brand-hero text-white sticky top-0 z-40">
        <div className="absolute inset-0 backdrop-blur-sm" />
        <div className="relative max-w-2xl mx-auto px-4 py-6 sm:py-8 text-center">
          <div className="flex justify-center mb-3 sm:mb-4">
            <Logo size="md" variant="white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{group.name}</h1>
          <p className="text-white/50 text-xs sm:text-sm capitalize mt-1.5 sm:mt-2 tracking-wide">Prestacao de contas</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* View Toggle */}
        <Tabs defaultValue="mensal" onValueChange={setActiveTab}>
          <TabsList className="w-full transition-all duration-300">
            <TabsTrigger value="mensal" className="flex-1 transition-all duration-200">Mensal</TabsTrigger>
            <TabsTrigger value="anual" className="flex-1 transition-all duration-200">Anual</TabsTrigger>
            <TabsTrigger value="campeonatos" className="flex-1 transition-all duration-200">Campeonatos</TabsTrigger>
            <TabsTrigger value="avisos" className="flex-1 transition-all duration-200">
              Avisos
              {announcements.filter(a => a.pinned).length > 0 && (
                <span className="ml-1 h-2 w-2 rounded-full bg-red-500 inline-block" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* ===================== MONTHLY VIEW ===================== */}
          <TabsContent value="mensal" className="transition-all duration-300">
            <div className="space-y-3 sm:space-y-4 pt-4">
              {/* Month navigation */}
              <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : (
                <>
                  {/* Balance Cards */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Entradas</p>
                      <AnimatedNumber value={totalIncome} prefix="R$ " className="text-base sm:text-lg font-bold text-brand-green" />
                    </div>
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Saidas</p>
                      <AnimatedNumber value={totalExpenses_} prefix="R$ " className="text-base sm:text-lg font-bold text-red-500" />
                    </div>
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '160ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Saldo</p>
                      <AnimatedNumber
                        value={balance}
                        prefix="R$ "
                        className={`text-base sm:text-lg font-bold ${balance >= 0 ? 'text-brand-green' : 'text-red-500'}`}
                      />
                    </div>
                  </div>

                  {/* Jogos do Mes */}
                  {matches.length > 0 && (
                    <div className="card-modern-elevated p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-brand-navy">Jogos do Mes</h2>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">{matches.length} jogos</span>
                      </div>
                      <div className="space-y-2.5">
                        {matches.map((match: any) => (
                          <div key={match.id} className="flex items-center justify-between text-sm py-1">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium text-brand-navy">
                                {format(new Date(match.match_date + 'T12:00:00'), 'dd/MM/yyyy')}
                              </span>
                              {match.location && (
                                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                  <MapPin className="h-3 w-3" />
                                  {match.location}
                                </span>
                              )}
                            </div>
                            {/* Attendance count */}
                            {matchAttendance[match.id] != null && matchAttendance[match.id] > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-gray-50 px-2 py-0.5 rounded-full">
                                <Users className="h-3 w-3" />
                                {matchAttendance[match.id]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mensalidades */}
                  <div className="card-modern-elevated p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: '280ms' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-bold text-brand-navy">Mensalidades</h2>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green">{paidCount}/{totalFeesCount}</span>
                    </div>
                    <div className="space-y-2.5">
                      {fees.map((fee: any) => (
                        <div key={fee.id} className="flex items-center justify-between text-sm py-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-brand-navy">{fee.member?.name}</span>
                            {fee.member?.member_type === 'avulso' && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1">Avulso</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {fee.receipt_url && (
                              <ReceiptViewer receiptUrl={fee.receipt_url} memberName={fee.member?.name || 'Membro'} />
                            )}
                            {feeStatusDisplay(fee)}
                          </div>
                        </div>
                      ))}
                      {fees.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma mensalidade gerada.</p>
                      )}
                    </div>
                  </div>

                  {/* Despesas */}
                  <div className="card-modern-elevated p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: '360ms' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-bold text-brand-navy">Despesas do Mes</h2>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500">R$ {totalExpenses_.toFixed(2)}</span>
                    </div>
                    <div className="space-y-2.5">
                      {expenses.map((exp: any) => (
                        <div key={exp.id} className="flex items-center justify-between text-sm py-1">
                          <div>
                            <span className="font-medium text-brand-navy">{exp.description}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              {EXPENSE_CATEGORIES[exp.category as keyof typeof EXPENSE_CATEGORIES]}
                            </span>
                          </div>
                          <span className="text-red-500 font-semibold">R$ {Number(exp.amount).toFixed(2)}</span>
                        </div>
                      ))}
                      {expenses.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma despesa registrada.</p>
                      )}
                    </div>
                  </div>

                  {/* Avulsos */}
                  {guests.length > 0 && (
                    <div className="card-modern-elevated p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: '440ms' }}>
                      <h2 className="font-bold text-brand-navy mb-4">Jogadores Avulsos</h2>
                      <div className="space-y-2.5">
                        {guests.map((guest: any) => (
                          <div key={guest.id} className="flex items-center justify-between text-sm py-1">
                            <span className="font-medium text-brand-navy">{guest.name} - {format(new Date(guest.match_date + 'T12:00:00'), 'dd/MM')}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">R$ {Number(guest.amount).toFixed(2)}</span>
                              {guest.paid ? (
                                <CheckCircle2 className="h-4 w-4 text-brand-green" />
                              ) : (
                                <Clock className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PIX info */}
                  {group.pix_key && (
                    <div className="card-modern-elevated p-4 sm:p-5 border-brand-green/20 bg-gradient-to-br from-brand-green/5 to-transparent animate-fade-in-up animate-pulse-subtle" style={{ animationDelay: '520ms' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-8 w-8 rounded-lg gradient-green flex items-center justify-center shadow-sm">
                          <DollarSign className="h-4 w-4 text-white" />
                        </div>
                        <h2 className="font-bold text-brand-navy">Pagar via PIX</h2>
                      </div>
                      <div className="space-y-2.5 text-sm">
                        {group.pix_key_type && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo:</span>
                            <span className="font-semibold">{PIX_KEY_TYPES[group.pix_key_type]}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Chave:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-brand-navy text-xs sm:text-sm break-all">{group.pix_key}</span>
                            <CopyPixButton pixKey={group.pix_key} />
                          </div>
                        </div>
                        {group.pix_beneficiary_name && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Beneficiario:</span>
                            <span className="font-semibold">{group.pix_beneficiary_name}</span>
                          </div>
                        )}
                      </div>
                      <PixQrCode
                        pixKey={group.pix_key}
                        pixKeyType={group.pix_key_type}
                        beneficiaryName={group.pix_beneficiary_name || group.name}
                      />
                    </div>
                  )}

                  {/* Export PDF - Monthly */}
                  <div className="flex justify-center animate-fade-in-up" style={{ animationDelay: '580ms' }}>
                    <ExportPdf
                      type="monthly"
                      groupName={group.name}
                      month={currentMonth}
                      fees={fees.map(f => ({ memberName: f.member?.name || '', amount: Number(f.amount), status: f.status, paidAt: f.paid_at }))}
                      guests={guests.map(g => ({ name: g.name, matchDate: g.match_date, amount: Number(g.amount), paid: g.paid }))}
                      expenses={expenses.map(e => ({ description: e.description, category: e.category, amount: Number(e.amount), date: e.expense_date }))}
                      totalIncome={totalIncome}
                      totalExpenses={totalExpenses_}
                      balance={balance}
                    />
                  </div>

                  {/* Share button */}
                  <div className="flex justify-center pt-2 sm:pt-4 pb-8">
                    <ShareButton groupName={group.name} slug={slug} />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ===================== ANNUAL VIEW ===================== */}
          <TabsContent value="anual" className="transition-all duration-300">
            <div className="space-y-3 sm:space-y-4 pt-4">
              {/* Year navigation */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold min-w-[100px] text-center">{selectedYear}</span>
                <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {annualLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : (
                <>
                  {/* Annual Summary Cards */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Receitas</p>
                      <AnimatedNumber value={annualTotalIncome} prefix="R$ " className="text-base sm:text-lg font-bold text-brand-green" />
                    </div>
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Despesas</p>
                      <AnimatedNumber value={annualTotalExpense} prefix="R$ " className="text-base sm:text-lg font-bold text-red-500" />
                    </div>
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '160ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Saldo Anual</p>
                      <AnimatedNumber
                        value={annualBalance}
                        prefix="R$ "
                        className={`text-base sm:text-lg font-bold ${annualBalance >= 0 ? 'text-brand-green' : 'text-red-500'}`}
                      />
                    </div>
                  </div>

                  {/* Month-by-month breakdown table */}
                  <div className="card-modern-elevated p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <h2 className="font-bold text-brand-navy mb-4">Resumo por Mes</h2>
                    {monthsData.length > 0 ? (
                      <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2.5 px-2 font-semibold text-brand-navy">Mes</th>
                              <th className="text-right py-2.5 px-2 font-semibold text-brand-green">Receitas</th>
                              <th className="text-right py-2.5 px-2 font-semibold text-red-500">Despesas</th>
                              <th className="text-right py-2.5 px-2 font-semibold text-brand-navy">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthsData.map((m, idx) => (
                              <tr key={m.month} className={idx % 2 === 0 ? 'bg-gray-50/50' : ''}>
                                <td className="py-2.5 px-2 font-medium text-brand-navy capitalize">{formatMonthName(m.month)}</td>
                                <td className="py-2.5 px-2 text-right text-brand-green font-medium">R$ {m.income.toFixed(2)}</td>
                                <td className="py-2.5 px-2 text-right text-red-500 font-medium">R$ {m.expense.toFixed(2)}</td>
                                <td className={`py-2.5 px-2 text-right font-medium ${m.balance >= 0 ? 'text-brand-green' : 'text-red-500'}`}>
                                  R$ {m.balance.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-300">
                              <td className="py-2.5 px-2 font-bold text-brand-navy">Total</td>
                              <td className="py-2.5 px-2 text-right font-bold text-brand-green">R$ {annualTotalIncome.toFixed(2)}</td>
                              <td className="py-2.5 px-2 text-right font-bold text-red-500">R$ {annualTotalExpense.toFixed(2)}</td>
                              <td className={`py-2.5 px-2 text-right font-bold ${annualBalance >= 0 ? 'text-brand-green' : 'text-red-500'}`}>
                                R$ {annualBalance.toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado para {selectedYear}.</p>
                    )}
                  </div>

                  {/* Member payment compliance */}
                  {memberCompliance.length > 0 && (
                    <div className="card-modern-elevated p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: '280ms' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="h-4 w-4 text-brand-navy" />
                        <h2 className="font-bold text-brand-navy">Adimplencia dos Membros</h2>
                      </div>
                      <div className="space-y-2.5">
                        {memberCompliance.map((member) => (
                          <div key={member.name} className="flex items-center justify-between text-sm py-1.5">
                            <span className="font-medium text-brand-navy">{member.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">
                                {member.paidMonths}/{member.totalMonths} meses
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${complianceBg(member.percentage)} ${complianceColor(member.percentage)}`}>
                                {member.percentage}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total matches and guest revenue */}
                  {(annualTotalMatches > 0 || annualGuestRevenue > 0) && (
                    <div className="card-modern-elevated p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: '360ms' }}>
                      <h2 className="font-bold text-brand-navy mb-4">Jogos e Avulsos</h2>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Total de jogos no ano
                          </span>
                          <span className="font-bold text-brand-navy">{annualTotalMatches}</span>
                        </div>
                        {annualGuestRevenue > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-2">
                              <DollarSign className="h-3.5 w-3.5" />
                              Receita de avulsos
                            </span>
                            <span className="font-bold text-brand-green">R$ {annualGuestRevenue.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PIX info */}
                  {group.pix_key && (
                    <div className="card-modern-elevated p-4 sm:p-5 border-brand-green/20 bg-gradient-to-br from-brand-green/5 to-transparent animate-fade-in-up animate-pulse-subtle" style={{ animationDelay: '440ms' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-8 w-8 rounded-lg gradient-green flex items-center justify-center shadow-sm">
                          <DollarSign className="h-4 w-4 text-white" />
                        </div>
                        <h2 className="font-bold text-brand-navy">Pagar via PIX</h2>
                      </div>
                      <div className="space-y-2.5 text-sm">
                        {group.pix_key_type && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo:</span>
                            <span className="font-semibold">{PIX_KEY_TYPES[group.pix_key_type]}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Chave:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-brand-navy text-xs sm:text-sm break-all">{group.pix_key}</span>
                            <CopyPixButton pixKey={group.pix_key} />
                          </div>
                        </div>
                        {group.pix_beneficiary_name && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Beneficiario:</span>
                            <span className="font-semibold">{group.pix_beneficiary_name}</span>
                          </div>
                        )}
                      </div>
                      <PixQrCode
                        pixKey={group.pix_key}
                        pixKeyType={group.pix_key_type}
                        beneficiaryName={group.pix_beneficiary_name || group.name}
                      />
                    </div>
                  )}

                  {/* Export PDF - Annual */}
                  <div className="flex justify-center animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                    <ExportPdf
                      type="annual"
                      groupName={group.name}
                      year={selectedYear}
                      monthlyData={monthsData.map(m => ({
                        month: m.month,
                        income: m.income,
                        expenses: m.expense,
                        balance: m.balance,
                      }))}
                      totalIncome={annualTotalIncome}
                      totalExpenses={annualTotalExpense}
                      balance={annualBalance}
                    />
                  </div>

                  {/* Share button */}
                  <div className="flex justify-center pt-2 sm:pt-4 pb-8">
                    <ShareButton groupName={group.name} slug={slug} />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ===================== CAMPEONATOS VIEW ===================== */}
          <TabsContent value="campeonatos" className="transition-all duration-300">
            <div className="space-y-3 sm:space-y-4 pt-4">
              {/* Year navigation */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setCampYear(y => y - 1)}
                  className="h-8 w-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-muted-foreground hover:text-brand-navy hover:border-brand-navy/30 transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-lg font-bold text-brand-navy min-w-[60px] text-center">{campYear}</span>
                <button
                  onClick={() => setCampYear(y => y + 1)}
                  className="h-8 w-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-muted-foreground hover:text-brand-navy hover:border-brand-navy/30 transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {campLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando campeonatos...</div>
              ) : campTournaments.length === 0 ? (
                <div className="card-modern-elevated p-6 text-center text-muted-foreground">
                  Nenhum campeonato em {campYear}.
                </div>
              ) : (() => {
                // Build comprehensive data
                const finishedCount = campTournaments.filter((t: any) => t.status === 'finished').length
                const activeCount = campTournaments.filter((t: any) => t.status === 'active').length
                const totalGames = campMatches.length
                const scoredGames = campMatches.filter((m: any) => m.score_a != null && m.score_b != null)

                // Build team stats: wins per game AND championship wins
                const teamStats: Record<string, { name: string; gameWins: number; gameLosses: number; gameDraws: number; totalGames: number; champWins: number }> = {}

                function ensureTeam(name: string) {
                  if (!teamStats[name]) teamStats[name] = { name, gameWins: 0, gameLosses: 0, gameDraws: 0, totalGames: 0, champWins: 0 }
                }

                // Count game wins
                for (const m of scoredGames) {
                  const tA = m.team_a_name || 'Time A'
                  const tB = m.team_b_name || 'Time B'
                  ensureTeam(tA); ensureTeam(tB)
                  teamStats[tA].totalGames++; teamStats[tB].totalGames++
                  if (m.score_a > m.score_b) { teamStats[tA].gameWins++; teamStats[tB].gameLosses++ }
                  else if (m.score_b > m.score_a) { teamStats[tB].gameWins++; teamStats[tA].gameLosses++ }
                  else { teamStats[tA].gameDraws++; teamStats[tB].gameDraws++ }
                }

                // Count championship wins (for finished tournaments, team with most wins)
                const champResults: { tournament: string; winner: string | null; format: string }[] = []
                for (const t of campTournaments) {
                  const tMatches = scoredGames.filter((m: any) => m.tournament_id === t.id)
                  if (tMatches.length === 0) { champResults.push({ tournament: t.name, winner: null, format: t.format }); continue }

                  const winsMap: Record<string, number> = {}
                  for (const m of tMatches) {
                    const tA = m.team_a_name || 'Time A'
                    const tB = m.team_b_name || 'Time B'
                    if (!winsMap[tA]) winsMap[tA] = 0
                    if (!winsMap[tB]) winsMap[tB] = 0
                    if (m.score_a > m.score_b) winsMap[tA]++
                    else if (m.score_b > m.score_a) winsMap[tB]++
                  }

                  const sorted = Object.entries(winsMap).sort((a, b) => b[1] - a[1])
                  let winner: string | null = null

                  if (t.format === 'best_of_4') {
                    // Winner is first team to 4 wins
                    const w = sorted.find(([, v]) => v >= 4)
                    winner = w ? w[0] : null
                  } else if (t.status === 'finished' && sorted.length > 0 && sorted[0][1] > (sorted[1]?.[1] || 0)) {
                    winner = sorted[0][0]
                  }

                  champResults.push({ tournament: t.name, winner, format: t.format })
                  if (winner) {
                    ensureTeam(winner)
                    teamStats[winner].champWins++
                  }
                }

                const ranking = Object.values(teamStats).sort((a, b) => {
                  if (b.champWins !== a.champWins) return b.champWins - a.champWins
                  if (b.gameWins !== a.gameWins) return b.gameWins - a.gameWins
                  return b.totalGames - a.totalGames
                })

                return (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div className="card-modern-elevated p-3 text-center animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-navy to-indigo-700 flex items-center justify-center mx-auto mb-1.5 shadow-sm">
                          <Trophy className="h-3.5 w-3.5 text-white" />
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Campeonatos</p>
                        <p className="text-lg sm:text-xl font-bold text-brand-navy">{campTournaments.length}</p>
                      </div>
                      <div className="card-modern-elevated p-3 text-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-1.5 shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Finalizados</p>
                        <p className="text-lg sm:text-xl font-bold text-[#00C853]">{finishedCount}</p>
                      </div>
                      <div className="card-modern-elevated p-3 text-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-navy to-blue-600 flex items-center justify-center mx-auto mb-1.5 shadow-sm">
                          <CalendarDays className="h-3.5 w-3.5 text-white" />
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Jogos</p>
                        <p className="text-lg sm:text-xl font-bold text-brand-navy">{totalGames}</p>
                      </div>
                    </div>

                    {/* Ranking de Campeonatos Ganhos - DESTAQUE PRINCIPAL */}
                    {ranking.length > 0 && (
                      <div className="card-modern-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                        <div className="bg-gradient-to-r from-brand-navy to-indigo-700 px-4 py-3">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            Ranking de Campeonatos Ganhos - {campYear}
                          </h3>
                        </div>
                        <div className="divide-y">
                          {ranking.map((team, idx) => (
                            <div key={team.name} className={`flex items-center gap-3 px-4 py-3 ${idx === 0 && team.champWins > 0 ? 'bg-amber-50/50' : ''}`}>
                              {/* Position */}
                              <div className="w-8 text-center shrink-0">
                                {idx === 0 && team.champWins > 0 ? (
                                  <span className="text-lg">🏆</span>
                                ) : idx === 1 && team.champWins > 0 ? (
                                  <span className="text-lg">🥈</span>
                                ) : idx === 2 && team.champWins > 0 ? (
                                  <span className="text-lg">🥉</span>
                                ) : (
                                  <span className="text-sm font-bold text-muted-foreground">{idx + 1}</span>
                                )}
                              </div>

                              {/* Team info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-sm ${idx === 0 && team.champWins > 0 ? 'text-brand-navy' : 'text-foreground'}`}>
                                    {team.name}
                                  </span>
                                  {team.champWins > 0 && (
                                    <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                      <Trophy className="h-2.5 w-2.5" />
                                      {team.champWins} {team.champWins === 1 ? 'titulo' : 'titulos'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                                  <span>{team.totalGames}J</span>
                                  <span className="text-green-600 font-medium">{team.gameWins}V</span>
                                  <span className="text-amber-600">{team.gameDraws}E</span>
                                  <span className="text-red-500">{team.gameLosses}D</span>
                                  <span className="text-brand-navy font-medium">
                                    {team.totalGames > 0 ? Math.round((team.gameWins / team.totalGames) * 100) : 0}%
                                  </span>
                                </div>
                              </div>

                              {/* Championship wins - BIG number */}
                              <div className="text-center shrink-0">
                                <p className={`text-2xl font-extrabold ${team.champWins > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                                  {team.champWins}
                                </p>
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">
                                  {team.champWins === 1 ? 'titulo' : 'titulos'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de campeonatos com campeao */}
                    <div className="card-modern-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                      <div className="px-4 py-3 border-b">
                        <h3 className="text-sm font-bold text-brand-navy flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          Campeonatos de {campYear}
                        </h3>
                      </div>
                      <div className="divide-y">
                        {champResults.map((cr, idx) => {
                          const t = campTournaments[idx]
                          const tMatches = campMatches.filter((m: any) => m.tournament_id === t.id)
                          const statusLabel = TOURNAMENT_STATUSES[t.status] || t.status
                          const statusColor = t.status === 'active' ? 'text-green-600 bg-green-50' : t.status === 'finished' ? 'text-gray-600 bg-gray-100' : 'text-red-600 bg-red-50'

                          return (
                            <div key={t.id} className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-brand-navy">{t.name}</span>
                                    <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${statusColor}`}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span>{TOURNAMENT_FORMATS[t.format]}</span>
                                    <span>-</span>
                                    <span>{tMatches.length} jogos</span>
                                  </div>
                                </div>
                                {cr.winner ? (
                                  <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-3 py-1.5 shrink-0">
                                    <Trophy className="h-3.5 w-3.5 text-amber-600" />
                                    <span className="text-sm font-bold text-amber-800">{cr.winner}</span>
                                  </div>
                                ) : t.status === 'active' ? (
                                  <span className="text-[11px] text-green-600 font-medium bg-green-50 rounded-full px-2 py-0.5">Em andamento</span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">Sem vencedor</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </TabsContent>

          {/* ===================== AVISOS VIEW ===================== */}
          <TabsContent value="avisos" className="transition-all duration-300">
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-[#1B1F4B] flex items-center justify-center">
                  <Megaphone className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1B1F4B]">Mural de Avisos</h2>
                  <p className="text-xs text-muted-foreground">Comunicados e informacoes do grupo</p>
                </div>
              </div>

              {announcementsLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando avisos...</div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-medium">Nenhum aviso publicado</p>
                  <p className="text-xs text-muted-foreground mt-1">Avisos do grupo aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a: any) => {
                    const createdAt = new Date(a.created_at)
                    const isRecent = (Date.now() - createdAt.getTime()) < 3 * 24 * 60 * 60 * 1000 // 3 dias

                    return (
                      <div
                        key={a.id}
                        className={`rounded-xl border p-4 transition-all ${
                          a.pinned
                            ? 'border-[#1B1F4B]/30 bg-[#1B1F4B]/5 shadow-sm'
                            : 'bg-white'
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {a.pinned && (
                              <Pin className="h-3.5 w-3.5 text-[#1B1F4B] shrink-0 rotate-45" />
                            )}
                            <h3 className={`text-sm font-semibold truncate ${a.pinned ? 'text-[#1B1F4B]' : 'text-gray-900'}`}>
                              {a.title}
                            </h3>
                            {isRecent && !a.pinned && (
                              <Badge variant="secondary" className="bg-[#00C853]/10 text-[#00C853] text-[10px] px-1.5 py-0 shrink-0">
                                Novo
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {a.content}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                          <span className="text-[11px] text-muted-foreground">
                            {a.author?.name || 'Admin'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">•</span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(createdAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center pb-8">
          <div className="flex justify-center mb-2">
            <Logo size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">Gestao de tesouraria para peladas</p>
        </div>
      </main>

      {/* ── Bottom Floating WhatsApp Share Button (mobile) ── */}
      <div className="fixed bottom-4 right-4 z-50 sm:hidden">
        <button
          onClick={handleWhatsAppShare}
          className="h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 active:scale-95"
          aria-label="Compartilhar via WhatsApp"
        >
          <Share2 className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
