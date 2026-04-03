import { createClient } from '@/lib/supabase/server'
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, CheckCircle2, CalendarDays, Stethoscope } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import RankingCard from '@/components/dashboard/ranking-card'

export default async function GroupDashboard({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createClient()
  const currentMonth = format(new Date(), 'yyyy-MM')
  const monthLabel = format(new Date(), 'MMMM yyyy', { locale: ptBR })

  const [
    { data: group },
    { data: members },
    { data: fees },
    { data: guests },
    { data: expenses },
    { data: matches },
  ] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'active'),
    supabase.from('monthly_fees').select('*, member:group_members(name)').eq('group_id', groupId).eq('reference_month', currentMonth),
    supabase.from('guest_players').select('*').eq('group_id', groupId).gte('match_date', `${currentMonth}-01`).lte('match_date', `${currentMonth}-31`),
    supabase.from('expenses').select('*').eq('group_id', groupId).gte('expense_date', `${currentMonth}-01`).lte('expense_date', `${currentMonth}-31`),
    supabase.from('matches').select('*').eq('group_id', groupId).gte('match_date', `${currentMonth}-01`).lte('match_date', `${currentMonth}-31`).order('match_date', { ascending: false }),
  ])

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
    </div>
  )
}
