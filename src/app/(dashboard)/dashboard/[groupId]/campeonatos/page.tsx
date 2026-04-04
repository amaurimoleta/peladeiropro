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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Trash2, Pencil, Trophy, CalendarDays, ChevronLeft, ChevronRight,
  ListOrdered, GitBranch, Repeat, Shield, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import type { Tournament, Team } from '@/lib/types'
import { TOURNAMENT_STATUSES, TOURNAMENT_FORMATS } from '@/lib/types'

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

export default function CampeonatosPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { isAdmin } = useGroupRole(groupId)

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  // Year filter
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([])

  // Teams
  const [allGroupTeams, setAllGroupTeams] = useState<Team[]>([])
  const [tournamentTeamsMap, setTournamentTeamsMap] = useState<Record<string, string[]>>({})
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false)
  const [teamsDialogTournamentId, setTeamsDialogTournamentId] = useState<string | null>(null)

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
    const all = data || []
    setTournaments(all)

    // Extract available years
    const years = new Set<number>()
    for (const t of all) {
      const dateStr = t.start_date || t.created_at
      if (dateStr) {
        const y = t.start_date ? parseInt(t.start_date.substring(0, 4), 10) : new Date(dateStr).getFullYear()
        years.add(y)
      }
    }
    if (years.size === 0) years.add(new Date().getFullYear())
    setAvailableYears([...years].sort((a, b) => b - a))
    setLoading(false)
  }, [groupId])

  const loadGroupTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').eq('group_id', groupId).order('name')
    setAllGroupTeams(data || [])
  }, [groupId])

  const loadAllTournamentTeams = useCallback(async () => {
    // Load tournament_teams for all tournaments in this group
    const { data } = await supabase
      .from('tournament_teams')
      .select('tournament_id, team_id')
    if (!data) return
    const map: Record<string, string[]> = {}
    for (const row of data) {
      if (!map[row.tournament_id]) map[row.tournament_id] = []
      map[row.tournament_id].push(row.team_id)
    }
    setTournamentTeamsMap(map)
  }, [groupId])

  useEffect(() => { loadTournaments(); loadGroupTeams(); loadAllTournamentTeams() }, [loadTournaments, loadGroupTeams, loadAllTournamentTeams])

  // Filter tournaments by year
  const filteredTournaments = tournaments.filter(t => {
    const dateStr = t.start_date || t.created_at
    if (!dateStr) return true
    const y = t.start_date ? parseInt(t.start_date.substring(0, 4), 10) : new Date(dateStr).getFullYear()
    return y === selectedYear
  })

  // ── Team toggle ──
  async function toggleTeam(tournamentId: string, teamId: string) {
    const current = tournamentTeamsMap[tournamentId] || []
    const isIn = current.includes(teamId)
    if (isIn) {
      const { error } = await supabase.from('tournament_teams').delete().eq('tournament_id', tournamentId).eq('team_id', teamId)
      if (error) { toast.error('Erro ao remover time'); return }
      setTournamentTeamsMap(prev => ({
        ...prev,
        [tournamentId]: current.filter(id => id !== teamId),
      }))
    } else {
      const { error } = await supabase.from('tournament_teams').insert({ tournament_id: tournamentId, team_id: teamId })
      if (error) { toast.error('Erro ao adicionar time'); return }
      setTournamentTeamsMap(prev => ({
        ...prev,
        [tournamentId]: [...current, teamId],
      }))
    }
  }

  // ── CRUD ──
  function resetNewForm() {
    setNewName(''); setNewDescription(''); setNewStartDate(''); setNewEndDate('')
    setNewFormat('league'); setNewPointsWin('3'); setNewPointsDraw('1'); setNewPointsLoss('0')
  }

  async function handleAddTournament(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error, data } = await supabase.from('tournaments').insert({
      group_id: groupId, name: newName, description: newDescription || null,
      start_date: newStartDate || null, end_date: newEndDate || null,
      format: newFormat,
      points_win: parseInt(newPointsWin, 10) || 3,
      points_draw: parseInt(newPointsDraw, 10) || 1,
      points_loss: parseInt(newPointsLoss, 10) || 0,
    }).select('id').single()
    if (error) {
      toast.error('Erro ao criar campeonato', { description: error.message })
    } else {
      toast.success('Campeonato criado!')
      await logAudit(supabase, { groupId, action: 'create_tournament', entityType: 'tournament', entityId: data?.id, details: { name: newName, format: newFormat } })
      setNewDialogOpen(false); resetNewForm(); await loadTournaments()
    }
    setSaving(false)
  }

  function openEdit(tournament: Tournament) {
    setEditingTournament(tournament); setEditName(tournament.name)
    setEditDescription(tournament.description || ''); setEditStartDate(tournament.start_date || '')
    setEditEndDate(tournament.end_date || ''); setEditFormat(tournament.format)
    setEditPointsWin(String(tournament.points_win)); setEditPointsDraw(String(tournament.points_draw))
    setEditPointsLoss(String(tournament.points_loss)); setEditStatus(tournament.status)
    setEditDialogOpen(true)
  }

  async function handleEditTournament(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTournament) return
    setSaving(true)
    const { error } = await supabase.from('tournaments').update({
      name: editName, description: editDescription || null,
      start_date: editStartDate || null, end_date: editEndDate || null,
      format: editFormat,
      points_win: parseInt(editPointsWin, 10) || 3,
      points_draw: parseInt(editPointsDraw, 10) || 1,
      points_loss: parseInt(editPointsLoss, 10) || 0,
      status: editStatus as Tournament['status'],
    }).eq('id', editingTournament.id)
    if (error) {
      toast.error('Erro ao atualizar campeonato', { description: error.message })
    } else {
      toast.success('Campeonato atualizado!')
      await logAudit(supabase, { groupId, action: 'edit_tournament', entityType: 'tournament', entityId: editingTournament.id, details: { name: editName, status: editStatus } })
      setEditDialogOpen(false); setEditingTournament(null); await loadTournaments()
    }
    setSaving(false)
  }

  function confirmDelete(tournamentId: string) {
    setDeletingTournamentId(tournamentId); setDeleteDialogOpen(true)
  }

  async function handleDeleteTournament() {
    if (!deletingTournamentId) return
    const { error } = await supabase.from('tournaments').delete().eq('id', deletingTournamentId)
    if (error) {
      toast.error('Erro ao excluir campeonato', { description: error.message })
    } else {
      toast.success('Campeonato removido!')
      await logAudit(supabase, { groupId, action: 'delete_tournament', entityType: 'tournament', entityId: deletingTournamentId })
      setDeleteDialogOpen(false); setDeletingTournamentId(null); await loadTournaments()
    }
  }

  function fmtDate(dateStr: string | null): string {
    if (!dateStr) return ''
    return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy')
  }

  // ── Format selector ──
  function FormatSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <div className="space-y-2">
        <Label>Formato do Campeonato *</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(TOURNAMENT_FORMATS).map(([key, label]) => {
            const Icon = FORMAT_ICONS[key] || ListOrdered
            const isSelected = value === key
            return (
              <button key={key} type="button" onClick={() => onChange(key)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                  isSelected ? 'border-brand-navy bg-brand-navy/5 text-brand-navy' : 'border-gray-200 text-muted-foreground hover:border-gray-300'
                }`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-left leading-tight">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Campeonatos</h1>
          <p className="text-muted-foreground">
            {filteredTournaments.length} {filteredTournaments.length === 1 ? 'campeonato' : 'campeonatos'} em {selectedYear}
          </p>
        </div>
        {isAdmin && (
          <Button className="bg-[#00C853] hover:bg-[#00A843] text-white" onClick={() => setNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Novo Campeonato
          </Button>
        )}
      </div>

      {/* Year navigator */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1 flex-wrap">
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                selectedYear === year
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {year}
            </button>
          ))}
          {!availableYears.includes(selectedYear) && (
            <button
              className="px-3 py-1 rounded-full text-sm font-medium bg-brand-navy text-white shadow-sm"
            >
              {selectedYear}
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Tournament Cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando campeonatos...</div>
      ) : filteredTournaments.length === 0 ? (
        <Card className="card-modern-elevated">
          <CardContent className="text-center py-12 text-muted-foreground">
            Nenhum campeonato em {selectedYear}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTournaments.map(tournament => {
            const FormatIcon = FORMAT_ICONS[tournament.format] || ListOrdered
            const teamIds = tournamentTeamsMap[tournament.id] || []
            const teamCount = teamIds.length

            return (
              <Card key={tournament.id} className="card-modern-elevated overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Trophy className="h-4 w-4 text-brand-navy shrink-0" />
                          <Link
                            href={`/dashboard/${groupId}/campeonatos/${tournament.id}`}
                            className="font-bold text-lg text-brand-navy hover:underline"
                          >
                            {tournament.name}
                          </Link>
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
                          <p className="text-xs text-muted-foreground">{tournament.description}</p>
                        )}

                        {/* Teams chips */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {teamCount > 0 && (
                            <div className="flex items-center gap-1">
                              {teamIds.slice(0, 6).map(tid => {
                                const team = allGroupTeams.find(t => t.id === tid)
                                return team ? (
                                  <div
                                    key={tid}
                                    className="flex items-center gap-1 bg-muted rounded-full pl-1 pr-2 py-0.5"
                                  >
                                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: team.color }}>
                                      <Shield className="h-2.5 w-2.5 text-white m-[3px]" />
                                    </div>
                                    <span className="text-[11px] font-medium text-brand-navy">{team.name}</span>
                                  </div>
                                ) : null
                              })}
                              {teamCount > 6 && (
                                <span className="text-[11px] text-muted-foreground">+{teamCount - 6}</span>
                              )}
                            </div>
                          )}
                          {teamCount === 0 && (
                            <span className="text-xs text-muted-foreground">Nenhum time vinculado</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Link href={`/dashboard/${groupId}/campeonatos/${tournament.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhes">
                            <Eye className="h-4 w-4 text-brand-navy" />
                          </Button>
                        </Link>
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Gerenciar times"
                              onClick={() => { setTeamsDialogTournamentId(tournament.id); setTeamsDialogOpen(true) }}>
                              <Shield className="h-4 w-4 text-muted-foreground" />
                            </Button>
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
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog: Novo Campeonato */}
      <Dialog open={newDialogOpen} onOpenChange={v => { setNewDialogOpen(v); if (!v) resetNewForm() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Campeonato</DialogTitle></DialogHeader>
          <form onSubmit={handleAddTournament} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Copa Pelada 2026" value={newName} onChange={e => setNewName(e.target.value)} required />
            </div>
            <FormatSelector value={newFormat} onChange={setNewFormat} />
            {newFormat === 'best_of_4' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Melhor de 4 Vitórias:</strong> A série continua até um time alcançar 4 vitórias. Empates adicionam jogos extras.
              </div>
            )}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea placeholder="Descrição do campeonato" value={newDescription} onChange={e => setNewDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data Inicio</Label><Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} /></div>
            </div>
            {newFormat === 'league' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><Label>Pts Vitoria</Label><Input type="number" value={newPointsWin} onChange={e => setNewPointsWin(e.target.value)} min="0" /></div>
                <div className="space-y-2"><Label>Pts Empate</Label><Input type="number" value={newPointsDraw} onChange={e => setNewPointsDraw(e.target.value)} min="0" /></div>
                <div className="space-y-2"><Label>Pts Derrota</Label><Input type="number" value={newPointsLoss} onChange={e => setNewPointsLoss(e.target.value)} min="0" /></div>
              </div>
            )}
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Campeonato'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Campeonato */}
      <Dialog open={editDialogOpen} onOpenChange={v => { setEditDialogOpen(v); if (!v) setEditingTournament(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Campeonato</DialogTitle></DialogHeader>
          <form onSubmit={handleEditTournament} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <FormatSelector value={editFormat} onChange={setEditFormat} />
            {editFormat === 'best_of_4' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Melhor de 4 Vitórias:</strong> A série continua até um time alcançar 4 vitórias. Empates adicionam jogos extras.
              </div>
            )}
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data Inicio</Label><Input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} /></div>
            </div>
            {editFormat === 'league' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><Label>Pts Vitoria</Label><Input type="number" value={editPointsWin} onChange={e => setEditPointsWin(e.target.value)} min="0" /></div>
                <div className="space-y-2"><Label>Pts Empate</Label><Input type="number" value={editPointsDraw} onChange={e => setEditPointsDraw(e.target.value)} min="0" /></div>
                <div className="space-y-2"><Label>Pts Derrota</Label><Input type="number" value={editPointsLoss} onChange={e => setEditPointsLoss(e.target.value)} min="0" /></div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={v => v && setEditStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TOURNAMENT_STATUSES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerenciar Times do Campeonato */}
      <Dialog open={teamsDialogOpen} onOpenChange={v => { setTeamsDialogOpen(v); if (!v) setTeamsDialogTournamentId(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Times do Campeonato</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allGroupTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum time cadastrado no grupo.<br />
                <Link href={`/dashboard/${groupId}/times`} className="text-brand-navy underline text-xs">Ir para página de Times</Link>
              </p>
            ) : teamsDialogTournamentId && (
              allGroupTeams.map(team => {
                const isIn = (tournamentTeamsMap[teamsDialogTournamentId] || []).includes(team.id)
                return (
                  <button
                    key={team.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      isIn ? 'border-brand-navy bg-brand-navy/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleTeam(teamsDialogTournamentId, team.id)}
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

      {/* Dialog: Confirmar Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Tem certeza que deseja excluir este campeonato? Os jogos vinculados não serão removidos, apenas desvinculados.</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteTournament}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
