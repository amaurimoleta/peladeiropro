import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: generate-monthly-report
 *
 * Generates a monthly financial summary for each group.
 * Stores it as a structured JSON in audit_logs for the app to render as PDF.
 *
 * Can be triggered:
 * - Via pg_cron on the 1st of each month (for previous month)
 * - Manually via POST with { group_id, reference_month }
 */

interface MonthlyReport {
  group_id: string
  group_name: string
  reference_month: string
  generated_at: string
  summary: {
    total_fees_expected: number
    total_fees_paid: number
    total_fees_pending: number
    total_guests: number
    total_guests_paid: number
    total_revenues: number
    total_expenses: number
    net_result: number
    payment_rate: number
  }
  fees_detail: {
    member_name: string
    status: string
    amount: number
    paid_at: string | null
  }[]
  expenses_detail: {
    description: string
    category: string
    amount: number
    date: string
  }[]
  revenues_detail: {
    description: string
    category: string
    amount: number
    date: string
  }[]
  guests_detail: {
    name: string
    amount: number
    paid: boolean
    date: string
  }[]
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Determine which month to report
  let targetMonth: string
  let targetGroupId: string | null = null

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      targetMonth = body.reference_month
      targetGroupId = body.group_id || null
    } catch {
      // Default to previous month
      const now = new Date()
      now.setMonth(now.getMonth() - 1)
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
  } else {
    const now = new Date()
    now.setMonth(now.getMonth() - 1)
    targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  // Get groups to process
  let groupsQuery = supabase.from('groups').select('id, name')
  if (targetGroupId) {
    groupsQuery = groupsQuery.eq('id', targetGroupId)
  }
  const { data: groups, error: groupsError } = await groupsQuery

  if (groupsError) {
    return new Response(JSON.stringify({ error: groupsError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const reports: MonthlyReport[] = []
  const firstDay = `${targetMonth}-01`
  const year = parseInt(targetMonth.split('-')[0])
  const month = parseInt(targetMonth.split('-')[1])
  const lastDay = new Date(year, month, 0).toISOString().split('T')[0]

  for (const group of groups || []) {
    // Fetch all data for this group/month in parallel
    const [
      { data: fees },
      { data: expenses },
      { data: guests },
      { data: revenues },
    ] = await Promise.all([
      supabase
        .from('monthly_fees')
        .select('amount, status, paid_at, member:group_members(name)')
        .eq('group_id', group.id)
        .eq('reference_month', targetMonth),
      supabase
        .from('expenses')
        .select('description, category, amount, expense_date')
        .eq('group_id', group.id)
        .gte('expense_date', firstDay)
        .lte('expense_date', lastDay),
      supabase
        .from('guest_players')
        .select('name, amount, paid, match_date')
        .eq('group_id', group.id)
        .gte('match_date', firstDay)
        .lte('match_date', lastDay),
      supabase
        .from('revenues')
        .select('description, category, amount, revenue_date')
        .eq('group_id', group.id)
        .gte('revenue_date', firstDay)
        .lte('revenue_date', lastDay),
    ])

    const feesArr = fees || []
    const expensesArr = expenses || []
    const guestsArr = guests || []
    const revenuesArr = revenues || []

    const totalFeesExpected = feesArr.reduce((s, f) => s + Number(f.amount), 0)
    const paidFees = feesArr.filter(f => f.status === 'paid')
    const totalFeesPaid = paidFees.reduce((s, f) => s + Number(f.amount), 0)
    const pendingFees = feesArr.filter(f => f.status === 'pending' || f.status === 'overdue')
    const totalFeesPending = pendingFees.reduce((s, f) => s + Number(f.amount), 0)
    const paidGuests = guestsArr.filter(g => g.paid)
    const totalGuestsPaid = paidGuests.reduce((s, g) => s + Number(g.amount), 0)
    const totalExpenses = expensesArr.reduce((s, e) => s + Number(e.amount), 0)
    const totalRevenues = revenuesArr.reduce((s, r) => s + Number(r.amount), 0)
    const totalIncome = totalFeesPaid + totalGuestsPaid + totalRevenues
    const netResult = totalIncome - totalExpenses
    const paymentRate = feesArr.length > 0
      ? Math.round((paidFees.length / feesArr.length) * 100)
      : 0

    const report: MonthlyReport = {
      group_id: group.id,
      group_name: group.name,
      reference_month: targetMonth,
      generated_at: new Date().toISOString(),
      summary: {
        total_fees_expected: totalFeesExpected,
        total_fees_paid: totalFeesPaid,
        total_fees_pending: totalFeesPending,
        total_guests: guestsArr.length,
        total_guests_paid: totalGuestsPaid,
        total_revenues: totalRevenues,
        total_expenses: totalExpenses,
        net_result: netResult,
        payment_rate: paymentRate,
      },
      fees_detail: feesArr.map(f => ({
        member_name: (f.member as any)?.name || 'Desconhecido',
        status: f.status,
        amount: Number(f.amount),
        paid_at: f.paid_at,
      })),
      expenses_detail: expensesArr.map(e => ({
        description: e.description,
        category: e.category,
        amount: Number(e.amount),
        date: e.expense_date,
      })),
      revenues_detail: revenuesArr.map(r => ({
        description: r.description,
        category: r.category,
        amount: Number(r.amount),
        date: r.revenue_date,
      })),
      guests_detail: guestsArr.map(g => ({
        name: g.name,
        amount: Number(g.amount),
        paid: g.paid,
        date: g.match_date,
      })),
    }

    reports.push(report)

    // Store report in audit_logs
    await supabase.from('audit_logs').insert({
      group_id: group.id,
      action: 'monthly_report_generated',
      entity_type: 'report',
      user_name: 'Sistema',
      details: report,
    })
  }

  return new Response(JSON.stringify({
    month: targetMonth,
    reports_generated: reports.length,
    reports: reports.map(r => ({
      group: r.group_name,
      income: r.summary.total_fees_paid + r.summary.total_guests_paid + r.summary.total_revenues,
      expenses: r.summary.total_expenses,
      net: r.summary.net_result,
      payment_rate: `${r.summary.payment_rate}%`,
    })),
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
