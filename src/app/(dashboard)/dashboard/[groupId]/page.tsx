import { createClient } from '@/lib/supabase/server'
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, CheckCircle2, CalendarDays, Stethoscope, Wallet, Activity, BarChart3, UserCheck } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import RankingCard from '@/components/dashboard/ranking-card'
import AnnouncementsCard from '@/components/dashboard/announcements-card'
import FinancialCharts from '@/components/dashboard/financial-charts'
import type { MonthlyFinancialData, ExpenseCategoryData } from '@/components/dashboard/financial-charts'

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

const ACTION_ICONS: Record<string, string> = {
  create: '➕',
  update: '✏️',
  delete: '🗑️',
  payment: '💰',
  default: '📋',
}

export default async function GroupDashboard({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createClient()
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')
  const monthLabel = format(now, 'MMMM yyyy', { locale: ptBR })

  // Build date ranges for last 6 months (for charts)
  const sixMonthsAgo = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd')

  const [
    { data: group },
    { data: members },
    { data: fees },
    { data: guests },
    { data: expenses },
    { data: matches },
    // All-time queries for accumulated balance
    { data: allFees },
    { data: allGuests },
    { data: allExpenses },
    // Audit logs
    { data: auditLogs },
    // Attendance for current month
    { data: matchAttendance },
    // Last 6 months data for charts
    { data: chartFees },
    { data: chartGuests },
    { data: chartExpenses },
  ] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'active'),
    supabase.from('monthly_fees').select('*, member:group_members(name)').eq('group_id', groupId).eq('reference_month', currentMonth),
    supabase.from('guest_players').select('*').eq('group_id', groupId).gte('match_date', `${currentMonth}-01`).lte('match_date', `${currentMonth}-31`),
    supabase.from('expenses').select('*').eq('group_id', groupId).gte('expense_date', `${currentMonth}-01`).lte('expense_date', `${currentMonth}-31`),
    supabase.from('matches').select('*').eq('group_id', groupId).gte('match_date', `${currentMonth}-01`).lte('match_date', `${currentMonth}-31`).order('match_date', { ascending: false }),
    // All-time for accumulated balance
    supabase.from('monthly_fees').select('amount').eq('group_id', groupId).eq('status', 'paid'),
    supabase.from('guest_players').select('amount').eq('group_id', groupId).eq('paid', true),
    supabase.from('expenses').select('amount').eq('group_id', groupId),
    // Audit logs
    supabase.from('audit_logs').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(10),
    // Match attendance for current month matches
    supabase.from('match_attendance').select('*, member:group_members(name), match:matches(match_date, group_id)').eq('present', true),
    // Chart data: fees, guests, expenses for last 6 months
    supabase.from('monthly_fees').select('amount, reference_month, status').eq('group_id', groupId).eq('status', 'paid').gte('reference_month', format(subMonths(now, 5), 'yyyy-MM')),
    supabase.from('guest_players').select('amount, match_date, paid').eq('group_id', groupId).eq('paid', true).gte('match_date', sixMonthsAgo),
    supabase.from('expenses').select('amount, expense_date, category').eq('group_id', groupId).gte('expense_date', sixMonthsAgo),
  ])

  // ---- Accumulated balance (all-time) ----
  const totalAllFeesPaid = allFees?.reduce((acc, f) => acc + Number(f.amount), 0) || 0
  const totalAllGuestsPaid = allGuests?.reduce((acc, g) => acc + Number(g.amount), 0) || 0
  const totalAllExpenses = allExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0
  const accumulatedBalance = totalAllFeesPaid + totalAllGuestsPaid - totalAllExpenses

  // ---- Current month calculations ----
  const totalFeesPaid = fees?.filter(f => f.status === 'paid').reduce((acc, f) => acc + Number(f.amount), 0) || 0
  const totalFeesPending = fees?.filter(f => f.status !== 'paid' && f.status !== 'waived' && f.status !== 'dm_leave').reduce((acc, f) => acc + Number(f.amount), 0) || 0
  const totalGuests = guests?.filter(g => g.paid).reduce((acc, g) => acc + Number(g.amount), 0) || 0
  const totalGuestsPending = guests?.filter(g => !g.paid).reduce((acc, g) => acc + Number(g.amount), 0) || 0
  const totalExpenses = expenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0
  const totalIncome = totalFeesPaid + totalGuests
  const balance = totalIncome - totalExpenses

  const paidCount = fees?.filter(f => f.status === 'paid').length || 0
  const dmCount = fees?.filter(f => f.status === 'dm_leave').length || 0
  const totalFeesCount = fees?.length || 0
  const overdueFees = fees?.filter(f => f.status === 'overdue' || (f.status === 'pending' && new Date(f.due_date) < new Date())) || []

  const mensalistas = members?.filter(m => m.member_type === 'mensalista').length || 0
  const avulsos = members?.filter(m => m.member_type === 'avulso').length || 0

  // ---- Chart data: last 6 months ----
  const monthlyData: MonthlyFinancialData[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i)
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

  // ---- Expense breakdown by category (current month) ----
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

  // ---- Attendance stats (current month) ----
  const currentMonthMatchIds = new Set(matches?.map(m => m.id) || [])
  const currentMonthAttendance = matchAttendance?.filter(
    (a: any) => a.match?.group_id === groupId && currentMonthMatchIds.has(a.match_id)
  ) || []
  const totalMatchesThisMonth = matches?.length || 0
  const averageAttendance = totalMatchesThisMonth > 0
    ? Math.round(currentMonthAttendance.length / totalMatchesThisMonth)
    : 0

  // Most frequent player
  const playerCounts: Record<string, { name: string; count: number }> = {}
  currentMonthAttendance.forEach((a: any) => {
    const name = a.member?.name || 'Desconhecido'
    if (!playerCounts[a.member_id]) {
      playerCounts[a.member_id] = { name, count: 0 }
    }
    playerCounts[a.member_id].count++
  })
  const mostFrequentPlayer = Object.values(playerCounts).sort((a, b) => b.count - a.count)[0]

  const summaryCards = [
    {
      label: 'Saldo do Mes',
      value: `R$ ${balance.toFixed(2)}`,
      subtitle: 'Entradas - Despesas',
      icon: DollarSign,
      gradient: 'from-blue-500 to-indigo-600',
      valueColor: balance >= 0 ? 'text-brand-green' : 'text-red-500',
    },
    {
      label: 'Mensalidades',
      value: `R$ ${totalFeesPaid.toFixed(2)}`,
      subtitle: `${paidCount}/${totalFeesCount} pagas${dmCount > 0 ? ` | ${dmCount} DM` : ''} | R$ ${totalFeesPending.toFixed(2)} pendente`,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-green-600',
      valueColor: 'text-brand-navy',
    },
    {
      label: 'Avulsos',
      value: `R$ ${totalGuests.toFixed(2)}`,
      subtitle: `${guests?.length || 0} jogadores | R$ ${totalGuestsPending.toFixed(2)} pendente`,
      icon: Users,
      gradient: 'from-violet-500 to-purple-600',
      valueColor: 'text-brand-navy',
    },
    {
      label: 'Despesas',
      value: `R$ ${totalExpenses.toFixed(2)}`,
      subtitle: `${expenses?.length || 0} despesas no mes`,
      icon: TrendingDown,
      gradient: 'from-red-500 to-rose-600',
      valueColor: 'text-red-500',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight">{group?.name}</h1>
        <p className="text-muted-foreground capitalize mt-1">{monthLabel}</p>
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
          <span>{mensalistas} mensalistas</span>
          <span>{avulsos} avulsos</span>
          <span>{matches?.length || 0} jogos no mes</span>
        </div>
      </div>

      <AnnouncementsCard groupId={groupId} />

      {/* Caixa do Grupo - Accumulated Balance */}
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
        <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
          <span>Receitas totais: <span className="font-semibold text-emerald-600">R$ {(totalAllFeesPaid + totalAllGuestsPaid).toFixed(2)}</span></span>
          <span>Despesas totais: <span className="font-semibold text-red-500">R$ {totalAllExpenses.toFixed(2)}</span></span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {summaryCards.map((card) => (
          <div key={card.label} className="card-modern-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
              <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm`}>
                <card.icon className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className={`text-2xl font-extrabold ${card.valueColor} tracking-tight`}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Attendance Stats */}
      {totalMatchesThisMonth > 0 && (
        <div className="card-modern-elevated mb-8 p-5 border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-violet-50/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <UserCheck className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-bold text-brand-navy">Frequencia do Mes</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-brand-navy">{totalMatchesThisMonth}</div>
              <p className="text-xs text-muted-foreground mt-1">Jogos no mes</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-brand-navy">{averageAttendance}</div>
              <p className="text-xs text-muted-foreground mt-1">Media por jogo</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-brand-navy truncate">
                {mostFrequentPlayer ? mostFrequentPlayer.name.split(' ')[0] : '-'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {mostFrequentPlayer ? `${mostFrequentPlayer.count} presenças` : 'Mais frequente'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Financial Charts */}
      <FinancialCharts monthlyData={monthlyData} expenseBreakdown={expenseBreakdown} />

      {/* Matches this month */}
      {matches && matches.length > 0 && (
        <div className="card-modern-elevated mb-8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-bold text-brand-navy">Jogos do Mes ({matches.length})</h2>
          </div>
          <div className="space-y-2.5">
            {matches.slice(0, 5).map((match: any) => (
              <div key={match.id} className="flex items-center justify-between text-sm py-1">
                <span className="font-medium text-brand-navy">
                  {format(new Date(match.match_date + 'T12:00:00'), 'dd/MM/yyyy')}
                  {match.location && <span className="text-muted-foreground ml-2">- {match.location}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue section */}
      {overdueFees.length > 0 && (
        <div className="card-modern-elevated mb-8 p-5 border border-red-100 bg-gradient-to-br from-red-50 to-rose-50/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
              <AlertCircle className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-bold text-red-600">Mensalidades Atrasadas ({overdueFees.length})</h2>
          </div>
          <div className="space-y-2.5">
            {overdueFees.map((fee: any) => (
              <div key={fee.id} className="flex items-center justify-between text-sm py-1">
                <span className="font-medium text-red-800">{fee.member?.name}</span>
                <span className="font-semibold text-red-600">R$ {Number(fee.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DM Leave section */}
      {dmCount > 0 && (
        <div className="card-modern-elevated mb-8 p-5 border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-bold text-blue-600">Afastados pelo DM ({dmCount})</h2>
          </div>
          <div className="space-y-2.5">
            {fees?.filter(f => f.status === 'dm_leave').map((fee: any) => (
              <div key={fee.id} className="flex items-center justify-between text-sm py-1">
                <span className="font-medium text-blue-800">{fee.member?.name}</span>
                <span className="text-xs text-blue-500">Sem cobranca</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-modern-elevated p-5">
          <h2 className="font-bold text-brand-navy mb-4">Ultimos Pagamentos</h2>
          {fees?.filter(f => f.status === 'paid').length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum pagamento neste mes.</p>
          ) : (
            <div className="space-y-3">
              {fees?.filter(f => f.status === 'paid').slice(0, 5).map((fee: any) => (
                <div key={fee.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-brand-green" />
                    <span className="text-sm font-medium text-brand-navy">{fee.member?.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-brand-green">R$ {Number(fee.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-modern-elevated p-5">
          <h2 className="font-bold text-brand-navy mb-4">Despesas Recentes</h2>
          {!expenses || expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma despesa neste mes.</p>
          ) : (
            <div className="space-y-3">
              {expenses.slice(0, 5).map((expense: any) => (
                <div key={expense.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-brand-navy">{expense.description}</span>
                  <span className="text-sm font-semibold text-red-500">- R$ {Number(expense.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ranking Card */}
      <div className="mt-8">
        <RankingCard groupId={groupId} />
      </div>

      {/* Audit Log Preview */}
      {auditLogs && auditLogs.length > 0 && (
        <div className="card-modern-elevated mt-8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-sm">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-bold text-brand-navy">Atividade Recente</h2>
          </div>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />
            <div className="space-y-4">
              {auditLogs.map((log: any, index: number) => {
                const actionKey = log.action?.includes('create') ? 'create'
                  : log.action?.includes('update') ? 'update'
                  : log.action?.includes('delete') ? 'delete'
                  : log.action?.includes('pay') || log.action?.includes('paid') ? 'payment'
                  : 'default'
                const icon = ACTION_ICONS[actionKey]

                return (
                  <div key={log.id} className="flex items-start gap-3 relative pl-1">
                    <div className="h-6 w-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-xs z-10 shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-brand-navy">{log.user_name || 'Sistema'}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {log.action}
                        {log.entity_type && <span className="ml-1">({log.entity_type})</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
