import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: send-reminders
 *
 * Runs daily via pg_cron. Finds overdue/pending fees and generates
 * reminder records. Groups can configure WhatsApp notification via
 * the reminders table.
 *
 * Logic:
 * - 3 days BEFORE due_date: "Lembrete amigavel"
 * - ON due_date: "Hoje vence sua mensalidade"
 * - 3 days AFTER due_date: "Sua mensalidade esta atrasada"
 * - 7+ days AFTER: "Urgente: mensalidade em atraso"
 */

interface ReminderPayload {
  group_id: string
  group_name: string
  member_id: string
  member_name: string
  member_phone: string | null
  fee_id: string
  amount: number
  due_date: string
  reference_month: string
  reminder_type: 'pre_due' | 'due_day' | 'post_due' | 'urgent'
  pix_key: string | null
  pix_beneficiary_name: string | null
  message: string
}

function buildMessage(
  type: string,
  memberName: string,
  groupName: string,
  amount: number,
  monthLabel: string,
  pixKey: string | null,
  pixBeneficiary: string | null,
): string {
  const pixInfo = pixKey
    ? `\n\n💰 Chave PIX: ${pixKey}${pixBeneficiary ? `\nFavorecido: ${pixBeneficiary}` : ''}`
    : ''

  switch (type) {
    case 'pre_due':
      return `Ola ${memberName}! 👋\n\nLembrete: sua mensalidade de ${monthLabel} no valor de R$ ${amount.toFixed(2)} vence em 3 dias.${pixInfo}\n\nObrigado! ⚽\n- ${groupName}`

    case 'due_day':
      return `Ola ${memberName}! ⚽\n\nHoje vence sua mensalidade de ${monthLabel} no valor de R$ ${amount.toFixed(2)}.${pixInfo}\n\nPague hoje e fique em dia!\n- ${groupName}`

    case 'post_due':
      return `Ola ${memberName}! ⚠️\n\nSua mensalidade de ${monthLabel} no valor de R$ ${amount.toFixed(2)} esta atrasada ha 3 dias.${pixInfo}\n\nRegularize para manter sua posicao no ranking! 📊\n- ${groupName}`

    case 'urgent':
      return `Ola ${memberName}! 🚨\n\nSua mensalidade de ${monthLabel} no valor de R$ ${amount.toFixed(2)} esta com mais de 7 dias de atraso.\n\nSeu ranking esta sendo impactado! Regularize o quanto antes.${pixInfo}\n\n- ${groupName}`

    default:
      return ''
  }
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Calculate target dates
  const in3Days = new Date(today)
  in3Days.setDate(in3Days.getDate() + 3)
  const in3DaysStr = in3Days.toISOString().split('T')[0]

  const ago3Days = new Date(today)
  ago3Days.setDate(ago3Days.getDate() - 3)
  const ago3DaysStr = ago3Days.toISOString().split('T')[0]

  const ago7Days = new Date(today)
  ago7Days.setDate(ago7Days.getDate() - 7)
  const ago7DaysStr = ago7Days.toISOString().split('T')[0]

  // Get all pending/overdue fees with member and group info
  const { data: fees, error: feesError } = await supabase
    .from('monthly_fees')
    .select(`
      id, amount, due_date, reference_month, status,
      member:group_members(id, name, phone),
      group:groups(id, name, pix_key, pix_beneficiary_name)
    `)
    .in('status', ['pending', 'overdue'])

  if (feesError) {
    return new Response(JSON.stringify({ error: feesError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const reminders: ReminderPayload[] = []

  for (const fee of fees || []) {
    const member = fee.member as any
    const group = fee.group as any
    if (!member || !group) continue

    const dueDate = fee.due_date
    let reminderType: string | null = null

    if (dueDate === in3DaysStr) {
      reminderType = 'pre_due'
    } else if (dueDate === todayStr) {
      reminderType = 'due_day'
    } else if (dueDate === ago3DaysStr) {
      reminderType = 'post_due'
    } else if (dueDate === ago7DaysStr) {
      reminderType = 'urgent'
    }

    if (!reminderType) continue

    const monthLabel = fee.reference_month
    const message = buildMessage(
      reminderType,
      member.name,
      group.name,
      Number(fee.amount),
      monthLabel,
      group.pix_key,
      group.pix_beneficiary_name,
    )

    reminders.push({
      group_id: group.id,
      group_name: group.name,
      member_id: member.id,
      member_name: member.name,
      member_phone: member.phone,
      fee_id: fee.id,
      amount: Number(fee.amount),
      due_date: dueDate,
      reference_month: fee.reference_month,
      reminder_type: reminderType as any,
      pix_key: group.pix_key,
      pix_beneficiary_name: group.pix_beneficiary_name,
      message,
    })
  }

  // Store reminders in audit log for now (can be extended to send via WhatsApp API/email)
  for (const reminder of reminders) {
    await supabase.from('audit_logs').insert({
      group_id: reminder.group_id,
      action: `reminder_${reminder.reminder_type}`,
      entity_type: 'monthly_fee',
      entity_id: reminder.fee_id,
      user_name: 'Sistema',
      details: {
        member_name: reminder.member_name,
        member_phone: reminder.member_phone,
        amount: reminder.amount,
        reference_month: reminder.reference_month,
        message: reminder.message,
        reminder_type: reminder.reminder_type,
      },
    })
  }

  return new Response(JSON.stringify({
    processed: reminders.length,
    reminders: reminders.map(r => ({
      member: r.member_name,
      type: r.reminder_type,
      phone: r.member_phone,
      month: r.reference_month,
    })),
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
