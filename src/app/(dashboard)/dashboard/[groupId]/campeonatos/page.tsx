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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Plus, Trash2, Pencil, Trophy, ChevronDown, ChevronUp, CalendarDays,
  MapPin, Swords, ListOrdered, GitBranch,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import type { Tournament, Match } from '@/lib/types'
import { TOURNAMENT_STATUSES, TOURNAMENT_FORMATS, PLAYOFF_PHASES } from '@/lib/types'

interface Standing {
  team: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  finished: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
}

const FORMAT_ICONS: Record<string, typeof ListOrdered> = {
  league: ListOrdered,
  playoff: GitBranch,
}

export default function CampeonatosPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { isAdmin } = useGroupRole(groupId)

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null)

  // All matches per tournament (including those without score)
  const [tournamentMatches, setTournamentMatches] = useState<Record<string, Match[]>>({})

  // New tournament dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newFormat, setNewFormat] = useState<string>('league')
  const [newPointsWin, setNewPointsWin] = useState('3')
  const [newPointsDraw, setNewPointsDraw] = useState('1')
  const [newPointsLoss, setNewPointsLoss] = useState('0')
  const [saving, setSaving] = useState(false)

  // Edit tournament dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editFormat, setEditFormat] = useState<string>('league')
  const [editPointsWin, setEditPointsWin] = useState('3')
  const [editPointsDraw, setEditPointsDraw] = useState('1')
  const [editPointsLoss, setEditPointsLoss] = useState('0')
  const [editStatus, setEditStatus] = useState<string>('active')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTournamentId, setDeletingTournamentId] = useState<string | null>(null)

  const loadTournaments = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
    setTournaments(data || [])
    setLoading(false)
  }, [groupId])

  useEffect(() => { loadTournaments() }, [loadTournaments])

  // Load ALL matches for a tournament when expanded
  const loadTournamentMatches = useCallback(async (tournamentId: string) => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('match_date', { ascending: true })
    setTournamentMatches((prev) => ({ ...prev, [tournamentId]: data || [] }))
  }, [groupId])

  useEffect(() => {
    if (expandedTournament) {
      loadTournamentMatches(expandedTournament)
    }
  }, [expandedTournament, loadTournamentMatches])

  // Build standings from matches (only scored ones)
  function buildStandings(tournament: Tournament, matches: Match[]): Standing[] {
    const scoredMatches = matches.filter(m => m.score_a != null && m.score_b != null)
    const teamsMap: Record<string, Standing> = {}

    function ensureTeam(name: string) {
      if (!teamsMap[name]) {
        teamsMap[name] = { team: name, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
      }
    }

    for (const match of scoredMatches) {
      const teamA = match.team_a_name || 'Time A'
      const teamB = match.team_b_name || 'Time B'
      const scoreA = match.score_a!
      const scoreB = match.score_b!

      ensureTeam(teamA)
      ensureTeam(teamB)

      teamsMap[teamA].played++
      teamsMap[teamB].played++
      teamsMap[teamA].goalsFor += scoreA
      teamsMap[teamA].goalsAgainst += scoreB
      teamsMap[teamB].goalsFor += scoreB
      teamsMap[teamB].goalsAgainst += scoreA

      if (scoreA > scoreB) {
        teamsMap[teamA].wins++
        teamsMap[teamA].points += tournament.points_win
        teamsMap[teamB].losses++
        teamsMap[teamB].points += tournament.points_loss
      } else if (scoreA < scoreB) {
        teamsMap[teamB].wins++
        teamsMap[teamB].points += tournament.points_win
        teamsMap[teamA].losses++
        teamsMap[teamA].points += tournament.points_loss
      } else {
        teamsMap[teamA].draws++
        teamsMap[teamA].points += tournament.points_draw
        teamsMap[teamB].draws++
        teamsMap[teamB].points += tournament.points_draw
      }
    }

    const standings = Object.values(teamsMap)
    standings.forEach((s) => { s.goalDifference = s.goalsFor - s.goalsAgainst })
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      return b.goalsFor - a.goalsFor
    })

    return standings
  }

  // Group playoff matches by phase
  function groupByPhase(matches: Match[]): Record<string, Match[]> {
    const groups: Record<string, Match[]> = {}
    const phaseOrder = ['final', 'semi', 'quarter', 'round16', 'group']

    for (const match of matches) {
      const phase = match.tournament_phase || 'group'
      if (!groups[phase]) groups[phase] = []
      groups[phase].push(match)
    }

    // Sort by phase order
    const sorted: Record<string, Match[]> = {}
    for (const phase of phaseOrder) {
      if (groups[phase]) sorted[phase] = groups[phase]
    }
    // Add any remaining phases not in order
    for (const [phase, list] of Object.entries(groups)) {
      if (!sorted[phase]) sorted[phase] = list
    }

    return sorted
  }

  function resetNewForm() {
    setNewName('')
    setNewDescription('')
    setNewStartDate('')
    setNewEndDate('')
    setNewFormat('league')
    setNewPointsWin('3')
    setNewPointsDraw('1')
    setNewPointsLoss('0')
  }

  async function handleAddTournament(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error, data } = await supabase.from('tournaments').insert({
      group_id: groupId,
      name: newName,
      description: newDescription || null,
      start_date: newStartDate || null,
      end_date: newEndDate || null,
      format: newFormat,
      points_win: parseInt(newPointsWin, 10) || 3,
      points_draw: parseInt(newPointsDraw, 10) || 1,
      points_loss: parseInt(newPointsLoss, 10) || 0,
    }).select('id').single()
    if (error) {
      toast.error('Erro ao criar campeonato', { description: error.message })
    } else {
      toast.success('Campeonato criado com sucesso!')
      await logAudit(supabase, { groupId, action: 'create_tournament', entityType: 'tournament', entityId: data?.id, details: { name: newName, format: newFormat } })
      setNewDialogOpen(false)
      resetNewForm()
      await loadTournaments()
    }
    setSaving(false)
  }

  function openEdit(tournament: Tournament) {
    setEditingTournament(tournament)
    setEditName(tournament.name)
    setEditDescription(tournament.description || '')
    setEditStartDate(tournament.start_date || '')
    setEditEndDate(tournament.end_date || '')
    setEditFormat(tournament.format)
    setEditPointsWin(String(tournament.points_win))
    setEditPointsDraw(String(tournament.points_draw))
    setEditPointsLoss(String(tournament.points_loss))
    setEditStatus(tournament.status)
    setEditDialogOpen(true)
  }

  async function handleEditTournament(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTournament) return
    setSaving(true)
    const { error } = await supabase
      .from('tournaments')
      .update({
        name: editName,
        description: editDescription || null,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
        format: editFormat,
        points_win: parseInt(editPointsWin, 10) || 3,
        points_draw: parseInt(editPointsDraw, 10) || 1,
        points_loss: parseInt(editPointsLoss, 10) || 0,
        status: editStatus as Tournament['status'],
      })
      .eq('id', editingTournament.id)
    if (error) {
      toast.error('Erro ao atualizar campeonato', { description: error.message })
    } else {
      toast.success('Campeonato atualizado!')
      await logAudit(supabase, { groupId, action: 'edit_tournament', entityType: 'tournament', entityId: editingTournament.id, details: { name: editName, status: editStatus } })
      setEditDialogOpen(false)
      setEditingTournament(null)
      await loadTournaments()
      if (expandedTournament === editingTournament.id) loadTournamentMatches(editingTournament.id)
    }
    setSaving(false)
  }

  function confirmDelete(tournamentId: string) {
    setDeletingTournamentId(tournamentId)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteTournament() {
    if (!deletingTournamentId) return
    const { error } = await supabase.from('tournaments').delete().eq('id', deletingTournamentId)
    if (error) {
      toast.error('Erro ao excluir campeonato', { description: error.message })
    } else {
      toast.success('Campeonato removido!')
      await logAudit(supabase, { groupId, action: 'delete_tournament', entityType: 'tournament', entityId: deletingTournamentId })
      setDeleteDialogOpen(false)
      setDeletingTournamentId(null)
      await loadTournaments()
    }
  }

  function fmtDate(dateStr: string | null): string {
    if (!dateStr) return ''
    return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy')
  }

  function fmtMatchDate(dateStr: string): string {
    return format(new Date(dateStr + 'T12:00:00'), "dd/MM - EEEE", { locale: ptBR })
  }

  // ── Match card for the tournament ──
  function MatchCard({ match }: { match: Match }) {
    const teamA = match.team_a_name || 'Time A'
    const teamB = match.team_b_name || 'Time B'
    const hasScore = match.score_a != null && match.score_b != null

    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 hover:border-brand-navy/20 transition-colors">
        {/* Date + Location */}
        <div className="w-24 shrink-0 text-center">
          <p className="text-xs font-medium text-brand-navy capitalize">{fmtMatchDate(match.match_date)}</p>
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

        {/* Score */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-sm font-bold text-brand-navy text-right flex-1 truncate">{teamA}</span>
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
          <span className="text-sm font-bold text-brand-navy text-left flex-1 truncate">{teamB}</span>
        </div>
      </div>
    )
  }

  // ── Format selector component for forms ──
  function FormatSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <div className="space-y-2">
        <Label>Formato do Campeonato *</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TOURNAMENT_FORMATS).map(([key, label]) => {
            const Icon = FORMAT_ICONS[key] || ListOrdered
            const isSelected = value === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                  isSelected
                    ? 'border-brand-navy bg-brand-navy/5 text-brand-navy'
                    : 'border-gray-200 text-muted-foreground hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Campeonatos</h1>
          <p className="text-muted-foreground">
            {tournaments.length} {tournaments.length === 1 ? 'campeonato' : 'campeonatos'}
          </p>
        </div>
        {isAdmin && (
          <Button className="bg-[#00C853] hover:bg-[#00A843] text-white" onClick={() => setNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Campeonato
          </Button>
        )}
      </div>

      {/* Tournament Cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando campeonatos...</div>
      ) : tournaments.length === 0 ? (
        <Card className="card-modern-elevated">
          <CardContent className="text-center py-12 text-muted-foreground">
            Nenhum campeonato cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tournaments.map((tournament) => {
            const isExpanded = expandedTournament === tournament.id
            const matches = tournamentMatches[tournament.id] || []
            const scoredMatches = matches.filter(m => m.score_a != null && m.score_b != null)
            const standings = isExpanded ? buildStandings(tournament, matches) : []
            const FormatIcon = FORMAT_ICONS[tournament.format] || ListOrdered

            return (
              <Card key={tournament.id} className="card-modern-elevated overflow-hidden">
                <CardContent className="p-0">
                  {/* Header */}
                  <div className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Trophy className="h-4 w-4 text-brand-navy shrink-0" />
                          <span className="font-bold text-lg text-brand-navy">{tournament.name}</span>
                          <Badge className={STATUS_COLORS[tournament.status]}>
                            {TOURNAMENT_STATUSES[tournament.status]}
                          </Badge>
                          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 gap-1">
                            <FormatIcon className="h-3 w-3" />
                            {TOURNAMENT_FORMATS[tournament.format]}
                          </Badge>
                        </div>

                        {(tournament.start_date || tournament.end_date) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {tournament.start_date ? fmtDate(tournament.start_date) : ''}
                              {tournament.start_date && tournament.end_date ? ' - ' : ''}
                              {tournament.end_date ? fmtDate(tournament.end_date) : ''}
                            </span>
                          </div>
                        )}

                        {tournament.description && (
                          <p className="text-xs text-muted-foreground ml-6">{tournament.description}</p>
                        )}

                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{matches.length} {matches.length === 1 ? 'jogo' : 'jogos'}</span>
                          <span>{scoredMatches.length} com placar</span>
                          {tournament.format === 'league' && (
                            <span className="text-brand-navy">V:{tournament.points_win} E:{tournament.points_draw} D:{tournament.points_loss}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tournament)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => confirmDelete(tournament.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expand button */}
                  <button
                    className="w-full flex items-center justify-center gap-1 py-2 text-sm text-brand-navy hover:bg-muted/50 transition-colors border-t"
                    onClick={() => setExpandedTournament(isExpanded ? null : tournament.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {isExpanded ? 'Ocultar detalhes' : 'Ver classificacao e jogos'}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t">
                      {/* ── RANKING (Pontos Corridos) ── */}
                      {tournament.format === 'league' && (
                        <div className="p-4">
                          <h3 className="text-sm font-bold text-brand-navy mb-3 flex items-center gap-2">
                            <ListOrdered className="h-4 w-4" />
                            Classificacao
                          </h3>
                          {standings.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum jogo com placar registrado.
                            </p>
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
                                    <TableRow key={s.team} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                      <TableCell className="text-center font-bold text-brand-navy">
                                        {idx === 0 ? <span className="flex items-center justify-center gap-1">🏆 1</span> : idx + 1}
                                      </TableCell>
                                      <TableCell className="font-semibold text-brand-navy">{s.team}</TableCell>
                                      <TableCell className="text-center">{s.played}</TableCell>
                                      <TableCell className="text-center text-green-600 font-medium">{s.wins}</TableCell>
                                      <TableCell className="text-center text-amber-600 font-medium">{s.draws}</TableCell>
                                      <TableCell className="text-center text-red-500 font-medium">{s.losses}</TableCell>
                                      <TableCell className="text-center">{s.goalsFor}</TableCell>
                                      <TableCell className="text-center">{s.goalsAgainst}</TableCell>
                                      <TableCell className="text-center font-medium">
                                        {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                                      </TableCell>
                                      <TableCell className="text-center font-extrabold text-brand-navy text-lg">{s.points}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── BRACKET (Playoff) ── */}
                      {tournament.format === 'playoff' && (
                        <div className="p-4">
                          <h3 className="text-sm font-bold text-brand-navy mb-3 flex items-center gap-2">
                            <GitBranch className="h-4 w-4" />
                            Chave do Campeonato
                          </h3>
                          {matches.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum jogo cadastrado neste campeonato.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {Object.entries(groupByPhase(matches)).map(([phase, phaseMatches]) => (
                                <div key={phase}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Swords className="h-3.5 w-3.5 text-violet-600" />
                                    <span className="text-xs font-bold uppercase tracking-wide text-violet-700">
                                      {PLAYOFF_PHASES[phase] || phase}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({phaseMatches.length} {phaseMatches.length === 1 ? 'jogo' : 'jogos'})
                                    </span>
                                  </div>
                                  <div className="space-y-2 ml-5">
                                    {phaseMatches.map((match) => (
                                      <MatchCard key={match.id} match={match} />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <Separator />

                      {/* ── JOGOS DO CAMPEONATO ── */}
                      <div className="p-4">
                        <h3 className="text-sm font-bold text-brand-navy mb-3 flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          Jogos do Campeonato ({matches.length})
                        </h3>
                        {matches.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum jogo vinculado a este campeonato.<br />
                            <span className="text-xs">Vincule jogos ao campeonato na pagina de Jogos.</span>
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {matches.map((match) => (
                              <MatchCard key={match.id} match={match} />
                            ))}
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

      {/* Dialog: Novo Campeonato */}
      <Dialog open={newDialogOpen} onOpenChange={(v) => { setNewDialogOpen(v); if (!v) resetNewForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Campeonato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTournament} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Copa Pelada 2026" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <FormatSelector value={newFormat} onChange={setNewFormat} />
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea placeholder="Descricao do campeonato" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Inicio</Label>
                <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
              </div>
            </div>
            {newFormat === 'league' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Pts Vitoria</Label>
                  <Input type="number" value={newPointsWin} onChange={(e) => setNewPointsWin(e.target.value)} min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Pts Empate</Label>
                  <Input type="number" value={newPointsDraw} onChange={(e) => setNewPointsDraw(e.target.value)} min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Pts Derrota</Label>
                  <Input type="number" value={newPointsLoss} onChange={(e) => setNewPointsLoss(e.target.value)} min="0" />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Campeonato'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Campeonato */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditingTournament(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Campeonato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditTournament} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <FormatSelector value={editFormat} onChange={setEditFormat} />
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Inicio</Label>
                <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
              </div>
            </div>
            {editFormat === 'league' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Pts Vitoria</Label>
                  <Input type="number" value={editPointsWin} onChange={(e) => setEditPointsWin(e.target.value)} min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Pts Empate</Label>
                  <Input type="number" value={editPointsDraw} onChange={(e) => setEditPointsDraw(e.target.value)} min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Pts Derrota</Label>
                  <Input type="number" value={editPointsLoss} onChange={(e) => setEditPointsLoss(e.target.value)} min="0" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TOURNAMENT_STATUSES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            Tem certeza que deseja excluir este campeonato? Os jogos vinculados nao serao removidos, apenas desvinculados.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteTournament}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
