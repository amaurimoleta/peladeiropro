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
  ChevronRight, ChevronDown, Users, Camera, Share2, Trophy, Award, Megaphone, Pin, Minus,
} from 'lucide-react'
import { format, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EXPENSE_CATEGORIES, PIX_KEY_TYPES, TOURNAMENT_STATUSES, TOURNAMENT_FORMATS } from '@/lib/types'
import { ShareButton } from '@/components/shared/share-button'
import { CopyPixButton } from '@/components/shared/copy-pix-button'
import { Logo } from '@/components/shared/logo'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { ExportPdf } from '@/components/shared/export-pdf'

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
  const [priorBalance, setPriorBalance] = useState(0)

  // Collapsible states for monthly view
  const [showMensalidades, setShowMensalidades] = useState(true)
  const [showDespesas, setShowDespesas] = useState(true)
  const [showAvulsos, setShowAvulsos] = useState(true)

  // Collapsible states for annual view
  const [showCompliance, setShowCompliance] = useState(false)
  const [showAnnualReceitas, setShowAnnualReceitas] = useState(false)
  const [showAnnualDespesas, setShowAnnualDespesas] = useState(false)

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

  // Campeonatos expand state
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set())

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
      const firstDayOfMonth = `${currentMonth}-01`
      const lastDayOfMonth = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      const [
        { data: feesData }, { data: guestsData }, { data: expensesData }, { data: matchesData },
        { data: priorFees }, { data: priorGuests }, { data: priorExpenses },
      ] = await Promise.all([
        supabase.from('monthly_fees').select('*, member:group_members(name, member_type)').eq('group_id', group.id).eq('reference_month', currentMonth),
        supabase.from('guest_players').select('*').eq('group_id', group.id).gte('match_date', firstDayOfMonth).lte('match_date', lastDayOfMonth),
        supabase.from('expenses').select('*').eq('group_id', group.id).gte('expense_date', firstDayOfMonth).lte('expense_date', lastDayOfMonth).order('expense_date', { ascending: false }),
        supabase.from('matches').select('*').eq('group_id', group.id).gte('match_date', firstDayOfMonth).lte('match_date', lastDayOfMonth).order('match_date', { ascending: false }),
        // Prior data for saldo inicial
        supabase.from('monthly_fees').select('amount').eq('group_id', group.id).eq('status', 'paid').lt('reference_month', currentMonth),
        supabase.from('guest_players').select('amount').eq('group_id', group.id).eq('paid', true).lt('match_date', firstDayOfMonth),
        supabase.from('expenses').select('amount').eq('group_id', group.id).lt('expense_date', firstDayOfMonth),
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

      // Compute prior balance (saldo inicial)
      const initBal = Number(group.initial_balance ?? 0)
      const priorFeesTotal = (priorFees || []).reduce((s: number, f: any) => s + Number(f.amount), 0)
      const priorGuestsTotal = (priorGuests || []).reduce((s: number, g: any) => s + Number(g.amount), 0)
      const priorExpensesTotal = (priorExpenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0)
      setPriorBalance(initBal + priorFeesTotal + priorGuestsTotal - priorExpensesTotal)

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
  const saldoFinal = priorBalance + balance
  const paidCount = fees.filter(f => f.status === 'paid').length
  const totalFeesCount = fees.length

  // Annual calculations
  const groupInitialBalance = group ? Number(group.initial_balance || 0) : 0
  const allMonthsRaw = Array.from({ length: 12 }, (_, i) => {
    const month = `${selectedYear}-${String(i + 1).padStart(2, '0')}`
    const monthFees = annualFees?.filter(f => f.reference_month === month && f.status === 'paid') || []
    const monthGuests = annualGuests?.filter(g => g.match_date.startsWith(month) && g.paid) || []
    const monthExpenses = annualExpenses?.filter(e => e.expense_date.startsWith(month)) || []
    const feeIncome = monthFees.reduce((s: number, f: any) => s + Number(f.amount), 0)
    const guestIncome = monthGuests.reduce((s: number, g: any) => s + Number(g.amount), 0)
    const income = feeIncome + guestIncome
    const expense = monthExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
    return { month, monthIndex: i, income, expense, balance: income - expense, saldoInicial: 0, saldoFinal: 0 }
  })
  // Compute running saldo
  let runningSaldo = groupInitialBalance
  for (const m of allMonthsRaw) {
    m.saldoInicial = runningSaldo
    m.saldoFinal = runningSaldo + m.income - m.expense
    runningSaldo = m.saldoFinal
  }
  const monthsData = allMonthsRaw.filter(m => m.income > 0 || m.expense > 0)

  const annualTotalIncome = monthsData.reduce((s, m) => s + m.income, 0)
  const annualTotalExpense = monthsData.reduce((s, m) => s + m.expense, 0)
  const annualBalance = annualTotalIncome - annualTotalExpense
  const annualSaldoInicial = monthsData.length > 0 ? monthsData[0].saldoInicial : groupInitialBalance
  const annualSaldoFinal = monthsData.length > 0 ? monthsData[monthsData.length - 1].saldoFinal : groupInitialBalance

  // Detailed revenue breakdown for annual view
  const annualFeeRevenue = annualFees.filter(f => f.status === 'paid').reduce((s: number, f: any) => s + Number(f.amount), 0)
  const annualGuestRevenue = annualGuests.filter(g => g.paid).reduce((s: number, g: any) => s + Number(g.amount), 0)

  // Detailed expense breakdown by category for annual view
  const annualExpenseByCategory: Record<string, number> = {}
  for (const e of (annualExpenses || [])) {
    const cat = e.category || 'other'
    annualExpenseByCategory[cat] = (annualExpenseByCategory[cat] || 0) + Number(e.amount)
  }

  // Member compliance for annual view (exclude goalkeepers when setting is off)
  const complianceMembers = group && !group.goalkeeper_pays_fee
    ? annualMembers.filter((m: any) => m.position !== 'goleiro')
    : annualMembers
  const memberCompliance = complianceMembers.map((member: any) => {
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
        {/* Mural de Avisos - sempre visivel */}
        {!announcementsLoading && announcements.length > 0 && (
          <div className="card-modern-elevated overflow-hidden">
            <div className="bg-gradient-to-r from-brand-navy to-indigo-700 px-4 py-2.5 flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 text-white" />
              <h3 className="text-xs font-bold text-white">Mural de Avisos</h3>
            </div>
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {announcements.map((a: any) => {
                const createdAt = new Date(a.created_at)
                const isRecent = (Date.now() - createdAt.getTime()) < 3 * 24 * 60 * 60 * 1000

                return (
                  <div
                    key={a.id}
                    className={`px-4 py-3 ${a.pinned ? 'bg-[#1B1F4B]/5' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {a.pinned && <Pin className="h-3 w-3 text-[#1B1F4B] shrink-0 rotate-45" />}
                      <span className={`text-sm font-semibold ${a.pinned ? 'text-[#1B1F4B]' : 'text-gray-900'}`}>
                        {a.title}
                      </span>
                      {isRecent && !a.pinned && (
                        <Badge variant="secondary" className="bg-[#00C853]/10 text-[#00C853] text-[9px] px-1 py-0 shrink-0">
                          Novo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{a.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {a.author?.name || 'Admin'} &middot; {format(createdAt, "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* View Toggle */}
        <Tabs defaultValue="mensal" onValueChange={setActiveTab}>
          <TabsList className="w-full transition-all duration-300">
            <TabsTrigger value="mensal" className="flex-1 transition-all duration-200">Mensal</TabsTrigger>
            <TabsTrigger value="anual" className="flex-1 transition-all duration-200">Anual</TabsTrigger>
            <TabsTrigger value="campeonatos" className="flex-1 transition-all duration-200">Campeonatos</TabsTrigger>
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="card-modern-elevated p-3 text-center animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-0.5">Saldo Inicial</p>
                      <AnimatedNumber
                        value={priorBalance}
                        prefix="R$ "
                        className={`text-sm sm:text-base font-bold ${priorBalance >= 0 ? 'text-brand-navy' : 'text-red-500'}`}
                      />
                    </div>
                    <div className="card-modern-elevated p-3 text-center animate-fade-in-up" style={{ animationDelay: '60ms' }}>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-0.5">Receitas</p>
                      <AnimatedNumber value={totalIncome} prefix="R$ " className="text-sm sm:text-base font-bold text-brand-green" />
                    </div>
                    <div className="card-modern-elevated p-3 text-center animate-fade-in-up" style={{ animationDelay: '120ms' }}>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-0.5">Despesas</p>
                      <AnimatedNumber value={totalExpenses_} prefix="R$ " className="text-sm sm:text-base font-bold text-red-500" />
                    </div>
                    <div className="card-modern-elevated p-3 text-center animate-fade-in-up" style={{ animationDelay: '180ms' }}>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-0.5">Saldo Final</p>
                      <AnimatedNumber
                        value={saldoFinal}
                        prefix="R$ "
                        className={`text-sm sm:text-base font-bold ${saldoFinal >= 0 ? 'text-brand-green' : 'text-red-500'}`}
                      />
                    </div>
                  </div>

                  {/* Receitas - collapsible */}
                  <div className="card-modern-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <button
                      type="button"
                      onClick={() => setShowAvulsos(!showAvulsos)}
                      className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
                    >
                      <h2 className="font-bold text-brand-navy">Receitas</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green">R$ {totalIncome.toFixed(2)}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showAvulsos ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {showAvulsos && (
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
                        {/* Mensalidades pagas */}
                        {totalFeesPaid > 0 && (
                          <div className="flex justify-between text-sm py-1">
                            <span className="text-muted-foreground">Mensalidades pagas</span>
                            <span className="font-semibold text-brand-green">R$ {totalFeesPaid.toFixed(2)}</span>
                          </div>
                        )}
                        {/* Jogadores Avulsos */}
                        {guests.length > 0 && (
                          <div>
                            <div className="flex justify-between text-sm py-1 mb-1">
                              <span className="text-muted-foreground">Jogadores avulsos</span>
                              <span className="font-semibold text-brand-green">R$ {totalGuestsPaid.toFixed(2)}</span>
                            </div>
                            <div className="space-y-1 pl-3 border-l-2 border-gray-100">
                              {guests.map((guest: any) => (
                                <div key={guest.id} className="flex items-center justify-between text-xs py-0.5">
                                  <span className="text-brand-navy">{guest.name} - {format(new Date(guest.match_date + 'T12:00:00'), 'dd/MM')}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium">R$ {Number(guest.amount).toFixed(2)}</span>
                                    {guest.paid ? (
                                      <CheckCircle2 className="h-3 w-3 text-brand-green" />
                                    ) : (
                                      <Clock className="h-3 w-3 text-amber-500" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {totalIncome === 0 && (
                          <p className="text-sm text-muted-foreground py-2 text-center">Nenhuma receita no mes.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Despesas - collapsible */}
                  <div className="card-modern-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '280ms' }}>
                    <button
                      type="button"
                      onClick={() => setShowDespesas(!showDespesas)}
                      className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
                    >
                      <h2 className="font-bold text-brand-navy">Despesas</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500">R$ {totalExpenses_.toFixed(2)}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showDespesas ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {showDespesas && (
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2.5">
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
                    )}
                  </div>

                  {/* Mensalidades - collapsible with categorization */}
                  {(() => {
                    const sortByName = (a: any, b: any) => (a.member?.name || '').localeCompare(b.member?.name || '')
                    const paidFees = fees.filter((f: any) => f.status === 'paid').sort(sortByName)
                    const pendingFeesArr = fees.filter((f: any) => f.status === 'pending' || f.status === 'overdue').sort(sortByName)
                    const dmFees = fees.filter((f: any) => f.status === 'dm_leave').sort(sortByName)
                    const waivedFees = fees.filter((f: any) => f.status === 'waived').sort(sortByName)

                    const renderFeeList = (list: any[], showValue: boolean) => (
                      list.length > 0 ? list.map((fee: any) => (
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
                            <span className={`text-xs font-medium ${showValue ? '' : 'text-muted-foreground'}`}>
                              R$ {showValue ? Number(fee.amount).toFixed(2) : '0,00'}
                            </span>
                          </div>
                        </div>
                      )) : null
                    )

                    return (
                      <div className="card-modern-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '360ms' }}>
                        <button
                          type="button"
                          onClick={() => setShowMensalidades(!showMensalidades)}
                          className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
                        >
                          <h2 className="font-bold text-brand-navy">Mensalidades</h2>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green">{paidCount}/{totalFeesCount}</span>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showMensalidades ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                        {showMensalidades && (
                          <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">
                            {fees.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma mensalidade gerada.</p>
                            ) : (
                              <>
                                {/* Pagos */}
                                {paidFees.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" />
                                      <span className="text-xs font-bold text-brand-green uppercase tracking-wide">Pagos ({paidFees.length})</span>
                                    </div>
                                    <div className="space-y-1 pl-5">
                                      {renderFeeList(paidFees, true)}
                                    </div>
                                  </div>
                                )}
                                {/* Pendentes */}
                                {pendingFeesArr.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                                      <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                                        Pendentes ({pendingFeesArr.length})
                                      </span>
                                    </div>
                                    <div className="space-y-1 pl-5">
                                      {renderFeeList(pendingFeesArr, false)}
                                    </div>
                                  </div>
                                )}
                                {/* Afastados DM */}
                                {dmFees.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Stethoscope className="h-3.5 w-3.5 text-blue-500" />
                                      <span className="text-xs font-bold text-blue-500 uppercase tracking-wide">Afastados DM ({dmFees.length})</span>
                                    </div>
                                    <div className="space-y-1 pl-5">
                                      {renderFeeList(dmFees, false)}
                                    </div>
                                  </div>
                                )}
                                {/* Dispensados */}
                                {waivedFees.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Dispensados ({waivedFees.length})</span>
                                    </div>
                                    <div className="space-y-1 pl-5">
                                      {renderFeeList(waivedFees, false)}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Saldo Inicial</p>
                      <AnimatedNumber value={annualSaldoInicial} prefix="R$ " className="text-base sm:text-lg font-bold text-brand-navy" />
                    </div>
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Receitas</p>
                      <AnimatedNumber value={annualTotalIncome} prefix="R$ " className="text-base sm:text-lg font-bold text-brand-green" />
                    </div>
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '160ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Despesas</p>
                      <AnimatedNumber value={annualTotalExpense} prefix="R$ " className="text-base sm:text-lg font-bold text-red-500" />
                    </div>
                    <div className="card-modern-elevated p-3 sm:p-4 text-center animate-fade-in-up" style={{ animationDelay: '240ms' }}>
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 shadow-sm">
                        <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Saldo Final</p>
                      <AnimatedNumber
                        value={annualSaldoFinal}
                        prefix="R$ "
                        className={`text-base sm:text-lg font-bold ${annualSaldoFinal >= 0 ? 'text-brand-green' : 'text-red-500'}`}
                      />
                    </div>
                  </div>

                  {/* Month-by-month breakdown table */}
                  <div className="card-modern-elevated p-4 sm:p-5 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                    <h2 className="font-bold text-brand-navy mb-4">Resumo por Mes</h2>
                    {monthsData.length > 0 ? (
                      <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2.5 px-1.5 sm:px-2 font-semibold text-brand-navy">Mes</th>
                              <th className="text-right py-2.5 px-1.5 sm:px-2 font-semibold text-muted-foreground">Saldo Ini.</th>
                              <th className="text-right py-2.5 px-1.5 sm:px-2 font-semibold text-brand-green">Receitas</th>
                              <th className="text-right py-2.5 px-1.5 sm:px-2 font-semibold text-red-500">Despesas</th>
                              <th className="text-right py-2.5 px-1.5 sm:px-2 font-semibold text-brand-navy">Saldo Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthsData.map((m, idx) => (
                              <tr key={m.month} className={idx % 2 === 0 ? 'bg-gray-50/50' : ''}>
                                <td className="py-2.5 px-1.5 sm:px-2 font-medium text-brand-navy capitalize">{formatMonthName(m.month)}</td>
                                <td className="py-2.5 px-1.5 sm:px-2 text-right text-muted-foreground font-medium">R$ {m.saldoInicial.toFixed(2)}</td>
                                <td className="py-2.5 px-1.5 sm:px-2 text-right text-brand-green font-medium">R$ {m.income.toFixed(2)}</td>
                                <td className="py-2.5 px-1.5 sm:px-2 text-right text-red-500 font-medium">R$ {m.expense.toFixed(2)}</td>
                                <td className={`py-2.5 px-1.5 sm:px-2 text-right font-medium ${m.saldoFinal >= 0 ? 'text-brand-green' : 'text-red-500'}`}>
                                  R$ {m.saldoFinal.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-300">
                              <td className="py-2.5 px-1.5 sm:px-2 font-bold text-brand-navy">Total</td>
                              <td className="py-2.5 px-1.5 sm:px-2 text-right font-bold text-muted-foreground">R$ {annualSaldoInicial.toFixed(2)}</td>
                              <td className="py-2.5 px-1.5 sm:px-2 text-right font-bold text-brand-green">R$ {annualTotalIncome.toFixed(2)}</td>
                              <td className="py-2.5 px-1.5 sm:px-2 text-right font-bold text-red-500">R$ {annualTotalExpense.toFixed(2)}</td>
                              <td className={`py-2.5 px-1.5 sm:px-2 text-right font-bold ${annualSaldoFinal >= 0 ? 'text-brand-green' : 'text-red-500'}`}>
                                R$ {annualSaldoFinal.toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado para {selectedYear}.</p>
                    )}
                  </div>

                  {/* Receitas Detalhadas - collapsible */}
                  {annualTotalIncome > 0 && (
                    <div className="card-modern-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '380ms' }}>
                      <button
                        type="button"
                        onClick={() => setShowAnnualReceitas(!showAnnualReceitas)}
                        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-brand-green" />
                          <h2 className="font-bold text-brand-navy">Receitas Detalhadas</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green">R$ {annualTotalIncome.toFixed(2)}</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showAnnualReceitas ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {showAnnualReceitas && (
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2.5 text-sm">
                          <div className="flex justify-between py-1.5">
                            <span className="text-muted-foreground">Mensalidades pagas</span>
                            <span className="font-semibold text-brand-green">R$ {annualFeeRevenue.toFixed(2)}</span>
                          </div>
                          {annualGuestRevenue > 0 && (
                            <div className="flex justify-between py-1.5">
                              <span className="text-muted-foreground">Jogadores avulsos</span>
                              <span className="font-semibold text-brand-green">R$ {annualGuestRevenue.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span className="text-brand-navy">Total Receitas</span>
                            <span className="text-brand-green">R$ {annualTotalIncome.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Despesas Detalhadas - collapsible */}
                  {annualTotalExpense > 0 && (
                    <div className="card-modern-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '460ms' }}>
                      <button
                        type="button"
                        onClick={() => setShowAnnualDespesas(!showAnnualDespesas)}
                        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          <h2 className="font-bold text-brand-navy">Despesas Detalhadas</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500">R$ {annualTotalExpense.toFixed(2)}</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showAnnualDespesas ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {showAnnualDespesas && (
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2.5 text-sm">
                          {Object.entries(annualExpenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                            <div key={cat} className="flex justify-between py-1.5">
                              <span className="text-muted-foreground">{EXPENSE_CATEGORIES[cat] || cat}</span>
                              <span className="font-semibold text-red-500">R$ {amount.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span className="text-brand-navy">Total Despesas</span>
                            <span className="text-red-500">R$ {annualTotalExpense.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Member payment compliance - collapsible */}
                  {memberCompliance.length > 0 && (
                    <div className="card-modern-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '540ms' }}>
                      <button
                        type="button"
                        onClick={() => setShowCompliance(!showCompliance)}
                        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-brand-navy" />
                          <h2 className="font-bold text-brand-navy">Adimplencia dos Membros</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green">{memberCompliance.length}</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showCompliance ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {showCompliance && (
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2.5">
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
                      )}
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

                // Build team stats: wins per game AND championship wins + goals
                const teamStats: Record<string, { name: string; gameWins: number; gameLosses: number; gameDraws: number; totalGames: number; champWins: number; goalsFor: number; goalsAgainst: number }> = {}

                function ensureTeam(name: string) {
                  if (!teamStats[name]) teamStats[name] = { name, gameWins: 0, gameLosses: 0, gameDraws: 0, totalGames: 0, champWins: 0, goalsFor: 0, goalsAgainst: 0 }
                }

                // Count game wins + goals
                for (const m of scoredGames) {
                  const tA = m.team_a_name || 'Time A'
                  const tB = m.team_b_name || 'Time B'
                  ensureTeam(tA); ensureTeam(tB)
                  teamStats[tA].totalGames++; teamStats[tB].totalGames++
                  teamStats[tA].goalsFor += Number(m.score_a); teamStats[tA].goalsAgainst += Number(m.score_b)
                  teamStats[tB].goalsFor += Number(m.score_b); teamStats[tB].goalsAgainst += Number(m.score_a)
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
                  const diffA = a.goalsFor - a.goalsAgainst
                  const diffB = b.goalsFor - b.goalsAgainst
                  if (diffB !== diffA) return diffB - diffA
                  return b.goalsFor - a.goalsFor
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
                                <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                                  <span>{team.totalGames}J</span>
                                  <span className="text-green-600 font-medium">{team.gameWins}V</span>
                                  <span className="text-amber-600">{team.gameDraws}E</span>
                                  <span className="text-red-500">{team.gameLosses}D</span>
                                  <span className="text-brand-navy font-medium">
                                    {team.totalGames > 0 ? Math.round((team.gameWins / team.totalGames) * 100) : 0}%
                                  </span>
                                  <span className="text-muted-foreground/50">|</span>
                                  <span>{team.goalsFor}GP</span>
                                  <span>{team.goalsAgainst}GC</span>
                                  <span className={`font-medium ${(team.goalsFor - team.goalsAgainst) > 0 ? 'text-green-600' : (team.goalsFor - team.goalsAgainst) < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {(team.goalsFor - team.goalsAgainst) > 0 ? '+' : ''}{team.goalsFor - team.goalsAgainst}SG
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

                    {/* Lista de campeonatos com campeao + jogos colapsaveis */}
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
                          const tMatches = campMatches.filter((m: any) => m.tournament_id === t.id).sort((a: any, b: any) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
                          const statusLabel = TOURNAMENT_STATUSES[t.status] || t.status
                          const statusColor = t.status === 'active' ? 'text-green-600 bg-green-50' : t.status === 'finished' ? 'text-gray-600 bg-gray-100' : 'text-red-600 bg-red-50'
                          const isExpanded = expandedTournaments.has(t.id)

                          function toggleExpand() {
                            setExpandedTournaments(prev => {
                              const next = new Set(prev)
                              if (next.has(t.id)) next.delete(t.id)
                              else next.add(t.id)
                              return next
                            })
                          }

                          return (
                            <div key={t.id}>
                              {/* Tournament header - clickable */}
                              <button
                                type="button"
                                onClick={toggleExpand}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
                              >
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
                                <div className="flex items-center gap-2 shrink-0">
                                  {cr.winner ? (
                                    <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1 shrink-0">
                                      <Trophy className="h-3 w-3 text-amber-600" />
                                      <span className="text-xs font-bold text-amber-800">{cr.winner}</span>
                                    </div>
                                  ) : t.status === 'active' ? (
                                    <span className="text-[11px] text-green-600 font-medium bg-green-50 rounded-full px-2 py-0.5">Em andamento</span>
                                  ) : null}
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </button>

                              {/* Match results - collapsible */}
                              {isExpanded && (
                                <div className="px-4 pb-3">
                                  {tMatches.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum jogo registrado.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {tMatches.map((m: any) => {
                                        const hasScore = m.score_a != null && m.score_b != null
                                        const teamA = m.team_a_name || 'Time A'
                                        const teamB = m.team_b_name || 'Time B'
                                        const matchDate = m.match_date ? format(new Date(m.match_date + 'T12:00:00'), 'dd/MM', { locale: ptBR }) : ''
                                        const phase = m.tournament_phase

                                        return (
                                          <div key={m.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                                            {/* Date */}
                                            <span className="text-[10px] text-muted-foreground w-10 shrink-0">{matchDate}</span>

                                            {/* Phase badge */}
                                            {phase && (
                                              <span className="text-[9px] bg-brand-navy/10 text-brand-navy rounded px-1 py-0.5 shrink-0">
                                                {phase}
                                              </span>
                                            )}

                                            {/* Team A */}
                                            <span className={`flex-1 text-right truncate font-medium ${hasScore && m.score_a > m.score_b ? 'text-brand-navy' : 'text-foreground'}`}>
                                              {teamA}
                                            </span>

                                            {/* Score */}
                                            {hasScore ? (
                                              <div className="flex items-center gap-1 shrink-0 bg-white rounded-md px-2 py-0.5 shadow-sm border">
                                                <span className={`font-bold text-sm min-w-[14px] text-center ${m.score_a > m.score_b ? 'text-green-600' : m.score_a < m.score_b ? 'text-red-500' : 'text-foreground'}`}>
                                                  {m.score_a}
                                                </span>
                                                <span className="text-muted-foreground text-[10px] font-bold">x</span>
                                                <span className={`font-bold text-sm min-w-[14px] text-center ${m.score_b > m.score_a ? 'text-green-600' : m.score_b < m.score_a ? 'text-red-500' : 'text-foreground'}`}>
                                                  {m.score_b}
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground shrink-0 bg-white rounded-md px-2 py-0.5 shadow-sm border text-[10px]">vs</span>
                                            )}

                                            {/* Team B */}
                                            <span className={`flex-1 truncate font-medium ${hasScore && m.score_b > m.score_a ? 'text-brand-navy' : 'text-foreground'}`}>
                                              {teamB}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
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
