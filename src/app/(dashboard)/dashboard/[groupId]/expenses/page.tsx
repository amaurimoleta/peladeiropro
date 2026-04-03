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
import { Plus, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { EXPENSE_CATEGORIES, type Expense, type GroupMember } from '@/lib/types'

const categoryColors: Record<string, string> = {
  court_rental: 'bg-blue-100 text-blue-700',
  goalkeeper: 'bg-purple-100 text-purple-700',
  equipment: 'bg-orange-100 text-orange-700',
  drinks: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-700',
}

export default function ExpensesPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [expenses, setExpenses] = useState<any[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
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

  const currentMonth = format(currentDate, 'yyyy-MM')

  async function loadData() {
    setLoading(true)
    const [{ data: expData }, { data: membersData }] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, paid_by_member:group_members(name)')
        .eq('group_id', groupId)
        .gte('expense_date', `${currentMonth}-01`)
        .lte('expense_date', `${currentMonth}-31`)
        .order('expense_date', { ascending: false }),
      supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'active').order('name'),
    ])
    setExpenses(expData || [])
    setMembers(membersData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [groupId, currentMonth])

  function resetForm() {
    setCategory('court_rental')
    setDescription('')
    setAmount('')
    setExpenseDate(format(new Date(), 'yyyy-MM-dd'))
    setPaidBy('')
    setNotes('')
  }

  async function handleAdd(e: React.FormEvent) {
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
      resetForm()
      loadData()
    }
    setSaving(false)
  }

  function openEdit(exp: any) {
    setEditingExpense(exp)
    setCategory(exp.category)
    setDescription(exp.description)
    setAmount(String(exp.amount))
    setExpenseDate(exp.expense_date)
    setPaidBy(exp.paid_by_member_id || '')
    setNotes(exp.notes || '')
    setEditDialogOpen(true)
  }

  async function handleEdit(e: React.FormEvent) {
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
      resetForm()
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

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
  const byCategory = expenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  const expenseForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleEdit : handleAdd} className="space-y-4">
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F4B]">Despesas</h1>
          <p className="text-muted-foreground">Total: R$ {total.toFixed(2)}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm() }}>
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

      <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) { setEditingExpense(null); resetForm() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Despesa</DialogTitle>
          </DialogHeader>
          {expenseForm(true)}
        </DialogContent>
      </Dialog>

      {/* Category summary */}
      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
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
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => openEdit(exp)}>
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
  )
}
