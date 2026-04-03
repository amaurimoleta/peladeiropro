'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DollarSign, TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle, Stethoscope, CalendarDays, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EXPENSE_CATEGORIES, PIX_KEY_TYPES } from '@/lib/types'
import { ShareButton } from '@/components/shared/share-button'
import { CopyPixButton } from '@/components/shared/copy-pix-button'
import { Logo } from '@/components/shared/logo'
import { MonthNavigator } from '@/components/shared/month-navigator'

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
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const currentMonth = format(currentDate, 'yyyy-MM')
  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  useEffect(() => {
    async function loadGroup() {
      const { data } = await supabase.from('groups').select('*').eq('public_slug', slug).single()
      if (!data) { setNotFound(true); setLoading(false); return }
      setGroup(data)
    }
    loadGroup()
  }, [slug])

  useEffect(() => {
    if (!group) return
    async function loadData() {
      setLoading(true)
      const [{ data: feesData }, { data: guestsData }, { data: expensesData }, { data: matchesData }] = await Promise.all([
        supabase.from('monthly_fees').select('*, member:group_members(name, member_type)').eq('group_id', group.id).eq('reference_month', currentMonth),
        supabase.from('guest_players').select('*').eq('group_id', group.id).gte('match_date', `${currentMonth}-01`).lte('match_date', `${currentMonth}-31`),
        supabase.from('expenses').select('*').eq('group_id', group.id).gte('expense_date', `${currentMonth}-01`).lte('expense_date', `${currentMonth}-31`).order('expense_date', { ascending: false }),
        supabase.from('matches').select('*').eq('group_id', group.id).gte('match_date', `${currentMonth}-01`).lte('match_date', `${currentMonth}-31`).order('match_date', { ascending: false }),
      ])
      setFees(feesData || [])
      setGuests(guestsData || [])
      setExpenses(expensesData || [])
      setMatches(matchesData || [])
      setLoading(false)
    }
    loadData()
  }, [group, currentMonth])

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

  const totalFeesPaid = fees.filter(f => f.status === 'paid').reduce((s: number, f: any) => s + Number(f.amount), 0)
  const totalGuestsPaid = guests.filter(g => g.paid).reduce((s: number, g: any) => s + Number(g.amount), 0)
  const totalIncome = totalFeesPaid + totalGuestsPaid
  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
  const balance = totalIncome - totalExpenses
  const paidCount = fees.filter(f => f.status === 'paid').length
  const totalFeesCount = fees.length

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

  return (
    <div className="min-h-screen gradient-surface">
      {/* Header */}
      <header className="gradient-brand-hero text-white">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{group.name}</h1>
          <p className="text-white/50 text-sm capitalize mt-2 tracking-wide">Prestacao de contas</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Month navigation */}
        <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <>
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
                <p className="text-xs text-muted-foreground font-medium">Saidas</p>
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

            {/* Jogos do Mes */}
            {matches.length > 0 && (
              <div className="card-modern-elevated p-5">
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mensalidades */}
            <div className="card-modern-elevated p-5">
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
                    {feeStatusDisplay(fee)}
                  </div>
                ))}
                {fees.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma mensalidade gerada.</p>
                )}
              </div>
            </div>

            {/* Despesas */}
            <div className="card-modern-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-brand-navy">Despesas do Mes</h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500">R$ {totalExpenses.toFixed(2)}</span>
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
                      <span className="text-muted-foreground">Beneficiario:</span>
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
          </>
        )}

        {/* Footer */}
        <div className="text-center pb-8">
          <div className="flex justify-center mb-2">
            <Logo size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">Gestao de tesouraria para peladas</p>
        </div>
      </main>
    </div>
  )
}
