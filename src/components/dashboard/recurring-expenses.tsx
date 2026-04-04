'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  RepeatIcon,
  Plus,
  Pencil,
  Trash2,
  Pause,
  Play,
  CalendarClock,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import {
  EXPENSE_CATEGORIES,
  type RecurringExpense,
  type CustomExpenseCategory,
} from '@/lib/types'

export default function RecurringExpenses({ groupId }: { groupId: string }) {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [customCategories, setCustomCategories] = useState<CustomExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('other')
  const [customCategoryId, setCustomCategoryId] = useState<string | null>(null)
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [saving, setSaving] = useState(false)

  const { isAdmin } = useGroupRole(groupId)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const [expensesRes, categoriesRes] = await Promise.all([
      supabase
        .from('recurring_expenses')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false }),
      supabase
        .from('custom_expense_categories')
        .select('*')
        .eq('group_id', groupId)
        .order('name'),
    ])

    if (expensesRes.error) {
      console.error('Error fetching recurring expenses:', expensesRes.error)
    } else {
      setExpenses(expensesRes.data || [])
    }

    if (!categoriesRes.error) {
      setCustomCategories(categoriesRes.data || [])
    }

    setLoading(false)
  }, [groupId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function resetForm() {
    setEditingId(null)
    setDescription('')
    setAmount('')
    setCategory('other')
    setCustomCategoryId(null)
    setDayOfMonth('1')
  }

  function openCreateDialog() {
    resetForm()
    setDialogOpen(true)
  }

  function openEditDialog(expense: RecurringExpense) {
    setEditingId(expense.id)
    setDescription(expense.description)
    setAmount(String(expense.amount))
    setCategory(expense.category)
    setCustomCategoryId(expense.custom_category_id)
    setDayOfMonth(String(expense.day_of_month))
    setDialogOpen(true)
  }

  function getCategoryLabel(cat: string, customCatId: string | null): string {
    if (cat === 'custom' && customCatId) {
      const custom = customCategories.find((c) => c.id === customCatId)
      return custom?.name || 'Personalizada'
    }
    return EXPENSE_CATEGORIES[cat] || cat
  }

  async function handleSave() {
    if (!description.trim()) {
      toast.error('Informe a descrição da despesa.')
      return
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    const parsedDay = parseInt(dayOfMonth, 10)
    if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      toast.error('Informe um dia do mês válido (1-31).')
      return
    }

    setSaving(true)

    try {
      const payload = {
        group_id: groupId,
        description: description.trim(),
        amount: parsedAmount,
        category: customCategoryId ? 'custom' : category,
        custom_category_id: customCategoryId || null,
        day_of_month: parsedDay,
      }

      if (editingId) {
        const { error } = await supabase
          .from('recurring_expenses')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error

        await logAudit(supabase, {
          groupId,
          action: 'update',
          entityType: 'recurring_expense',
          entityId: editingId,
          details: { description: payload.description, amount: payload.amount },
        })

        toast.success('Despesa recorrente atualizada!')
      } else {
        const { data: created, error } = await supabase
          .from('recurring_expenses')
          .insert({ ...payload, active: true })
          .select()
          .single()

        if (error) throw error

        await logAudit(supabase, {
          groupId,
          action: 'create',
          entityType: 'recurring_expense',
          entityId: created?.id,
          details: { description: payload.description, amount: payload.amount },
        })

        toast.success('Despesa recorrente criada!')
      }

      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (err) {
      console.error('Error saving recurring expense:', err)
      toast.error('Erro ao salvar despesa recorrente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Tem certeza que deseja excluir esta despesa recorrente?')
    if (!confirmed) return

    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir despesa recorrente.')
      return
    }

    await logAudit(supabase, {
      groupId,
      action: 'delete',
      entityType: 'recurring_expense',
      entityId: id,
    })

    toast.success('Despesa recorrente excluida.')
    fetchData()
  }

  async function handleToggleActive(expense: RecurringExpense) {
    const newActive = !expense.active

    const { error } = await supabase
      .from('recurring_expenses')
      .update({ active: newActive })
      .eq('id', expense.id)

    if (error) {
      toast.error('Erro ao atualizar status.')
      return
    }

    await logAudit(supabase, {
      groupId,
      action: newActive ? 'activate' : 'deactivate',
      entityType: 'recurring_expense',
      entityId: expense.id,
      details: { description: expense.description },
    })

    toast.success(newActive ? 'Despesa reativada!' : 'Despesa pausada.')
    fetchData()
  }

  async function handleGenerateMonthly() {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const toGenerate = expenses.filter(
      (e) => e.active && e.last_generated_month !== currentMonth
    )

    if (toGenerate.length === 0) {
      toast.info('Todas as despesas recorrentes ativas ja foram geradas para este mês.')
      return
    }

    const confirmed = window.confirm(
      `Gerar ${toGenerate.length} despesa(s) para o mês ${currentMonth}?`
    )
    if (!confirmed) return

    setGenerating(true)

    try {
      const expenseInserts = toGenerate.map((re) => ({
        group_id: groupId,
        category: re.category,
        custom_category_id: re.custom_category_id,
        description: re.description,
        amount: re.amount,
        expense_date: `${currentMonth}-${String(re.day_of_month).padStart(2, '0')}`,
        notes: `Gerada automaticamente de despesa recorrente`,
      }))

      const { error: insertError } = await supabase
        .from('expenses')
        .insert(expenseInserts)

      if (insertError) throw insertError

      for (const re of toGenerate) {
        const { error: updateError } = await supabase
          .from('recurring_expenses')
          .update({ last_generated_month: currentMonth })
          .eq('id', re.id)

        if (updateError) {
          console.error('Error updating last_generated_month:', updateError)
        }
      }

      await logAudit(supabase, {
        groupId,
        action: 'generate_monthly',
        entityType: 'recurring_expense',
        details: {
          month: currentMonth,
          count: toGenerate.length,
          total: toGenerate.reduce((sum, e) => sum + e.amount, 0),
        },
      })

      toast.success(`${toGenerate.length} despesa(s) gerada(s) para ${currentMonth}!`)
      fetchData()
    } catch (err) {
      console.error('Error generating monthly expenses:', err)
      toast.error('Erro ao gerar despesas do mês.')
    } finally {
      setGenerating(false)
    }
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const pendingCount = expenses.filter(
    (e) => e.active && e.last_generated_month !== currentMonth
  ).length

  return (
    <div className="card-modern-elevated p-3 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
            <RepeatIcon className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-bold text-sm sm:text-base text-[#1B1F4B] dark:text-gray-100">Despesas Recorrentes</h2>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateMonthly}
              disabled={generating || pendingCount === 0}
              className="text-xs"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <CalendarClock className="h-3.5 w-3.5 mr-1" />
              )}
              <span className="hidden sm:inline">Gerar Despesas do Mes</span>
              <span className="sm:hidden">Gerar</span>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </Button>

            <Button
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:opacity-90"
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nova Despesa Recorrente</span>
              <span className="sm:hidden">Nova</span>
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Editar Despesa Recorrente' : 'Nova Despesa Recorrente'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label className="text-sm font-medium text-[#1B1F4B] dark:text-gray-100 mb-1.5 block">
                      Descrição
                    </Label>
                    <Input
                      placeholder="Ex: Aluguel da quadra"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[#1B1F4B] dark:text-gray-100 mb-1.5 block">
                      Valor (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[#1B1F4B] dark:text-gray-100 mb-1.5 block">
                      Categoria
                    </Label>
                    <Select
                      value={customCategoryId ? `custom:${customCategoryId}` : category}
                      onValueChange={(val) => {
                        if (typeof val === 'string' && val.startsWith('custom:')) {
                          setCustomCategoryId(val.replace('custom:', ''))
                          setCategory('custom')
                        } else {
                          setCategory(val as string)
                          setCustomCategoryId(null)
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                        {customCategories.map((cc) => (
                          <SelectItem key={cc.id} value={`custom:${cc.id}`}>
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full inline-block"
                                style={{ backgroundColor: cc.color }}
                              />
                              {cc.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[#1B1F4B] dark:text-gray-100 mb-1.5 block">
                      Dia do mês
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="1"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                  >
                    {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Carregando despesas recorrentes...
        </p>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <RepeatIcon className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-sm">Nenhuma despesa recorrente cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className={`rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50 ${
                !expense.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-[#1B1F4B] dark:text-gray-100 truncate">
                      {expense.description}
                    </h3>
                    <Badge
                      variant={expense.active ? 'default' : 'secondary'}
                      className={
                        expense.active
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }
                    >
                      {expense.active ? 'Ativa' : 'Pausada'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-[#1B1F4B] dark:text-gray-100">
                      R$ {expense.amount.toFixed(2)}
                    </span>
                    <span className="truncate max-w-[80px] sm:max-w-none">{getCategoryLabel(expense.category, expense.custom_category_id)}</span>
                    <span>Dia {expense.day_of_month}</span>
                    {expense.last_generated_month && (
                      <span className="hidden sm:inline">
                        Ultimo: {expense.last_generated_month}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleToggleActive(expense)}
                      title={expense.active ? 'Pausar' : 'Reativar'}
                    >
                      {expense.active ? (
                        <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(expense)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(expense.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
