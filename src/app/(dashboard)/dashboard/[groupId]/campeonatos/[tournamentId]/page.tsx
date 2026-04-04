'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ArrowLeft, Plus, Trophy, CalendarDays, MapPin, Swords,
  ListOrdered, GitBranch, Repeat, Target, Shield, Users, X,
  Pencil, Save, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import type { Tournament, Match, Team, GroupMember } from '@/lib/types'
import { TOURNAMENT_STATUSES, TOURNAMENT_FORMATS, PLAYOFF_PHASES } from '@/lib/types'

// ── Types ──
interface Standing {
  team: string
  color: string | null
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

interface SeriesInfo {
  teamA: string
  teamB: string
  winsA: number
  winsB: number
  draws: number
  totalGames: number
  winner: string | null
  finished: boolean
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  finished: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
}

const FORMAT_ICONS: Record<string, typeof ListOrdered> = {
  league: ListOrdered,
  playoff: GitBranch,
  best_of_4: Repeat,
}

export default function TournamentDetailPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const tournamentId = params.tournamentId as string
  const supabase = createClient()
  const { isAdmin } = useGroupRole(groupId)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [tournamentTeamIds, setTournamentTeamIds] = useState<string[]>([])
  const [allGroupTeams, setAllGroupTeams] = useState<Team[]>([])
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, GroupMember[]>>({})
  const [loading, setLoading] = useState(true)

  // Add match dialog
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [matchDate, setMatchDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [matchLocation, setMatchLocation] = useState('')
  const [matchTeamA, setMatchTeamA] = useState('')
  const [matchTeamB, setMatchTeamB] = useState('')
  const [matchPhase, setMatchPhase] = useState('')
  const [matchNotes, setMatchNotes] = useState('')
  const [savingMatch, setSavingMatch] = useState(false)

  // Team management dialog
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false)

