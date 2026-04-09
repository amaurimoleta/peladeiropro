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
  Plus, Minus, Trash2, Pencil, MapPin, CalendarDays, Users, Check, ChevronDown, ChevronUp,
  MessageCircle, DollarSign, Trophy, Save, Loader2, UserCheck, UserX, HelpCircle, Share2,
  Search, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Receipt, Camera, ImagePlus, Target, Crown,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MonthNavigator } from '@/components/shared/month-navigator'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import { TeamShuffle } from '@/components/dashboard/team-shuffle'
import type { Match, GuestPlayer, GroupMember, Group, Tournament, Expense, MatchPhoto, MatchStat } from '@/lib/types'
import { TOURNAMENT_STATUSES, PLAYOFF_PHASES, EXPENSE_CATEGORIES } from '@/lib/types'
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

  // Full expense objects per match
  const [matchExpenses, setMatchExpenses] = useState<Record<string, Expense[]>>({})

  // Expense dialog state
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [expenseMatchId, setExpenseMatchId] = useState<string | null>(null)
  const [expenseMatchDate, setExpenseMatchDate] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('court_rental')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')

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

  // Match photos
  const [matchPhotos, setMatchPhotos] = useState<Record<string, MatchPhoto[]>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null)

  // Match stats (goals/assists)
  const [matchStats, setMatchStats] = useState<Record<string, MatchStat[]>>({})
  const [statsInputs, setStatsInputs] = useState<Record<string, { goals: number; assists: number }>>({})
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [statsMatchId, setStatsMatchId] = useState<string | null>(null)

  // MVP voting
  const [mvpVotes, setMvpVotes] = useState<Record<string, { voter_id: string; voted_for_id: string; voted_for_name: string }[]>>({})
  const [mvpDialogOpen, setMvpDialogOpen] = useState(false)
  const [mvpMatchId, setMvpMatchId] = useState<string | null>(null)
  const [myMvpVote, setMyMvpVote] = useState<string | null>(null)

  // Search, filter, sort
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterType, setFilterType] = useState<'all' | 'with_score' | 'no_score' | 'tournament' | 'with_guests'>('all')

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
      supabase.from('matches').select('*').eq('group_id', groupId).gte('match_date', firstDay).lte('match_date', lastDay).order('match_date', { ascending: true }),
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
      toast.error('Você precisa estar vinculado como membro para confirmar.')
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
    const msg = `⚽ *Pelada ${dateStr}*${location}\n\n✅ ${confirmedCount} confirmado${confirmedCount !== 1 ? 's' : ''}\n\nConfirme sua presença no app!\n${window.location.origin}/dashboard/${groupId}/matches`
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
      .select('*')
      .eq('group_id', groupId)
      .eq('expense_date', matchDate)
      .order('created_at', { ascending: false })

    const expenses = (data || []) as Expense[]
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    setMatchExpenses((prev) => ({ ...prev, [matchId]: expenses }))
    setExpenseSummaries((prev) => ({ ...prev, [matchId]: { total, loading: false } }))
  }, [groupId])

  // Load photos for a match
  const loadPhotos = useCallback(async (matchId: string) => {
    const { data } = await supabase
      .from('match_photos')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
    setMatchPhotos((prev) => ({ ...prev, [matchId]: (data || []) as MatchPhoto[] }))
  }, [groupId])

  const loadMatchStats = useCallback(async (matchId: string) => {
    const { data } = await supabase
      .from('match_stats')
      .select('*, member:group_members(id, name)')
      .eq('match_id', matchId)
      .order('goals', { ascending: false })
    setMatchStats((prev) => ({ ...prev, [matchId]: (data || []) as MatchStat[] }))
  }, [])

  const loadMvpVotes = useCallback(async (matchId: string) => {
    const { data } = await supabase
      .from('mvp_votes')
      .select('*, voted_for:group_members!mvp_votes_voted_for_id_fkey(id, name)')
      .eq('match_id', matchId)
    const votes = (data || []).map((v: any) => ({
      voter_id: v.voter_id,
      voted_for_id: v.voted_for_id,
      voted_for_name: v.voted_for?.name || 'Jogador',
    }))
    setMvpVotes((prev) => ({ ...prev, [matchId]: votes }))
  }, [])

  function openMvpDialog(matchId: string) {
    setMvpMatchId(matchId)
    // Check if current user already voted
    const votes = mvpVotes[matchId] || []
    const myVote = votes.find(v => v.voter_id === myMemberId)
    setMyMvpVote(myVote?.voted_for_id || null)
    setMvpDialogOpen(true)
  }

  async function handleMvpVote(votedForId: string) {
    if (!mvpMatchId || !myMemberId) {
      toast.error('Voce precisa estar vinculado como membro para votar.')
      return
    }
    // Delete existing vote
    await supabase.from('mvp_votes').delete().eq('match_id', mvpMatchId).eq('voter_id', myMemberId)

    if (votedForId === myMvpVote) {
      // Toggle off - just remove vote
      setMyMvpVote(null)
      toast.success('Voto removido!')
    } else {
      // Cast new vote
      const { error } = await supabase.from('mvp_votes').insert({
        match_id: mvpMatchId,
        group_id: groupId,
        voter_id: myMemberId,
        voted_for_id: votedForId,
      })
      if (error) {
        toast.error('Erro ao votar')
        return
      }
      setMyMvpVote(votedForId)
      toast.success('Voto registrado!')
    }
    loadMvpVotes(mvpMatchId)
  }

  function openStatsDialog(matchId: string) {
    setStatsMatchId(matchId)
    // Initialize inputs from existing stats + all present members
    const existing = matchStats[matchId] || []
    const attendance = attendanceMap[matchId] || {}
    const inputs: Record<string, { goals: number; assists: number }> = {}
    // Add all present members
    for (const [memberId, att] of Object.entries(attendance)) {
      if (att.present) {
        const stat = existing.find((s) => s.member_id === memberId)
        inputs[memberId] = { goals: stat?.goals || 0, assists: stat?.assists || 0 }
      }
    }
    // Add existing stats that might not be in attendance
    for (const stat of existing) {
      if (!inputs[stat.member_id]) {
        inputs[stat.member_id] = { goals: stat.goals, assists: stat.assists }
      }
    }
    setStatsInputs(inputs)
    setStatsDialogOpen(true)
  }

  async function handleSaveStats() {
    if (!statsMatchId) return
    // Delete existing stats for this match
    await supabase.from('match_stats').delete().eq('match_id', statsMatchId)
    // Insert new stats (only non-zero)
    const rows = Object.entries(statsInputs)
      .filter(([, v]) => v.goals > 0 || v.assists > 0)
      .map(([memberId, v]) => ({
        match_id: statsMatchId,
        group_id: groupId,
        member_id: memberId,
        goals: v.goals,
        assists: v.assists,
      }))
    if (rows.length > 0) {
      const { error } = await supabase.from('match_stats').insert(rows)
      if (error) {
        toast.error('Erro ao salvar estatísticas')
        return
      }
    }
    toast.success('Estatísticas salvas!')
    loadMatchStats(statsMatchId)
    setStatsDialogOpen(false)
  }

  // When a match is expanded, load attendance, expenses, photos and stats
  useEffect(() => {
    if (expandedMatch) {
      loadAttendance(expandedMatch)
      loadPhotos(expandedMatch)
      loadMatchStats(expandedMatch)
      loadMvpVotes(expandedMatch)
      const match = matches.find((m) => m.id === expandedMatch)
      if (match) {
        loadExpenses(expandedMatch, match.match_date)
      }
    }
  }, [expandedMatch, matches, loadAttendance, loadExpenses, loadPhotos, loadMatchStats, loadMvpVotes])

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

  function openExpenseDialog(matchId: string, matchDate: string) {
    setExpenseMatchId(matchId)
    setExpenseMatchDate(matchDate)
    setExpenseCategory('court_rental')
    setExpenseAmount('')
    setExpenseDescription('')
    setExpenseDialogOpen(true)
  }

  async function handleAddMatchExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!expenseMatchId) return
    setSaving(true)
    const { error, data } = await supabase.from('expenses').insert({
      group_id: groupId,
      category: expenseCategory,
      description: expenseDescription || EXPENSE_CATEGORIES[expenseCategory] || expenseCategory,
      amount: parseFloat(expenseAmount) || 0,
      expense_date: expenseMatchDate,
    }).select('id').single()
    if (error) {
      toast.error('Erro ao adicionar despesa', { description: error.message })
    } else {
      toast.success('Despesa adicionada!')
      await logAudit(supabase, {
        groupId,
        action: 'add_expense',
        entityType: 'expense',
        entityId: data?.id || expenseMatchDate,
        details: { category: expenseCategory, amount: expenseAmount, match_date: expenseMatchDate },
      })
      setExpenseDialogOpen(false)
      await loadExpenses(expenseMatchId, expenseMatchDate)
    }
    setSaving(false)
  }

  async function handleDeleteMatchExpense(expenseId: string, matchId: string, matchDate: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (error) {
      toast.error('Erro ao remover despesa', { description: error.message })
    } else {
      toast.success('Despesa removida!')
      await logAudit(supabase, {
        groupId,
        action: 'delete_expense',
        entityType: 'expense',
        entityId: expenseId,
      })
      await loadExpenses(matchId, matchDate)
    }
  }

  async function handlePhotoUpload(matchId: string, file: File) {
    setPhotoUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `photos/${groupId}/${matchId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        toast.error('Erro ao enviar foto', { description: uploadError.message })
        setPhotoUploading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName)

      const { error: insertError } = await supabase.from('match_photos').insert({
        match_id: matchId,
        group_id: groupId,
        photo_url: urlData.publicUrl,
        uploaded_by: myMemberId,
      })

      if (insertError) {
        toast.error('Erro ao salvar foto', { description: insertError.message })
      } else {
        toast.success('Foto adicionada!')
        await loadPhotos(matchId)
      }
    } catch (err) {
      toast.error('Erro ao enviar foto')
    }
    setPhotoUploading(false)
  }

  async function handleDeletePhoto(photoId: string, matchId: string) {
    const { error } = await supabase.from('match_photos').delete().eq('id', photoId)
    if (error) {
      toast.error('Erro ao remover foto', { description: error.message })
    } else {
      toast.success('Foto removida!')
      await loadPhotos(matchId)
    }
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

  function getExpenseCategoryStyle(category: string): string {
    switch (category) {
      case 'court_rental': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'goalkeeper': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'equipment': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'drinks': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  // Summary (based on all matches, not filtered)
  const allGuests = matches.flatMap((m) => m.guests || [])
  const totalMatches = matches.length
  const totalGuests = allGuests.length
  const totalCollected = allGuests.filter((g) => g.paid).reduce((s, g) => s + Number(g.amount), 0)
  const totalPending = allGuests.filter((g) => !g.paid).reduce((s, g) => s + Number(g.amount), 0)

  // Filter + Search + Sort
  const filteredMatches = matches
    .filter((match) => {
      // Text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchDate = formatMatchDate(match.match_date).toLowerCase()
        const location = (match.location || '').toLowerCase()
        const notes = (match.notes || '').toLowerCase()
        const teamA = (match.team_a_name || '').toLowerCase()
        const teamB = (match.team_b_name || '').toLowerCase()
        const guestNames = (match.guests || []).map(g => g.name.toLowerCase()).join(' ')
        const tournamentName = (tournaments.find(t => t.id === match.tournament_id)?.name || '').toLowerCase()
        if (
          !matchDate.includes(term) &&
          !location.includes(term) &&
          !notes.includes(term) &&
          !teamA.includes(term) &&
          !teamB.includes(term) &&
          !guestNames.includes(term) &&
          !tournamentName.includes(term)
        ) return false
      }
      // Filter by type
      if (filterType === 'with_score') return match.score_a != null && match.score_b != null
      if (filterType === 'no_score') return match.score_a == null || match.score_b == null
      if (filterType === 'tournament') return !!match.tournament_id
      if (filterType === 'with_guests') return (match.guests || []).length > 0
      return true
    })
    .sort((a, b) => {
      const cmp = a.match_date.localeCompare(b.match_date)
      return sortOrder === 'asc' ? cmp : -cmp
    })

  const hasActiveFilters = searchTerm.trim() !== '' || filterType !== 'all' || sortOrder !== 'asc'

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

      {/* Resumo do mês */}
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

      {/* Barra de busca, filtro e ordenacao */}
      {!loading && matches.length > 0 && (
        <div className="space-y-3 mb-6">
          {/* Search + Sort row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por local, time, avulso, campeonato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 shrink-0"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? (
                <><ArrowUp className="h-3.5 w-3.5" /> Antigo</>
              ) : (
                <><ArrowDown className="h-3.5 w-3.5" /> Recente</>
              )}
            </Button>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'with_score', label: 'Com placar' },
              { value: 'no_score', label: 'Sem placar' },
              { value: 'tournament', label: 'Campeonato' },
              { value: 'with_guests', label: 'Com avulsos' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterType(opt.value as typeof filterType)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterType === opt.value
                    ? 'bg-brand-navy text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setFilterType('all'); setSortOrder('asc') }}
                className="px-3 py-1 rounded-full text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Results count */}
          {(searchTerm || filterType !== 'all') && (
            <p className="text-xs text-muted-foreground">
              {filteredMatches.length} de {matches.length} {matches.length === 1 ? 'jogo' : 'jogos'}
            </p>
          )}
        </div>
      )}

      {/* Cards de jogos */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando jogos...</div>
      ) : matches.length === 0 ? (
        <Card className="card-modern-elevated">
          <CardContent className="text-center py-12 text-muted-foreground">
            Nenhum jogo neste mês.
          </CardContent>
        </Card>
      ) : filteredMatches.length === 0 ? (
        <Card className="card-modern-elevated">
          <CardContent className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum jogo encontrado com os filtros atuais.</p>
            <Button
              variant="link"
              size="sm"
              className="mt-1 text-brand-navy"
              onClick={() => { setSearchTerm(''); setFilterType('all') }}
            >
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((match) => {
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

                        {/* Observações */}
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

                      {/* Botões de ação */}
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

                  {/* Confirmação de Presença (RSVP) */}
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
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#00C853] h-7 text-xs gap-1"
                            onClick={() => openGuestDialog(match.id, match.match_date)}
                          >
                            <Plus className="h-3 w-3" />
                            Avulso
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 dark:text-blue-400 h-7 text-xs gap-1"
                            onClick={() => openExpenseDialog(match.id, match.match_date)}
                          >
                            <Receipt className="h-3 w-3" />
                            Despesa
                          </Button>
                        </>
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

                      {/* Presença */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Lista de Presença
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

                      {/* Despesas do Jogo */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <Receipt className="h-3.5 w-3.5" />
                            Despesas do Jogo
                          </p>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700"
                              onClick={() => openExpenseDialog(match.id, match.match_date)}
                            >
                              <Plus className="h-3 w-3" />
                              Adicionar Despesa
                            </Button>
                          )}
                        </div>
                        {expenseSummary?.loading ? (
                          <p className="text-sm text-muted-foreground">Carregando...</p>
                        ) : (matchExpenses[match.id] || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma despesa registrada para este jogo.</p>
                        ) : (
                          <div className="space-y-2">
                            {(matchExpenses[match.id] || []).map((expense) => (
                              <div
                                key={expense.id}
                                className="flex items-center justify-between bg-background dark:bg-background/50 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${getExpenseCategoryStyle(expense.category)}`}>
                                    {EXPENSE_CATEGORIES[expense.category] || expense.category}
                                  </span>
                                  <span className="text-sm text-muted-foreground truncate">
                                    {expense.description}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-sm font-semibold text-brand-navy dark:text-brand-navy">
                                    R$ {Number(expense.amount).toFixed(2)}
                                  </span>
                                  {isAdmin && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-500 h-7 w-7 p-0"
                                      onClick={() => handleDeleteMatchExpense(expense.id, match.id, match.match_date)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Estatísticas do Jogo (Gols e Assistências) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <Target className="h-3.5 w-3.5" />
                            Estatísticas do Jogo
                            {(matchStats[match.id] || []).length > 0 && (
                              <span className="text-[10px] font-normal ml-1 text-muted-foreground">
                                ({(matchStats[match.id] || []).reduce((s, st) => s + st.goals, 0)} gols, {(matchStats[match.id] || []).reduce((s, st) => s + st.assists, 0)} assist.)
                              </span>
                            )}
                          </p>
                          {!isReadOnly && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700"
                              onClick={() => openStatsDialog(match.id)}
                            >
                              <Target className="h-3.5 w-3.5" />
                              {(matchStats[match.id] || []).length > 0 ? 'Editar' : 'Lançar'}
                            </Button>
                          )}
                        </div>
                        {(matchStats[match.id] || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma estatística registrada.</p>
                        ) : (
                          <div className="space-y-1">
                            {(matchStats[match.id] || []).map((stat) => (
                              <div key={stat.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/50">
                                <span className="font-medium truncate">{stat.member?.name || 'Jogador'}</span>
                                <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
                                  {stat.goals > 0 && (
                                    <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-0 font-semibold px-2">
                                      {stat.goals} gol{stat.goals !== 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                  {stat.assists > 0 && (
                                    <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-0 font-semibold px-2">
                                      {stat.assists} assist.
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Fotos do Jogo */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <Camera className="h-3.5 w-3.5" />
                            Fotos do Jogo
                          </p>
                          {!isReadOnly && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700"
                              disabled={photoUploading}
                              onClick={() => {
                                const input = document.createElement('input')
                                input.type = 'file'
                                input.accept = 'image/*'
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0]
                                  if (file) handlePhotoUpload(match.id, file)
                                }
                                input.click()
                              }}
                            >
                              {photoUploading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ImagePlus className="h-3 w-3" />
                              )}
                              {photoUploading ? 'Enviando...' : 'Adicionar Foto'}
                            </Button>
                          )}
                        </div>
                        {(matchPhotos[match.id] || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma foto.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(matchPhotos[match.id] || []).map((photo) => (
                              <div key={photo.id} className="relative group rounded-lg overflow-hidden bg-background border">
                                <img
                                  src={photo.photo_url}
                                  alt="Foto do jogo"
                                  className="w-full h-28 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setViewingPhoto(photo.photo_url)}
                                />
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDeletePhoto(photo.id, match.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Votacao MVP */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <Crown className="h-3.5 w-3.5" />
                            Votacao MVP
                            {(mvpVotes[match.id] || []).length > 0 && (
                              <span className="text-[10px] font-normal ml-1 text-muted-foreground">
                                ({(mvpVotes[match.id] || []).length} voto{(mvpVotes[match.id] || []).length !== 1 ? 's' : ''})
                              </span>
                            )}
                          </p>
                          {myMemberId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                              onClick={() => openMvpDialog(match.id)}
                            >
                              <Crown className="h-3.5 w-3.5" />
                              Votar MVP
                            </Button>
                          )}
                        </div>
                        {(() => {
                          const votes = mvpVotes[match.id] || []
                          if (votes.length === 0) {
                            return <p className="text-sm text-muted-foreground">Nenhum voto registrado.</p>
                          }
                          // Count votes per player
                          const voteCounts: Record<string, { name: string; count: number }> = {}
                          for (const v of votes) {
                            if (!voteCounts[v.voted_for_id]) {
                              voteCounts[v.voted_for_id] = { name: v.voted_for_name, count: 0 }
                            }
                            voteCounts[v.voted_for_id].count++
                          }
                          const sorted = Object.entries(voteCounts).sort((a, b) => b[1].count - a[1].count)
                          const topCount = sorted[0]?.[1].count || 0
                          return (
                            <div className="space-y-1">
                              {sorted.map(([memberId, { name, count }]) => {
                                const isWinner = count === topCount && count > 0
                                return (
                                  <div
                                    key={memberId}
                                    className={`flex items-center justify-between text-sm py-1.5 px-3 rounded-lg ${isWinner ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-800' : 'bg-muted/50'}`}
                                  >
                                    <span className="font-medium truncate flex items-center gap-1.5">
                                      {isWinner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                                      {name}
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className={`${isWinner ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'} border-0 font-semibold px-2`}
                                    >
                                      {count} voto{count !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>

                      <Separator />

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
              <Label>Observações</Label>
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
              <Label>Observações</Label>
              <Textarea placeholder="Notas sobre o jogo" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir este jogo? Os jogadores avulsos vinculados também serão removidos.
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

      {/* Dialog: Visualizar Foto */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-3xl p-2">
          {viewingPhoto && (
            <img
              src={viewingPhoto}
              alt="Foto do jogo"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Estatísticas do Jogo */}
      <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              Lançar Estatísticas
            </DialogTitle>
          </DialogHeader>
          {Object.keys(statsInputs).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center px-4">
              Nenhum jogador presente. Registre a presença primeiro.
            </p>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 pb-2">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center mb-2 px-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Jogador</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase text-center w-[100px]">Gols</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase text-center w-[100px]">Assist.</span>
                </div>
                {Object.entries(statsInputs)
                  .sort(([a], [b]) => {
                    const nameA = mensalistas.find(m => m.id === a)?.name || ''
                    const nameB = mensalistas.find(m => m.id === b)?.name || ''
                    return nameA.localeCompare(nameB)
                  })
                  .map(([memberId, vals]) => {
                    const member = mensalistas.find(m => m.id === memberId)
                    const hasStats = vals.goals > 0 || vals.assists > 0
                    return (
                      <div
                        key={memberId}
                        className={`grid grid-cols-[1fr_auto_auto] gap-x-2 items-center py-2 px-1 border-b border-border/50 last:border-0 ${hasStats ? 'bg-orange-50/50 dark:bg-orange-950/20 rounded-lg' : ''}`}
                      >
                        <span className="text-sm font-medium truncate pr-1">{member?.name || 'Jogador'}</span>
                        <div className="flex items-center gap-1 w-[100px] justify-center">
                          <button
                            type="button"
                            className="h-9 w-9 rounded-full flex items-center justify-center bg-muted hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-90 transition-all touch-manipulation"
                            onClick={() =>
                              setStatsInputs((prev) => ({
                                ...prev,
                                [memberId]: { ...prev[memberId], goals: Math.max(0, prev[memberId].goals - 1) },
                              }))
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className={`w-7 text-center text-base font-bold tabular-nums ${vals.goals > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                            {vals.goals}
                          </span>
                          <button
                            type="button"
                            className="h-9 w-9 rounded-full flex items-center justify-center bg-muted hover:bg-green-100 dark:hover:bg-green-900/40 active:scale-90 transition-all touch-manipulation"
                            onClick={() =>
                              setStatsInputs((prev) => ({
                                ...prev,
                                [memberId]: { ...prev[memberId], goals: prev[memberId].goals + 1 },
                              }))
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 w-[100px] justify-center">
                          <button
                            type="button"
                            className="h-9 w-9 rounded-full flex items-center justify-center bg-muted hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-90 transition-all touch-manipulation"
                            onClick={() =>
                              setStatsInputs((prev) => ({
                                ...prev,
                                [memberId]: { ...prev[memberId], assists: Math.max(0, prev[memberId].assists - 1) },
                              }))
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className={`w-7 text-center text-base font-bold tabular-nums ${vals.assists > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                            {vals.assists}
                          </span>
                          <button
                            type="button"
                            className="h-9 w-9 rounded-full flex items-center justify-center bg-muted hover:bg-blue-100 dark:hover:bg-blue-900/40 active:scale-90 transition-all touch-manipulation"
                            onClick={() =>
                              setStatsInputs((prev) => ({
                                ...prev,
                                [memberId]: { ...prev[memberId], assists: prev[memberId].assists + 1 },
                              }))
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
              <div className="px-4 py-3 border-t bg-background">
                <Button
                  className="w-full h-12 text-base bg-[#00C853] hover:bg-[#00A843] text-white"
                  onClick={handleSaveStats}
                >
                  <Save className="h-5 w-5 mr-2" />
                  Salvar Estatísticas
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Votacao MVP */}
      <Dialog open={mvpDialogOpen} onOpenChange={setMvpDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Votar MVP do Jogo
            </DialogTitle>
          </DialogHeader>
          {(() => {
            if (!mvpMatchId) return null
            const attendance = attendanceMap[mvpMatchId] || {}
            const presentMembers = mensalistas.filter(m => attendance[m.id]?.present)
            const votes = mvpVotes[mvpMatchId] || []
            // Count votes per player
            const voteCounts: Record<string, number> = {}
            for (const v of votes) {
              voteCounts[v.voted_for_id] = (voteCounts[v.voted_for_id] || 0) + 1
            }

            if (presentMembers.length === 0) {
              return (
                <p className="text-sm text-muted-foreground py-8 text-center px-4">
                  Nenhum jogador presente. Registre a presenca primeiro.
                </p>
              )
            }

            return (
              <>
                <p className="text-xs text-muted-foreground px-4 pb-2">
                  Toque no jogador para votar. Toque novamente para remover o voto. Voce nao pode votar em si mesmo.
                </p>
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  {presentMembers
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((member) => {
                      const isSelected = myMvpVote === member.id
                      const isSelf = member.id === myMemberId
                      const voteCount = voteCounts[member.id] || 0
                      return (
                        <button
                          key={member.id}
                          type="button"
                          disabled={isSelf}
                          className={`w-full flex items-center justify-between py-3 px-3 rounded-lg mb-1 transition-all touch-manipulation text-left ${
                            isSelected
                              ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-400 dark:ring-amber-600'
                              : isSelf
                                ? 'bg-muted/30 opacity-50 cursor-not-allowed'
                                : 'bg-muted/50 hover:bg-muted active:scale-[0.98]'
                          }`}
                          onClick={() => handleMvpVote(member.id)}
                        >
                          <span className={`text-sm font-medium truncate flex items-center gap-2 ${isSelected ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                            {isSelected && <Crown className="h-4 w-4 text-amber-500 shrink-0" />}
                            {member.name}
                            {isSelf && <span className="text-[10px] text-muted-foreground font-normal">(voce)</span>}
                          </span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {voteCount > 0 && (
                              <Badge
                                variant="secondary"
                                className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-0 font-semibold px-2"
                              >
                                {voteCount} voto{voteCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                            {isSelected && (
                              <Check className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog: Adicionar Despesa ao Jogo */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Despesa ao Jogo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMatchExpense} className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={expenseCategory} onValueChange={(v) => setExpenseCategory(v || 'court_rental')}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="court_rental">Quadra</SelectItem>
                  <SelectItem value="goalkeeper">Goleiro</SelectItem>
                  <SelectItem value="equipment">Equipamento</SelectItem>
                  <SelectItem value="drinks">Bebidas</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="150,00"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Input
                placeholder="Ex: Aluguel da quadra"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
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
