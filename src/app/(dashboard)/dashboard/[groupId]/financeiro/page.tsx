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
  ChevronLeft, ChevronRight, CalendarDays, Banknote, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, endOfMonth } from 'date-fns'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES, type Expense, type Revenue, type GroupMember, type Group, type MonthlyFee } from '@/lib/types'
import { useGroupRole } from '@/hooks/use-group-role'
import { uploadReceipt } from '@/lib/upload-receipt'
import { logAudit } from '@/lib/audit'

type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES

const categoryColors: Record<string, string> = {
  court_rental: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  goalkeeper: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  equipment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  drinks: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const revenueCategoryColors: Record<string, string> = {
  sponsorship: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  donation: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  event: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  prize: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  rental: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
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
  const [dreAnnualRevenues, setDreAnnualRevenues] = useState<any[]>([])

  // Saldo Acumulado state
  const [allTimeFees, setAllTimeFees] = useState(0)
  const [allTimeGuests, setAllTimeGuests] = useState(0)
  const [allTimeExpenses, setAllTimeExpenses] = useState(0)

  // Saldo Inicial do mês (tudo antes do mês atual)
  const [priorFees, setPriorFees] = useState(0)
  const [priorGuests, setPriorGuests] = useState(0)
  const [priorExpenses, setPriorExpenses] = useState(0)
  const [allTimeRevenues, setAllTimeRevenues] = useState(0)
  const [priorRevenues, setPriorRevenues] = useState(0)

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

  // Receitas (Revenues) state
  const [revenues, setRevenues] = useState<any[]>([])
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false)
  const [editRevenueDialogOpen, setEditRevenueDialogOpen] = useState(false)
  const [editingRevenue, setEditingRevenue] = useState<any>(null)
  const [revenueCategory, setRevenueCategory] = useState<string>('other')
  const [revenueDescription, setRevenueDescription] = useState('')
  const [revenueAmount, setRevenueAmount] = useState('')
  const [revenueDate, setRevenueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [revenueNotes, setRevenueNotes] = useState('')
  const [savingRevenue, setSavingRevenue] = useState(false)

  // Batch selection state for fees
  const [selectedFees, setSelectedFees] = useState<Set<string>>(new Set())


  const currentMonth = format(currentDate, 'yyyy-MM')

  const loadData = useCallback(async () => {
    setLoading(true)
    setSelectedFees(new Set())
    const endDay = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const [
      { data: groupData },
      { data: membersData },
      { data: feesData },
      { data: expensesData },
      { data: guestsAllData },
      { data: revenuesData },
    ] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'active').order('name'),
      supabase.from('monthly_fees').select('*, member:group_members(name, member_type, phone, position)').eq('group_id', groupId).eq('reference_month', currentMonth),
      supabase.from('expenses').select('*, paid_by_member:group_members(name)').eq('group_id', groupId).gte('expense_date', `${currentMonth}-01`).lte('expense_date', endDay).order('expense_date', { ascending: false }),
      supabase.from('guest_players').select('*').eq('group_id', groupId).gte('match_date', `${currentMonth}-01`).lte('match_date', endDay).order('match_date', { ascending: false }),
      supabase.from('revenues').select('*').eq('group_id', groupId).gte('revenue_date', `${currentMonth}-01`).lte('revenue_date', endDay).order('revenue_date', { ascending: false }),
    ])
    setGroup(groupData)
    setMembers(membersData || [])
    setFees(feesData || [])
    setExpenses(expensesData || [])
    setRevenues(revenuesData || [])
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
      { data: allRevs },
      // Prior to current month (for saldo inicial)
      { data: priorFeesData },
      { data: priorGuestsData },
      { data: priorExpensesData },
      { data: priorRevsData },
    ] = await Promise.all([
      supabase.from('monthly_fees').select('amount').eq('group_id', groupId).eq('status', 'paid'),
      supabase.from('guest_players').select('amount').eq('group_id', groupId).eq('paid', true),
      supabase.from('expenses').select('amount').eq('group_id', groupId),
      supabase.from('revenues').select('amount').eq('group_id', groupId),
      // Fees paid before current month
      supabase.from('monthly_fees').select('amount').eq('group_id', groupId).eq('status', 'paid').lt('reference_month', currentMonth),
      // Guests paid before current month
      supabase.from('guest_players').select('amount').eq('group_id', groupId).eq('paid', true).lt('match_date', firstDay),
      // Expenses before current month
      supabase.from('expenses').select('amount').eq('group_id', groupId).lt('expense_date', firstDay),
      // Revenues before current month
      supabase.from('revenues').select('amount').eq('group_id', groupId).lt('revenue_date', firstDay),
    ])
    setAllTimeFees((allFees || []).reduce((sum, f) => sum + Number(f.amount), 0))
    setAllTimeGuests((allGuests || []).reduce((sum, g) => sum + Number(g.amount), 0))
    setAllTimeExpenses((allExpenses || []).reduce((sum, e) => sum + Number(e.amount), 0))
    setAllTimeRevenues((allRevs || []).reduce((sum, r) => sum + Number(r.amount), 0))
    setPriorFees((priorFeesData || []).reduce((sum, f) => sum + Number(f.amount), 0))
    setPriorGuests((priorGuestsData || []).reduce((sum, g) => sum + Number(g.amount), 0))
    setPriorExpenses((priorExpensesData || []).reduce((sum, e) => sum + Number(e.amount), 0))
    setPriorRevenues((priorRevsData || []).reduce((sum, r) => sum + Number(r.amount), 0))
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
      const [{ data: feesData }, { data: guestsData }, { data: expensesData }, { data: revsData }] = await Promise.all([
        supabase.from('monthly_fees').select('amount, status, reference_month').eq('group_id', groupId).eq('status', 'paid')
          .gte('reference_month', `${year}-01`).lte('reference_month', `${year}-12`),
        supabase.from('guest_players').select('amount, match_date').eq('group_id', groupId).eq('paid', true)
          .gte('match_date', `${year}-01-01`).lte('match_date', `${year}-12-31`),
        supabase.from('expenses').select('amount, expense_date').eq('group_id', groupId)
          .gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`),
        supabase.from('revenues').select('amount, revenue_date, category').eq('group_id', groupId)
          .gte('revenue_date', `${year}-01-01`).lte('revenue_date', `${year}-12-31`),
      ])
      setDreAnnualFees(feesData || [])
      setDreAnnualGuests(guestsData || [])
      setDreAnnualExpenses(expensesData || [])
      setDreAnnualRevenues(revsData || [])
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
      // Se goleiro não paga, exclui jogadores com posição goleiro
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
      toast.info('Todas as mensalidades ja foram geradas para este mês.')
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
        toast.error('Erro ao enviar comprovante. Pagamento será marcado sem comprovante.')
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

  async function deleteFeesBatch() {
    if (selectedFees.size === 0) return
    const ids = Array.from(selectedFees)
    const { error } = await supabase
      .from('monthly_fees')
      .delete()
      .in('id', ids)
    if (error) {
      toast.error('Erro ao excluir mensalidades')
    } else {
      toast.success(`${ids.length} mensalidade${ids.length > 1 ? 's' : ''} excluida${ids.length > 1 ? 's' : ''}.`)
      await logAudit(supabase, {
        groupId,
        action: 'batch_delete_fees',
        entityType: 'monthly_fee',
        entityId: undefined,
        details: { count: ids.length, month: currentMonth },
      })
      setSelectedFees(new Set())
      loadData()
      loadAccumulatedBalance()
    }
  }

  function toggleFeeSelection(feeId: string) {
    setSelectedFees(prev => {
      const next = new Set(prev)
      if (next.has(feeId)) next.delete(feeId)
      else next.add(feeId)
      return next
    })
  }

  function toggleAllFees() {
    if (selectedFees.size === displayFees.length) {
      setSelectedFees(new Set())
    } else {
      setSelectedFees(new Set(displayFees.map(f => f.id)))
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
    let pixInfo = `Chave PIX: ${group.pix_key || 'Não configurada'}`
    if (group.pix_key_2) pixInfo += `\nChave PIX 2: ${group.pix_key_2}`
    if (group.pix_key_3) pixInfo += `\nChave PIX 3: ${group.pix_key_3}`
    pixInfo += `\nFavor: ${group.pix_beneficiary_name || 'Não configurado'}`
    const message = `Ola ${name}! 👋\n\nSua mensalidade de ${monthLabel} no valor de R$ ${feeAmount.toFixed(2)} esta pendente.\n\n${pixInfo}\n\nObrigado! ⚽\n- ${group.name}`
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

  // ── Revenue handlers ──

  function resetRevenueForm() {
    setRevenueCategory('other')
    setRevenueDescription('')
    setRevenueAmount('')
    setRevenueDate(format(new Date(), 'yyyy-MM-dd'))
    setRevenueNotes('')
  }

  async function handleAddRevenue(e: React.FormEvent) {
    e.preventDefault()
    setSavingRevenue(true)
    const { data: newRevenue, error } = await supabase.from('revenues').insert({
      group_id: groupId,
      category: revenueCategory,
      description: revenueDescription,
      amount: parseFloat(revenueAmount),
      revenue_date: revenueDate,
      notes: revenueNotes || null,
    }).select().single()
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Receita registrada!')
      await logAudit(supabase, {
        groupId,
        action: 'create_revenue',
        entityType: 'revenue',
        entityId: newRevenue?.id,
        details: { description: revenueDescription, amount: parseFloat(revenueAmount), category: revenueCategory },
      })
      setRevenueDialogOpen(false)
      resetRevenueForm()
      loadData()
      loadAccumulatedBalance()
    }
    setSavingRevenue(false)
  }

  function openEditRevenue(rev: any) {
    setEditingRevenue(rev)
    setRevenueCategory(rev.category)
    setRevenueDescription(rev.description)
    setRevenueAmount(String(Number(rev.amount)))
    setRevenueDate(rev.revenue_date)
    setRevenueNotes(rev.notes || '')
    setEditRevenueDialogOpen(true)
  }

  async function handleEditRevenue(e: React.FormEvent) {
    e.preventDefault()
    if (!editingRevenue) return
    setSavingRevenue(true)
    const { error } = await supabase.from('revenues').update({
      category: revenueCategory,
      description: revenueDescription,
      amount: parseFloat(revenueAmount),
      revenue_date: revenueDate,
      notes: revenueNotes || null,
    }).eq('id', editingRevenue.id)
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Receita atualizada!')
      await logAudit(supabase, {
        groupId,
        action: 'edit_revenue',
        entityType: 'revenue',
        entityId: editingRevenue.id,
        details: { description: revenueDescription, amount: parseFloat(revenueAmount), category: revenueCategory },
      })
      setEditRevenueDialogOpen(false)
      setEditingRevenue(null)
      resetRevenueForm()
      loadData()
      loadAccumulatedBalance()
    }
    setSavingRevenue(false)
  }

  async function deleteRevenue(id: string, desc?: string) {
    if (!confirm('Remover esta receita?')) return
    await supabase.from('revenues').delete().eq('id', id)
    await logAudit(supabase, {
      groupId,
      action: 'delete_revenue',
      entityType: 'revenue',
      entityId: id,
      details: { description: desc },
    })
    toast.success('Receita removida!')
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

  // Receitas (outras)
  const totalRevenuesAmount = revenues.reduce((s: number, r: any) => s + Number(r.amount), 0)
  const byRevenueCategory = revenues.reduce((acc: Record<string, number>, r: any) => {
    acc[r.category] = (acc[r.category] || 0) + Number(r.amount)
    return acc
  }, {} as Record<string, number>)

  // DRE
  const dreTotalFees = displayFees.filter(f => f.status === 'paid').reduce((sum, f) => sum + Number(f.amount), 0)
  const dreTotalGuests = paidGuests.reduce((sum, g) => sum + Number(g.amount), 0)
  const dreTotalRevenues = totalRevenuesAmount
  const dreTotalIncome = dreTotalFees + dreTotalGuests + dreTotalRevenues
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
    const monthRevenues = dreAnnualRevenues.filter(r => r.revenue_date?.startsWith(monthKey)).reduce((s: number, r: any) => s + Number(r.amount), 0)
    const monthExpenses = dreAnnualExpenses.filter(e => e.expense_date?.startsWith(monthKey)).reduce((s: number, e: any) => s + Number(e.amount), 0)
    const totalReceitas = monthFees + monthGuests + monthRevenues
    const saldo = totalReceitas - monthExpenses
    return { name, monthKey, mensalidades: monthFees, avulsos: monthGuests, outrasReceitas: monthRevenues, totalReceitas, despesas: monthExpenses, saldo }
  })
  const dreAnnualTotals = dreAnnualMonthsData.reduce(
    (acc, m) => ({
      mensalidades: acc.mensalidades + m.mensalidades,
      avulsos: acc.avulsos + m.avulsos,
      outrasReceitas: acc.outrasReceitas + m.outrasReceitas,
      totalReceitas: acc.totalReceitas + m.totalReceitas,
      despesas: acc.despesas + m.despesas,
      saldo: acc.saldo + m.saldo,
    }),
    { mensalidades: 0, avulsos: 0, outrasReceitas: 0, totalReceitas: 0, despesas: 0, saldo: 0 }
  )

  // Saldo Acumulado
  const groupInitialBalance = Number(group?.initial_balance ?? 0)
  const allTimeIncome = allTimeFees + allTimeGuests + allTimeRevenues
  const accumulatedBalance = groupInitialBalance + allTimeIncome - allTimeExpenses

  // Saldo Inicial (tudo antes do mês selecionado) e Saldo Final
  const saldoInicial = groupInitialBalance + (priorFees + priorGuests + priorRevenues) - priorExpenses
  const receitasDoMes = dreTotalIncome
  const despesasDoMes = dreTotalExpenses
  const saldoFinal = saldoInicial + receitasDoMes - despesasDoMes

  function formatCurrency(value: number) {
    return `R$ ${value.toFixed(2)}`
  }

  // Convert SVG to PNG base64 via canvas
  async function svgToBase64Png(svgUrl: string, width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = svgUrl
    })
  }

  async function generatePDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    toast.info('Gerando PDF...')

    try {
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentW = pageW - margin * 2

    const fontFamily = 'helvetica'

    // Load logo as PNG
    let logoPng: string | null = null
    try {
      logoPng = await svgToBase64Png('/logo.svg', 600, 150)
    } catch { /* fallback to text */ }

    let logoWhitePng: string | null = null
    try {
      logoWhitePng = await svgToBase64Png('/logo-white.svg', 600, 150)
    } catch { /* fallback to text */ }

    // Brand colors
    const navy = { r: 27, g: 31, b: 75 }
    const green = { r: 0, g: 200, b: 83 }
    const red = { r: 229, g: 57, b: 53 }
    const blue = { r: 21, g: 101, b: 192 }

    const monthLabel = format(currentDate, 'MMMM yyyy')
    const groupName = group?.name || 'Grupo'
    let y = 0

    // ── Helpers ──
    function roundedRect(x: number, yPos: number, w: number, h: number, r: number) {
      doc.roundedRect(x, yPos, w, h, r, r, 'F')
    }

    function checkPageBreak(yPos: number, needed: number): number {
      if (yPos + needed > pageH - 25) { doc.addPage(); return 20 }
      return yPos
    }

    function sectionHeader(title: string, yPos: number): number {
      if (yPos > 245) { doc.addPage(); yPos = 20 }
      doc.setFillColor(navy.r, navy.g, navy.b)
      doc.rect(margin, yPos, 3, 8, 'F')
      doc.setFontSize(13)
      doc.setFont(fontFamily, 'bold')
      doc.setTextColor(navy.r, navy.g, navy.b)
      doc.text(title, margin + 7, yPos + 6)
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.3)
      doc.line(margin, yPos + 10, pageW - margin, yPos + 10)
      return yPos + 14
    }

    function addFooters() {
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.3)
        doc.line(margin, pageH - 20, pageW - margin, pageH - 20)
        // Logo in footer
        if (logoPng) {
          doc.addImage(logoPng, 'PNG', margin, pageH - 17, 28, 7)
        } else {
          doc.setFontSize(7)
          doc.setFont(fontFamily, 'bold')
          doc.setTextColor(navy.r, navy.g, navy.b)
          doc.text('PeladeiroPro', margin, pageH - 12)
        }
        // Center: date
        doc.setFont(fontFamily, 'normal')
        doc.setFontSize(7)
        doc.setTextColor(150, 150, 150)
        doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW / 2, pageH - 12, { align: 'center' })
        // Right: page
        doc.text(`Pagina ${i} de ${totalPages}`, pageW - margin, pageH - 12, { align: 'right' })
      }
    }

    // ═══════════════════════════════════════════
    //  HEADER
    // ═══════════════════════════════════════════
    const headerH = 40
    doc.setFillColor(navy.r, navy.g, navy.b)
    doc.rect(0, 0, pageW, headerH, 'F')
    doc.setFillColor(15, 18, 55)
    doc.rect(0, 0, pageW, 5, 'F')

    // Logo in header
    if (logoWhitePng) {
      doc.addImage(logoWhitePng, 'PNG', margin, 9, 48, 12)
    } else {
      doc.setFontSize(22)
      doc.setFont(fontFamily, 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('PeladeiroPro', margin, 19)
    }

    // Subtitle
    doc.setFontSize(9)
    doc.setFont(fontFamily, 'normal')
    doc.setTextColor(200, 210, 255)
    doc.text('Relatorio Financeiro', margin, 28)

    // Group name (right)
    doc.setFontSize(11)
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(groupName, pageW - margin, 17, { align: 'right' })

    // Month (right)
    doc.setFontSize(9)
    doc.setFont(fontFamily, 'normal')
    doc.setTextColor(200, 210, 255)
    const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
    doc.text(capitalizedMonth, pageW - margin, 25, { align: 'right' })

    // Green accent line
    doc.setFillColor(green.r, green.g, green.b)
    doc.rect(0, headerH, pageW, 1.5, 'F')

    y = headerH + 12

    // ═══════════════════════════════════════════
    //  SUMMARY CARDS
    // ═══════════════════════════════════════════
    const totalReceitasMensalidades = displayFees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0)
    const totalReceitasAvulsos = paidGuests.reduce((s, g) => s + Number(g.amount), 0)
    const totalReceitasOutras = revenues.reduce((s: number, r: any) => s + Number(r.amount), 0)
    const totalReceitas = totalReceitasMensalidades + totalReceitasAvulsos + totalReceitasOutras
    const totalDespesas = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
    const saldo = totalReceitas - totalDespesas

    const cardW = (contentW - 9) / 4
    const cardH = 28
    const cardR = 3

    const cards = [
      { label: 'Mensalidades', value: `R$ ${totalReceitasMensalidades.toFixed(2)}`, color: green },
      { label: 'Avulsos', value: `R$ ${totalReceitasAvulsos.toFixed(2)}`, color: blue },
      { label: 'Despesas', value: `R$ ${totalDespesas.toFixed(2)}`, color: red },
      { label: 'Saldo', value: `${saldo >= 0 ? '+' : ''}R$ ${saldo.toFixed(2)}`, color: saldo >= 0 ? green : red },
    ]

    cards.forEach((card, i) => {
      const x = margin + i * (cardW + 3)
      const tR = Math.round(card.color.r + (255 - card.color.r) * 0.88)
      const tG = Math.round(card.color.g + (255 - card.color.g) * 0.88)
      const tB = Math.round(card.color.b + (255 - card.color.b) * 0.88)
      doc.setFillColor(tR, tG, tB)
      roundedRect(x, y, cardW, cardH, cardR)
      doc.setFillColor(card.color.r, card.color.g, card.color.b)
      doc.rect(x, y + 3, 2.5, cardH - 6, 'F')
      doc.setFontSize(7.5)
      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(card.label, x + 6, y + 9)
      doc.setFontSize(12)
      doc.setFont(fontFamily, 'bold')
      doc.setTextColor(card.color.r, card.color.g, card.color.b)
      doc.text(card.value, x + 6, y + 20)
    })

    y += cardH + 6
    if (totalReceitasOutras > 0) {
      doc.setFontSize(8)
      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(120, 120, 120)
      doc.text(`Outras receitas incluidas: R$ ${totalReceitasOutras.toFixed(2)}`, margin, y + 2)
      y += 8
    }
    y += 6

    // ═══════════════════════════════════════════
    //  MENSALIDADES
    // ═══════════════════════════════════════════
    const statusLabel: Record<string, string> = {
      paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', waived: 'Isento', dm_leave: 'DM',
    }

    y = sectionHeader('Mensalidades', y)

    const feeRows = displayFees.map(fee => [
      (fee.member as any)?.name || '-',
      `R$ ${Number(fee.amount).toFixed(2)}`,
      statusLabel[fee.status] || fee.status,
      fee.paid_at ? format(new Date(fee.paid_at), 'dd/MM/yyyy') : '-',
    ])

    autoTable(doc, {
      startY: y,
      head: [['Membro', 'Valor', 'Status', 'Data Pagamento']],
      body: feeRows,
      theme: 'striped',
      styles: { font: fontFamily, fontSize: 8.5, cellPadding: 3.5 },
      headStyles: { fillColor: [navy.r, navy.g, navy.b], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 4 },
      bodyStyles: { textColor: [60, 60, 60] },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 35, halign: 'right' }, 2: { cellWidth: 35, halign: 'center' }, 3: { cellWidth: 40, halign: 'center' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 2) {
          const val = data.cell.raw as string
          if (val === 'Pago') { data.cell.styles.fillColor = [232, 245, 233]; data.cell.styles.textColor = [0, 150, 50]; data.cell.styles.fontStyle = 'bold' }
          else if (val === 'Atrasado') { data.cell.styles.fillColor = [255, 235, 238]; data.cell.styles.textColor = [200, 30, 30]; data.cell.styles.fontStyle = 'bold' }
          else if (val === 'Pendente') { data.cell.styles.fillColor = [255, 249, 230]; data.cell.styles.textColor = [200, 140, 0]; data.cell.styles.fontStyle = 'bold' }
          else if (val === 'Isento') { data.cell.styles.fillColor = [240, 240, 240]; data.cell.styles.textColor = [120, 120, 120] }
          else if (val === 'DM') { data.cell.styles.fillColor = [232, 240, 254]; data.cell.styles.textColor = [30, 90, 180] }
        }
      },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 12

    // ═══════════════════════════════════════════
    //  DESPESAS
    // ═══════════════════════════════════════════
    y = checkPageBreak(y, 40)
    y = sectionHeader('Despesas', y)

    const expenseRows = expenses.map((e: any) => [
      EXPENSE_CATEGORIES[e.category] || e.category,
      e.description || '-',
      `R$ ${Number(e.amount).toFixed(2)}`,
      e.expense_date ? format(new Date(e.expense_date), 'dd/MM/yyyy') : '-',
    ])

    if (expenseRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Categoria', 'Descricao', 'Valor', 'Data']],
        body: expenseRows,
        theme: 'striped',
        styles: { font: fontFamily, fontSize: 8.5, cellPadding: 3.5 },
        headStyles: { fillColor: [navy.r, navy.g, navy.b], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 4 },
        bodyStyles: { textColor: [60, 60, 60] },
        alternateRowStyles: { fillColor: [252, 245, 245] },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 65 }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 30, halign: 'center' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 2) {
            data.cell.styles.textColor = [red.r, red.g, red.b]
            data.cell.styles.fontStyle = 'bold'
          }
        },
        margin: { left: margin, right: margin },
      })
      y = (doc as any).lastAutoTable.finalY + 12
    } else {
      doc.setFillColor(248, 248, 248)
      roundedRect(margin, y, contentW, 16, 3)
      doc.setFontSize(9)
      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(150, 150, 150)
      doc.text('Nenhuma despesa registrada no periodo.', pageW / 2, y + 10, { align: 'center' })
      y += 24
    }

    // ═══════════════════════════════════════════
    //  JOGADORES AVULSOS
    // ═══════════════════════════════════════════
    y = checkPageBreak(y, 40)
    y = sectionHeader('Jogadores Avulsos', y)

    const guestRows = allGuests.map((g: any) => [
      g.name || '-',
      `R$ ${Number(g.amount).toFixed(2)}`,
      g.paid ? 'Sim' : 'Nao',
      g.match_date ? format(new Date(g.match_date), 'dd/MM/yyyy') : '-',
    ])

    if (guestRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Nome', 'Valor', 'Pago', 'Data']],
        body: guestRows,
        theme: 'striped',
        styles: { font: fontFamily, fontSize: 8.5, cellPadding: 3.5 },
        headStyles: { fillColor: [navy.r, navy.g, navy.b], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 4 },
        bodyStyles: { textColor: [60, 60, 60] },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 35, halign: 'right' }, 2: { cellWidth: 30, halign: 'center' }, 3: { cellWidth: 40, halign: 'center' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 2) {
            const val = data.cell.raw as string
            if (val === 'Sim') { data.cell.styles.fillColor = [232, 245, 233]; data.cell.styles.textColor = [0, 150, 50]; data.cell.styles.fontStyle = 'bold' }
            else { data.cell.styles.fillColor = [255, 235, 238]; data.cell.styles.textColor = [200, 30, 30]; data.cell.styles.fontStyle = 'bold' }
          }
        },
        margin: { left: margin, right: margin },
      })
    } else {
      doc.setFillColor(248, 248, 248)
      roundedRect(margin, y, contentW, 16, 3)
      doc.setFontSize(9)
      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(150, 150, 150)
      doc.text('Nenhum jogador avulso registrado no periodo.', pageW / 2, y + 10, { align: 'center' })
    }

    addFooters()

    const safeGroupName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const month = format(currentDate, 'MM')
    const year = format(currentDate, 'yyyy')
    doc.save(`relatorio-${safeGroupName}-${month}-${year}.pdf`)
    toast.success('Relatorio gerado com sucesso!')
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      toast.error('Erro ao gerar o PDF. Tente novamente.')
    }
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <span className="text-xs sm:text-sm font-medium text-[#1B1F4B] dark:text-gray-100 truncate">{label}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-[10px] sm:text-xs text-muted-foreground">{pct}%</span>
            <span className="text-xs sm:text-sm font-semibold tabular-nums text-right whitespace-nowrap">
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
        <Label>Descrição *</Label>
        <Input placeholder="Ex: Aluguel quadra Society ABC" value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
        <Label>Observações</Label>
        <Textarea placeholder="Notas adicionais" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
        {saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Registrar Despesa'}
      </Button>
    </form>
  )

  // ── Revenue form ──

  const revenueForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleEditRevenue : handleAddRevenue} className="space-y-4">
      <div className="space-y-2">
        <Label>Categoria *</Label>
        <Select value={revenueCategory} onValueChange={(v) => v && setRevenueCategory(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(REVENUE_CATEGORIES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Descrição *</Label>
        <Input placeholder="Ex: Patrocinio Loja X" value={revenueDescription} onChange={(e) => setRevenueDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <Label>Valor (R$) *</Label>
          <Input type="number" step="0.01" min="0" placeholder="500.00" value={revenueAmount} onChange={(e) => setRevenueAmount(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input type="date" value={revenueDate} onChange={(e) => setRevenueDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea placeholder="Notas adicionais" value={revenueNotes} onChange={(e) => setRevenueNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={savingRevenue}>
        {savingRevenue ? 'Salvando...' : isEdit ? 'Atualizar' : 'Registrar Receita'}
      </Button>
    </form>
  )

  return (
    <div className="overflow-x-hidden">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1B1F4B] dark:text-gray-100">Financeiro</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Gerencie mensalidades, despesas e acompanhe o resultado</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={generatePDF}
                className="border-[#1B1F4B]/20 text-[#1B1F4B] hover:bg-[#1B1F4B]/5 dark:text-gray-100 dark:border-gray-600"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Gerar PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
            )}
            {isReadOnly && (
              <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Somente leitura
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Caixa do Grupo (Saldo Inicial / Final) ── */}
      <Card className="mb-6 border-2 border-[#1B1F4B]/10 shadow-lg">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-full bg-[#1B1F4B]/10 p-2">
              <Wallet className="h-5 w-5 text-[#1B1F4B] dark:text-gray-100" />
            </div>
            <h2 className="text-lg font-bold text-[#1B1F4B] dark:text-gray-100">Caixa do Grupo</h2>
          </div>

          {/* Saldo Inicial → Movimentacao → Saldo Final */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 items-center">
            <div className="flex flex-col items-center sm:items-start p-2 sm:p-3 rounded-lg bg-slate-50">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase">Saldo Inicial</span>
              <span className={`text-sm sm:text-lg font-bold ${saldoInicial >= 0 ? 'text-[#1B1F4B] dark:text-gray-100' : 'text-red-500'}`}>
                {formatCurrency(saldoInicial)}
              </span>
            </div>

            <div className="flex flex-col items-center sm:items-start p-2 sm:p-3 rounded-lg bg-green-50">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase">+ Receitas</span>
              <span className="text-sm sm:text-lg font-bold text-[#00C853]">{formatCurrency(receitasDoMes)}</span>
            </div>

            <div className="flex flex-col items-center sm:items-start p-2 sm:p-3 rounded-lg bg-red-50">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase">- Despesas</span>
              <span className="text-sm sm:text-lg font-bold text-red-500">{formatCurrency(despesasDoMes)}</span>
            </div>

            <div className="hidden sm:flex items-center justify-center text-2xl text-muted-foreground">=</div>

            <div className="col-span-2 sm:col-span-1 flex flex-col items-center sm:items-start p-2 sm:p-3 rounded-lg bg-[#1B1F4B]/5 border-2 border-[#1B1F4B]/20">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase">Saldo Final</span>
              <span className={`text-base sm:text-xl font-extrabold ${saldoFinal >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
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
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-full min-w-fit">
            <TabsTrigger value="mensalidades" className="text-xs sm:text-sm gap-1 sm:gap-1.5 px-2 sm:px-3">
              <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Mensalidades</span>
              <span className="sm:hidden">Mensal.</span>
            </TabsTrigger>
            <TabsTrigger value="avulsos" className="text-xs sm:text-sm gap-1 sm:gap-1.5 px-2 sm:px-3">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Avulsos
            </TabsTrigger>
            <TabsTrigger value="despesas" className="text-xs sm:text-sm gap-1 sm:gap-1.5 px-2 sm:px-3">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Despesas</span>
              <span className="sm:hidden">Desp.</span>
            </TabsTrigger>
            <TabsTrigger value="receitas" className="text-xs sm:text-sm gap-1 sm:gap-1.5 px-2 sm:px-3">
              <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Receitas</span>
              <span className="sm:hidden">Rec.</span>
            </TabsTrigger>
            <TabsTrigger value="dre" className="text-xs sm:text-sm gap-1 sm:gap-1.5 px-2 sm:px-3">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              DRE
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab: Mensalidades ── */}
        <TabsContent value="mensalidades">
          <div className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {paidCount}/{displayFees.length} pagas | R$ {totalFeesAmount.toFixed(2)}{dmCount > 0 ? ` | ${dmCount} DM` : ''}
              </p>
              <div className="flex gap-2 flex-wrap">
                {isAdmin && pendingFees.length > 0 && (
                  <Dialog open={cobrancaDialogOpen} onOpenChange={setCobrancaDialogOpen}>
                    <DialogTrigger render={<Button variant="outline" size="sm" className="text-green-600 border-green-400 hover:bg-green-50 text-xs sm:text-sm" />}>
                      <MessageCircle className="h-3.5 w-3.5 sm:mr-1.5" />
                      <span className="hidden sm:inline">Cobrar Pendentes</span>
                      <span className="sm:hidden">Cobrar</span>
                    </DialogTrigger>
                    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
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
                    size="sm"
                    className="bg-[#00C853] hover:bg-[#00A843] text-white text-xs sm:text-sm"
                    onClick={generateFees}
                    disabled={generating}
                  >
                    <Zap className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">{generating ? 'Gerando...' : 'Gerar Mensalidades'}</span>
                    <span className="sm:hidden">{generating ? 'Gerando...' : 'Gerar'}</span>
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
              <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
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

            {/* Batch actions bar */}
            {isAdmin && selectedFees.size > 0 && (
              <div className="flex items-center gap-2 sm:gap-3 p-3 bg-red-50 border border-red-200 rounded-xl flex-wrap">
                <span className="text-xs sm:text-sm font-medium text-red-700">{selectedFees.size} selecionada{selectedFees.size > 1 ? 's' : ''}</span>
                <Button size="sm" variant="outline" className="text-red-600 border-red-400 hover:bg-red-100 text-xs" onClick={deleteFeesBatch}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Excluir
                </Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground text-xs" onClick={() => setSelectedFees(new Set())}>
                  Cancelar
                </Button>
              </div>
            )}

            {/* ── Mobile card list ── */}
            <div className="sm:hidden space-y-2">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Carregando...</p>
              ) : displayFees.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma mensalidade gerada. Clique em &quot;Gerar&quot; para criar.
                </p>
              ) : (
                displayFees.map((fee) => (
                  <div key={fee.id} className={`p-3 rounded-xl border-l-[3px] border border-gray-100 dark:border-gray-800 shadow-sm ${
                    selectedFees.has(fee.id)
                      ? 'bg-red-50/50 dark:bg-red-950/30 !border-red-300 dark:!border-red-800'
                      : fee.status === 'paid' ? 'border-l-[#00C853] bg-white dark:bg-gray-900'
                      : fee.status === 'dm_leave' ? 'border-l-blue-400 bg-white dark:bg-gray-900'
                      : fee.status === 'overdue' ? 'border-l-red-400 bg-white dark:bg-gray-900'
                      : fee.status === 'waived' ? 'border-l-amber-400 bg-white dark:bg-gray-900'
                      : 'border-l-gray-300 dark:border-l-gray-600 bg-white dark:bg-gray-900'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 accent-[#1B1F4B] cursor-pointer shrink-0 mt-0.5"
                            checked={selectedFees.has(fee.id)}
                            onChange={() => toggleFeeSelection(fee.id)}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate">{fee.member?.name}</span>
                            {fee.status === 'paid' && fee.receipt_url && (
                              <button onClick={() => setViewingReceipt(fee.receipt_url!)} className="text-blue-500 shrink-0"><Eye className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground tabular-nums">R$ {Number(fee.amount).toFixed(2)}</span>
                            {fee.paid_at && <span className="text-[10px] text-muted-foreground">Pago {format(new Date(fee.paid_at), 'dd/MM')}</span>}
                          </div>
                        </div>
                      </div>
                      {statusBadge(fee.status)}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1.5 mt-2 pt-2 border-t border-dashed dark:border-gray-700 border-gray-200">
                        {(fee.status === 'pending' || fee.status === 'overdue') ? (
                          <>
                            <button className="inline-flex items-center justify-center rounded-lg bg-[#00C853] hover:bg-[#00A843] text-white h-8 px-3 text-xs font-medium flex-1 shadow-sm transition-colors" onClick={() => openPaymentDialog(fee.id, fee.member?.name || '')}>
                              <Check className="h-3.5 w-3.5 mr-1" />Pago
                            </button>
                            <Button size="sm" variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 h-8 px-3 text-xs" onClick={() => markAsDmLeave(fee.id, fee.member?.name)}>
                              <Stethoscope className="h-3.5 w-3.5 mr-1" />DM
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 w-8 p-0" onClick={() => deleteFee(fee.id, fee.member?.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (fee.status === 'paid' || fee.status === 'dm_leave' || fee.status === 'waived') ? (
                          <>
                            <Button size="sm" variant="ghost" className="text-muted-foreground h-8 px-3 text-xs" onClick={() => openEditPaymentDialog(fee)}>
                              <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 w-8 p-0" onClick={() => deleteFee(fee.id, fee.member?.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ── Desktop table ── */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && (
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 accent-[#1B1F4B] cursor-pointer"
                            checked={displayFees.length > 0 && selectedFees.size === displayFees.length}
                            onChange={toggleAllFees}
                          />
                        </TableHead>
                      )}
                      <TableHead>Membro</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Pgto</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                      </TableRow>
                    ) : displayFees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                          Nenhuma mensalidade gerada. Clique em &quot;Gerar Mensalidades&quot; para criar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayFees.map((fee) => (
                        <TableRow key={fee.id} className={selectedFees.has(fee.id) ? 'bg-red-50/50' : ''}>
                          {isAdmin && (
                            <TableCell className="w-10">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 accent-[#1B1F4B] cursor-pointer"
                                checked={selectedFees.has(fee.id)}
                                onChange={() => toggleFeeSelection(fee.id)}
                              />
                            </TableCell>
                          )}
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
                          <TableCell className="whitespace-nowrap">R$ {Number(fee.amount).toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(fee.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{statusBadge(fee.status)}</TableCell>
                          <TableCell>
                            {fee.paid_at ? format(new Date(fee.paid_at), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {(fee.status === 'pending' || fee.status === 'overdue') && isAdmin ? (
                              <div className="flex gap-1 justify-end flex-wrap">
                                <Button size="sm" variant="outline" className="text-[#00C853] border-[#00C853] hover:bg-[#00C853]/10 h-7 px-2 text-xs" onClick={() => openPaymentDialog(fee.id, fee.member?.name || '')}>
                                  <Check className="h-3 w-3 mr-1" />Pago
                                </Button>
                                <Button size="sm" variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 h-7 px-2 text-xs" onClick={() => markAsDmLeave(fee.id, fee.member?.name)}>
                                  <Stethoscope className="h-3 w-3 mr-1" />DM
                                </Button>
                                <Button size="sm" variant="ghost" className="text-muted-foreground h-7 px-2 text-xs" onClick={() => markAsWaived(fee.id, fee.member?.name)}>
                                  Dispensar
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 w-7 p-0" onClick={() => deleteFee(fee.id, fee.member?.name)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (fee.status === 'paid' || fee.status === 'dm_leave' || fee.status === 'waived') && isAdmin ? (
                              <div className="flex gap-1 justify-end flex-wrap">
                                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-brand-navy h-7 px-2 text-xs" onClick={() => openEditPaymentDialog(fee)}>
                                  <Pencil className="h-3 w-3 mr-1" />Editar
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 w-7 p-0" onClick={() => deleteFee(fee.id, fee.member?.name)}>
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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: Avulsos ── */}
        <TabsContent value="avulsos">
          <div className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {allGuests.length} avulso{allGuests.length !== 1 ? 's' : ''}
                  {' '}&bull;{' '}
                  <span className="text-[#00C853] font-medium">
                    {allGuests.filter(g => g.paid).length} pago{allGuests.filter(g => g.paid).length !== 1 ? 's' : ''}
                  </span>
                  {' '}&bull;{' '}
                  <span className="text-amber-500 font-medium">
                    {allGuests.filter(g => !g.paid).length} pend.
                  </span>
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  Total: R$ {allGuests.reduce((s, g) => s + Number(g.amount), 0).toFixed(2)}
                  {' '}&bull;{' '}
                  Receb.: R$ {allGuests.filter(g => g.paid).reduce((s, g) => s + Number(g.amount), 0).toFixed(2)}
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
                        <Label>Observações</Label>
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
                    <Label>Observações</Label>
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

            {/* ── Mobile card list ── */}
            <div className="sm:hidden space-y-2">
              {allGuests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum jogador avulso neste mês.</p>
              ) : (
                allGuests.map((guest) => (
                  <div key={guest.id} className={`p-3 rounded-xl border-l-[3px] border border-gray-100 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 ${guest.paid ? 'border-l-[#00C853]' : 'border-l-amber-400'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold truncate">{guest.name}</span>
                          {guest.receipt_url && (
                            <button onClick={() => setViewingReceipt(guest.receipt_url)} className="text-blue-500 shrink-0"><Eye className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground tabular-nums">R$ {Number(guest.amount).toFixed(2)}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(guest.match_date + 'T12:00:00'), 'dd/MM')}</span>
                          {guest.notes && <span className="text-[10px] text-muted-foreground truncate">{guest.notes}</span>}
                        </div>
                      </div>
                      {guest.paid ? (
                        <Badge className="bg-[#00C853]/10 text-[#00C853] shrink-0 text-xs"><Check className="h-3 w-3 mr-0.5" />Pago</Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-xs"><Clock className="h-3 w-3 mr-0.5" />Pend.</Badge>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1.5 mt-2 pt-2 border-t border-dashed dark:border-gray-700">
                        {!guest.paid ? (
                          <button className="inline-flex items-center justify-center rounded-lg bg-[#00C853] hover:bg-[#00A843] text-white h-8 px-3 text-xs font-medium flex-1 shadow-sm transition-colors" onClick={() => markGuestPaid(guest.id, guest.name)}>
                            <Check className="h-3.5 w-3.5 mr-1" />Pago
                          </button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-muted-foreground h-8 px-3 text-xs" onClick={() => markGuestUnpaid(guest.id, guest.name)}>
                            <Minus className="h-3.5 w-3.5 mr-1" />Desfazer
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-muted-foreground h-8 w-8 p-0" onClick={() => openEditGuestDialog(guest)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 w-8 p-0" onClick={() => deleteGuest(guest.id, guest.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ── Desktop table ── */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allGuests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum jogador avulso neste mês.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allGuests.map((guest) => (
                        <TableRow key={guest.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {guest.name}
                              {guest.receipt_url && (
                                <button onClick={() => setViewingReceipt(guest.receipt_url)} className="text-blue-500 hover:text-blue-700 transition-colors" title="Ver comprovante">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {guest.notes && <p className="text-xs text-muted-foreground">{guest.notes}</p>}
                          </TableCell>
                          <TableCell>{format(new Date(guest.match_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>R$ {Number(guest.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            {guest.paid ? (
                              <Badge className="bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20"><Check className="h-3 w-3 mr-1" />Pago</Badge>
                            ) : (
                              <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <div className="flex gap-1 justify-end">
                                {!guest.paid ? (
                                  <Button size="sm" variant="outline" className="text-[#00C853] border-[#00C853] hover:bg-[#00C853]/10 h-7 px-2 text-xs" onClick={() => markGuestPaid(guest.id, guest.name)}>
                                    <Check className="h-3 w-3 mr-1" />Pago
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="ghost" className="text-muted-foreground h-7 px-2 text-xs" onClick={() => markGuestUnpaid(guest.id, guest.name)}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="text-muted-foreground h-7 w-7 p-0" onClick={() => openEditGuestDialog(guest)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 w-7 p-0" onClick={() => deleteGuest(guest.id, guest.name)}>
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
                </div>
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

            {/* ── Mobile card list ── */}
            <div className="sm:hidden space-y-2">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Carregando...</p>
              ) : expenses.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma despesa neste mês.</p>
              ) : (
                expenses.map((exp: any) => (
                  <div key={exp.id} className="p-3 rounded-xl border-l-[3px] border-l-red-400 border border-gray-100 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold">{exp.description}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${categoryColors[exp.category]} text-[10px]`} variant="secondary">
                            {EXPENSE_CATEGORIES[exp.category as keyof typeof EXPENSE_CATEGORIES]}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(exp.expense_date + 'T12:00:00'), 'dd/MM')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-medium text-red-500">R$ {Number(exp.amount).toFixed(2)}</span>
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="ghost" className="text-muted-foreground h-7 w-7 p-0" onClick={() => openEditExpense(exp)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0" onClick={() => deleteExpense(exp.id, exp.description)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Desktop table ── */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Pago por</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                      </TableRow>
                    ) : expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma despesa neste mês.</TableCell>
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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: Receitas ── */}
        <TabsContent value="receitas">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total: R$ {totalRevenuesAmount.toFixed(2)}</p>
              {isAdmin && (
                <Dialog open={revenueDialogOpen} onOpenChange={(v) => { setRevenueDialogOpen(v); if (!v) resetRevenueForm() }}>
                  <Button className="bg-[#00C853] hover:bg-[#00A843] text-white" onClick={() => setRevenueDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Receita
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Receita</DialogTitle>
                    </DialogHeader>
                    {revenueForm(false)}
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Edit Revenue Dialog */}
            <Dialog open={editRevenueDialogOpen} onOpenChange={(v) => { setEditRevenueDialogOpen(v); if (!v) { setEditingRevenue(null); resetRevenueForm() } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Receita</DialogTitle>
                </DialogHeader>
                {revenueForm(true)}
              </DialogContent>
            </Dialog>

            {/* Category summary */}
            {Object.keys(byRevenueCategory).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(byRevenueCategory).map(([cat, val]) => (
                  <Badge key={cat} className={revenueCategoryColors[cat] || 'bg-gray-100'} variant="secondary">
                    {REVENUE_CATEGORIES[cat] || cat}: R$ {(val as number).toFixed(2)}
                  </Badge>
                ))}
              </div>
            )}

            {/* ── Mobile card list ── */}
            <div className="sm:hidden space-y-2">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Carregando...</p>
              ) : revenues.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma receita neste mês.</p>
              ) : (
                revenues.map((rev: any) => (
                  <div key={rev.id} className="p-3 rounded-xl border-l-[3px] border-l-[#00C853] border border-gray-100 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold">{rev.description}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${revenueCategoryColors[rev.category] || 'bg-gray-100'} text-[10px]`} variant="secondary">
                            {REVENUE_CATEGORIES[rev.category] || rev.category}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(rev.revenue_date + 'T12:00:00'), 'dd/MM')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-medium text-[#00C853]">R$ {Number(rev.amount).toFixed(2)}</span>
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="ghost" className="text-muted-foreground h-7 w-7 p-0" onClick={() => openEditRevenue(rev)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0" onClick={() => deleteRevenue(rev.id, rev.description)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Desktop table ── */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Obs</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                      </TableRow>
                    ) : revenues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma receita neste mês. Clique em &quot;Nova Receita&quot; para adicionar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      revenues.map((rev: any) => (
                        <TableRow key={rev.id}>
                          <TableCell className="font-medium">{rev.description}</TableCell>
                          <TableCell>
                            <Badge className={revenueCategoryColors[rev.category] || 'bg-gray-100'} variant="secondary">
                              {REVENUE_CATEGORIES[rev.category] || rev.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[#00C853] font-medium whitespace-nowrap">R$ {Number(rev.amount).toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(rev.revenue_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{rev.notes || '-'}</TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => openEditRevenue(rev)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteRevenue(rev.id, rev.description)}>
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
                </div>
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
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-[#1B1F4B] dark:text-gray-100 dark:text-white'
                    : 'text-muted-foreground hover:text-[#1B1F4B] dark:text-gray-100 dark:hover:text-white'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setDreView('anual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  dreView === 'anual'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-[#1B1F4B] dark:text-gray-100 dark:text-white'
                    : 'text-muted-foreground hover:text-[#1B1F4B] dark:text-gray-100 dark:hover:text-white'
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
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <Card className="border-l-4 border-l-[#00C853]">
                        <CardContent className="pt-3 sm:pt-4 px-2 sm:px-6">
                          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
                            <div className="hidden sm:block rounded-full bg-[#00C853]/10 p-2">
                              <TrendingUp className="h-5 w-5 text-[#00C853]" />
                            </div>
                            <div className="text-center sm:text-left">
                              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium uppercase">Receitas</p>
                              <p className="text-sm sm:text-xl font-bold text-[#00C853]">{formatCurrency(dreTotalIncome)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-red-500">
                        <CardContent className="pt-3 sm:pt-4 px-2 sm:px-6">
                          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
                            <div className="hidden sm:block rounded-full bg-red-500/10 p-2">
                              <TrendingDown className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="text-center sm:text-left">
                              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium uppercase">Despesas</p>
                              <p className="text-sm sm:text-xl font-bold text-red-500">{formatCurrency(dreTotalExpenses)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className={`border-l-4 ${dreNetResult >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
                        <CardContent className="pt-3 sm:pt-4 px-2 sm:px-6">
                          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
                            <div className={`hidden sm:block rounded-full p-2 ${dreNetResult >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                              <DollarSign className={`h-5 w-5 ${dreNetResult >= 0 ? 'text-blue-500' : 'text-red-500'}`} />
                            </div>
                            <div className="text-center sm:text-left">
                              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium uppercase">Resultado</p>
                              <p className={`text-sm sm:text-xl font-bold ${dreNetResult >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
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
                            <h2 className="text-lg font-bold text-[#1B1F4B] dark:text-gray-100">Receitas</h2>
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
                            {dreTotalRevenues > 0 && (
                              <BarLine
                                label={`Outras receitas (${revenues.length})`}
                                value={dreTotalRevenues}
                                total={dreTotalIncome}
                                color="#6366f1"
                                icon={<Banknote className="h-4 w-4 text-indigo-500" />}
                              />
                            )}
                          </div>
                          <div className="mt-4 pt-3 border-t border-dashed dark:border-gray-700 flex items-center justify-between">
                            <span className="text-sm font-bold text-[#1B1F4B] dark:text-gray-100">Total de Receitas</span>
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
                            <h2 className="text-lg font-bold text-[#1B1F4B] dark:text-gray-100">Despesas</h2>
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
                              <p className="text-sm text-muted-foreground italic">Nenhuma despesa registrada neste mês.</p>
                            )}
                          </div>
                          <div className="mt-4 pt-3 border-t border-dashed dark:border-gray-700 flex items-center justify-between">
                            <span className="text-sm font-bold text-[#1B1F4B] dark:text-gray-100">Total de Despesas</span>
                            <span className="text-sm font-bold text-red-500">{formatCurrency(dreTotalExpenses)}</span>
                          </div>
                        </section>

                        {/* Separator */}
                        <div className="h-px bg-border" />

                        {/* RESULTADO */}
                        <section>
                          <div className="flex items-center gap-2 mb-4">
                            <DollarSign className={`h-5 w-5 ${dreNetResult >= 0 ? 'text-[#00C853]' : 'text-red-500'}`} />
                            <h2 className="text-lg font-bold text-[#1B1F4B] dark:text-gray-100">Resultado</h2>
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
                            <div className="border-t pt-2 mt-2 flex items-center justify-between gap-2">
                              <span className="text-sm sm:text-base font-bold text-[#1B1F4B] dark:text-gray-100">Resultado Líquido</span>
                              <span className={`text-base sm:text-lg font-bold ${dreNetResult >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
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
                    <CalendarDays className="h-4 w-4 text-[#1B1F4B] dark:text-gray-100" />
                    <span className="text-lg font-semibold text-[#1B1F4B] dark:text-gray-100 min-w-[60px] text-center">{dreYear}</span>
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
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <Card className="border-l-4 border-l-[#00C853]">
                        <CardContent className="pt-3 sm:pt-4 px-2 sm:px-6">
                          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
                            <div className="hidden sm:block rounded-full bg-[#00C853]/10 p-2">
                              <TrendingUp className="h-5 w-5 text-[#00C853]" />
                            </div>
                            <div className="text-center sm:text-left">
                              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium uppercase">Receitas</p>
                              <p className="text-sm sm:text-xl font-bold text-[#00C853]">{formatCurrency(dreAnnualTotals.totalReceitas)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-red-500">
                        <CardContent className="pt-3 sm:pt-4 px-2 sm:px-6">
                          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
                            <div className="hidden sm:block rounded-full bg-red-500/10 p-2">
                              <TrendingDown className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="text-center sm:text-left">
                              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium uppercase">Despesas</p>
                              <p className="text-sm sm:text-xl font-bold text-red-500">{formatCurrency(dreAnnualTotals.despesas)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className={`border-l-4 ${dreAnnualTotals.saldo >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
                        <CardContent className="pt-3 sm:pt-4 px-2 sm:px-6">
                          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
                            <div className={`hidden sm:block rounded-full p-2 ${dreAnnualTotals.saldo >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                              <DollarSign className={`h-5 w-5 ${dreAnnualTotals.saldo >= 0 ? 'text-blue-500' : 'text-red-500'}`} />
                            </div>
                            <div className="text-center sm:text-left">
                              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium uppercase">Saldo</p>
                              <p className={`text-sm sm:text-xl font-bold ${dreAnnualTotals.saldo >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
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
                                <TableHead className="font-semibold text-[#1B1F4B] dark:text-gray-100">Mes</TableHead>
                                <TableHead className="hidden sm:table-cell text-right font-semibold text-[#00C853]">Mensalidades</TableHead>
                                <TableHead className="hidden sm:table-cell text-right font-semibold text-[#66BB6A]">Avulsos</TableHead>
                                <TableHead className="hidden sm:table-cell text-right font-semibold text-indigo-500">Outras</TableHead>
                                <TableHead className="text-right font-semibold text-[#00C853]">
                                  <span className="hidden sm:inline">Total Receitas</span>
                                  <span className="sm:hidden">Receitas</span>
                                </TableHead>
                                <TableHead className="text-right font-semibold text-red-500">Despesas</TableHead>
                                <TableHead className="text-right font-semibold text-[#1B1F4B] dark:text-gray-100">Saldo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dreAnnualMonthsData.map((m, idx) => {
                                const hasData = m.mensalidades > 0 || m.avulsos > 0 || m.outrasReceitas > 0 || m.despesas > 0
                                return (
                                  <TableRow key={m.monthKey} className={idx % 2 === 0 ? 'bg-muted/20' : ''}>
                                    <TableCell className="font-medium text-[#1B1F4B] dark:text-gray-100">{m.name}</TableCell>
                                    <TableCell className="hidden sm:table-cell text-right tabular-nums">
                                      {hasData ? formatCurrency(m.mensalidades) : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-right tabular-nums">
                                      {hasData ? formatCurrency(m.avulsos) : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-right tabular-nums">
                                      {hasData ? formatCurrency(m.outrasReceitas) : <span className="text-muted-foreground">-</span>}
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
                                <TableCell className="font-bold text-[#1B1F4B] dark:text-gray-100">Total</TableCell>
                                <TableCell className="hidden sm:table-cell text-right font-bold tabular-nums">{formatCurrency(dreAnnualTotals.mensalidades)}</TableCell>
                                <TableCell className="hidden sm:table-cell text-right font-bold tabular-nums">{formatCurrency(dreAnnualTotals.avulsos)}</TableCell>
                                <TableCell className="hidden sm:table-cell text-right font-bold tabular-nums">{formatCurrency(dreAnnualTotals.outrasReceitas)}</TableCell>
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
                          <BarChart3 className="h-5 w-5 text-[#1B1F4B] dark:text-gray-100" />
                          <h2 className="text-lg font-bold text-[#1B1F4B] dark:text-gray-100">Resumo Anual {dreYear}</h2>
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
                          {dreAnnualTotals.outrasReceitas > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Outras Receitas</span>
                              <span className="text-indigo-500 font-medium">{formatCurrency(dreAnnualTotals.outrasReceitas)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm border-t pt-2">
                            <span className="font-semibold text-[#1B1F4B] dark:text-gray-100">Total Receitas</span>
                            <span className="text-[#00C853] font-bold">{formatCurrency(dreAnnualTotals.totalReceitas)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total Despesas</span>
                            <span className="text-red-500 font-medium">- {formatCurrency(dreAnnualTotals.despesas)}</span>
                          </div>
                          <div className="border-t pt-3 mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm sm:text-base font-bold text-[#1B1F4B] dark:text-gray-100">Resultado Anual</span>
                            <span className={`text-base sm:text-lg font-bold ${dreAnnualTotals.saldo >= 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
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