  // Inline score editing
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null)
  const [scoreInputs, setScoreInputs] = useState<Record<string, { a: string; b: string }>>({})
  const [savingScore, setSavingScore] = useState<Record<string, boolean>>({})

  const loadTournament = useCallback(async () => {
    const { data } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
    setTournament(data)
  }, [tournamentId])

  const loadMatches = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('match_date', { ascending: true })
    const loaded = data || []
    setMatches(loaded)
    // Initialize score inputs
    const newInputs: Record<string, { a: string; b: string }> = {}
    for (const m of loaded) {
      newInputs[m.id] = { a: m.score_a != null ? String(m.score_a) : '', b: m.score_b != null ? String(m.score_b) : '' }
    }
    setScoreInputs(prev => ({ ...prev, ...newInputs }))
  }, [tournamentId])

  const loadTournamentTeams = useCallback(async () => {
    const { data } = await supabase
      .from('tournament_teams')
      .select('team_id')
      .eq('tournament_id', tournamentId)
    const teamIds = (data || []).map(t => t.team_id)
    setTournamentTeamIds(teamIds)
  }, [tournamentId])

  const loadAllGroupTeams = useCallback(async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('group_id', groupId)
      .order('name')
    setAllGroupTeams(data || [])
  }, [groupId])

  const loadTeamMembers = useCallback(async (teamIds: string[]) => {
    if (teamIds.length === 0) return
    const { data: tmData } = await supabase
      .from('team_members')
      .select('team_id, member_id')
      .in('team_id', teamIds)
    if (!tmData || tmData.length === 0) { setTeamMembersMap({}); return }
    const memberIds = [...new Set(tmData.map(tm => tm.member_id))]
    const { data: membersData } = await supabase
      .from('group_members')
      .select('*')
      .in('id', memberIds)
    const membersById: Record<string, GroupMember> = {}
    for (const m of membersData || []) membersById[m.id] = m
    const map: Record<string, GroupMember[]> = {}
    for (const tm of tmData) {
      if (!map[tm.team_id]) map[tm.team_id] = []
      const member = membersById[tm.member_id]
      if (member) map[tm.team_id].push(member)
    }
    setTeamMembersMap(map)
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadTournament(), loadMatches(), loadTournamentTeams(), loadAllGroupTeams()])
      setLoading(false)
    }
    init()
  }, [loadTournament, loadMatches, loadTournamentTeams, loadAllGroupTeams])

  // Derive the participating teams from allGroupTeams + tournamentTeamIds
  useEffect(() => {
    const t = allGroupTeams.filter(team => tournamentTeamIds.includes(team.id))
    setTeams(t)
    loadTeamMembers(tournamentTeamIds)
  }, [tournamentTeamIds, allGroupTeams, loadTeamMembers])

  // ── Helpers ──
  function fmtDate(dateStr: string | null): string {
    if (!dateStr) return ''
    return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy')
  }

  function fmtMatchDate(dateStr: string): string {
    return format(new Date(dateStr + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })
  }

  function fmtMatchDateShort(dateStr: string): string {
    return format(new Date(dateStr + 'T12:00:00'), "dd/MM - EEEE", { locale: ptBR })
  }

  function getTeamColor(teamName: string): string | null {
    const t = teams.find(t => t.name === teamName)
    return t?.color || null
  }

  // ── Standings builder ──
  function buildStandings(): Standing[] {
    if (!tournament) return []
    const scoredMatches = matches.filter(m => m.score_a != null && m.score_b != null)
    const teamsMap: Record<string, Standing> = {}

    function ensureTeam(name: string) {
      if (!teamsMap[name]) {
        teamsMap[name] = { team: name, color: getTeamColor(name), played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
      }
    }

    for (const match of scoredMatches) {
      const teamA = match.team_a_name || 'Time A'
      const teamB = match.team_b_name || 'Time B'
      ensureTeam(teamA); ensureTeam(teamB)
      teamsMap[teamA].played++; teamsMap[teamB].played++
      teamsMap[teamA].goalsFor += match.score_a!; teamsMap[teamA].goalsAgainst += match.score_b!
      teamsMap[teamB].goalsFor += match.score_b!; teamsMap[teamB].goalsAgainst += match.score_a!

      if (match.score_a! > match.score_b!) {
        teamsMap[teamA].wins++; teamsMap[teamA].points += tournament.points_win
        teamsMap[teamB].losses++; teamsMap[teamB].points += tournament.points_loss
      } else if (match.score_a! < match.score_b!) {
        teamsMap[teamB].wins++; teamsMap[teamB].points += tournament.points_win
        teamsMap[teamA].losses++; teamsMap[teamA].points += tournament.points_loss
      } else {
        teamsMap[teamA].draws++; teamsMap[teamA].points += tournament.points_draw
        teamsMap[teamB].draws++; teamsMap[teamB].points += tournament.points_draw
      }
    }

    const standings = Object.values(teamsMap)
    standings.forEach(s => { s.goalDifference = s.goalsFor - s.goalsAgainst })
    standings.sort((a, b) => b.points !== a.points ? b.points - a.points : b.goalDifference !== a.goalDifference ? b.goalDifference - a.goalDifference : b.goalsFor - a.goalsFor)
    return standings
  }

  function groupByPhase(): Record<string, Match[]> {
    const groups: Record<string, Match[]> = {}
    const phaseOrder = ['final', 'semi', 'quarter', 'round16', 'group']
    for (const match of matches) {
      const phase = match.tournament_phase || 'group'
      if (!groups[phase]) groups[phase] = []
      groups[phase].push(match)
    }
    const sorted: Record<string, Match[]> = {}
    for (const phase of phaseOrder) { if (groups[phase]) sorted[phase] = groups[phase] }
    for (const [phase, list] of Object.entries(groups)) { if (!sorted[phase]) sorted[phase] = list }
    return sorted
  }

  function buildSeriesInfo(): SeriesInfo {
    const scoredMatches = matches.filter(m => m.score_a != null && m.score_b != null)
    let teamA = 'Time A', teamB = 'Time B'
    if (matches.length > 0) { teamA = matches[0].team_a_name || 'Time A'; teamB = matches[0].team_b_name || 'Time B' }
    let winsA = 0, winsB = 0, draws = 0
    for (const m of scoredMatches) {
      if (m.score_a! > m.score_b!) winsA++
      else if (m.score_b! > m.score_a!) winsB++
      else draws++
    }
    let winner: string | null = null, finished = false
    if (winsA >= 4) { winner = teamA; finished = true }
    else if (winsB >= 4) { winner = teamB; finished = true }
    return { teamA, teamB, winsA, winsB, draws, totalGames: scoredMatches.length, winner, finished }
  }

  // ── Team toggle ──
  async function toggleTeam(teamId: string) {
    const isIn = tournamentTeamIds.includes(teamId)
    if (isIn) {
      const { error } = await supabase.from('tournament_teams').delete().eq('tournament_id', tournamentId).eq('team_id', teamId)
      if (error) { toast.error('Erro ao remover time'); return }
      setTournamentTeamIds(prev => prev.filter(id => id !== teamId))
    } else {
      const { error } = await supabase.from('tournament_teams').insert({ tournament_id: tournamentId, team_id: teamId })
      if (error) { toast.error('Erro ao adicionar time'); return }
      setTournamentTeamIds(prev => [...prev, teamId])
    }
  }

  // ── Add match ──
  async function handleAddMatch(e: React.FormEvent) {
    e.preventDefault()
    setSavingMatch(true)
    const { error } = await supabase.from('matches').insert({
      group_id: groupId,
      match_date: matchDate,
      location: matchLocation || null,
      notes: matchNotes || null,
      team_a_name: matchTeamA || 'Time A',
      team_b_name: matchTeamB || 'Time B',
      tournament_id: tournamentId,
      tournament_phase: matchPhase || null,
    })
    if (error) {
      toast.error('Erro ao criar jogo', { description: error.message })
    } else {
      toast.success('Jogo adicionado!')
      await logAudit(supabase, { groupId, action: 'create_match', entityType: 'match', entityId: matchDate, details: { tournament_id: tournamentId } })
      setMatchDialogOpen(false)
      loadMatches()
    }
    setSavingMatch(false)
  }

  async function handleSaveScore(matchId: string) {
    const inputs = scoreInputs[matchId]
    if (!inputs) return
    setSavingScore(prev => ({ ...prev, [matchId]: true }))
    const scoreA = inputs.a !== '' ? parseInt(inputs.a, 10) : null
    const scoreB = inputs.b !== '' ? parseInt(inputs.b, 10) : null
    const { error } = await supabase.from('matches').update({ score_a: scoreA, score_b: scoreB }).eq('id', matchId)
    if (error) {
      toast.error('Erro ao salvar placar', { description: error.message })
    } else {
      toast.success('Placar salvo!')
      setEditingScoreId(null)
      await logAudit(supabase, { groupId, action: 'update_score', entityType: 'match', entityId: matchId, details: { score_a: scoreA, score_b: scoreB } })
      await loadMatches()
    }
    setSavingScore(prev => ({ ...prev, [matchId]: false }))
  }

  function openAddMatch() {
    setMatchDate(format(new Date(), 'yyyy-MM-dd'))
    setMatchLocation('')
    setMatchTeamA(teams.length > 0 ? teams[0].name : 'Time A')
    setMatchTeamB(teams.length > 1 ? teams[1].name : 'Time B')
    setMatchPhase('')
    setMatchNotes('')
    setMatchDialogOpen(true)
  }

  // ── Components ──
  function MatchCard({ match, index }: { match: Match; index?: number }) {
    const teamA = match.team_a_name || 'Time A'
    const teamB = match.team_b_name || 'Time B'
    const hasScore = match.score_a != null && match.score_b != null
    const colorA = getTeamColor(teamA)
    const colorB = getTeamColor(teamB)
    const isEditing = editingScoreId === match.id
    const currentInputs = scoreInputs[match.id] || { a: '', b: '' }
    const isSaving = savingScore[match.id]

    return (
      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-brand-navy/20 transition-colors overflow-hidden">
        <div className="flex items-center gap-3 p-3">
          <div className="w-28 shrink-0 text-center">
            {index !== undefined && (
              <Badge variant="secondary" className="text-[10px] mb-0.5">Jogo {index + 1}</Badge>
            )}
            <p className="text-xs font-medium text-brand-navy capitalize">{fmtMatchDateShort(match.match_date)}</p>
            {match.location && (
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5 mt-0.5">
                <MapPin className="h-2.5 w-2.5" /> {match.location}
              </p>
            )}
            {match.tournament_phase && (
              <Badge variant="secondary" className="text-[10px] mt-1 bg-violet-50 text-violet-700">
                {PLAYOFF_PHASES[match.tournament_phase] || match.tournament_phase}
              </Badge>
            )}
          </div>

          {/* Score area */}
          {isEditing && isAdmin ? (
            <div className="flex-1 flex items-center justify-center gap-2">
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                {colorA && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorA }} />}
                <span className="text-xs font-bold text-brand-navy text-right truncate">{teamA}</span>
              </div>
              <Input
                type="number" min="0" className="w-12 h-8 text-center text-sm font-bold border-brand-navy/30 px-1"
                value={currentInputs.a}
                onChange={e => setScoreInputs(prev => ({ ...prev, [match.id]: { ...prev[match.id], a: e.target.value } }))}
              />
              <span className="text-xs text-muted-foreground font-bold">x</span>
              <Input
                type="number" min="0" className="w-12 h-8 text-center text-sm font-bold border-brand-navy/30 px-1"
                value={currentInputs.b}
                onChange={e => setScoreInputs(prev => ({ ...prev, [match.id]: { ...prev[match.id], b: e.target.value } }))}
              />
              <div className="flex items-center gap-1.5 flex-1 justify-start">
                <span className="text-xs font-bold text-brand-navy text-left truncate">{teamB}</span>
                {colorB && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorB }} />}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" className="bg-[#00C853] hover:bg-[#00A843] text-white h-7 w-7 p-0" onClick={() => handleSaveScore(match.id)} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground h-7 w-7 p-0" onClick={() => setEditingScoreId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`flex-1 flex items-center justify-center gap-2 ${isAdmin ? 'cursor-pointer' : ''}`}
              onClick={() => isAdmin && setEditingScoreId(match.id)}
              title={isAdmin ? 'Clique para editar o placar' : undefined}
            >
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                {colorA && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorA }} />}
                <span className="text-sm font-bold text-brand-navy text-right truncate">{teamA}</span>
              </div>
              {hasScore ? (
                <>
                  <span className="bg-brand-navy text-white px-2 py-0.5 rounded text-sm font-extrabold min-w-[28px] text-center">{match.score_a}</span>
                  <span className="text-xs text-muted-foreground">x</span>
                  <span className="bg-brand-navy text-white px-2 py-0.5 rounded text-sm font-extrabold min-w-[28px] text-center">{match.score_b}</span>
                </>
              ) : (
                <>
                  <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded text-sm min-w-[28px] text-center">-</span>
                  <span className="text-xs text-muted-foreground">x</span>
                  <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded text-sm min-w-[28px] text-center">-</span>
                </>
              )}
              <div className="flex items-center gap-1.5 flex-1 justify-start">
                <span className="text-sm font-bold text-brand-navy text-left truncate">{teamB}</span>
                {colorB && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorB }} />}
              </div>
              {isAdmin && (
                <Pencil className="h-3 w-3 text-muted-foreground opacity-40 shrink-0" />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  function WinDots({ wins, max, color }: { wins: number; max: number; color: string }) {
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < wins ? `${color} border-transparent shadow-sm` : 'bg-transparent border-gray-300'}`} />
        ))}
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando campeonato...</div>
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Campeonato nao encontrado.</p>
        <Link href={`/dashboard/${groupId}/campeonatos`}>
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        </Link>
      </div>
    )
  }

  const FormatIcon = FORMAT_ICONS[tournament.format] || ListOrdered
  const scoredMatches = matches.filter(m => m.score_a != null && m.score_b != null)
  const standings = tournament.format === 'league' ? buildStandings() : []
  const series = tournament.format === 'best_of_4' ? buildSeriesInfo() : null

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href={`/dashboard/${groupId}/campeonatos`} className="text-sm text-muted-foreground hover:text-brand-navy transition-colors inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para campeonatos
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Trophy className="h-5 w-5 text-brand-navy" />
              <h1 className="text-2xl font-bold text-brand-navy">{tournament.name}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={STATUS_COLORS[tournament.status]}>
                {TOURNAMENT_STATUSES[tournament.status]}
              </Badge>
              <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 gap-1">
                <FormatIcon className="h-3 w-3" />
                {TOURNAMENT_FORMATS[tournament.format]}
              </Badge>
              {(tournament.start_date || tournament.end_date) && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {tournament.start_date ? fmtDate(tournament.start_date) : ''}
                  {tournament.start_date && tournament.end_date ? ' - ' : ''}
                  {tournament.end_date ? fmtDate(tournament.end_date) : ''}
                </span>
              )}
            </div>
            {tournament.description && (
              <p className="text-sm text-muted-foreground mt-2">{tournament.description}</p>
            )}
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>{teams.length} {teams.length === 1 ? 'time' : 'times'}</span>
              <span>{matches.length} {matches.length === 1 ? 'jogo' : 'jogos'}</span>
              <span>{scoredMatches.length} com placar</span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setTeamsDialogOpen(true)}>
                <Shield className="h-4 w-4 mr-1" />
                Times
              </Button>
              <Button size="sm" className="bg-[#00C853] hover:bg-[#00A843] text-white" onClick={openAddMatch}>
                <Plus className="h-4 w-4 mr-1" />
                Jogo
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="classificacao">
        <TabsList className="w-full">
          <TabsTrigger value="classificacao">
            {tournament.format === 'best_of_4' ? (
              <><Target className="h-4 w-4 mr-1" />Serie</>
            ) : tournament.format === 'playoff' ? (
              <><GitBranch className="h-4 w-4 mr-1" />Chave</>
            ) : (
              <><ListOrdered className="h-4 w-4 mr-1" />Classificacao</>
            )}
          </TabsTrigger>
          <TabsTrigger value="jogos">
            <CalendarDays className="h-4 w-4 mr-1" />
            Jogos ({matches.length})
          </TabsTrigger>
          <TabsTrigger value="times">
            <Shield className="h-4 w-4 mr-1" />
            Times ({teams.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Classificacao / Chave / Serie ── */}
        <TabsContent value="classificacao">
          <Card className="card-modern-elevated mt-4">
            <CardContent className="p-4">
              {/* LEAGUE */}
              {tournament.format === 'league' && (
                standings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum jogo com placar registrado.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#1B1F4B]">
                          <TableHead className="text-white font-semibold text-center w-12">#</TableHead>
                          <TableHead className="text-white font-semibold">Time</TableHead>
                          <TableHead className="text-white font-semibold text-center">J</TableHead>
                          <TableHead className="text-white font-semibold text-center">V</TableHead>
                          <TableHead className="text-white font-semibold text-center">E</TableHead>
                          <TableHead className="text-white font-semibold text-center">D</TableHead>
                          <TableHead className="text-white font-semibold text-center">GP</TableHead>
                          <TableHead className="text-white font-semibold text-center">GC</TableHead>
                          <TableHead className="text-white font-semibold text-center">SG</TableHead>
                          <TableHead className="text-white font-semibold text-center">Pts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standings.map((s, idx) => (
                          <TableRow key={s.team} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}>
                            <TableCell className="text-center font-bold text-brand-navy">
                              {idx === 0 ? <span className="flex items-center justify-center gap-1">🏆 1</span> : idx + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {s.color && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                                <span className="font-semibold text-brand-navy">{s.team}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{s.played}</TableCell>
                            <TableCell className="text-center text-green-600 font-medium">{s.wins}</TableCell>
                            <TableCell className="text-center text-amber-600 font-medium">{s.draws}</TableCell>
                            <TableCell className="text-center text-red-500 font-medium">{s.losses}</TableCell>
                            <TableCell className="text-center">{s.goalsFor}</TableCell>
                            <TableCell className="text-center">{s.goalsAgainst}</TableCell>
                            <TableCell className="text-center font-medium">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</TableCell>
                            <TableCell className="text-center font-extrabold text-brand-navy text-lg">{s.points}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}

              {/* PLAYOFF */}
              {tournament.format === 'playoff' && (
                matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum jogo cadastrado.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupByPhase()).map(([phase, phaseMatches]) => (
                      <div key={phase}>
                        <div className="flex items-center gap-2 mb-2">
                          <Swords className="h-3.5 w-3.5 text-violet-600" />
                          <span className="text-xs font-bold uppercase tracking-wide text-violet-700">
                            {PLAYOFF_PHASES[phase] || phase}
                          </span>
                          <span className="text-xs text-muted-foreground">({phaseMatches.length} {phaseMatches.length === 1 ? 'jogo' : 'jogos'})</span>
                        </div>
                        <div className="space-y-2 ml-5">
                          {phaseMatches.map(m => <MatchCard key={m.id} match={m} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* BEST OF 4 */}
              {tournament.format === 'best_of_4' && series && (
                matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum jogo cadastrado.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Scoreboard */}
                    <div className="bg-gradient-to-r from-brand-navy/5 via-transparent to-brand-navy/5 rounded-xl p-6">
                      <div className="flex items-center justify-center gap-6 sm:gap-10">
                        <div className="flex flex-col items-center gap-2 flex-1">
                          {getTeamColor(series.teamA) && (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: getTeamColor(series.teamA)! }}>
                              <Shield className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <span className="text-sm font-bold text-brand-navy text-center">{series.teamA}</span>
                          <span className={`text-5xl font-extrabold ${series.winner === series.teamA ? 'text-[#00C853]' : 'text-brand-navy'}`}>{series.winsA}</span>
                          <WinDots wins={series.winsA} max={4} color="bg-[#00C853]" />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <Swords className="h-6 w-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground font-bold">VS</span>
                          {series.draws > 0 && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 mt-1">
                              {series.draws} {series.draws === 1 ? 'empate' : 'empates'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-2 flex-1">
                          {getTeamColor(series.teamB) && (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: getTeamColor(series.teamB)! }}>
                              <Shield className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <span className="text-sm font-bold text-brand-navy text-center">{series.teamB}</span>
                          <span className={`text-5xl font-extrabold ${series.winner === series.teamB ? 'text-[#00C853]' : 'text-brand-navy'}`}>{series.winsB}</span>
                          <WinDots wins={series.winsB} max={4} color="bg-blue-500" />
                        </div>
                      </div>
                      <div className="text-center mt-4">
                        {series.finished ? (
                          <Badge className="bg-[#00C853]/10 text-[#00C853] text-sm px-4 py-1">
                            <Trophy className="h-3.5 w-3.5 mr-1.5" />{series.winner} venceu a serie!
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-sm px-4 py-1">
                            Serie em andamento - {series.totalGames} {series.totalGames === 1 ? 'jogo disputado' : 'jogos disputados'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Game-by-game */}
                    {scoredMatches.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Jogos disputados</h4>
                        <div className="space-y-2">
                          {scoredMatches.map((m, idx) => {
                            const aWon = m.score_a! > m.score_b!
                            const isDraw = m.score_a === m.score_b
                            return (
                              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                                <div className="w-16 shrink-0 text-center">
                                  <Badge variant="secondary" className="text-[10px]">Jogo {idx + 1}</Badge>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{fmtMatchDateShort(m.match_date)}</p>
                                </div>
                                <div className="flex-1 flex items-center justify-center gap-2">
                                  <span className={`text-sm font-bold text-right flex-1 truncate ${aWon ? 'text-[#00C853]' : isDraw ? 'text-amber-600' : 'text-brand-navy'}`}>
                                    {m.team_a_name || 'Time A'}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-sm font-extrabold min-w-[28px] text-center text-white ${aWon ? 'bg-[#00C853]' : isDraw ? 'bg-amber-500' : 'bg-brand-navy'}`}>{m.score_a}</span>
                                  <span className="text-xs text-muted-foreground">x</span>
                                  <span className={`px-2 py-0.5 rounded text-sm font-extrabold min-w-[28px] text-center text-white ${!aWon && !isDraw ? 'bg-[#00C853]' : isDraw ? 'bg-amber-500' : 'bg-brand-navy'}`}>{m.score_b}</span>
                                  <span className={`text-sm font-bold text-left flex-1 truncate ${!aWon && !isDraw ? 'text-[#00C853]' : isDraw ? 'text-amber-600' : 'text-brand-navy'}`}>
                                    {m.team_b_name || 'Time B'}
                                  </span>
                                </div>
                                <div className="w-16 shrink-0 text-center">
                                  {isDraw && <Badge className="bg-amber-50 text-amber-700 text-[10px]">Empate</Badge>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Jogos ── */}
        <TabsContent value="jogos">
          <Card className="card-modern-elevated mt-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-brand-navy">Todos os Jogos</h3>
                {isAdmin && (
                  <Button size="sm" className="bg-[#00C853] hover:bg-[#00A843] text-white gap-1 h-8" onClick={openAddMatch}>
                    <Plus className="h-3.5 w-3.5" />Adicionar Jogo
                  </Button>
                )}
              </div>
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum jogo cadastrado neste campeonato.</p>
              ) : (
                <div className="space-y-2">
                  {matches.map((m, idx) => <MatchCard key={m.id} match={m} index={idx} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Times ── */}
        <TabsContent value="times">
          <div className="mt-4">
            {isAdmin && (
              <div className="flex justify-end mb-4">
                <Button size="sm" variant="outline" onClick={() => setTeamsDialogOpen(true)}>
                  <Shield className="h-4 w-4 mr-1" />Gerenciar Times
                </Button>
              </div>
            )}
            {teams.length === 0 ? (
              <Card className="card-modern-elevated">
                <CardContent className="text-center py-8 text-muted-foreground">
                  Nenhum time vinculado a este campeonato.
                  {isAdmin && <><br /><span className="text-xs">Clique em &quot;Gerenciar Times&quot; para adicionar.</span></>}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(team => {
                  const members = teamMembersMap[team.id] || []
                  return (
                    <Card key={team.id} className="card-modern-elevated overflow-hidden">
                      <CardContent className="p-0">
                        <div className="h-2 w-full" style={{ backgroundColor: team.color }} />
                        <div className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: team.color }}>
                              <Shield className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-brand-navy">{team.name}</h3>
                              <p className="text-xs text-muted-foreground">{members.length} {members.length === 1 ? 'jogador' : 'jogadores'}</p>
                            </div>
                          </div>
                          {members.length > 0 ? (
                            <div className="space-y-1">
                              {members.map(m => (
                                <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                                  <span className="text-sm text-brand-navy">{m.name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhum jogador no elenco.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Gerenciar Times */}
      <Dialog open={teamsDialogOpen} onOpenChange={setTeamsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Times do Campeonato</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allGroupTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum time cadastrado no grupo.<br />
                <Link href={`/dashboard/${groupId}/times`} className="text-brand-navy underline text-xs">Ir para pagina de Times</Link>
              </p>
            ) : (
              allGroupTeams.map(team => {
                const isIn = tournamentTeamIds.includes(team.id)
                return (
                  <button
                    key={team.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      isIn ? 'border-brand-navy bg-brand-navy/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleTeam(team.id)}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: team.color }}>
                      <Shield className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium text-brand-navy flex-1">{team.name}</span>
                    {isIn ? (
                      <Badge className="bg-brand-navy text-white">Participando</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Adicionar</Badge>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Adicionar Jogo */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Jogo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMatch} className="space-y-4">
            <div className="space-y-2">
              <Label>Data do jogo *</Label>
              <Input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input placeholder="Ex: Quadra Society ABC" value={matchLocation} onChange={e => setMatchLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Time A</Label>
                {teams.length > 0 ? (
                  <Select value={matchTeamA} onValueChange={v => v && setMatchTeamA(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Time A" value={matchTeamA} onChange={e => setMatchTeamA(e.target.value)} />
                )}
              </div>
              <div className="space-y-2">
                <Label>Time B</Label>
                {teams.length > 0 ? (
                  <Select value={matchTeamB} onValueChange={v => v && setMatchTeamB(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Time B" value={matchTeamB} onChange={e => setMatchTeamB(e.target.value)} />
                )}
              </div>
            </div>
            {tournament.format === 'playoff' && (
              <div className="space-y-2">
                <Label>Fase do Playoff</Label>
                <Select value={matchPhase} onValueChange={v => setMatchPhase(v || '')}>
                  <SelectTrigger><SelectValue placeholder="Selecione a fase" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLAYOFF_PHASES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea placeholder="Notas sobre o jogo" value={matchNotes} onChange={e => setMatchNotes(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={savingMatch}>
              {savingMatch ? 'Salvando...' : 'Adicionar Jogo'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
