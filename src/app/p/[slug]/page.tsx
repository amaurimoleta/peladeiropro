import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DollarSign, TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EXPENSE_CATEGORIES, PIX_KEY_TYPES } from '@/lib/types'
import { ShareButton } from '@/components/shared/share-button'
import { CopyPixButton } from '@/components/shared/copy-pix-button'
import { Logo } from '@/components/shared/logo'

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('public_slug', slug)
    .single()

  if (!group) notFound()

  const currentMonth = format(new Date(), 'yyyy-MM')
  const monthLabel = format(new Date(), 'MMMM yyyy', { locale: ptBR })

  const [
    { data: fees },
    { data: guests },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('monthly_fees').select('*, member:group_members(name)').eq('group_id', group.id).eq('reference_month', currentMonth),
    supabase.from('guest_players').select('*').eq('group_id', group.id).gte('match_date', `${currentMonth}-01`).lte('match_date', `${currentMonth}-31`),
    supabase.from('expenses').select('*').eq('group_id', group.id).gte('expense_date', `${currentMonth}-01`).lte('expense_date', `${currentMonth}-31`).order('expense_date', { ascending: false }),
  ])

  const totalFeesPaid = fees?.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0) || 0
  const totalGuestsPaid = guests?.filter(g => g.paid).reduce((s, g) => s + Number(g.amount), 0) || 0
  const totalIncome = totalFeesPaid + totalGuestsPaid
  const totalExpenses = expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0
  const balance = totalIncome - totalExpenses
  const paidCount = fees?.filter(f => f.status === 'paid').length || 0
  const totalFeesCount = fees?.length || 0

  return (
    <div className="min-h-screen gradient-surface">
      {/* Header */}
      <header className="gradient-brand-hero text-white">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{group.name}</h1>
          <p className="text-white/50 text-sm capitalize mt-2 tracking-wide">Prestação de contas - {monthLabel}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Balance Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-modern-elevated p-4 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-2 shadow-sm">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Entradas</p>
            <p className="text-lg font-bold text-brand-green">R$ {totalIncome.toFixed(2)}</p>
          </div>
          <div className="card-modern-elevated p-4 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-2 shadow-sm">
              <TrendingDown className="h-4 w-4 text-white" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Saídas</p>
            <p className="text-lg font-bold text-red-500">R$ {totalExpenses.toFixed(2)}</p>
          </div>
          <div className="card-modern-elevated p-4 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-2 shadow-sm">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Saldo</p>
            <p className={`text-lg font-bold ${balance >= 0 ? 'text-brand-green' : 'text-red-500'}`}>
              R$ {balance.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Mensalidades */}
        <div className="card-modern-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-brand-navy">Mensalidades</h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green">{paidCount}/{totalFeesCount}</span>
          </div>
          <div className="space-y-2.5">
            {fees?.map((fee: any) => (
              <div key={fee.id} className="flex items-center justify-between text-sm py-1">
                <span className="font-medium text-brand-navy">{fee.member?.name}</span>
                {fee.status === 'paid' ? (
                  <span className="flex items-center gap-1.5 text-brand-green font-medium text-xs"><CheckCircle2 className="h-3.5 w-3.5" />Pago</span>
                ) : fee.status === 'overdue' ? (
                  <span className="flex items-center gap-1.5 text-red-500 font-medium text-xs"><AlertCircle className="h-3.5 w-3.5" />Atrasado</span>
                ) : fee.status === 'waived' ? (
                  <span className="text-muted-foreground text-xs">Dispensado</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-500 font-medium text-xs"><Clock className="h-3.5 w-3.5" />Pendente</span>
                )}
              </div>
            ))}
            {(!fees || fees.length === 0) && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma mensalidade gerada.</p>
            )}
          </div>
        </div>

        {/* Despesas */}
        <div className="card-modern-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-brand-navy">Despesas do Mês</h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500">R$ {totalExpenses.toFixed(2)}</span>
          </div>
          <div className="space-y-2.5">
            {expenses?.map((exp: any) => (
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
            {(!expenses || expenses.length === 0) && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma despesa registrada.</p>
            )}
          </div>
        </div>

        {/* Avulsos */}
        {guests && guests.length > 0 && (
          <div className="card-modern-elevated p-5">
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
          <div className="card-modern-elevated p-5 border-brand-green/20 bg-gradient-to-br from-brand-green/5 to-transparent">
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
                  <span className="font-mono font-semibold text-brand-navy">{group.pix_key}</span>
                  <CopyPixButton pixKey={group.pix_key} />
                </div>
              </div>
              {group.pix_beneficiary_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Beneficiário:</span>
                  <span className="font-semibold">{group.pix_beneficiary_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Share button */}
        <div className="flex justify-center pt-4 pb-8">
          <ShareButton groupName={group.name} slug={slug} />
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <div className="flex justify-center mb-2">
            <Logo size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">Gestão de tesouraria para peladas</p>
        </div>
      </main>
    </div>
  )
}
