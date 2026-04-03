'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { EXPENSE_CATEGORIES } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, Minus } from 'lucide-react'

type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES

export default function DREPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [fees, setFees] = useState<any[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const currentMonth = format(currentDate, 'yyyy-MM')

  async function loadData() {
    setLoading(true)
    const [{ data: feesData }, { data: guestsData }, { data: expensesData }] = await Promise.all([
      supabase
        .from('monthly_fees')
        .select('*')
        .eq('group_id', groupId)
        .eq('reference_month', currentMonth)
        .eq('status', 'paid'),
      supabase
        .from('guest_players')
        .select('*')
        .eq('group_id', groupId)
        .gte('match_date', `${currentMonth}-01`)
        .lte('match_date', `${currentMonth}-31`)
        .eq('paid', true),
      supabase
        .from('expenses')
        .select('*')
        .eq('group_id', groupId)
        .gte('expense_date', `${currentMonth}-01`)
        .lte('expense_date', `${currentMonth}-31`),
    ])
    setFees(feesData || [])
    setGuests(guestsData || [])
    setExpenses(expensesData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [groupId, currentMonth])

  // Income calculations
  const totalFees = fees.reduce((sum, f) => sum + Number(f.amount), 0)
  const totalGuests = guests.reduce((sum, g) => sum + Number(g.amount), 0)
  const totalIncome = totalFees + totalGuests

  // Expense calculations by category
  const expensesByCategory = expenses.reduce((acc, e) => {
    const cat = e.category as ExpenseCategory
    acc[cat] = (acc[cat] || 0) + Number(e.amount)
    return acc
  }, {} as Record<ExpenseCategory, number>)

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // Result
  const netResult = totalIncome - totalExpenses

  // Max value for proportional bars
  const allValues = [
    totalFees,
    totalGuests,
    ...Object.values(expensesByCategory),
  ].filter(v => v > 0)
  const maxValue = Math.max(...allValues, 1)

  function formatCurrency(value: number) {
    return `R$ ${value.toFixed(2)}`
  }

  function percentage(value: number, total: number) {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  function BarLine({
    label,
    value,
    total,
    color,
    icon,
  }: {
    label: string
    value: number
    total: number
    color: string
    icon?: React.ReactNode
  }) {
    const pct = percentage(value, total)
    const barWidth = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium text-[#1B1F4B]">{label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{pct}%</span>
            <span className="text-sm font-semibold tabular-nums min-w-[100px] text-right">
              {formatCurrency(value)}
            </span>
          </div>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1B1F4B]">DRE</h1>
          <p className="text-muted-foreground">Demonstrativo do Resultado do Exercicio</p>
        </div>
        <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B1F4B]">DRE</h1>
        <p className="text-muted-foreground">Demonstrativo do Resultado do Exercicio</p>
      </div>

      <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-l-4 border-l-[#00C853]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[#00C853]/10 p-2">
                <TrendingUp className="h-5 w-5 text-[#00C853]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receitas</p>
                <p className="text-xl font-bold text-[#00C853]">{formatCurrency(totalIncome)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-500/10 p-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Despesas</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${netResult >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2 ${netResult >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                <DollarSign className={`h-5 w-5 ${netResult >= 0 ? 'text-blue-500' : 'text-red-500'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Resultado</p>
                <p className={`text-xl font-bold ${netResult >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                  {netResult >= 0 ? '+' : ''}{formatCurrency(netResult)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DRE Report */}
      <Card className="shadow-lg">
        <CardContent className="py-6 space-y-8">
          {/* RECEITAS */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-[#00C853]" />
              <h2 className="text-lg font-bold text-[#1B1F4B]">Receitas</h2>
            </div>
            <div className="space-y-4 pl-1">
              <BarLine
                label={`Mensalidades pagas (${fees.length})`}
                value={totalFees}
                total={totalIncome}
                color="#00C853"
              />
              <BarLine
                label={`Avulsos pagos (${guests.length})`}
                value={totalGuests}
                total={totalIncome}
                color="#66BB6A"
              />
            </div>
            <div className="mt-4 pt-3 border-t border-dashed flex items-center justify-between">
              <span className="text-sm font-bold text-[#1B1F4B]">Total de Receitas</span>
              <span className="text-sm font-bold text-[#00C853]">{formatCurrency(totalIncome)}</span>
            </div>
          </section>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <Minus className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* DESPESAS */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold text-[#1B1F4B]">Despesas</h2>
            </div>
            <div className="space-y-4 pl-1">
              {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((cat) => {
                const value = expensesByCategory[cat] || 0
                if (value === 0 && totalExpenses > 0) return null
                return (
                  <BarLine
                    key={cat}
                    label={EXPENSE_CATEGORIES[cat]}
                    value={value}
                    total={totalExpenses}
                    color="#EF4444"
                  />
                )
              })}
              {totalExpenses === 0 && (
                <p className="text-sm text-muted-foreground italic">Nenhuma despesa registrada neste mes.</p>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-dashed flex items-center justify-between">
              <span className="text-sm font-bold text-[#1B1F4B]">Total de Despesas</span>
              <span className="text-sm font-bold text-red-500">{formatCurrency(totalExpenses)}</span>
            </div>
          </section>

          {/* Separator */}
          <div className="h-px bg-border" />

          {/* RESULTADO */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className={`h-5 w-5 ${netResult >= 0 ? 'text-[#00C853]' : 'text-red-500'}`} />
              <h2 className="text-lg font-bold text-[#1B1F4B]">Resultado</h2>
            </div>
            <div className="rounded-lg p-4 space-y-2"
              style={{
                backgroundColor: netResult >= 0 ? 'rgba(0, 200, 83, 0.06)' : 'rgba(239, 68, 68, 0.06)',
              }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Receitas</span>
                <span className="text-[#00C853] font-medium">{formatCurrency(totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Despesas</span>
                <span className="text-red-500 font-medium">- {formatCurrency(totalExpenses)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex items-center justify-between">
                <span className="text-base font-bold text-[#1B1F4B]">Resultado Liquido</span>
                <span className={`text-lg font-bold ${netResult >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
                  {netResult >= 0 ? '+' : ''}{formatCurrency(netResult)}
                </span>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
