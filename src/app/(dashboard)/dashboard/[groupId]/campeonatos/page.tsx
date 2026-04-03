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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Pencil, Trophy, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import type { Tournament, Match } from '@/lib/types'
import { TOURNAMENT_STATUSES } from '@/lib/types'

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

export default function CampeonatosPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { isAdmin } = useGroupRole(groupId)

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null)

  // Matches per tournament (for ranking)
  const [tournamentMatches, setTournamentMatches] = useState<Record<string, Match[]>>({})

  // New tournament dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
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

  // Load matches for a tournament when expanded
  const loadTournamentMatches = useCallback(async (tournamentId: string) => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .not('score_a', 'is', null)
      .not('score_b', 'is', null)
      .order('match_date', { ascending: true })
    setTournamentMatches((prev) => ({ ...prev, [tournamentId]: data || [] }))
  }, [groupId])

  useEffect(() => {
    if (expandedTournament) {
      loadTournamentMatches(expandedTournament)
    }
  }, [expandedTournament, loadTournamentMatches])

  // Build standings from matches
  function buildStandings(tournament: Tournament, matches: Match[]): Standing[] {
    const teamsMap: Record<string, Standing> = {}

    function ensureTeam(name: string) {
      if (!teamsMap[name]) {
        teamsMap[name] = {
          team: name,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        }
      }
    }

    for (const match of matches) {
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
    standings.forEach((s) => {
      s.goalDifference = s.goalsFor - s.goalsAgainst
    })

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      return b.goalsFor - a.goalsFor
    })

    return standings
  }

  function resetNewForm() {
    setNewName('')
    setNewDescription('')
    setNewStartDate('')
    setNewEndDate('')
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
      points_win: parseInt(newPointsWin, 10) || 3,
      points_draw: parseInt(newPointsDraw, 10) || 1,
      points_loss: parseInt(newPointsLoss, 10) || 0,
    }).select('id').single()
    if (error) {
      toast.error('Erro ao criar campeonato', { description: error.message })
    } else {
      toast.success('Campeonato criado com sucesso!')
      await logAudit(supabase, {
        groupId,
        action: 'create_tournament',
        entityType: 'tournament',
        entityId: data?.id,
        details: { name: newName },
      })
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
        points_win: parseInt(editPointsWin, 10) || 3,
        points_draw: parseInt(editPointsDraw, 10) || 1,
        points_loss: parseInt(editPointsLoss, 10) || 0,
        status: editStatus as Tournament['status'],
      })
      .eq('id', editingTournament.id)
    if (error) {
      toast.error('Erro ao atualizar campeonato', { description: error.message })
    } else {
      toast.success('Campeonato atualizado com sucesso!')
      await logAudit(supabase, {
        groupId,
        action: 'edit_tournament',
        entityType: 'tournament',
        entityId: editingTournament.id,
        details: { name: editName, status: editStatus },
      })
      setEditDialogOpen(false)
      setEditingTournament(null)
      await loadTournaments()
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
      toast.success('Campeonato removido com sucesso!')
      await logAudit(supabase, {
        groupId,
        action: 'delete_tournament',
        entityType: 'tournament',
        entityId: deletingTournamentId,
      })
      setDeleteDialogOpen(false)
      setDeletingTournamentId(null)
      await loadTournaments()
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return ''
    return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
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
          <Button
            className="bg-[#00C853] hover:bg-[#00A843] text-white"
            onClick={() => setNewDialogOpen(true)}
          >
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
            const standings = isExpanded ? buildStandings(tournament, matches) : []

            return (
              <Card key={tournament.id} className="card-modern-elevated overflow-hidden">
                <CardContent className="p-0">
                  {/* Header */}
                  <div className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Trophy className="h-4 w-4 text-brand-navy shrink-0" />
                          <span className="font-bold text-lg text-brand-navy">
                            {tournament.name}
                          </span>
                          <Badge className={STATUS_COLORS[tournament.status]}>
                            {TOURNAMENT_STATUSES[tournament.status]}
                          </Badge>
                        </div>

                        {/* Date range */}
                        {(tournament.start_date || tournament.end_date) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {tournament.start_date ? formatDate(tournament.start_date) : ''}
                              {tournament.start_date && tournament.end_date ? ' - ' : ''}
                              {tournament.end_date ? formatDate(tournament.end_date) : ''}
                            </span>
                          </div>
                        )}

                        {/* Description */}
                        {tournament.description && (
                          <p className="text-xs text-muted-foreground ml-6">{tournament.description}</p>
                        )}
                      </div>

                      {/* Action buttons */}
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

                    {/* Points config badge */}
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <span>V: {tournament.points_win}pts</span>
                      <span>E: {tournament.points_draw}pts</span>
                      <span>D: {tournament.points_loss}pts</span>
                    </div>
                  </div>

                  {/* Expand/collapse button */}
                  <button
                    className="w-full flex items-center justify-center gap-1 py-2 text-sm text-brand-navy hover:bg-muted/50 transition-colors border-t"
                    onClick={() => setExpandedTournament(isExpanded ? null : tournament.id)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Ocultar classificacao
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Ver classificacao
                      </>
                    )}
                  </button>

                  {/* Ranking Table */}
                  {isExpanded && (
                    <div className="border-t p-4">
                      {matches.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum jogo com placar registrado neste campeonato.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-[#1B1F4B]">
                                <TableHead className="text-white font-semibold text-center w-12">Pos</TableHead>
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
                                <TableRow
                                  key={s.team}
                                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                >
                                  <TableCell className="text-center font-bold text-brand-navy">
                                    {idx === 0 ? (
                                      <span className="flex items-center justify-center gap-1">
                                        <span role="img" aria-label="trophy">🏆</span> 1
                                      </span>
                                    ) : (
                                      idx + 1
                                    )}
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
                                  <TableCell className="text-center font-extrabold text-brand-navy text-lg">
                                    {s.points}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
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
              <Input placeholder="Ex: Copa Pelada 2026" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea placeholder="Descricao do campeonato" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
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
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            Tem certeza que deseja excluir este campeonato? Esta acao nao pode ser desfeita.
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
