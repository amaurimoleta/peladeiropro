'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Trash2, Pencil, MapPin, CalendarDays, Users, Check, ChevronDown, ChevronUp,
  MessageCircle, DollarSign, Trophy, Save, Loader2, UserCheck, UserX, HelpCircle, Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import { TeamShuffle } from '@/components/dashboard/team-shuffle'
import type { Match, GuestPlayer, GroupMember, Group, Tournament } from '@/lib/types'
import { TOURNAMENT_STATUSES, PLAYOFF_PHASES } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AttendanceMap {
  [memberId: string]: { id?: string; present: boolean }
}

interface MatchWithGuests extends Match {
  guests: GuestPlayer[]
}

export default function MatchesPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { isAdmin, isReadOnly } = useGroupRole(groupId)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [matches, setMatches] = useState<MatchWithGuests[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)

  // Group data (for PIX info)
  const [groupData, setGroupData] = useState<Group | null>(null)

  // Active mensalista members
  const [mensalistas, setMensalistas] = useState<GroupMember[]>([])

  // Attendance state per match
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceMap>>({})
  const [attendanceLoading, setAttendanceLoading] = useState<Record<string, boolean>>({})

  // Expense summary per match
  const [expenseSummaries, setExpenseSummaries] = useState<Record<string, { total: number; loading: boolean }>>({})

  // New match dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newMatchDate, setNewMatchDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [newLocation, setNewLocation] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newTeamAName, setNewTeamAName] = useState('Time A')
  const [newTeamBName, setNewTeamBName] = useState('Time B')
  const [saving, setSaving] = useState(false)

  // Edit match dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [editMatchDate, setEditMatchDate] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTeamAName, setEditTeamAName] = useState('')
  const [editTeamBName, setEditTeamBName] = useState('')

  // Score state per match (inline editing)
  const [scoreInputs, setScoreInputs] = useState<Record<string, { a: string; b: string }>>({})
  const [savingScore, setSavingScore] = useState<Record<string, boolean>>({})
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null)

  // Tournaments
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [newTournamentId, setNewTournamentId] = useState('')
  const [newTournamentPhase, setNewTournamentPhase] = useState('')
  const [editTournamentId, setEditTournamentId] = useState('')
  const [editTournamentPhase, setEditTournamentPhase] = useState('')

  // Add guest dialog
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [guestMatchId, setGuestMatchId] = useState<string | null>(null)
  const [guestMatchDate, setGuestMatchDate] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestAmount, setGuestAmount] = useState('')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null)

  // Match confirmations (RSVP)
  const [confirmationsMap, setConfirmationsMap] = useState<Record<string, any[]>>({})
  const [myMemberId, setMyMemberId] = useState<string | null>(null)

  const currentMonth = format(currentDate, 'yyyy-MM')

  // Load group data
  useEffect(() => {
    async function loadGroup() {
      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()
      setGroupData(data)
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

  // Load active tournaments
  useEffect(() => {
    async function loadTournaments() {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('name')
      setTournaments(data || [])
    }
    loadTournaments()
  }, [groupId])

  // Load matches and guests separately (same pattern as financeiro)
  const loadMatches = useCallback(async () => {
    setLoading(true)
    const firstDay = `${currentMonth}-01`
    const lastDay = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const [
      { data: matchesData },
      { data: guestsData },
    ] = await Promise.all([
      supabase.from('matches').select('*').eq('group_id', groupId).gte('match_date', firstDay).lte('match_date', lastDay).order('match_date', { ascending: false }),
      supabase.from('guest_players').select('*').eq('group_id', groupId).gte('match_date', firstDay).lte('match_date', lastDay),
    ])

    const loadedMatches = matchesData || []
    const allGuestsData = guestsData || []

    const matchesWithGuests: MatchWithGuests[] = loadedMatches.map((m) => ({
      ...m,
      guests: allGuestsData.filter((g) => g.match_id === m.id),
    }))

    setMatches(matchesWithGuests)

    // Initialize score inputs
    const newScoreInputs: Record<string, { a: string; b: string }> = {}
    for (const m of matchesWithGuests) {
      newScoreInputs[m.id] = {
        a: m.score_a != null ? String(m.score_a) : '',
        b: m.score_b != null ? String(m.score_b) : '',
      }
    }
    setScoreInputs((prev) => ({ ...prev, ...newScoreInputs }))
    setLoading(false)
  }, [groupId, currentMonth])

  useEffect(() => { loadMatches() }, [loadMatches])

  // Load current user's member ID
  useEffect(() => {
    async function loadMyMember() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .single()
      if (data) setMyMemberId(data.id)
    }
    loadMyMember()
  }, [groupId])

  // Load confirmations for all loaded matches
  useEffect(() => {
    async function loadConfirmations() {
      if (matches.length === 0) return
      const matchIds = matches.map(m => m.id)
      const { data } = await supabase
        .from('match_confirmations')
        .select('*, member:group_members(name)')
        .in('match_id', matchIds)
      if (data) {
        const map: Record<string, any[]> = {}
        for (const c of data) {
          if (!map[c.match_id]) map[c.match_id] = []
          map[c.match_id].push(c)
        }
        setConfirmationsMap(map)
      }
    }
    loadConfirmations()
  }, [matches])

  // RSVP toggle
  async function toggleConfirmation(matchId: string, status: 'confirmed' | 'declined') {
    if (!myMemberId) {
      toast.error('Voce precisa estar vinculado como membro para confirmar.')
      return
    }
    const existing = confirmationsMap[matchId]?.find(c => c.member_id === myMemberId)

    if (existing) {
      if (existing.status === status) {
        // Remove confirmation
        await supabase.from('match_confirmations').delete().eq('id', existing.id)
      } else {
        // Update status
        await supabase.from('match_confirmations').update({ status }).eq('id', existing.id)
      }
    } else {
      // Create new
      await supabase.from('match_confirmations').insert({
        match_id: matchId,
        member_id: myMemberId,
        status,
      })
    }

    // Reload confirmations
    const { data } = await supabase
      .from('match_confirmations')
      .select('*, member:group_members(name)')
      .eq('match_id', matchId)
    setConfirmationsMap(prev => ({ ...prev, [matchId]: data || [] }))
  }

  function shareMatchWhatsApp(match: Match) {
    const dateStr = format(new Date(match.match_date + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })
    const location = match.location ? `\n📍 ${match.location}` : ''
    const confs = confirmationsMap[match.id] || []
    const confirmedCount = confs.filter(c => c.status === 'confirmed').length
    const msg = `⚽ *Pelada ${dateStr}*${location}\n\n✅ ${confirmedCount} confirmado${confirmedCount !== 1 ? 's' : ''}\n\nConfirme sua presenca no app!\n${window.location.origin}/dashboard/${groupId}/matches`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // Load attendance for a match
  const loadAttendance = useCallback(async (matchId: string) => {
    setAttendanceLoading((prev) => ({ ...prev, [matchId]: true }))
    const { data } = await supabase
      .from('match_attendance')
      .select('*')
      .eq('match_id', matchId)

    const map: AttendanceMap = {}
    for (const row of data || []) {
      map[row.member_id] = { id: row.id, present: row.present }
    }
    setAttendanceMap((prev) => ({ ...prev, [matchId]: map }))
    setAttendanceLoading((prev) => ({ ...prev, [matchId]: false }))
  }, [groupId])

  // Load expenses for a match date
  const loadExpenses = useCallback(async (matchId: string, matchDate: string) => {
    setExpenseSummaries((prev) => ({ ...prev, [matchId]: { total: 0, loading: true } }))
    const { data } = await supabase
      .from('expenses')
      .select('amount')
      .eq('group_id', groupId)
      .eq('expense_date', matchDate)

    const total = (data || []).reduce((sum, e) => sum + Number(e.amount), 0)
    setExpenseSummaries((prev) => ({ ...prev, [matchId]: { total, loading: false } }))
  }, [groupId])

  // When a match is expanded, load attendance and expenses
  useEffect(() => {
    if (expandedMatch) {
      loadAttendance(expandedMatch)
      const match = matches.find((m) => m.id === expandedMatch)
      if (match) {
        loadExpenses(expandedMatch, match.match_date)
      }
    }
  }, [expandedMatch, matches, loadAttendance, loadExpenses])

  async function toggleAttendance(matchId: string, memberId: string) {
    const current = attendanceMap[matchId]?.[memberId]
    const newPresent = !(current?.present ?? false)

    if (current?.id) {
      await supabase
        .from('match_attendance')
        .update({ present: newPresent })
        .eq('id', current.id)
    } else {
      const { data } = await supabase
        .from('match_attendance')
        .insert({ match_id: matchId, member_id: memberId, present: newPresent })
        .select('id')
        .single()
      if (data) {
        setAttendanceMap((prev) => ({
          ...prev,
          [matchId]: {
            ...prev[matchId],
            [memberId]: { id: data.id, present: newPresent },
          },
        }))
        await logAudit(supabase, {
          groupId,
          action: 'update_attendance',
          entityType: 'match_attendance',
          entityId: matchId,
          details: { member_id: memberId, present: newPresent },
        })
        return
      }
    }

    setAttendanceMap((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [memberId]: { ...current, present: newPresent },
      },
    }))

    await logAudit(supabase, {
      groupId,
      action: 'update_attendance',
      entityType: 'match_attendance',
      entityId: matchId,
      details: { member_id: memberId, present: newPresent },
    })
  }

  async function handleAddMatch(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('matches').insert({
      group_id: groupId,
      match_date: newMatchDate,
      location: newLocation || null,
      notes: newNotes || null,
      team_a_name: newTeamAName || 'Time A',
      team_b_name: newTeamBName || 'Time B',
      tournament_id: newTournamentId && newTournamentId !== 'none' ? newTournamentId : null,
      tournament_phase: newTournamentPhase || null,
    })
    if (error) {
      console.error('Erro ao criar jogo:', error)
      toast.error('Erro ao criar jogo', { description: error.message })
    } else {
      toast.success('Jogo criado com sucesso!')
      await logAudit(supabase, {
        groupId,
        action: 'create_match',
        entityType: 'match',
        entityId: newMatchDate,
        details: { match_date: newMatchDate, location: newLocation },
      })
      setNewDialogOpen(false)
      setNewMatchDate(format(new Date(), 'yyyy-MM-dd'))
      setNewLocation('')
      setNewNotes('')
      setNewTeamAName('Time A')
      setNewTeamBName('Time B')
      setNewTournamentId('')
      setNewTournamentPhase('')
      await loadMatches()
    }
    setSaving(false)
  }

  function openEdit(match: Match) {
    setEditingMatch(match)
    setEditMatchDate(match.match_date)
    setEditLocation(match.location || '')
    setEditNotes(match.notes || '')
    setEditTeamAName(match.team_a_name || 'Time A')
    setEditTeamBName(match.team_b_name || 'Time B')
    setEditTournamentId(match.tournament_id || '')
    setEditTournamentPhase(match.tournament_phase || '')
    setEditDialogOpen(true)
  }

  async function handleEditMatch(e: React.FormEvent) {
    e.preventDefault()
    if (!editingMatch) return
    setSaving(true)
    const { error } = await supabase
      .from('matches')
      .update({
        match_date: editMatchDate,
        location: editLocation || null,
        notes: editNotes || null,
        team_a_name: editTeamAName || 'Time A',
        team_b_name: editTeamBName || 'Time B',
        tournament_id: editTournamentId && editTournamentId !== 'none' ? editTournamentId : null,
        tournament_phase: editTournamentPhase || null,
      })
      .eq('id', editingMatch.id)
    if (error) {
      toast.error('Erro ao atualizar jogo', { description: error.message })
    } else {
      toast.success('Jogo atualizado com sucesso!')
      await logAudit(supabase, {
        groupId,
        action: 'edit_match',
        entityType: 'match',
        entityId: editingMatch.id,
        details: { match_date: editMatchDate, location: editLocation },
      })
      setEditDialogOpen(false)
      setEditingMatch(null)
      await loadMatches()
    }
    setSaving(false)
  }

  function confirmDelete(matchId: string) {
    setDeletingMatchId(matchId)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteMatch() {
    if (!deletingMatchId) return
    const { error } = await supabase.from('matches').delete().eq('id', deletingMatchId)
    if (error) {
      toast.error('Erro ao excluir jogo', { description: error.message })
    } else {
      toast.success('Jogo removido com sucesso!')
      await logAudit(supabase, {
        groupId,
        action: 'delete_match',
        entityType: 'match',
        entityId: deletingMatchId,
      })
      setDeleteDialogOpen(false)
      setDeletingMatchId(null)
      await loadMatches()
    }
  }

  async function handleSaveScore(matchId: string) {
    const inputs = scoreInputs[matchId]
    if (!inputs) return
    setSavingScore((prev) => ({ ...prev, [matchId]: true }))
    const scoreA = inputs.a !== '' ? parseInt(inputs.a, 10) : null
    const scoreB = inputs.b !== '' ? parseInt(inputs.b, 10) : null
    const { error } = await supabase
      .from('matches')
      .update({ score_a: scoreA, score_b: scoreB })
      .eq('id', matchId)
    if (error) {
      toast.error('Erro ao salvar placar', { description: error.message })
    } else {
      toast.success('Placar salvo!')
      setEditingScoreId(null)
      await logAudit(supabase, {
        groupId,
        action: 'update_score',
        entityType: 'match',
        entityId: matchId,
        details: { score_a: scoreA, score_b: scoreB },
      })
      await loadMatches()
    }
    setSavingScore((prev) => ({ ...prev, [matchId]: false }))
  }

  function openGuestDialog(matchId: string, matchDate: string) {
    setGuestMatchId(matchId)
    setGuestMatchDate(matchDate)
    setGuestName('')
    setGuestPhone('')
    setGuestAmount('')
    setGuestDialogOpen(true)
  }

  async function handleAddGuest(e: React.FormEvent) {
    e.preventDefault()
    if (!guestMatchId) return
    setSaving(true)
    const { error } = await supabase.from('guest_players').insert({
      group_id: groupId,
      match_id: guestMatchId,
      name: guestName,
      phone: guestPhone || null,
      match_date: guestMatchDate,
      amount: parseFloat(guestAmount) || 0,
    })
    if (error) {
      toast.error('Erro ao adicionar avulso', { description: error.message })
    } else {
      toast.success('Jogador avulso adicionado!')
      await logAudit(supabase, {
        groupId,
        action: 'add_guest',
        entityType: 'guest_player',
        entityId: guestMatchDate,
        details: { name: guestName, amount: guestAmount, match_id: guestMatchId },
      })
      setGuestDialogOpen(false)
      await loadMatches()
    }
    setSaving(false)
  }

  async function markGuestPaid(guestId: string) {
    await supabase
      .from('guest_players')
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq('id', guestId)
    toast.success('Pagamento confirmado!')
    await logAudit(supabase, {
      groupId,
      action: 'mark_guest_paid',
      entityType: 'guest_player',
      entityId: guestId,
    })
    await loadMatches()
  }

  async function deleteGuest(guestId: string) {
    await supabase.from('guest_players').delete().eq('id', guestId)
    toast.success('Avulso removido!')
    await logAudit(supabase, {
      groupId,
      action: 'delete_guest',
      entityType: 'guest_player',
      entityId: guestId,
    })
    await loadMatches()
  }

  function buildWhatsAppUrl(guest: GuestPlayer, matchDate: string) {
    const dateFormatted = format(new Date(matchDate + 'T12:00:00'), 'dd/MM/yyyy')
    const amount = Number(guest.amount).toFixed(2)
    const pixKey = groupData?.pix_key || ''
    const pixBeneficiary = groupData?.pix_beneficiary_name || ''

    const message = `Ola ${guest.name}! Sua participacao na pelada de ${dateFormatted} ficou em R$ ${amount}.\n\nChave PIX: ${pixKey}\nFavor: ${pixBeneficiary}\n\nObrigado!`

    const phone = (guest.phone || '').replace(/\D/g, '')
    const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`
  }

  // Helpers
  function getAttendanceCount(matchId: string): number {
    const map = attendanceMap[matchId]
    if (!map) return 0
    return Object.values(map).filter((a) => a.present).length
  }

  function getCostPerPlayer(matchId: string, guestCount: number): number | null {
    const expenses = expenseSummaries[matchId]
    if (!expenses || expenses.loading) return null
    const presentCount = getAttendanceCount(matchId)
    const totalPlayers = presentCount + guestCount
    if (totalPlayers === 0) return null
    return expenses.total / totalPlayers
  }

  function formatMatchDate(dateStr: string): string {
    return format(new Date(dateStr + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })
  }

  function getTeamAName(match: Match): string {
    return match.team_a_name || 'Time A'
  }

  function getTeamBName(match: Match): string {
    return match.team_b_name || 'Time B'
  }

  // Summary
  const allGuests = matches.flatMap((m) => m.guests || [])
  const totalMatches = matches.length
  const totalGuests = allGuests.length
  const totalCollected = allGuests.filter((g) => g.paid).reduce((s, g) => s + Number(g.amount), 0)
  const totalPending = allGuests.filter((g) => !g.paid).reduce((s, g) => s + Number(g.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Jogos</h1>
          <p className="text-muted-foreground">
            {totalMatches} {totalMatches === 1 ? 'jogo' : 'jogos'} | {totalGuests} {totalGuests === 1 ? 'avulso' : 'avulsos'}
          </p>
        </div>
        {isAdmin && (
          <Button
            className="bg-[#00C853] hover:bg-[#00A843] text-white"
            onClick={() => setNewDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Jogo
          </Button>
        )}
      </div>

      <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

      {/* Resumo do mes */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="card-modern-elevated">
          <CardContent className="p-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto mb-1 text-brand-navy" />
            <p className="text-2xl font-bold text-brand-navy">{totalMatches}</p>
            <p className="text-xs text-muted-foreground">Jogos</p>
          </CardContent>
        </Card>
        <Card className="card-modern-elevated">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-brand-navy" />
            <p className="text-2xl font-bold text-brand-navy">{totalGuests}</p>
            <p className="text-xs text-muted-foreground">Avulsos</p>
          </CardContent>
        </Card>
        <Card className="card-modern-elevated">
          <CardContent className="p-4 text-center">
            <Check className="h-5 w-5 mx-auto mb-1 text-[#00C853]" />
            <p className="text-2xl font-bold text-[#00C853]">R$ {totalCollected.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Recebido</p>
            {totalPending > 0 && (
              <p className="text-xs text-orange-500 mt-1">R$ {totalPending.toFixed(2)} pendente</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cards de jogos */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando jogos...</div>
      ) : matches.length === 0 ? (
        <Card className="card-modern-elevated">
          <CardContent className="text-center py-12 text-muted-foreground">
            Nenhum jogo neste mes.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const guests = match.guests || []
            const isExpanded = expandedMatch === match.id
            const matchAttendance = attendanceMap[match.id] || {}
            const presentCount = getAttendanceCount(match.id)
            const guestCount = guests.length
            const costPerPlayer = getCostPerPlayer(match.id, guestCount)
            const expenseSummary = expenseSummaries[match.id]
            const teamA = getTeamAName(match)
            const teamB = getTeamBName(match)
            const hasScore = match.score_a != null && match.score_b != null
            const currentScoreInputs = scoreInputs[match.id] || { a: '', b: '' }
            const isEditingScore = editingScoreId === match.id

            return (
              <Card key={match.id} className="card-modern-elevated overflow-hidden">
                <CardContent className="p-0">
                  {/* Cabecalho do card */}
                  <div className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Data */}
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarDays className="h-4 w-4 text-brand-navy shrink-0" />
                          <span className="font-bold text-lg text-brand-navy capitalize">
                            {formatMatchDate(match.match_date)}
                          </span>
                        </div>

                        {/* Local */}
                        {match.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{match.location}</span>
                          </div>
                        )}

                        {/* Observacoes */}
                        {match.notes && (
                          <p className="text-xs text-muted-foreground ml-6">{match.notes}</p>
                        )}

                        {/* Tournament badge */}
                        {match.tournament_id && tournaments.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit mt-1">
                            <Trophy className="h-3 w-3" />
                            {tournaments.find(t => t.id === match.tournament_id)?.name || 'Campeonato'}
                            {match.tournament_phase && PLAYOFF_PHASES[match.tournament_phase] && (
                              <span className="text-amber-600 font-medium">• {PLAYOFF_PHASES[match.tournament_phase]}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Botoes de acao */}
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="ghost" className="text-brand-navy h-8 w-8 p-0" onClick={() => openEdit(match)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 h-8 w-8 p-0" onClick={() => confirmDelete(match.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PLACAR - Sempre visivel no card */}
                  <div className="px-4 py-3 bg-gradient-to-r from-brand-navy/5 to-brand-green/5">
                    {isEditingScore && isAdmin ? (
                      /* Modo de edicao do placar */
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold text-brand-navy">{teamA}</span>
                          <Input
                            type="number"
                            min="0"
                            className="w-14 h-10 text-center text-lg font-bold border-brand-navy/30"
                            placeholder="0"
                            value={currentScoreInputs.a}
                            onChange={(e) =>
                              setScoreInputs((prev) => ({
                                ...prev,
                                [match.id]: { ...prev[match.id], a: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <span className="text-xl font-bold text-muted-foreground mt-4">x</span>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold text-brand-navy">{teamB}</span>
                          <Input
                            type="number"
                            min="0"
                            className="w-14 h-10 text-center text-lg font-bold border-brand-navy/30"
                            placeholder="0"
                            value={currentScoreInputs.b}
                            onChange={(e) =>
                              setScoreInputs((prev) => ({
                                ...prev,
                                [match.id]: { ...prev[match.id], b: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1 ml-3 mt-4">
                          <Button
                            size="sm"
                            className="bg-[#00C853] hover:bg-[#00A843] text-white h-8 px-3"
                            onClick={() => handleSaveScore(match.id)}
                            disabled={savingScore[match.id]}
                          >
                            {savingScore[match.id] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground h-6 px-2 text-xs"
                            onClick={() => setEditingScoreId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Exibicao do placar */
                      <div
                        className={`flex items-center justify-center gap-3 ${isAdmin ? 'cursor-pointer' : ''}`}
                        onClick={() => isAdmin && setEditingScoreId(match.id)}
                        title={isAdmin ? 'Clique para editar o placar' : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-semibold text-brand-navy mb-1">{teamA}</span>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-extrabold ${
                              hasScore
                                ? 'bg-brand-navy text-white shadow-md'
                                : 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300'
                            }`}>
                              {hasScore ? match.score_a : '-'}
                            </div>
                          </div>

                          <div className="flex flex-col items-center">
                            <Trophy className={`h-4 w-4 mb-1 ${hasScore ? 'text-amber-500' : 'text-gray-300'}`} />
                            <span className="text-lg font-bold text-muted-foreground">x</span>
                          </div>

                          <div className="flex flex-col items-center">
                            <span className="text-xs font-semibold text-brand-navy mb-1">{teamB}</span>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-extrabold ${
                              hasScore
                                ? 'bg-brand-navy text-white shadow-md'
                                : 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300'
                            }`}>
                              {hasScore ? match.score_b : '-'}
                            </div>
                          </div>
                        </div>

                        {isAdmin && !hasScore && (
                          <span className="text-xs text-muted-foreground ml-2 italic">
                            Toque para registrar
                          </span>
                        )}
                        {isAdmin && hasScore && (
                          <Pencil className="h-3 w-3 text-muted-foreground ml-2 opacity-50" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Confirmacao de Presenca (RSVP) */}
                  {(() => {
                    const confs = confirmationsMap[match.id] || []
                    const confirmedList = confs.filter(c => c.status === 'confirmed')
                    const declinedList = confs.filter(c => c.status === 'declined')
                    const myConf = myMemberId ? confs.find(c => c.member_id === myMemberId) : null
                    const isFutureOrToday = new Date(match.match_date + 'T23:59:59') >= new Date(new Date().toISOString().split('T')[0] + 'T00:00:00')

                    return (
                      <div className="px-4 py-2.5 border-t border-b bg-gradient-to-r from-[#00C853]/5 to-blue-500/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-[#00C853]" />
                              <span className="text-sm font-semibold text-[#00C853]">{confirmedList.length}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <UserX className="h-3.5 w-3.5 text-red-400" />
                              <span className="text-sm font-semibold text-red-400">{declinedList.length}</span>
                            </div>
                            {match.max_players && (
                              <span className="text-xs text-muted-foreground">
                                / {match.max_players} vagas
                              </span>
                            )}
                          </div>

                          {myMemberId && isFutureOrToday && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant={myConf?.status === 'confirmed' ? 'default' : 'outline'}
                                className={`h-7 text-xs gap-1 ${
                                  myConf?.status === 'confirmed'
                                    ? 'bg-[#00C853] hover:bg-[#00A843] text-white'
                                    : 'text-[#00C853] border-[#00C853]/50 hover:bg-[#00C853]/10'
                                }`}
                                onClick={() => toggleConfirmation(match.id, 'confirmed')}
                              >
                                <UserCheck className="h-3 w-3" />
                                Vou
                              </Button>
                              <Button
                                size="sm"
                                variant={myConf?.status === 'declined' ? 'default' : 'outline'}
                                className={`h-7 text-xs gap-1 ${
                                  myConf?.status === 'declined'
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'text-red-400 border-red-300/50 hover:bg-red-50'
                                }`}
                                onClick={() => toggleConfirmation(match.id, 'declined')}
                              >
                                <UserX className="h-3 w-3" />
                                Fora
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground"
                                onClick={() => shareMatchWhatsApp(match)}
                                title="Compartilhar no WhatsApp"
                              >
                                <Share2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Show confirmed names */}
                        {confirmedList.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {confirmedList.map(c => (
                              <span key={c.id} className="text-[10px] bg-[#00C853]/10 text-[#00C853] rounded-full px-2 py-0.5 font-medium">
                                {c.member?.name || '?'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Badges + botao expandir */}
                  <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {guests.length > 0 && (
                        <Badge variant="secondary" className="bg-brand-navy/10 text-brand-navy">
                          <Users className="h-3 w-3 mr-1" />
                          {guests.length} {guests.length === 1 ? 'avulso' : 'avulsos'}
                        </Badge>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#00C853] h-7 text-xs gap-1"
                          onClick={() => openGuestDialog(match.id, match.match_date)}
                        >
                          <Plus className="h-3 w-3" />
                          Avulso
                        </Button>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground gap-1 text-xs"
                      onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                    >
                      {isExpanded ? 'Menos' : 'Detalhes'}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  {/* Secoes expandidas */}
                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-4 py-3 space-y-4">

                      {/* Presenca */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Lista de Presenca
                          </p>
                          <Badge variant="secondary" className="bg-brand-navy/10 text-brand-navy">
                            {presentCount}/{mensalistas.length} presentes
                          </Badge>
                        </div>
                        {attendanceLoading[match.id] ? (
                          <p className="text-sm text-muted-foreground">Carregando...</p>
                        ) : mensalistas.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum mensalista cadastrado.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {mensalistas.map((member) => {
                              const isPresent = matchAttendance[member.id]?.present ?? false
                              return (
                                <label
                                  key={member.id}
                                  className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                                    isPresent ? 'bg-[#00C853]/10' : 'bg-background'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isPresent}
                                    onChange={() => toggleAttendance(match.id, member.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#00C853] focus:ring-[#00C853] accent-[#00C853]"
                                  />
                                  <span className={`text-sm ${isPresent ? 'font-medium text-brand-navy' : 'text-muted-foreground'}`}>
                                    {member.name}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                        {(() => {
                          const presentMembers = mensalistas.filter(m => matchAttendance[m.id]?.present)
                          return presentMembers.length > 0 ? (
                            <div className="mt-3">
                              <TeamShuffle members={presentMembers.map(m => ({ id: m.id, name: m.name }))} />
                            </div>
                          ) : null
                        })()}
                      </div>

                      <Separator />

                      {/* Avulsos */}
                      {guests.length > 0 && (
                        <>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Jogadores Avulsos
                            </p>
                            <div className="space-y-2">
                              {guests.map((guest) => (
                                <div
                                  key={guest.id}
                                  className="flex items-center justify-between bg-background rounded-lg px-3 py-2"
                                >
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-sm text-brand-navy">{guest.name}</span>
                                    {guest.phone && (
                                      <span className="text-xs text-muted-foreground ml-2">{guest.phone}</span>
                                    )}
                                    <span className="text-sm text-muted-foreground ml-2">
                                      R$ {Number(guest.amount).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {guest.paid ? (
                                      <Badge className="bg-[#00C853]/10 text-[#00C853]">
                                        <Check className="h-3 w-3 mr-1" />
                                        Pago
                                      </Badge>
                                    ) : (
                                      <>
                                        <Badge variant="outline" className="text-orange-500 border-orange-300">
                                          Pendente
                                        </Badge>
                                        {guest.phone && (
                                          <a
                                            href={buildWhatsAppUrl(guest, match.match_date)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="text-green-600 border-green-400 h-7 px-2"
                                            >
                                              <MessageCircle className="h-3 w-3" />
                                            </Button>
                                          </a>
                                        )}
                                        {isAdmin && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-[#00C853] border-[#00C853] h-7 px-2"
                                            onClick={() => markGuestPaid(guest.id)}
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </>
                                    )}
                                    {isAdmin && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-500 h-7 px-2"
                                        onClick={() => deleteGuest(guest.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Separator />
                        </>
                      )}

                      {/* Rateio */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Rateio
                        </p>
                        {expenseSummary?.loading ? (
                          <p className="text-sm text-muted-foreground">Calculando...</p>
                        ) : (
                          <div className="bg-background rounded-lg px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Despesas do dia</span>
                              <span className="font-medium text-brand-navy">
                                R$ {(expenseSummary?.total ?? 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Mensalistas presentes</span>
                              <span className="font-medium text-brand-navy">{presentCount}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Avulsos</span>
                              <span className="font-medium text-brand-navy">{guestCount}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Total de jogadores</span>
                              <span className="font-medium text-brand-navy">{presentCount + guestCount}</span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-brand-navy flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                Custo por jogador
                              </span>
                              <span className="text-lg font-bold text-[#00C853]">
                                {costPerPlayer !== null
                                  ? `R$ ${costPerPlayer.toFixed(2)}`
                                  : 'R$ 0,00'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog: Novo Jogo */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Jogo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMatch} className="space-y-4">
            <div className="space-y-2">
              <Label>Data do jogo *</Label>
              <Input type="date" value={newMatchDate} onChange={(e) => setNewMatchDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input placeholder="Ex: Quadra Society ABC" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome do Time A</Label>
                <Input placeholder="Time A" value={newTeamAName} onChange={(e) => setNewTeamAName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nome do Time B</Label>
                <Input placeholder="Time B" value={newTeamBName} onChange={(e) => setNewTeamBName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Campeonato</Label>
              <Select value={newTournamentId} onValueChange={(v) => { setNewTournamentId(v || ''); if (!v || v === 'none') setNewTournamentPhase('') }}>
                <SelectTrigger><SelectValue placeholder="Nenhum (jogo avulso)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (jogo avulso)</SelectItem>
                  {tournaments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const selectedTournament = tournaments.find(t => t.id === newTournamentId)
              return selectedTournament?.format === 'playoff' ? (
                <div className="space-y-2">
                  <Label>Fase do Playoff</Label>
                  <Select value={newTournamentPhase} onValueChange={(v) => setNewTournamentPhase(v || '')}>
                    <SelectTrigger><SelectValue placeholder="Selecione a fase" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLAYOFF_PHASES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null
            })()}
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea placeholder="Notas sobre o jogo" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Jogo'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Jogo */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Jogo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditMatch} className="space-y-4">
            <div className="space-y-2">
              <Label>Data do jogo *</Label>
              <Input type="date" value={editMatchDate} onChange={(e) => setEditMatchDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input placeholder="Ex: Quadra Society ABC" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome do Time A</Label>
                <Input placeholder="Time A" value={editTeamAName} onChange={(e) => setEditTeamAName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nome do Time B</Label>
                <Input placeholder="Time B" value={editTeamBName} onChange={(e) => setEditTeamBName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Campeonato</Label>
              <Select value={editTournamentId} onValueChange={(v) => { setEditTournamentId(v || ''); if (!v || v === 'none') setEditTournamentPhase('') }}>
                <SelectTrigger><SelectValue placeholder="Nenhum (jogo avulso)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (jogo avulso)</SelectItem>
                  {tournaments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const selectedTournament = tournaments.find(t => t.id === editTournamentId)
              return selectedTournament?.format === 'playoff' ? (
                <div className="space-y-2">
                  <Label>Fase do Playoff</Label>
                  <Select value={editTournamentPhase} onValueChange={(v) => setEditTournamentPhase(v || '')}>
                    <SelectTrigger><SelectValue placeholder="Selecione a fase" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLAYOFF_PHASES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null
            })()}
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea placeholder="Notas sobre o jogo" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alteracoes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Exclusao */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusao</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir este jogo? Os jogadores avulsos vinculados tambem serao removidos.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteMatch}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Adicionar Jogador Avulso */}
      <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Jogador Avulso</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGuest} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Nome do jogador" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(99) 99999-9999" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="25,00"
                value={guestAmount}
                onChange={(e) => setGuestAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
