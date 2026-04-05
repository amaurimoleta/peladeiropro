'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  UserPlus,
  DollarSign,
  Check,
  X,
  Share2,
  Receipt,
  TrendingUp,
  TrendingDown,
  Loader2,
  Trash2,
  Phone,
  Plus,
  CircleDollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useGroupRole } from '@/hooks/use-group-role'
import { EXPENSE_CATEGORIES } from '@/lib/types'
import type { GroupMember, Group, GuestPlayer, Expense, MatchAttendance } from '@/lib/types'

interface AttendanceState {
  [memberId: string]: { id?: string; present: boolean }
}

interface TodayGuest {
  id: string
  name: string
  phone: string | null
  amount: number
  created_at: string
}

interface TodayExpense {
  id: string
  category: string
  description: string
  amount: number
  created_at: string
}

export default function DiaDJogoPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { isAdmin, isReadOnly, loading: roleLoading } = useGroupRole(groupId)

  const today = format(new Date(), 'yyyy-MM-dd')
  const todayFormatted = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })

  // Core state
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [mensalistas, setMensalistas] = useState<GroupMember[]>([])
  const [matchId, setMatchId] = useState<string | null>(null)

  // Attendance
  const [attendance, setAttendance] = useState<AttendanceState>({})
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null)

  // Guests
  const [todayGuests, setTodayGuests] = useState<TodayGuest[]>([])
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestAmount, setGuestAmount] = useState('')
  const [savingGuest, setSavingGuest] = useState(false)

  // Expenses
  const [todayExpenses, setTodayExpenses] = useState<TodayExpense[]>([])
  const [expenseCategory, setExpenseCategory] = useState('court_rental')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [savingExpense, setSavingExpense] = useState(false)

  // Load group data
  useEffect(() => {
    async function loadGroup() {
      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()
      setGroup(data)
    }
    loadGroup()
  }, [groupId])

  // Load mensalista members
  useEffect(() => {
    async function loadMensalistas() {
      const { data } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .eq('member_type', 'mensalista')
        .order('name')
      setMensalistas(data || [])
    }
    loadMensalistas()
  }, [groupId])

  // Load or create today's match, then load attendance + guests + expenses
  const loadTodayData = useCallback(async () => {
    setLoading(true)

    // Check if a match exists for today
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id')
      .eq('group_id', groupId)
      .eq('match_date', today)
      .limit(1)
      .single()

    const currentMatchId = existingMatch?.id || null
    setMatchId(currentMatchId)

    // Load attendance if match exists
    if (currentMatchId) {
      const { data: attendanceData } = await supabase
        .from('match_attendance')
        .select('*')
        .eq('match_id', currentMatchId)

      const map: AttendanceState = {}
      if (attendanceData) {
        for (const a of attendanceData) {
          map[a.member_id] = { id: a.id, present: a.present }
        }
      }
      setAttendance(map)
    } else {
      setAttendance({})
    }

    // Load today's guests
    const { data: guestsData } = await supabase
      .from('guest_players')
      .select('*')
      .eq('group_id', groupId)
      .eq('match_date', today)
      .order('created_at', { ascending: false })
    setTodayGuests(guestsData || [])

    // Load today's expenses
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .eq('expense_date', today)
      .order('created_at', { ascending: false })
    setTodayExpenses(expensesData || [])

    setLoading(false)
  }, [groupId, today])

  useEffect(() => {
    loadTodayData()
  }, [loadTodayData])

  // Ensure a match exists for today (create if needed)
  async function ensureMatch(): Promise<string> {
    if (matchId) return matchId

    const { data, error } = await supabase
      .from('matches')
      .insert({ group_id: groupId, match_date: today })
      .select('id')
      .single()

    if (error || !data) {
      toast.error('Erro ao criar partida do dia')
      throw new Error('Failed to create match')
    }

    setMatchId(data.id)
    return data.id
  }

  // Toggle attendance
  async function toggleAttendance(memberId: string) {
    if (isReadOnly) return
    setSavingAttendance(memberId)

    try {
      const mId = await ensureMatch()
      const current = attendance[memberId]
      const newPresent = current ? !current.present : true

      if (current?.id) {
        await supabase
          .from('match_attendance')
          .update({ present: newPresent })
          .eq('id', current.id)

        setAttendance((prev) => ({
          ...prev,
          [memberId]: { ...prev[memberId], present: newPresent },
        }))
      } else {
        const { data } = await supabase
          .from('match_attendance')
          .insert({ match_id: mId, member_id: memberId, present: newPresent })
          .select('id')
          .single()

        if (data) {
          setAttendance((prev) => ({
            ...prev,
            [memberId]: { id: data.id, present: newPresent },
          }))
        }
      }
    } catch {
      toast.error('Erro ao salvar presenca')
    } finally {
      setSavingAttendance(null)
    }
  }

  // Mark all as present
  async function markAllPresent() {
    if (isReadOnly) return
    try {
      const mId = await ensureMatch()
      for (const member of mensalistas) {
        const current = attendance[member.id]
        if (current?.present) continue

        if (current?.id) {
          await supabase
            .from('match_attendance')
            .update({ present: true })
            .eq('id', current.id)
        } else {
          const { data } = await supabase
            .from('match_attendance')
            .insert({ match_id: mId, member_id: member.id, present: true })
            .select('id')
            .single()
          if (data) {
            setAttendance((prev) => ({
              ...prev,
              [member.id]: { id: data.id, present: true },
            }))
          }
        }
      }
      // Reload attendance state after batch
      const { data: attendanceData } = await supabase
        .from('match_attendance')
        .select('*')
        .eq('match_id', mId)
      const map: AttendanceState = {}
      if (attendanceData) {
        for (const a of attendanceData) {
          map[a.member_id] = { id: a.id, present: a.present }
        }
      }
      setAttendance(map)
      toast.success('Todos marcados como presentes')
    } catch {
      toast.error('Erro ao marcar presencas')
    }
  }

  // Add guest
  async function addGuest() {
    if (!guestName.trim()) {
      toast.error('Informe o nome do avulso')
      return
    }

    const amount = parseFloat(guestAmount) || 0

    setSavingGuest(true)
    try {
      const mId = await ensureMatch()

      const { data, error } = await supabase
        .from('guest_players')
        .insert({
          group_id: groupId,
          match_id: mId,
          match_date: today,
          name: guestName.trim(),
          phone: guestPhone.trim() || null,
          amount,
          paid: amount > 0,
          paid_at: amount > 0 ? new Date().toISOString() : null,
        })
        .select('*')
        .single()

      if (error) throw error

      if (data) {
        setTodayGuests((prev) => [data, ...prev])
        setGuestName('')
        setGuestPhone('')
        setGuestAmount('')
        toast.success('Avulso adicionado com sucesso')
      }
    } catch {
      toast.error('Erro ao adicionar avulso')
    } finally {
      setSavingGuest(false)
    }
  }

  // Remove guest
  async function removeGuest(guestId: string) {
    const { error } = await supabase
      .from('guest_players')
      .delete()
      .eq('id', guestId)

    if (error) {
      toast.error('Erro ao remover avulso')
      return
    }

    setTodayGuests((prev) => prev.filter((g) => g.id !== guestId))
    toast.success('Avulso removido')
  }

  // Add expense
  async function addExpense() {
    const amount = parseFloat(expenseAmount)
    if (!amount || amount <= 0) {
      toast.error('Informe um valor valido para a despesa')
      return
    }

    setSavingExpense(true)
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          category: expenseCategory,
          description: expenseDescription.trim() || EXPENSE_CATEGORIES[expenseCategory] || expenseCategory,
          amount,
          expense_date: today,
        })
        .select('*')
        .single()

      if (error) throw error

      if (data) {
        setTodayExpenses((prev) => [data, ...prev])
        setExpenseAmount('')
        setExpenseDescription('')
        setExpenseCategory('court_rental')
        toast.success('Despesa registrada com sucesso')
      }
    } catch {
      toast.error('Erro ao registrar despesa')
    } finally {
      setSavingExpense(false)
    }
  }

  // Remove expense
  async function removeExpense(expenseId: string) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (error) {
      toast.error('Erro ao remover despesa')
      return
    }

    setTodayExpenses((prev) => prev.filter((e) => e.id !== expenseId))
    toast.success('Despesa removida')
  }

  // Computed values
  const confirmedCount = Object.values(attendance).filter((a) => a.present).length
  const totalMensalistas = mensalistas.length
  const guestCount = todayGuests.length
  const monthlyFee = group?.monthly_fee_amount || 0

  // Financial calculations
  // Per-game fee = monthly / 4 (rough weekly estimate)
  const perGameFee = monthlyFee > 0 ? monthlyFee / 4 : 0
  const totalFromMembers = confirmedCount * perGameFee
  const totalFromGuests = todayGuests.reduce((sum, g) => sum + (g.amount || 0), 0)
  const totalRevenue = totalFromMembers + totalFromGuests
  const totalExpenses = todayExpenses.reduce((sum, e) => sum + e.amount, 0)
  const dayResult = totalRevenue - totalExpenses

  // WhatsApp share
  function shareWhatsApp() {
    const confirmedNames = mensalistas
      .filter((m) => attendance[m.id]?.present)
      .map((m) => m.name)

    const guestNames = todayGuests.map((g) => g.name)

    let message = `\u26BD *Dia de Jogo - ${group?.name || 'Pelada'}*\n`
    message += `\uD83D\uDCC5 ${todayFormatted}\n\n`

    message += `\u2705 *Confirmados (${confirmedCount}):*\n`
    if (confirmedNames.length > 0) {
      confirmedNames.forEach((n, i) => {
        message += `${i + 1}. ${n}\n`
      })
    } else {
      message += `Nenhum confirmado ainda\n`
    }

    if (guestNames.length > 0) {
      message += `\n\uD83C\uDD95 *Avulsos (${guestCount}):*\n`
      guestNames.forEach((n, i) => {
        message += `${i + 1}. ${n}\n`
      })
    }

    message += `\n\uD83D\uDCB0 *Resumo Financeiro:*\n`
    message += `Arrecadado: R$ ${totalRevenue.toFixed(2)}\n`
    message += `Despesas: R$ ${totalExpenses.toFixed(2)}\n`
    message += `Resultado: R$ ${dayResult.toFixed(2)}\n`
    message += `\n\uD83D\uDCF1 Total de jogadores: ${confirmedCount + guestCount}`

    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-3xl">{'\u26BD'}</span> Dia de Jogo
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {todayFormatted}
          </p>
          {group && (
            <p className="text-sm font-medium text-[#00C853] mt-0.5">
              {group.name}
            </p>
          )}
        </div>
        <Button
          onClick={shareWhatsApp}
          className="bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2 self-start sm:self-auto"
        >
          <Share2 className="h-4 w-4" />
          Compartilhar via WhatsApp
        </Button>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-[#00C853]/10 to-[#00C853]/5 dark:from-[#00C853]/20 dark:to-[#00C853]/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00C853]/20">
              <Users className="h-5 w-5 text-[#00C853]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Confirmados</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {confirmedCount}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  / {totalMensalistas}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-500/5 dark:from-blue-500/20 dark:to-blue-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20">
              <UserPlus className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Avulsos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {guestCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Arrecadado hoje</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                R$ {totalRevenue.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Presence Confirmation */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-[#00C853]" />
                Presenca - Mensalistas
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-[#00C853]/10 text-[#00C853] border-0"
              >
                {confirmedCount}/{totalMensalistas}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllPresent}
                className="w-full mb-3 border-[#00C853]/30 text-[#00C853] hover:bg-[#00C853]/10"
              >
                <Check className="h-4 w-4 mr-2" />
                Marcar todos como presentes
              </Button>
            )}

            {mensalistas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum mensalista ativo encontrado
              </p>
            )}

            <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
              {mensalistas.map((member) => {
                const isPresent = attendance[member.id]?.present || false
                const isSaving = savingAttendance === member.id

                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                      isPresent
                        ? 'bg-[#00C853]/10 dark:bg-[#00C853]/20 border border-[#00C853]/30'
                        : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isPresent
                            ? 'bg-[#00C853] text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {member.name}
                        </p>
                        {member.position && (
                          <p className="text-xs text-muted-foreground">
                            {member.position}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isPresent ? 'default' : 'outline'}
                      disabled={isReadOnly || isSaving}
                      onClick={() => toggleAttendance(member.id)}
                      className={`shrink-0 min-w-[90px] ${
                        isPresent
                          ? 'bg-[#00C853] hover:bg-[#00C853]/90 text-white border-0'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500'
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isPresent ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Presente
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Ausente
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Guest Registration */}
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-500" />
                Adicionar Avulso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Nome *"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  disabled={isReadOnly}
                />
                <Input
                  placeholder="Telefone (opcional)"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="flex gap-3">
                <Input
                  type="number"
                  placeholder="Valor (R$)"
                  value={guestAmount}
                  onChange={(e) => setGuestAmount(e.target.value)}
                  disabled={isReadOnly}
                  className="flex-1"
                  min="0"
                  step="0.01"
                />
                <Button
                  onClick={addGuest}
                  disabled={isReadOnly || savingGuest || !guestName.trim()}
                  className="bg-blue-500 hover:bg-blue-600 text-white gap-2 shrink-0"
                >
                  {savingGuest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Adicionar
                </Button>
              </div>

              {todayGuests.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avulsos de hoje ({todayGuests.length})
                  </p>
                  {todayGuests.map((guest) => (
                    <div
                      key={guest.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {guest.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {guest.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {guest.phone}
                            </span>
                          )}
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            R$ {guest.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGuest(guest.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Expense Registration */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-orange-500" />
                Registrar Despesa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={expenseCategory}
                onValueChange={(v) => v && setExpenseCategory(v)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Valor (R$) *"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  disabled={isReadOnly}
                  min="0"
                  step="0.01"
                />
                <Input
                  placeholder="Descricao (opcional)"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>

              <Button
                onClick={addExpense}
                disabled={isReadOnly || savingExpense || !expenseAmount}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {savingExpense ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Registrar Despesa
              </Button>

              {todayExpenses.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Despesas de hoje ({todayExpenses.length})
                  </p>
                  {todayExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {expense.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {EXPENSE_CATEGORIES[expense.category] || expense.category}
                          </Badge>
                          <span className="font-medium text-orange-600 dark:text-orange-400">
                            R$ {expense.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExpense(expense.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Financial Summary */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-[#00C853]" />
            Resumo Financeiro do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Revenue */}
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Total Arrecadado
                </p>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                R$ {totalRevenue.toFixed(2)}
              </p>
              <div className="mt-2 space-y-0.5 text-xs text-green-600/80 dark:text-green-400/80">
                <p>Mensalistas ({confirmedCount}x): R$ {totalFromMembers.toFixed(2)}</p>
                <p>Avulsos ({guestCount}): R$ {totalFromGuests.toFixed(2)}</p>
              </div>
            </div>

            {/* Expenses */}
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Total Despesas
                </p>
              </div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                R$ {totalExpenses.toFixed(2)}
              </p>
              <div className="mt-2 space-y-0.5 text-xs text-red-600/80 dark:text-red-400/80">
                {todayExpenses.length === 0 ? (
                  <p>Nenhuma despesa registrada</p>
                ) : (
                  todayExpenses.map((e) => (
                    <p key={e.id}>
                      {EXPENSE_CATEGORIES[e.category] || e.category}: R$ {e.amount.toFixed(2)}
                    </p>
                  ))
                )}
              </div>
            </div>

            {/* Result */}
            <div
              className={`p-4 rounded-xl border ${
                dayResult >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30'
                  : 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign
                  className={`h-4 w-4 ${
                    dayResult >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}
                />
                <p
                  className={`text-sm font-medium ${
                    dayResult >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-orange-700 dark:text-orange-300'
                  }`}
                >
                  Resultado do Dia
                </p>
              </div>
              <p
                className={`text-2xl font-bold ${
                  dayResult >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-orange-700 dark:text-orange-300'
                }`}
              >
                R$ {dayResult.toFixed(2)}
              </p>
              <p
                className={`mt-2 text-xs ${
                  dayResult >= 0
                    ? 'text-emerald-600/80 dark:text-emerald-400/80'
                    : 'text-orange-600/80 dark:text-orange-400/80'
                }`}
              >
                {dayResult >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
              </p>
            </div>
          </div>

          {/* Total players count */}
          <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Total de jogadores hoje</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {confirmedCount + guestCount}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom WhatsApp Share (mobile convenience) */}
      <div className="sm:hidden">
        <Button
          onClick={shareWhatsApp}
          className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2 py-6 text-base"
        >
          <Share2 className="h-5 w-5" />
          Compartilhar Resumo via WhatsApp
        </Button>
      </div>
    </div>
  )
}
