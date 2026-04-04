import { createClient } from '@/lib/supabase/server'
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, Stethoscope, Wallet } from 'lucide-react'
import { format, subMonths, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import RankingCard from '@/components/dashboard/ranking-card'
import { AttendanceRanking } from '@/components/dashboard/attendance-ranking'
import AnnouncementsCard from '@/components/dashboard/announcements-card'
import FinancialCharts from '@/components/dashboard/financial-charts'
import type { MonthlyFinancialData, ExpenseCategoryData, BalanceEvolutionData } from '@/components/dashboard/financial-charts'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  court_rental: 'Quadra',
  goalkeeper: 'Goleiro',
  equipment: 'Equipamento',
  drinks: 'Bebidas',
  other: 'Outros',
}

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  court_rental: '#6366f1',
  goalkeeper: '#f59e0b',
  equipment: '#8b5cf6',
  drinks: '#ec4899',
  other: '#64748b',
}

export default async function GroupDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>
  searchParams: Promise<{ mes?: string; visao?: string }>
}) {
  const { groupId } = await params
  const { mes, visao } = await searchParams
  const supabase = await createClient()
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const selectedDate = mes ? new Date(mes + '-15T12:00:00') : now
  const viewMode = visao === 'ano' ? 'year' : 'month'
  const currentMonth = format(selectedDate, 'yyyy-MM')
  const year = selectedDate.getFullYear()
  const firstDay = viewMode === 'year' ? `${year}-01-01` : `${currentMonth}-01`
  const lastDay = viewMode === 'year' ? `${year}-12-31` : format(endOfMonth(selectedDate), 'yyyy-MM-dd')
  const priorMonthLimit = viewMode === 'year' ? `${year}-01` : currentMonth

  // Greeting based on time of day
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const [
    { data: { user } },
    { data: group },
    { data: members },
    { data: fees },
    { data: guests },
    { data: expenses },
    // Prior balance queries (before the selected period)
    { data: priorFees },
    { data: priorGuests },
    { data: priorExpenses },
    // All-time balance
    { data: allFees },
    { data: allGuests },
    { data: allExpenses },
    // Chart data
    { data: chartFees },
    { data: chartGuests },
    { data: chartExpenses },
    // All overdue fees (where due_date has passed)
    { data: overdueFeesFull },
    // Current month DM
    { data: currentDmFees },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'active'),
    viewMode === 'year'
      ? supabase.from('monthly_fees').select('*, member:group_members(name)').eq('group_id', groupId).gte('reference_month', `${year}-01`).lte('reference_month', `${year}-12`)
      : supabase.from('monthly_fees').select('*, member:group_members(name)').eq('group_id', groupId).eq('reference_month', currentMonth),
    supabase.from('guest_players').select('*').eq('group_id', groupId).gte('match_date', firstDay).lte('match_date', lastDay),
    supabase.from('expenses').select('*').eq('group_id', groupId).gte('expense_date', firstDay).lte('expense_date', lastDay),
    // Prior fees paid (before selected period)
    supabase.from('monthly_fees').select('amount').eq('group_id', groupId).eq('status', 'paid').lt('reference_month', priorMonthLimit),
    // Prior guests paid (before selected period)
    supabase.from('guest_players').select('amount').eq('group_id', groupId).eq('paid', true).lt('match_date', firstDay),
    // Prior expenses (before selected period)
    supabase.from('expenses').select('amount').eq('group_id', groupId).lt('expense_date', firstDay),
    // All-time for accumulated balance
    supabase.from('monthly_fees').select('amount').eq('group_id', groupId).eq('status', 'paid'),
    supabase.from('guest_players').select('amount').eq('group_id', groupId).eq('paid', true),
    supabase.from('expenses').select('amount').eq('group_id', groupId),
    // Chart data (bounded by view mode)
    viewMode === 'year'
      ? supabase.from('monthly_fees').select('amount, reference_month, status').eq('group_id', groupId).eq('status', 'paid').gte('reference_month', `${year}-01`).lte('reference_month', `${year}-12`)
      : supabase.from('monthly_fees').select('amount, reference_month, status').eq('group_id', groupId).eq('status', 'paid').gte('reference_month', format(subMonths(selectedDate, 5), 'yyyy-MM')),
    viewMode === 'year'
      ? supabase.from('guest_players').select('amount, match_date, paid').eq('group_id', groupId).eq('paid', true).gte('match_date', `${year}-01-01`).lte('match_date', `${year}-12-31`)
      : supabase.from('guest_players').select('amount, match_date, paid').eq('group_id', groupId).eq('paid', true).gte('match_date', format(subMonths(selectedDate, 5), 'yyyy-MM') + '-01'),
    viewMode === 'year'
      ? supabase.from('expenses').select('amount, expense_date, category').eq('group_id', groupId).gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`)
      : supabase.from('expenses').select('amount, expense_date, category').eq('group_id', groupId).gte('expense_date', format(subMonths(selectedDate, 5), 'yyyy-MM') + '-01'),
    // All overdue fees with member names (due_date has passed, not paid)
    supabase.from('monthly_fees').select('*, member:group_members(name)').eq('group_id', groupId).in('status', ['pending', 'overdue']).lte('due_date', todayStr),
    // Current month DM fees (only currently active)
    supabase.from('monthly_fees').select('*, member:group_members(name)').eq('group_id', groupId).eq('status', 'dm_leave').eq('reference_month', format(now, 'yyyy-MM')),
  ])

  // Get user profile for greeting
  let userName = 'Peladeiro'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    if (profile?.full_name) {
      userName = profile.full_name.split(' ')[0]
    }
  }

  // ---- Filter out goalkeeper fees if setting is off ----
  const goalkeeperPaysFee = group?.goalkeeper_pays_fee ?? true
  const goalkeeperMemberIds = new Set(
    !goalkeeperPaysFee ? (members || []).filter((m: any) => m.position === 'goleiro').map((m: any) => m.id) : []
  )
  const filteredFees = !goalkeeperPaysFee
    ? (fees || []).filter((f: any) => !goalkeeperMemberIds.has(f.member_id))
    : fees

  // ---- Accumulated balance (all-time) ----
  const totalAllFeesPaid = allFees?.reduce((acc, f) => acc + Number(f.amount), 0) || 0
  const totalAllGuestsPaid = allGuests?.reduce((acc, g) => acc + Number(g.amount), 0) || 0
  const totalAllExpenses = allExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0
  const groupInitialBalance = Number(group?.initial_balance ?? 0)
  const accumulatedBalance = groupInitialBalance + totalAllFeesPaid + totalAllGuestsPaid - totalAllExpenses

  // ---- Prior balance (saldo inicial do periodo) ----
  const totalPriorFees = priorFees?.reduce((acc, f) => acc + Number(f.amount), 0) || 0
  const totalPriorGuests = priorGuests?.reduce((acc, g) => acc + Number(g.amount), 0) || 0
  const totalPriorExpenses = priorExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0
  const saldoInicial = groupInitialBalance + totalPriorFees + totalPriorGuests - totalPriorExpenses

  // ---- Current period calculations ----
  const totalFeesPaid = filteredFees?.filter(f => f.status === 'paid').reduce((acc, f) => acc + Number(f.amount), 0) || 0
  const totalFeesPending = filteredFees?.filter(f => f.status !== 'paid' && f.status !== 'waived' && f.status !== 'dm_leave').reduce((acc, f) => acc + Number(f.amount), 0) || 0
  const totalGuests = guests?.filter(g => g.paid).reduce((acc, g) => acc + Number(g.amount), 0) || 0
  const totalGuestsPending = guests?.filter(g => !g.paid).reduce((acc, g) => acc + Number(g.amount), 0) || 0
  const totalExpenses = expenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0
  const receitas = totalFeesPaid + totalGuests
  const despesas = totalExpenses
  const saldoFinal = saldoInicial + receitas - despesas

  const paidCount = filteredFees?.filter(f => f.status === 'paid').length || 0
  const dmCount = filteredFees?.filter(f => f.status === 'dm_leave').length || 0
  const totalFeesCount = filteredFees?.length || 0

  // ---- Overdue fees grouped by member ----
  const overdueByMember: Record<string, { name: string; months: string[]; totalAmount: number }> = {}
  for (const fee of overdueFeesFull || []) {
    if (!goalkeeperPaysFee && goalkeeperMemberIds.has(fee.member_id)) continue
    const memberName = fee.member?.name || 'Desconhecido'
    if (!overdueByMember[fee.member_id]) {
      overdueByMember[fee.member_id] = { name: memberName, months: [], totalAmount: 0 }
    }
    const monthLabel = format(new Date(fee.reference_month + '-15T12:00:00'), 'MMM/yyyy', { locale: ptBR })
    overdueByMember[fee.member_id].months.push(monthLabel)
    overdueByMember[fee.member_id].totalAmount += Number(fee.amount)
  }
  const overdueMembers = Object.values(overdueByMember).sort((a, b) => b.totalAmount - a.totalAmount)
  const totalOverdueAmount = overdueMembers.reduce((acc, m) => acc + m.totalAmount, 0)

  // ---- Inadimplentes count (overdue fees in period + unpaid guests) ----
  const overdueFeesPeriod = filteredFees?.filter(f =>
    (f.status === 'overdue' || (f.status === 'pending' && new Date(f.due_date) < now))
  ) || []
  const unpaidGuestsCount = guests?.filter(g => !g.paid).length || 0
  const inadimplentesCount = overdueFeesPeriod.length + unpaidGuestsCount
  const inadimplentesAmount = overdueFeesPeriod.reduce((acc, f) => acc + Number(f.amount), 0) + (guests?.filter(g => !g.paid).reduce((acc, g) => acc + Number(g.amount), 0) || 0)

  // ---- Chart data ----
  const monthlyData: MonthlyFinancialData[] = []

  if (viewMode === 'year') {
    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`
      const label = format(new Date(year, m, 15), 'MMM', { locale: ptBR })

      const monthIncome =
        (chartFees?.filter(f => f.reference_month === monthKey).reduce((acc, f) => acc + Number(f.amount), 0) || 0) +
        (chartGuests?.filter(g => g.match_date?.startsWith(monthKey)).reduce((acc, g) => acc + Number(g.amount), 0) || 0)

      const monthExpenses =
        chartExpenses?.filter(e => e.expense_date?.startsWith(monthKey)).reduce((acc, e) => acc + Number(e.amount), 0) || 0

      monthlyData.push({
        month: monthKey,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        income: monthIncome,
        expenses: monthExpenses,
      })
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(selectedDate, i)
      const monthKey = format(d, 'yyyy-MM')
      const label = format(d, 'MMM', { locale: ptBR })

      const monthIncome =
        (chartFees?.filter(f => f.reference_month === monthKey).reduce((acc, f) => acc + Number(f.amount), 0) || 0) +
        (chartGuests?.filter(g => g.match_date?.startsWith(monthKey)).reduce((acc, g) => acc + Number(g.amount), 0) || 0)

      const monthExpenses =
        chartExpenses?.filter(e => e.expense_date?.startsWith(monthKey)).reduce((acc, e) => acc + Number(e.amount), 0) || 0

      monthlyData.push({
        month: monthKey,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        income: monthIncome,
        expenses: monthExpenses,
      })
    }
  }

  // ---- Balance evolution for line chart (annual view) ----
  const balanceEvolution: BalanceEvolutionData[] = []
  if (viewMode === 'year') {
    let runningBalance = saldoInicial
    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`
      const label = format(new Date(year, m, 15), 'MMM', { locale: ptBR })

      const monthIncome = monthlyData[m]?.income || 0
      const monthExp = monthlyData[m]?.expenses || 0
      runningBalance += monthIncome - monthExp

      balanceEvolution.push({
        month: monthKey,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        saldo: runningBalance,
      })
    }
  }

  // ---- Expense breakdown by category ----
  const categoryTotals: Record<string, number> = {}
  expenses?.forEach((e: any) => {
    const cat = e.category || 'other'
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount)
  })
  const expenseBreakdown: ExpenseCategoryData[] = Object.entries(categoryTotals).map(([cat, value]) => ({
    name: EXPENSE_CATEGORY_LABELS[cat] || cat,
    value,
    color: EXPENSE_CATEGORY_COLORS[cat] || '#64748b',
  }))

  return (
    <div>
      {/* Greeting + Cash Balance */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight">{greeting}, {userName}!</h1>
        <p className="text-muted-foreground text-sm mt-1">Aqui esta o resumo do seu grupo.</p>
      </div>

      <div className="card-modern-elevated mb-8 p-6 border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-green-50/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-brand-navy text-lg">Caixa do Grupo</h2>
            <p className="text-xs text-muted-foreground">Saldo acumulado de todos os meses</p>
          </div>
        </div>
        <div className={`text-4xl font-extrabold tracking-tight ${accumulatedBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          R$ {accumulatedBalance.toFixed(2)}
        </div>
        <div className="flex flex-wrap gap-4 sm:gap-6 mt-3 text-xs text-muted-foreground">
          <span>Receitas totais: <span className="font-semibold text-emerald-600">R$ {(totalAllFeesPaid + totalAllGuestsPaid).toFixed(2)}</span></span>
          <span>Despesas totais: <span className="font-semibold text-red-500">R$ {totalAllExpenses.toFixed(2)}</span></span>
        </div>
      </div>

      {/* Announcements */}
      <div className="mb-8">
        <AnnouncementsCard groupId={groupId} />
      </div>

      {/* Navigation */}
      <DashboardNav currentMonth={currentMonth} viewMode={viewMode} />

      {/* Row 1: Saldo Inicial, Receitas, Despesas, Saldo Final */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <div className="card-modern-elevated p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Saldo Inicial</span>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-sm">
              <Wallet className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold tracking-tight ${saldoInicial >= 0 ? 'text-brand-navy' : 'text-red-500'}`}>
            R$ {saldoInicial.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Saldo antes do periodo</p>
        </div>

        <div className="card-modern-elevated p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Receitas</span>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-brand-green tracking-tight">
            R$ {receitas.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Mensalidades + avulsos</p>
        </div>

        <div className="card-modern-elevated p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Despesas</span>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
              <TrendingDown className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-red-500 tracking-tight">
            R$ {despesas.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{expenses?.length || 0} despesas no {viewMode === 'year' ? 'ano' : 'mes'}</p>
        </div>

        <div className="card-modern-elevated p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Saldo Final</span>
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${saldoFinal >= 0 ? 'from-blue-500 to-indigo-600' : 'from-red-500 to-rose-600'} flex items-center justify-center shadow-sm`}>
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold tracking-tight ${saldoFinal >= 0 ? 'text-brand-green' : 'text-red-500'}`}>
            R$ {saldoFinal.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Saldo ao final do periodo</p>
        </div>
      </div>

      {/* Row 2: Mensalidades, Avulsos, Inadimplentes */}
      <div className="grid gap-4 grid-cols-3 mb-8">
        <div className="card-modern-elevated p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Mensalidades</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-brand-navy tracking-tight">
            R$ {totalFeesPaid.toFixed(2)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {paidCount}/{totalFeesCount} pagas{dmCount > 0 ? ` | ${dmCount} DM` : ''}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            R$ {totalFeesPending.toFixed(2)} pendente
          </p>
        </div>

        <div className="card-modern-elevated p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Avulsos</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-brand-navy tracking-tight">
            R$ {totalGuests.toFixed(2)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{guests?.length || 0} jogadores</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">R$ {totalGuestsPending.toFixed(2)} pendente</p>
        </div>

        <div className="card-modern-elevated p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Inadimplentes</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-sm">
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-orange-600 tracking-tight">
            {inadimplentesCount}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">R$ {inadimplentesAmount.toFixed(2)} em atraso</p>
        </div>
      </div>

      {/* Financial Charts */}
      <FinancialCharts
        monthlyData={monthlyData}
        expenseBreakdown={expenseBreakdown}
        viewMode={viewMode}
        balanceEvolution={balanceEvolution}
      />

      {/* Overdue Section (enhanced with member names + months) */}
      {overdueMembers.length > 0 && (
        <div className="card-modern-elevated mb-8 p-5 border border-red-100 bg-gradient-to-br from-red-50 to-rose-50/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-bold text-red-600">Mensalidades Atrasadas</h2>
            </div>
            <span className="text-sm font-bold text-red-600">Total: R$ {totalOverdueAmount.toFixed(2)}</span>
          </div>
          <div className="space-y-3">
            {overdueMembers.map((member, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-red-100 last:border-0">
                <div>
                  <span className="font-semibold text-red-800">{member.name}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {member.months.map((month, i) => (
                      <span key={i} className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                        {month}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="font-bold text-red-600 whitespace-nowrap ml-4">R$ {member.totalAmount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DM Leave section - only currently active */}
      {currentDmFees && currentDmFees.length > 0 && (
        <div className="card-modern-elevated mb-8 p-5 border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-bold text-blue-600">Afastados pelo DM ({currentDmFees.length})</h2>
          </div>
          <div className="space-y-2.5">
            {currentDmFees.map((fee: any) => (
              <div key={fee.id} className="flex items-center justify-between text-sm py-1">
                <span className="font-medium text-blue-800">{fee.member?.name}</span>
                <span className="text-xs text-blue-500">Sem cobranca</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rankings side by side */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <RankingCard groupId={groupId} />
        <AttendanceRanking groupId={groupId} />
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground py-4 border-t border-gray-100">
        Agora o seu grupo de futebol e uma SAF
      </div>
    </div>
  )
}
