'use client'

import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { EXPENSE_CATEGORIES, type Expense, type GroupMember, type Group, type MonthlyFee } from '@/lib/types'

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

  // Shared state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])

  // Mensalidades state
  const [fees, setFees] = useState<(MonthlyFee & { member?: { name: string; member_type: string } })[]>([])
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

  // DRE state
  const [paidGuests, setPaidGuests] = useState<any[]>([])

  const currentMonth = format(currentDate, 'yyyy-MM')

  async function loadData() {
    setLoading(true)
    const [
      { data: groupData },
      { data: membersData },
      { data: feesData },
      { data: expensesData },
      { data: guestsData },
    ] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'active').order('name'),
      supabase.from('monthly_fees').select('*, member:group_members(name, member_type)').eq('group_id', groupId).eq('reference_month', currentMonth),
      supabase.from('expenses').select('*, paid_by_member:group_members(name)').eq('group_id', groupId).gte('expense_date', `${currentMonth}-01`).lte('expense_date', `${currentMonth}-31`).order('expense_date', { ascending: false }),
      supabase.from('guest_players').select('*').eq('group_id', groupId).gte('match_date', `${currentMonth}-01`).lte('match_date', `${currentMonth}-31`).eq('paid', true),
    ])
    setGroup(groupData)
    setMembers(membersData || [])
    setFees(feesData || [])
    setExpenses(expensesData || [])
    setPaidGuests(guestsData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [groupId, currentMonth])

  // ── Mensalidades handlers ──

  async function generateFees() {
    if (!group || members.length === 0) return
    setGenerating(true)

    const mensalistas = members.filter(m => m.member_type === 'mensalista' && m.status === 'active')
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
      loadData()
    }
    setGenerating(false)
  }

  async function markAsPaid(feeId: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: 'pix' })
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao marcar pagamento')
    } else {
      toast.success('Pagamento confirmado!')
      loadData()
    }
  }

  async function markAsDmLeave(feeId: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .update({ status: 'dm_leave' })
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao marcar afastamento DM')
    } else {
      toast.success('Membro marcado como afastado (DM).')
      loadData()
    }
  }

  async function markAsWaived(feeId: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .update({ status: 'waived' })
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao dispensar mensalidade')
    } else {
      toast.success('Mensalidade dispensada.')
      loadData()
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
    const { error } = await supabase.from('expenses').insert({
      group_id: groupId,
      category,
      description,
      amount: parseFloat(amount),
      expense_date: expenseDate,
      paid_by_member_id: paidBy || null,
      notes: notes || null,
    })
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Despesa registrada!')
      setDialogOpen(false)
      resetExpenseForm()
      loadData()
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
      setEditDialogOpen(false)
      setEditingExpense(null)
      resetExpenseForm()
      loadData()
    }
    setSaving(false)
  }

  async function deleteExpense(id: string) {
    if (!confirm('Remover esta despesa?')) return
    await supabase.from('expenses').delete().eq('id', id)
    toast.success('Despesa removida!')
    loadData()
  }

  // ── Computed values ──

  // Mensalidades
  const paidCount = fees.filter(f => f.status === 'paid').length
  const totalFeesAmount = fees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0)
  const dmCount = fees.filter(f => f.status === 'dm_leave').length

  // Despesas
  const totalExpensesAmount = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
  const byCategory = expenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  // DRE
  const dreTotalFees = fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + Number(f.amount), 0)
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
        <h1 className="text-2xl font-bold text-[#1B1F4B]">Financeiro</h1>
        <p className="text-muted-foreground">Gerencie mensalidades, despesas e acompanhe o resultado financeiro</p>
      </div>

      <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

      <Tabs defaultValue="mensalidades">
        <TabsList className="w-full">
          <TabsTrigger value="mensalidades">
            <CreditCard className="h-4 w-4 mr-1.5" />
            Mensalidades
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {paidCount}/{fees.length} pagas | R$ {totalFeesAmount.toFixed(2)} recebido{dmCount > 0 ? ` | ${dmCount} afastados DM` : ''}
              </p>
              <Button
                className="bg-[#00C853] hover:bg-[#00A843] text-white"
                onClick={generateFees}
                disabled={generating}
              >
                <Zap className="h-4 w-4 mr-2" />
                {generating ? 'Gerando...' : 'Gerar Mensalidades'}
              </Button>
            </div>

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
                    ) : fees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma mensalidade gerada. Clique em &quot;Gerar Mensalidades&quot; para criar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      fees.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="font-medium">{fee.member?.name}</TableCell>
                          <TableCell>R$ {Number(fee.amount).toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(fee.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{statusBadge(fee.status)}</TableCell>
                          <TableCell>
                            {fee.paid_at ? format(new Date(fee.paid_at), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {fee.status === 'pending' || fee.status === 'overdue' ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="outline" className="text-[#00C853] border-[#00C853] hover:bg-[#00C853]/10" onClick={() => markAsPaid(fee.id)}>
                                  <Check className="h-3 w-3 mr-1" />
                                  Pago
                                </Button>
                                <Button size="sm" variant="outline" className="text-blue-600 border-blue-400 hover:bg-blue-50" onClick={() => markAsDmLeave(fee.id)}>
                                  <Stethoscope className="h-3 w-3 mr-1" />
                                  DM
                                </Button>
                                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => markAsWaived(fee.id)}>
                                  Dispensar
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

        {/* ── Tab: Despesas ── */}
        <TabsContent value="despesas">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total: R$ {totalExpensesAmount.toFixed(2)}</p>
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
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => openEditExpense(exp)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteExpense(exp.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
