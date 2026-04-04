'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Check, Clock, AlertCircle, Zap, Stethoscope, Plus, Trash2, Pencil,
  TrendingUp, TrendingDown, DollarSign, CreditCard, Receipt, BarChart3, Minus,
  MessageCircle, Send, Image, Eye, Wallet, Users, ShieldAlert,
  ChevronLeft, ChevronRight, CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, endOfMonth } from 'date-fns'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { EXPENSE_CATEGORIES, type Expense, type GroupMember, type Group, type MonthlyFee } from '@/lib/types'
import { useGroupRole } from '@/hooks/use-group-role'
import { uploadReceipt } from '@/lib/upload-receipt'
import { logAudit } from '@/lib/audit'

type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES

const categoryColors: Record<string, string> = {
  court_rental: 'bg-blue-100 text-blue-700',
  goalkeeper: 'bg-purple-100 text-purple-700',
  equipment: 'bg-orange-100 text-orange-700',
  drinks: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-700',
}


export default function FinanceiroPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { role, isAdmin, isReadOnly } = useGroupRole(groupId)

  // Shared state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])

  // Mensalidades state
  const [fees, setFees] = useState<(MonthlyFee & { member?: { name: string; member_type: string; phone?: string | null } })[]>([])
  const [generating, setGenerating] = useState(false)

  // Despesas state
  const [expenses, setExpenses] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [category, setCategory] = useState<string>('court_rental')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paidBy, setPaidBy] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Avulsos state
  const [allGuests, setAllGuests] = useState<any[]>([])
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [editGuestDialogOpen, setEditGuestDialogOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<any>(null)
  const [guestName, setGuestName] = useState('')
  const [guestDate, setGuestDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [guestAmount, setGuestAmount] = useState('')
  const [guestNotes, setGuestNotes] = useState('')
  const [savingGuest, setSavingGuest] = useState(false)
  const [guestPaymentDate, setGuestPaymentDate] = useState('')
  const [guestReceiptFile, setGuestReceiptFile] = useState<File | null>(null)
  const guestReceiptInputRef = useRef<HTMLInputElement>(null)

  // DRE state
  const [paidGuests, setPaidGuests] = useState<any[]>([])
  const [dreView, setDreView] = useState<'mensal' | 'anual'>('mensal')
  const [dreYear, setDreYear] = useState(new Date().getFullYear())
  const [dreAnnualLoading, setDreAnnualLoading] = useState(false)
  const [dreAnnualFees, setDreAnnualFees] = useState<any[]>([])
  const [dreAnnualGuests, setDreAnnualGuests] = useState<any[]>([])
  const [dreAnnualExpenses, setDreAnnualExpenses] = useState<any[]>([])

  // Saldo Acumulado state
  const [allTimeFees, setAllTimeFees] = useState(0)
  const [allTimeGuests, setAllTimeGuests] = useState(0)
  const [allTimeExpenses, setAllTimeExpenses] = useState(0)

  // Saldo Inicial do mes (tudo antes do mes atual)
  const [priorFees, setPriorFees] = useState(0)
  const [priorGuests, setPriorGuests] = useState(0)
  const [priorExpenses, setPriorExpenses] = useState(0)

  // WhatsApp cobranca state
  const [cobrancaDialogOpen, setCobrancaDialogOpen] = useState(false)

  // Receipt upload state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null)
  const [payingFeeName, setPayingFeeName] = useState<string>('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [paymentDate, setPaymentDate] = useState('')
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Edit payment dialog state
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false)
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [editingFeeName, setEditingFeeName] = useState<string>('')
  const [editPaymentDate, setEditPaymentDate] = useState('')
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('paid')
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null)
  const [savingEditPayment, setSavingEditPayment] = useState(false)
  const editReceiptInputRef = useRef<HTMLInputElement>(null)

  // Receipt viewer state
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null)


  const currentMonth = format(currentDate, 'yyyy-MM')

  const loadData = useCallback(async () => {
    setLoading(true)
    const endDay = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const [
      { data: groupData },
      { data: membersData },
      { data: feesData },
      { data: expensesData },
      { data: guestsAllData },
    ] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'active').order('name'),
      supabase.from('monthly_fees').select('*, member:group_members(name, member_type, phone, position)').eq('group_id', groupId).eq('reference_month', currentMonth),
      supabase.from('expenses').select('*, paid_by_member:group_members(name)').eq('group_id', groupId).gte('expense_date', `${currentMonth}-01`).lte('expense_date', endDay).order('expense_date', { ascending: false }),
      supabase.from('guest_players').select('*').eq('group_id', groupId).gte('match_date', `${currentMonth}-01`).lte('match_date', endDay).order('match_date', { ascending: false }),
    ])
    setGroup(groupData)
    setMembers(membersData || [])
    setFees(feesData || [])
    setExpenses(expensesData || [])
    const guestsArr = guestsAllData || []
    setAllGuests(guestsArr)
    setPaidGuests(guestsArr.filter((g: any) => g.paid))
    setLoading(false)
  }, [groupId, currentMonth])

  // Load accumulated balance (all-time) and prior-month balance
  const loadAccumulatedBalance = useCallback(async () => {
    const firstDay = `${currentMonth}-01`

    const [
      { data: allFees },
      { data: allGuests },
      { data: allExpenses },
      // Prior to current month (for saldo inicial)
      { data: priorFeesData },
      { data: priorGuestsData },
      { data: priorExpensesData },
    ] = await Promise.all([
      supabase.from('monthly_fees').select('amount').eq('group_id', groupId).eq('status', 'paid'),
      supabase.from('guest_players').select('amount').eq('group_id', groupId).eq('paid', true),
      supabase.from('expenses').select('amount').eq('group_id', groupId),
      // Fees paid before current month
      supabase.from('monthly_fees').select('amount').eq('group_id', groupId).eq('status', 'paid').lt('reference_month', currentMonth),
      // Guests paid before current month
      supabase.from('guest_players').select('amount').eq('group_id', groupId).eq('paid', true).lt('match_date', firstDay),
      // Expenses before current month
      supabase.from('expenses').select('amount').eq('group_id', groupId).lt('expense_date', firstDay),
    ])
    setAllTimeFees((allFees || []).reduce((sum, f) => sum + Number(f.amount), 0))
    setAllTimeGuests((allGuests || []).reduce((sum, g) => sum + Number(g.amount), 0))
    setAllTimeExpenses((allExpenses || []).reduce((sum, e) => sum + Number(e.amount), 0))
    setPriorFees((priorFeesData || []).reduce((sum, f) => sum + Number(f.amount), 0))
    setPriorGuests((priorGuestsData || []).reduce((sum, g) => sum + Number(g.amount), 0))
    setPriorExpenses((priorExpensesData || []).reduce((sum, e) => sum + Number(e.amount), 0))
  }, [groupId, currentMonth])

  useEffect(() => {
    loadData()
    loadAccumulatedBalance()
  }, [loadData, loadAccumulatedBalance])

  // Load DRE annual data
  useEffect(() => {
    if (dreView !== 'anual') return
    async function loadDreAnnual() {
      setDreAnnualLoading(true)
      const year = dreYear
      const [{ data: feesData }, { data: guestsData }, { data: expensesData }] = await Promise.all([
        supabase.from('monthly_fees').select('amount, status, reference_month').eq('group_id', groupId).eq('status', 'paid')
          .gte('reference_month', `${year}-01`).lte('reference_month', `${year}-12`),
        supabase.from('guest_players').select('amount, match_date').eq('group_id', groupId).eq('paid', true)
          .gte('match_date', `${year}-01-01`).lte('match_date', `${year}-12-31`),
        supabase.from('expenses').select('amount, expense_date').eq('group_id', groupId)
          .gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`),
      ])
      setDreAnnualFees(feesData || [])
      setDreAnnualGuests(guestsData || [])
      setDreAnnualExpenses(expensesData || [])
      setDreAnnualLoading(false)
    }
    loadDreAnnual()
  }, [dreView, dreYear, groupId])

  // ── Mensalidades handlers ──

  async function generateFees() {
    if (!group || members.length === 0) return
    setGenerating(true)

    const mensalistas = members.filter(m => {
      if (m.member_type !== 'mensalista' || m.status !== 'active') return false
      // Se goleiro nao paga, exclui jogadores com posicao goleiro
      if (!group.goalkeeper_pays_fee && m.position === 'goleiro') return false
      return true
    })
    const existingMemberIds = new Set(fees.map(f => f.member_id))
    const newFees = mensalistas
      .filter(m => !existingMemberIds.has(m.id))
      .map(m => ({
        group_id: groupId,
        member_id: m.id,
        reference_month: currentMonth,
        amount: group.monthly_fee_amount,
        due_date: `${currentMonth}-${String(group.due_day).padStart(2, '0')}`,
        status: 'pending' as const,
      }))

    if (newFees.length === 0) {
      toast.info('Todas as mensalidades ja foram geradas para este mes.')
      setGenerating(false)
      return
    }

    const { error } = await supabase.from('monthly_fees').insert(newFees)
    if (error) {
      toast.error('Erro ao gerar mensalidades', { description: error.message })
    } else {
      toast.success(`${newFees.length} mensalidades geradas!`)
      await logAudit(supabase, {
        groupId,
        action: 'generate_fees',
        entityType: 'monthly_fee',
        details: { month: currentMonth, count: newFees.length },
      })
      loadData()
      loadAccumulatedBalance()
    }
    setGenerating(false)
  }

  function openPaymentDialog(feeId: string, memberName: string) {
    setPayingFeeId(feeId)
    setPayingFeeName(memberName)
    setReceiptFile(null)
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setPaymentDialogOpen(true)
  }

  async function confirmPayment() {
    if (!payingFeeId) return
    setConfirmingPayment(true)

    let receiptUrl: string | null = null
    if (receiptFile) {
      receiptUrl = await uploadReceipt(supabase, receiptFile, groupId)
      if (!receiptUrl) {
        toast.error('Erro ao enviar comprovante. Pagamento sera marcado sem comprovante.')
      }
    }

    const paidAtDate = paymentDate
      ? new Date(paymentDate + 'T12:00:00').toISOString()
      : new Date().toISOString()

    const updateData: Record<string, any> = {
      status: 'paid',
      paid_at: paidAtDate,
      payment_method: 'pix',
    }
    if (receiptUrl) {
      updateData.receipt_url = receiptUrl
    }

    const { error } = await supabase
      .from('monthly_fees')
      .update(updateData)
      .eq('id', payingFeeId)

    if (error) {
      toast.error('Erro ao marcar pagamento')
    } else {
      toast.success('Pagamento confirmado!')
      await logAudit(supabase, {
        groupId,
        action: 'mark_fee_paid',
        entityType: 'monthly_fee',
        entityId: payingFeeId,
        details: { member: payingFeeName, month: currentMonth, has_receipt: !!receiptUrl },
      })
      loadData()
      loadAccumulatedBalance()
    }
    setConfirmingPayment(false)
    setPaymentDialogOpen(false)
    setPayingFeeId(null)
    setReceiptFile(null)
  }

  function openEditPaymentDialog(fee: any) {
    setEditingFeeId(fee.id)
    setEditingFeeName(fee.member?.name || '')
    setEditPaymentDate(fee.paid_at ? format(new Date(fee.paid_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
    setEditPaymentStatus(fee.status)
    setEditReceiptFile(null)
    setEditPaymentDialogOpen(true)
  }

  async function saveEditPayment() {
    if (!editingFeeId) return
    setSavingEditPayment(true)

    let receiptUrl: string | null = null
    if (editReceiptFile) {
      receiptUrl = await uploadReceipt(supabase, editReceiptFile, groupId)
      if (!receiptUrl) {
        toast.error('Erro ao enviar comprovante.')
      }
    }

    const paidAtDate = editPaymentStatus === 'paid' && editPaymentDate
      ? new Date(editPaymentDate + 'T12:00:00').toISOString()
      : editPaymentStatus === 'paid' ? new Date().toISOString() : null

    const updateData: Record<string, any> = {
      status: editPaymentStatus,
      paid_at: paidAtDate,
    }
    if (editPaymentStatus !== 'paid') {
      updateData.paid_at = null
      updateData.payment_method = null
    }
    if (editPaymentStatus === 'dm_leave' || editPaymentStatus === 'waived') {
      updateData.amount = 0
    }
    if (receiptUrl) {
      updateData.receipt_url = receiptUrl
    }

    const { error } = await supabase
      .from('monthly_fees')
      .update(updateData)
      .eq('id', editingFeeId)

    if (error) {
      toast.error('Erro ao editar pagamento')
    } else {
      toast.success('Pagamento atualizado!')
      await logAudit(supabase, {
        groupId,
        action: 'edit_fee_payment',
        entityType: 'monthly_fee',
        entityId: editingFeeId,
        details: { member: editingFeeName, month: currentMonth, status: editPaymentStatus, date: editPaymentDate },
      })
      loadData()
      loadAccumulatedBalance()
    }
    setSavingEditPayment(false)
    setEditPaymentDialogOpen(false)
    setEditingFeeId(null)
    setEditReceiptFile(null)
  }

  async function markAsDmLeave(feeId: string, memberName?: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .update({ status: 'dm_leave', amount: 0 })
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao marcar afastamento DM')
    } else {
      toast.success('Membro marcado como afastado (DM).')
      await logAudit(supabase, {
        groupId,
        action: 'mark_fee_dm',
        entityType: 'monthly_fee',
        entityId: feeId,
        details: { member: memberName, month: currentMonth },
      })
      loadData()
    }
  }

  async function markAsWaived(feeId: string, memberName?: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .update({ status: 'waived', amount: 0 })
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao dispensar mensalidade')
    } else {
      toast.success('Mensalidade dispensada.')
      await logAudit(supabase, {
        groupId,
        action: 'mark_fee_waived',
        entityType: 'monthly_fee',
        entityId: feeId,
        details: { member: memberName, month: currentMonth },
      })
      loadData()
      loadAccumulatedBalance()
    }
  }

  async function deleteFee(feeId: string, memberName?: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .delete()
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao excluir mensalidade')
    } else {
      toast.success('Mensalidade excluida.')
      await logAudit(supabase, {
        groupId,
        action: 'delete_fee',
        entityType: 'monthly_fee',
        entityId: feeId,
        details: { member: memberName, month: currentMonth },
      })
      loadData()
      loadAccumulatedBalance()
    }
  }

  // ── Guest CRUD functions ──

  function resetGuestForm() {
    setGuestName('')
    setGuestDate(format(new Date(), 'yyyy-MM-dd'))
    setGuestAmount('')
    setGuestNotes('')
    setGuestPaymentDate('')
    setGuestReceiptFile(null)
  }

  async function saveGuest(e: React.FormEvent) {
    e.preventDefault()
    if (!guestName.trim() || !guestAmount) return
    setSavingGuest(true)
    const { error } = await supabase.from('guest_players').insert({
      group_id: groupId,
      name: guestName.trim(),
      match_date: guestDate,
      amount: parseFloat(guestAmount) || 0,
      notes: guestNotes || null,
      paid: false,
    })
    if (error) {
      toast.error('Erro ao adicionar avulso')
    } else {
      toast.success('Jogador avulso adicionado!')
      await logAudit(supabase, {
        groupId,
        action: 'add_guest',
        entityType: 'guest_player',
        entityId: guestDate,
        details: { name: guestName, amount: guestAmount },
      })
      setGuestDialogOpen(false)
      resetGuestForm()
      loadData()
      loadAccumulatedBalance()
    }
    setSavingGuest(false)
  }

  function openEditGuestDialog(guest: any) {
    setEditingGuest(guest)
    setGuestName(guest.name)
    setGuestDate(guest.match_date)
    setGuestAmount(String(Number(guest.amount)))
    setGuestNotes(guest.notes || '')
    setGuestReceiptFile(null)
    setEditGuestDialogOpen(true)
  }

  async function updateGuest(e: React.FormEvent) {
    e.preventDefault()
    if (!editingGuest) return
    setSavingGuest(true)

    let receiptUrl: string | null = null
    if (guestReceiptFile) {
      receiptUrl = await uploadReceipt(supabase, guestReceiptFile, groupId)
    }

    const updateData: Record<string, any> = {
      name: guestName.trim(),
      match_date: guestDate,
      amount: parseFloat(guestAmount) || 0,
      notes: guestNotes || null,
    }
    if (receiptUrl) {
      updateData.receipt_url = receiptUrl
    }

    const { error } = await supabase
      .from('guest_players')
      .update(updateData)
      .eq('id', editingGuest.id)

    if (error) {
      toast.error('Erro ao atualizar avulso')
    } else {
      toast.success('Avulso atualizado!')
      await logAudit(supabase, {
        groupId,
        action: 'edit_guest',
        entityType: 'guest_player',
        entityId: editingGuest.id,
        details: { name: guestName, amount: guestAmount },
      })
      setEditGuestDialogOpen(false)
      setEditingGuest(null)
      resetGuestForm()
      loadData()
      loadAccumulatedBalance()
    }
    setSavingGuest(false)
  }

  async function markGuestPaid(guestId: string, guestName_: string) {
    setGuestPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    const paidAt = new Date().toISOString()
    const { error } = await supabase
      .from('guest_players')
      .update({ paid: true, paid_at: paidAt })
      .eq('id', guestId)
    if (error) {
      toast.error('Erro ao confirmar pagamento')
    } else {
      toast.success('Pagamento confirmado!')
      await logAudit(supabase, {
        groupId,
        action: 'mark_guest_paid',
        entityType: 'guest_player',
        entityId: guestId,
        details: { name: guestName_ },
      })
      loadData()
      loadAccumulatedBalance()
    }
  }

  async function markGuestUnpaid(guestId: string, guestName_: string) {
    const { error } = await supabase
      .from('guest_players')
      .update({ paid: false, paid_at: null })
      .eq('id', guestId)
    if (error) {
      toast.error('Erro ao reverter pagamento')
    } else {
      toast.success('Pagamento revertido.')
      await logAudit(supabase, {
        groupId,
        action: 'unmark_guest_paid',
        entityType: 'guest_player',
        entityId: guestId,
        details: { name: guestName_ },
      })
      loadData()
      loadAccumulatedBalance()
    }
  }

  async function deleteGuest(guestId: string, guestName_: string) {
    const { error } = await supabase.from('guest_players').delete().eq('id', guestId)
    if (error) {
      toast.error('Erro ao remover avulso')
    } else {
      toast.success('Avulso removido!')
      await logAudit(supabase, {
        groupId,
        action: 'delete_guest',
        entityType: 'guest_player',
        entityId: guestId,
        details: { name: guestName_ },
      })
      loadData()
      loadAccumulatedBalance()
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20"><Check className="h-3 w-3 mr-1" />Pago</Badge>
      case 'overdue':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Atrasado</Badge>
      case 'waived':
        return <Badge variant="secondary">Dispensado</Badge>
      case 'dm_leave':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"><Stethoscope className="h-3 w-3 mr-1" />Afastado DM</Badge>
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
    }
  }

  // ── WhatsApp cobranca ──

  function buildWhatsAppUrl(phone: string, name: string, monthLabel: string, feeAmount: number) {
    if (!group) return ''
    const cleanPhone = phone.replace(/\D/g, '')
    const message = `Ola ${name}! 👋\n\nSua mensalidade de ${monthLabel} no valor de R$ ${feeAmount.toFixed(2)} esta pendente.\n\nChave PIX: ${group.pix_key || 'Nao configurada'}\nFavor: ${group.pix_beneficiary_name || 'Nao configurado'}\n\nObrigado! ⚽\n- ${group.name}`
    return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`
  }

  function cobrarTodos() {
    const monthLabel = format(currentDate, 'MMMM/yyyy')
    pendingFeesWithPhone.forEach((fee, index) => {
      setTimeout(() => {
        const url = buildWhatsAppUrl(
          fee.member!.phone!,
          fee.member!.name,
          monthLabel,
          Number(fee.amount)
        )
        window.open(url, '_blank')
      }, index * 800)
    })
    setCobrancaDialogOpen(false)
  }

  // ── Despesas handlers ──

  function resetExpenseForm() {
    setCategory('court_rental')
    setDescription('')
    setAmount('')
    setExpenseDate(format(new Date(), 'yyyy-MM-dd'))
    setPaidBy('')
    setNotes('')
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: newExpense, error } = await supabase.from('expenses').insert({
      group_id: groupId,
      category,
      description,
      amount: parseFloat(amount),
      expense_date: expenseDate,
      paid_by_member_id: paidBy || null,
      notes: notes || null,
    }).select().single()
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Despesa registrada!')
      await logAudit(supabase, {
        groupId,
        action: 'create_expense',
        entityType: 'expense',
        entityId: newExpense?.id,
        details: { description, amount: parseFloat(amount), category },
      })
      setDialogOpen(false)
      resetExpenseForm()
      loadData()
      loadAccumulatedBalance()
    }
    setSaving(false)
  }

  function openEditExpense(exp: any) {
    setEditingExpense(exp)
    setCategory(exp.category)
    setDescription(exp.description)
    setAmount(String(exp.amount))
    setExpenseDate(exp.expense_date)
    setPaidBy(exp.paid_by_member_id || '')
    setNotes(exp.notes || '')
    setEditDialogOpen(true)
  }

  async function handleEditExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!editingExpense) return
    setSaving(true)
    const { error } = await supabase.from('expenses').update({
      category,
      description,
      amount: parseFloat(amount),
      expense_date: expenseDate,
      paid_by_member_id: paidBy || null,
      notes: notes || null,
    }).eq('id', editingExpense.id)
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Despesa atualizada!')
      await logAudit(supabase, {
        groupId,
        action: 'edit_expense',
        entityType: 'expense',
        entityId: editingExpense.id,
        details: { description, amount: parseFloat(amount), category },
      })
      setEditDialogOpen(false)
      setEditingExpense(null)
      resetExpenseForm()
      loadData()
      loadAccumulatedBalance()
    }
    setSaving(false)
  }

  async function deleteExpense(id: string, desc?: string) {
    if (!confirm('Remover esta despesa?')) return
    await supabase.from('expenses').delete().eq('id', id)
    await logAudit(supabase, {
      groupId,
      action: 'delete_expense',
      entityType: 'expense',
      entityId: id,
      details: { description: desc },
    })
    toast.success('Despesa removida!')
    loadData()
    loadAccumulatedBalance()
  }

  // ── Computed values ──

  // Filter out goalkeeper fees when setting is off
  const displayFees = group && !group.goalkeeper_pays_fee
    ? fees.filter(f => (f.member as any)?.position !== 'goleiro')
    : fees

  // Mensalidades
  const paidCount = displayFees.filter(f => f.status === 'paid').length
  const totalFeesAmount = displayFees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0)
  const dmCount = displayFees.filter(f => f.status === 'dm_leave').length
  const pendingFees = displayFees.filter(f => f.status === 'pending' || f.status === 'overdue')
  const pendingFeesWithPhone = pendingFees.filter(f => f.member?.phone)

  // Despesas
  const totalExpensesAmount = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
  const byCategory = expenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  // DRE
  const dreTotalFees = displayFees.filter(f => f.status === 'paid').reduce((sum, f) => sum + Number(f.amount), 0)
  const dreTotalGuests = paidGuests.reduce((sum, g) => sum + Number(g.amount), 0)
  const dreTotalIncome = dreTotalFees + dreTotalGuests
  const dreExpensesByCategory = expenses.reduce((acc, e) => {
    const cat = e.category as ExpenseCategory
    acc[cat] = (acc[cat] || 0) + Number(e.amount)
    return acc
  }, {} as Record<ExpenseCategory, number>)
  const dreTotalExpenses = totalExpensesAmount
  const dreNetResult = dreTotalIncome - dreTotalExpenses

  const allDreValues = [
    dreTotalFees,
    dreTotalGuests,
    ...Object.values(dreExpensesByCategory),
  ].filter(v => v > 0)
  const dreMaxValue = Math.max(...allDreValues, 1)

  // DRE Anual computed
  const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const dreAnnualMonthsData = MONTH_NAMES.map((name, idx) => {
    const mm = String(idx + 1).padStart(2, '0')
    const monthKey = `${dreYear}-${mm}`
    const monthFees = dreAnnualFees.filter(f => f.reference_month === monthKey).reduce((s: number, f: any) => s + Number(f.amount), 0)
    const monthGuests = dreAnnualGuests.filter(g => g.match_date?.startsWith(monthKey)).reduce((s: number, g: any) => s + Number(g.amount), 0)
    const monthExpenses = dreAnnualExpenses.filter(e => e.expense_date?.startsWith(monthKey)).reduce((s: number, e: any) => s + Number(e.amount), 0)
    const totalReceitas = monthFees + monthGuests
    const saldo = totalReceitas - monthExpenses
    return { name, monthKey, mensalidades: monthFees, avulsos: monthGuests, totalReceitas, despesas: monthExpenses, saldo }
  })
  const dreAnnualTotals = dreAnnualMonthsData.reduce(
    (acc, m) => ({
      mensalidades: acc.mensalidades + m.mensalidades,
      avulsos: acc.avulsos + m.avulsos,
      totalReceitas: acc.totalReceitas + m.totalReceitas,
      despesas: acc.despesas + m.despesas,
      saldo: acc.saldo + m.saldo,
    }),
    { mensalidades: 0, avulsos: 0, totalReceitas: 0, despesas: 0, saldo: 0 }
  )

  // Saldo Acumulado
  const groupInitialBalance = Number(group?.initial_balance ?? 0)
  const allTimeIncome = allTimeFees + allTimeGuests
  const accumulatedBalance = groupInitialBalance + allTimeIncome - allTimeExpenses

  // Saldo Inicial (tudo antes do mes selecionado) e Saldo Final
  const saldoInicial = groupInitialBalance + (priorFees + priorGuests) - priorExpenses
  const receitasDoMes = dreTotalIncome
  const despesasDoMes = dreTotalExpenses
  const saldoFinal = saldoInicial + receitasDoMes - despesasDoMes

  function formatCurrency(value: number) {
    return `R$ ${value.toFixed(2)}`
  }

  function drePercentage(value: number, total: number) {
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
    const pct = drePercentage(value, total)
    const barWidth = dreMaxValue > 0 ? Math.max((value / dreMaxValue) * 100, 2) : 0

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

  // ── Expense form ──

  const expenseForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleEditExpense : handleAddExpense} className="space-y-4">
      <div className="space-y-2">
        <Label>Categoria *</Label>
        <Select value={category} onValueChange={(v) => v && setCategory(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Descricao *</Label>
        <Input placeholder="Ex: Aluguel quadra Society ABC" value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor (R$) *</Label>
          <Input type="number" step="0.01" min="0" placeholder="200.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Pago por</Label>
        <Select value={paidBy} onValueChange={(v) => v && setPaidBy(v)}>
          <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Observacoes</Label>
        <Textarea placeholder="Notas adicionais" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
        {saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Registrar Despesa'}
      </Button>
    </form>
  )

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1B1F4B]">Financeiro</h1>
            <p className="text-muted-foreground">Gerencie mensalidades, despesas e acompanhe o resultado financeiro</p>
          </div>
          {isReadOnly && (
            <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
              <ShieldAlert className="h-3 w-3 mr-1" />
              Somente leitura
            </Badge>
          )}
        </div>
      </div>

      {/* ── Caixa do Grupo (Saldo Inicial / Final) ── */}
      <Card className="mb-6 border-2 border-[#1B1F4B]/10 shadow-lg">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-full bg-[#1B1F4B]/10 p-2">
              <Wallet className="h-5 w-5 text-[#1B1F4B]" />
            </div>
            <h2 className="text-lg font-bold text-[#1B1F4B]">Caixa do Grupo</h2>
          </div>

          {/* Saldo Inicial → Movimentacao → Saldo Final */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
            <div className="flex flex-col items-center sm:items-start p-3 rounded-lg bg-slate-50">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Saldo Inicial</span>
              <span className={`text-lg font-bold ${saldoInicial >= 0 ? 'text-[#1B1F4B]' : 'text-red-500'}`}>
                {formatCurrency(saldoInicial)}
              </span>
            </div>

            <div className="flex flex-col items-center sm:items-start p-3 rounded-lg bg-green-50">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">+ Receitas</span>
              <span className="text-lg font-bold text-[#00C853]">{formatCurrency(receitasDoMes)}</span>
            </div>

            <div className="flex flex-col items-center sm:items-start p-3 rounded-lg bg-red-50">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">- Despesas</span>
              <span className="text-lg font-bold text-red-500">{formatCurrency(despesasDoMes)}</span>
            </div>

            <div className="hidden sm:flex items-center justify-center text-2xl text-muted-foreground">=</div>

            <div className="flex flex-col items-center sm:items-start p-3 rounded-lg bg-[#1B1F4B]/5 border-2 border-[#1B1F4B]/20">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Saldo Final</span>
              <span className={`text-xl font-extrabold ${saldoFinal >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
                {saldoFinal >= 0 ? '+' : ''}{formatCurrency(saldoFinal)}
              </span>
            </div>
          </div>

          {/* Saldo geral acumulado */}
          <div className="mt-3 pt-3 border-t border-muted/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Saldo acumulado geral (todos os meses)</span>
            <span className={`text-sm font-bold ${accumulatedBalance >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
              {formatCurrency(accumulatedBalance)}
            </span>
          </div>
        </CardContent>
      </Card>

      <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

      <Tabs defaultValue="mensalidades">
        <TabsList className="w-full">
          <TabsTrigger value="mensalidades">
            <CreditCard className="h-4 w-4 mr-1.5" />
            Mensalidades
          </TabsTrigger>
          <TabsTrigger value="avulsos">
            <Users className="h-4 w-4 mr-1.5" />
            Avulsos
          </TabsTrigger>
          <TabsTrigger value="despesas">
            <Receipt className="h-4 w-4 mr-1.5" />
            Despesas
          </TabsTrigger>
          <TabsTrigger value="dre">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            DRE
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Mensalidades ── */}
        <TabsContent value="mensalidades">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">
                {paidCount}/{displayFees.length} pagas | R$ {totalFeesAmount.toFixed(2)} recebido{dmCount > 0 ? ` | ${dmCount} afastados DM` : ''}
              </p>
              <div className="flex gap-2">
                {isAdmin && pendingFees.length > 0 && (
                  <Dialog open={cobrancaDialogOpen} onOpenChange={setCobrancaDialogOpen}>
                    <DialogTrigger render={<Button variant="outline" className="text-green-600 border-green-400 hover:bg-green-50" />}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Cobrar Pendentes
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Cobrar Pendentes via WhatsApp</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {pendingFees.map(fee => {
                          const phone = fee.member?.phone
                          const cleanPhone = phone?.replace(/\D/g, '')
                          const monthLabel = format(currentDate, 'MMMM/yyyy')
                          return (
                            <div key={fee.id} className="flex items-center justify-between p-3 rounded-lg border">
                              <div>
                                <p className="font-medium text-sm">{fee.member?.name}</p>
                                <p className="text-xs text-muted-foreground">{phone || 'Sem telefone'}</p>
                                <p className="text-xs text-red-500">R$ {Number(fee.amount).toFixed(2)}</p>
                              </div>
                              {phone && cleanPhone ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-400 hover:bg-green-50"
                                  onClick={() => {
                                    const url = buildWhatsAppUrl(phone, fee.member!.name, monthLabel, Number(fee.amount))
                                    window.open(url, '_blank')
                                  }}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  WhatsApp
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-xs">Sem telefone</Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {pendingFeesWithPhone.length > 0 && (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                          onClick={cobrarTodos}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Cobrar Todos ({pendingFeesWithPhone.length})
                        </Button>
                      )}
                    </DialogContent>
                  </Dialog>
                )}
                {isAdmin && (
                  <Button
                    className="bg-[#00C853] hover:bg-[#00A843] text-white"
                    onClick={generateFees}
                    disabled={generating}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {generating ? 'Gerando...' : 'Gerar Mensalidades'}
                  </Button>
                )}
              </div>
            </div>

            {/* Payment confirmation dialog with receipt upload */}
            <Dialog open={paymentDialogOpen} onOpenChange={(v) => { setPaymentDialogOpen(v); if (!v) { setPayingFeeId(null); setReceiptFile(null); setPaymentDate('') } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar Pagamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Confirmar pagamento de <span className="font-semibold text-foreground">{payingFeeName}</span>?
                  </p>
                  <div className="space-y-2">
                    <Label>Data do pagamento</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Comprovante (opcional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                        className="text-sm"
                      />
                    </div>
                    {receiptFile && (
                      <p className="text-xs text-muted-foreground">
                        <Image className="h-3 w-3 inline mr-1" />
                        {receiptFile.name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-[#00C853] hover:bg-[#00A843] text-white"
                      onClick={confirmPayment}
                      disabled={confirmingPayment}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {confirmingPayment ? 'Confirmando...' : 'Confirmar Pagamento'}
                    </Button>
                    <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Receipt viewer dialog */}
            <Dialog open={!!viewingReceipt} onOpenChange={(v) => { if (!v) setViewingReceipt(null) }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Comprovante</DialogTitle>
                </DialogHeader>
                {viewingReceipt && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={viewingReceipt} alt="Comprovante" className="max-w-full max-h-[500px] rounded-lg object-contain" />
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Edit payment dialog */}
            <Dialog open={editPaymentDialogOpen} onOpenChange={(v) => { setEditPaymentDialogOpen(v); if (!v) { setEditingFeeId(null); setEditReceiptFile(null) } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Pagamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Editando pagamento de <span className="font-semibold text-foreground">{editingFeeName}</span>
                  </p>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editPaymentStatus} onValueChange={(v) => v && setEditPaymentStatus(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="overdue">Atrasado</SelectItem>
                        <SelectItem value="waived">Dispensado</SelectItem>
                        <SelectItem value="dm_leave">Afastado (DM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editPaymentStatus === 'paid' && (
                    <>
                      <div className="space-y-2">
                        <Label>Data do pagamento</Label>
                        <Input
                          type="date"
                          value={editPaymentDate}
                          onChange={(e) => setEditPaymentDate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Novo comprovante (opcional)</Label>
                        <Input
                          ref={editReceiptInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setEditReceiptFile(e.target.files?.[0] || null)}
                          className="text-sm"
                        />
                        {editReceiptFile && (
                          <p className="text-xs text-muted-foreground">
                            <Image className="h-3 w-3 inline mr-1" />
                            {editReceiptFile.name}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-[#1B1F4B] hover:bg-[#1B1F4B]/90 text-white"
                      onClick={saveEditPayment}
                      disabled={savingEditPayment}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {savingEditPayment ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditPaymentDialogOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membro</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Pgto</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                      </TableRow>
                    ) : displayFees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma mensalidade gerada. Clique em &quot;Gerar Mensalidades&quot; para criar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayFees.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {fee.member?.name}
                              {fee.status === 'paid' && fee.receipt_url && (
                                <button
                                  onClick={() => setViewingReceipt(fee.receipt_url!)}
                                  className="text-blue-500 hover:text-blue-700 transition-colors"
                                  title="Ver comprovante"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>R$ {Number(fee.amount).toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(fee.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{statusBadge(fee.status)}</TableCell>
                          <TableCell>
                            {fee.paid_at ? format(new Date(fee.paid_at), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {(fee.status === 'pending' || fee.status === 'overdue') && isAdmin ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="outline" className="text-[#00C853] border-[#00C853] hover:bg-[#00C853]/10" onClick={() => openPaymentDialog(fee.id, fee.member?.name || '')}>
                                  <Check className="h-3 w-3 mr-1" />
                                  Pago
                                </Button>
                                <Button size="sm" variant="outline" className="text-blue-600 border-blue-400 hover:bg-blue-50" onClick={() => markAsDmLeave(fee.id, fee.member?.name)}>
                                  <Stethoscope className="h-3 w-3 mr-1" />
                                  DM
                                </Button>
                                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => markAsWaived(fee.id, fee.member?.name)}>
                                  Dispensar
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteFee(fee.id, fee.member?.name)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (fee.status === 'paid' || fee.status === 'dm_leave' || fee.status === 'waived') && isAdmin ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-brand-navy" onClick={() => openEditPaymentDialog(fee)}>
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteFee(fee.id, fee.member?.name)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: Avulsos ── */}
        <TabsContent value="avulsos">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {allGuests.length} avulso{allGuests.length !== 1 ? 's' : ''} no mes
                  {' '}&bull;{' '}
                  <span className="text-[#00C853] font-medium">
                    {allGuests.filter(g => g.paid).length} pago{allGuests.filter(g => g.paid).length !== 1 ? 's' : ''}
                  </span>
                  {' '}&bull;{' '}
                  <span className="text-amber-500 font-medium">
                    {allGuests.filter(g => !g.paid).length} pendente{allGuests.filter(g => !g.paid).length !== 1 ? 's' : ''}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total: R$ {allGuests.reduce((s, g) => s + Number(g.amount), 0).toFixed(2)}
                  {' '}&bull;{' '}
                  Recebido: R$ {allGuests.filter(g => g.paid).reduce((s, g) => s + Number(g.amount), 0).toFixed(2)}
                </p>
              </div>
              {isAdmin && (
                <Dialog open={guestDialogOpen} onOpenChange={(v) => { setGuestDialogOpen(v); if (!v) resetGuestForm() }}>
                  <Button className="bg-[#00C853] hover:bg-[#00A843] text-white" onClick={() => setGuestDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Avulso
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Jogador Avulso</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveGuest} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input placeholder="Nome do jogador" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Data *</Label>
                        <Input type="date" value={guestDate} onChange={(e) => setGuestDate(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor (R$) *</Label>
                        <Input type="number" step="0.01" min="0" placeholder="25.00" value={guestAmount} onChange={(e) => setGuestAmount(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Observacoes</Label>
                        <Input placeholder="Ex: amigo do Joao" value={guestNotes} onChange={(e) => setGuestNotes(e.target.value)} />
                      </div>
                      <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={savingGuest}>
                        {savingGuest ? 'Salvando...' : 'Adicionar'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Edit Guest Dialog */}
            <Dialog open={editGuestDialogOpen} onOpenChange={(v) => { setEditGuestDialogOpen(v); if (!v) { setEditingGuest(null); resetGuestForm() } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Jogador Avulso</DialogTitle>
                </DialogHeader>
                <form onSubmit={updateGuest} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input placeholder="Nome do jogador" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Input type="date" value={guestDate} onChange={(e) => setGuestDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$) *</Label>
                    <Input type="number" step="0.01" min="0" placeholder="25.00" value={guestAmount} onChange={(e) => setGuestAmount(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Observacoes</Label>
                    <Input placeholder="Ex: amigo do Joao" value={guestNotes} onChange={(e) => setGuestNotes(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Comprovante (opcional)</Label>
                    <Input
                      ref={guestReceiptInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setGuestReceiptFile(e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-[#1B1F4B] hover:bg-[#1B1F4B]/90 text-white" disabled={savingGuest}>
                    {savingGuest ? 'Salvando...' : 'Salvar'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allGuests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum jogador avulso neste mes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allGuests.map((guest) => (
                        <TableRow key={guest.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {guest.name}
                              {guest.receipt_url && (
                                <button
                                  onClick={() => setViewingReceipt(guest.receipt_url)}
                                  className="text-blue-500 hover:text-blue-700 transition-colors"
                                  title="Ver comprovante"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {guest.notes && (
                              <p className="text-xs text-muted-foreground">{guest.notes}</p>
                            )}
                          </TableCell>
                          <TableCell>{format(new Date(guest.match_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>R$ {Number(guest.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            {guest.paid ? (
                              <Badge className="bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20">
                                <Check className="h-3 w-3 mr-1" />Pago
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1" />Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <div className="flex gap-1 justify-end">
                                {!guest.paid ? (
                                  <Button size="sm" variant="outline" className="text-[#00C853] border-[#00C853] hover:bg-[#00C853]/10" onClick={() => markGuestPaid(guest.id, guest.name)}>
                                    <Check className="h-3 w-3 mr-1" />
                                    Pago
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => markGuestUnpaid(guest.id, guest.name)}>
                                    <Minus className="h-3 w-3 mr-1" />
                                    Reverter
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => openEditGuestDialog(guest)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteGuest(guest.id, guest.name)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: Despesas ── */}
        <TabsContent value="despesas">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total: R$ {totalExpensesAmount.toFixed(2)}</p>
              {isAdmin && (
                <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetExpenseForm() }}>
                  <DialogTrigger render={<Button className="bg-[#00C853] hover:bg-[#00A843] text-white" />}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Despesa
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Despesa</DialogTitle>
                    </DialogHeader>
                    {expenseForm(false)}
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) { setEditingExpense(null); resetExpenseForm() } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Despesa</DialogTitle>
                </DialogHeader>
                {expenseForm(true)}
              </DialogContent>
            </Dialog>

            {/* Category summary */}
            {Object.keys(byCategory).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(byCategory).map(([cat, val]) => (
                  <Badge key={cat} className={categoryColors[cat] || 'bg-gray-100'} variant="secondary">
                    {EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES]}: R$ {(val as number).toFixed(2)}
                  </Badge>
                ))}
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Pago por</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                      </TableRow>
                    ) : expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma despesa neste mes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map((exp: any) => (
                        <TableRow key={exp.id}>
                          <TableCell className="font-medium">{exp.description}</TableCell>
                          <TableCell>
                            <Badge className={categoryColors[exp.category]} variant="secondary">
                              {EXPENSE_CATEGORIES[exp.category as keyof typeof EXPENSE_CATEGORIES]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-red-500 font-medium">R$ {Number(exp.amount).toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(exp.expense_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{exp.paid_by_member?.name || '-'}</TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => openEditExpense(exp)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteExpense(exp.id, exp.description)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: DRE ── */}
        <TabsContent value="dre">
          <div className="space-y-6 mt-4">
            {/* Toggle Mensal / Anual */}
            <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg w-fit mx-auto">
              <button
                onClick={() => setDreView('mensal')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  dreView === 'mensal'
                    ? 'bg-white shadow-sm text-[#1B1F4B]'
                    : 'text-muted-foreground hover:text-[#1B1F4B]'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setDreView('anual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  dreView === 'anual'
                    ? 'bg-white shadow-sm text-[#1B1F4B]'
                    : 'text-muted-foreground hover:text-[#1B1F4B]'
                }`}
              >
                Anual
              </button>
            </div>

            {/* ── DRE Mensal ── */}
            {dreView === 'mensal' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    Carregando...
                  </div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card className="border-l-4 border-l-[#00C853]">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-[#00C853]/10 p-2">
                              <TrendingUp className="h-5 w-5 text-[#00C853]" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receitas</p>
                              <p className="text-xl font-bold text-[#00C853]">{formatCurrency(dreTotalIncome)}</p>
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
                              <p className="text-xl font-bold text-red-500">{formatCurrency(dreTotalExpenses)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className={`border-l-4 ${dreNetResult >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3">
                            <div className={`rounded-full p-2 ${dreNetResult >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                              <DollarSign className={`h-5 w-5 ${dreNetResult >= 0 ? 'text-blue-500' : 'text-red-500'}`} />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Resultado</p>
                              <p className={`text-xl font-bold ${dreNetResult >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                {dreNetResult >= 0 ? '+' : ''}{formatCurrency(dreNetResult)}
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
                              label={`Mensalidades pagas (${fees.filter(f => f.status === 'paid').length})`}
                              value={dreTotalFees}
                              total={dreTotalIncome}
                              color="#00C853"
                            />
                            <BarLine
                              label={`Avulsos pagos (${paidGuests.length})`}
                              value={dreTotalGuests}
                              total={dreTotalIncome}
                              color="#66BB6A"
                            />
                          </div>
                          <div className="mt-4 pt-3 border-t border-dashed flex items-center justify-between">
                            <span className="text-sm font-bold text-[#1B1F4B]">Total de Receitas</span>
                            <span className="text-sm font-bold text-[#00C853]">{formatCurrency(dreTotalIncome)}</span>
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
                              const value = dreExpensesByCategory[cat] || 0
                              if (value === 0 && dreTotalExpenses > 0) return null
                              return (
                                <BarLine
                                  key={cat}
                                  label={EXPENSE_CATEGORIES[cat]}
                                  value={value}
                                  total={dreTotalExpenses}
                                  color="#EF4444"
                                />
                              )
                            })}
                            {dreTotalExpenses === 0 && (
                              <p className="text-sm text-muted-foreground italic">Nenhuma despesa registrada neste mes.</p>
                            )}
                          </div>
                          <div className="mt-4 pt-3 border-t border-dashed flex items-center justify-between">
                            <span className="text-sm font-bold text-[#1B1F4B]">Total de Despesas</span>
                            <span className="text-sm font-bold text-red-500">{formatCurrency(dreTotalExpenses)}</span>
                          </div>
                        </section>

                        {/* Separator */}
                        <div className="h-px bg-border" />

                        {/* RESULTADO */}
                        <section>
                          <div className="flex items-center gap-2 mb-4">
                            <DollarSign className={`h-5 w-5 ${dreNetResult >= 0 ? 'text-[#00C853]' : 'text-red-500'}`} />
                            <h2 className="text-lg font-bold text-[#1B1F4B]">Resultado</h2>
                          </div>
                          <div className="rounded-lg p-4 space-y-2"
                            style={{
                              backgroundColor: dreNetResult >= 0 ? 'rgba(0, 200, 83, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                            }}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Receitas</span>
                              <span className="text-[#00C853] font-medium">{formatCurrency(dreTotalIncome)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Despesas</span>
                              <span className="text-red-500 font-medium">- {formatCurrency(dreTotalExpenses)}</span>
                            </div>
                            <div className="border-t pt-2 mt-2 flex items-center justify-between">
                              <span className="text-base font-bold text-[#1B1F4B]">Resultado Liquido</span>
                              <span className={`text-lg font-bold ${dreNetResult >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
                                {dreNetResult >= 0 ? '+' : ''}{formatCurrency(dreNetResult)}
                              </span>
                            </div>
                          </div>
                        </section>
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}

            {/* ── DRE Anual ── */}
            {dreView === 'anual' && (
              <>
                {/* Year navigation */}
                <div className="flex items-center justify-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => setDreYear(y => y - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#1B1F4B]" />
                    <span className="text-lg font-semibold text-[#1B1F4B] min-w-[60px] text-center">{dreYear}</span>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setDreYear(y => y + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {dreAnnualLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    Carregando...
                  </div>
                ) : (
                  <>
                    {/* Annual Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card className="border-l-4 border-l-[#00C853]">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-[#00C853]/10 p-2">
                              <TrendingUp className="h-5 w-5 text-[#00C853]" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receitas {dreYear}</p>
                              <p className="text-xl font-bold text-[#00C853]">{formatCurrency(dreAnnualTotals.totalReceitas)}</p>
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
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Despesas {dreYear}</p>
                              <p className="text-xl font-bold text-red-500">{formatCurrency(dreAnnualTotals.despesas)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className={`border-l-4 ${dreAnnualTotals.saldo >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3">
                            <div className={`rounded-full p-2 ${dreAnnualTotals.saldo >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                              <DollarSign className={`h-5 w-5 ${dreAnnualTotals.saldo >= 0 ? 'text-blue-500' : 'text-red-500'}`} />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo {dreYear}</p>
                              <p className={`text-xl font-bold ${dreAnnualTotals.saldo >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                {dreAnnualTotals.saldo >= 0 ? '+' : ''}{formatCurrency(dreAnnualTotals.saldo)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Annual DRE Table */}
                    <Card className="shadow-lg">
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold text-[#1B1F4B]">Mes</TableHead>
                                <TableHead className="text-right font-semibold text-[#00C853]">Mensalidades</TableHead>
                                <TableHead className="text-right font-semibold text-[#66BB6A]">Avulsos</TableHead>
                                <TableHead className="text-right font-semibold text-[#00C853]">Total Receitas</TableHead>
                                <TableHead className="text-right font-semibold text-red-500">Despesas</TableHead>
                                <TableHead className="text-right font-semibold text-[#1B1F4B]">Saldo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dreAnnualMonthsData.map((m, idx) => {
                                const hasData = m.mensalidades > 0 || m.avulsos > 0 || m.despesas > 0
                                return (
                                  <TableRow key={m.monthKey} className={idx % 2 === 0 ? 'bg-muted/20' : ''}>
                                    <TableCell className="font-medium text-[#1B1F4B]">{m.name}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {hasData ? formatCurrency(m.mensalidades) : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {hasData ? formatCurrency(m.avulsos) : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-medium text-[#00C853]">
                                      {hasData ? formatCurrency(m.totalReceitas) : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-medium text-red-500">
                                      {hasData ? formatCurrency(m.despesas) : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell className={`text-right tabular-nums font-semibold ${
                                      !hasData ? 'text-muted-foreground' : m.saldo >= 0 ? 'text-[#00C853]' : 'text-red-500'
                                    }`}>
                                      {hasData ? (
                                        <>{m.saldo >= 0 ? '+' : ''}{formatCurrency(m.saldo)}</>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                            {/* Total Row */}
                            <tfoot>
                              <TableRow className="border-t-2 bg-muted/40 font-bold">
                                <TableCell className="font-bold text-[#1B1F4B]">Total</TableCell>
                                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(dreAnnualTotals.mensalidades)}</TableCell>
                                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(dreAnnualTotals.avulsos)}</TableCell>
                                <TableCell className="text-right font-bold tabular-nums text-[#00C853]">{formatCurrency(dreAnnualTotals.totalReceitas)}</TableCell>
                                <TableCell className="text-right font-bold tabular-nums text-red-500">{formatCurrency(dreAnnualTotals.despesas)}</TableCell>
                                <TableCell className={`text-right font-bold tabular-nums ${dreAnnualTotals.saldo >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
                                  {dreAnnualTotals.saldo >= 0 ? '+' : ''}{formatCurrency(dreAnnualTotals.saldo)}
                                </TableCell>
                              </TableRow>
                            </tfoot>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Annual Result Summary */}
                    <Card className="shadow-lg">
                      <CardContent className="py-6">
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="h-5 w-5 text-[#1B1F4B]" />
                          <h2 className="text-lg font-bold text-[#1B1F4B]">Resumo Anual {dreYear}</h2>
                        </div>
                        <div className="rounded-lg p-4 space-y-3"
                          style={{
                            backgroundColor: dreAnnualTotals.saldo >= 0 ? 'rgba(0, 200, 83, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                          }}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Mensalidades</span>
                            <span className="text-[#00C853] font-medium">{formatCurrency(dreAnnualTotals.mensalidades)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Avulsos</span>
                            <span className="text-[#66BB6A] font-medium">{formatCurrency(dreAnnualTotals.avulsos)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm border-t pt-2">
                            <span className="font-semibold text-[#1B1F4B]">Total Receitas</span>
                            <span className="text-[#00C853] font-bold">{formatCurrency(dreAnnualTotals.totalReceitas)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total Despesas</span>
                            <span className="text-red-500 font-medium">- {formatCurrency(dreAnnualTotals.despesas)}</span>
                          </div>
                          <div className="border-t pt-3 mt-2 flex items-center justify-between">
                            <span className="text-base font-bold text-[#1B1F4B]">Resultado Liquido Anual</span>
                            <span className={`text-lg font-bold ${dreAnnualTotals.saldo >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
                              {dreAnnualTotals.saldo >= 0 ? '+' : ''}{formatCurrency(dreAnnualTotals.saldo)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* No data message */}
                    {dreAnnualTotals.totalReceitas === 0 && dreAnnualTotals.despesas === 0 && (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                          <p className="text-muted-foreground">
                            Nenhum dado financeiro encontrado para {dreYear}.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}
