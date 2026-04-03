'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Trash2, Pencil, Shield, Users, X, Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import type { Team, GroupMember } from '@/lib/types'

const TEAM_COLORS = [
  '#1B1F4B', '#00C853', '#EF4444', '#3B82F6', '#F59E0B',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
  '#10B981', '#DC2626',
]

export default function TimesPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { isAdmin } = useGroupRole(groupId)

  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  // Team members per team
  const [teamMembers, setTeamMembers] = useState<Record<string, string[]>>({})

  // New team dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#1B1F4B')
  const [saving, setSaving] = useState(false)

  // Edit team dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#1B1F4B')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)

  const loadTeams = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('group_id', groupId)
      .order('name')
    setTeams(data || [])
    setLoading(false)
  }, [groupId])

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('name')
    setMembers(data || [])
  }, [groupId])

  useEffect(() => { loadTeams(); loadMembers() }, [loadTeams, loadMembers])

  // Load team members when expanded
  const loadTeamMembers = useCallback(async (teamId: string) => {
    const { data } = await supabase
      .from('team_members')
      .select('member_id')
      .eq('team_id', teamId)
    setTeamMembers((prev) => ({
      ...prev,
      [teamId]: (data || []).map((tm) => tm.member_id),
    }))
  }, [])

  useEffect(() => {
    if (expandedTeam) {
      loadTeamMembers(expandedTeam)
    }
  }, [expandedTeam, loadTeamMembers])

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error, data } = await supabase.from('teams').insert({
      group_id: groupId,
      name: newName,
      color: newColor,
    }).select('id').single()
    if (error) {
      toast.error('Erro ao criar time', { description: error.message })
    } else {
      toast.success('Time criado com sucesso!')
      await logAudit(supabase, { groupId, action: 'create_team', entityType: 'team', entityId: data?.id, details: { name: newName } })
      setNewDialogOpen(false)
      setNewName('')
      setNewColor('#1B1F4B')
      await loadTeams()
    }
    setSaving(false)
  }

  function openEdit(team: Team) {
    setEditingTeam(team)
    setEditName(team.name)
    setEditColor(team.color)
    setEditDialogOpen(true)
  }

  async function handleEditTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTeam) return
    setSaving(true)
    const { error } = await supabase
      .from('teams')
      .update({ name: editName, color: editColor })
      .eq('id', editingTeam.id)
    if (error) {
      toast.error('Erro ao atualizar time', { description: error.message })
    } else {
      toast.success('Time atualizado!')
      await logAudit(supabase, { groupId, action: 'edit_team', entityType: 'team', entityId: editingTeam.id, details: { name: editName } })
      setEditDialogOpen(false)
      setEditingTeam(null)
      await loadTeams()
    }
    setSaving(false)
  }

  function confirmDelete(teamId: string) {
    setDeletingTeamId(teamId)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteTeam() {
    if (!deletingTeamId) return
    const { error } = await supabase.from('teams').delete().eq('id', deletingTeamId)
    if (error) {
      toast.error('Erro ao excluir time', { description: error.message })
    } else {
      toast.success('Time removido!')
      await logAudit(supabase, { groupId, action: 'delete_team', entityType: 'team', entityId: deletingTeamId })
      setDeleteDialogOpen(false)
      setDeletingTeamId(null)
      if (expandedTeam === deletingTeamId) setExpandedTeam(null)
      await loadTeams()
    }
  }

  async function toggleMember(teamId: string, memberId: string) {
    const current = teamMembers[teamId] || []
    const isMember = current.includes(memberId)

    if (isMember) {
      // Remove
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('member_id', memberId)
      if (error) {
        toast.error('Erro ao remover jogador', { description: error.message })
        return
      }
      setTeamMembers((prev) => ({
        ...prev,
        [teamId]: current.filter((id) => id !== memberId),
      }))
    } else {
      // Add
      const { error } = await supabase
        .from('team_members')
        .insert({ team_id: teamId, member_id: memberId })
      if (error) {
        toast.error('Erro ao adicionar jogador', { description: error.message })
        return
      }
      setTeamMembers((prev) => ({
        ...prev,
        [teamId]: [...current, memberId],
      }))
    }
  }

  function getMemberName(memberId: string): string {
    return members.find((m) => m.id === memberId)?.name || 'Desconhecido'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Times</h1>
          <p className="text-muted-foreground">
            {teams.length} {teams.length === 1 ? 'time' : 'times'} cadastrados
          </p>
        </div>
        {isAdmin && (
          <Button className="bg-[#00C853] hover:bg-[#00A843] text-white" onClick={() => setNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Time
          </Button>
        )}
      </div>

      {/* Team Cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando times...</div>
      ) : teams.length === 0 ? (
        <Card className="card-modern-elevated">
          <CardContent className="text-center py-12 text-muted-foreground">
            Nenhum time cadastrado. Crie times para organizar campeonatos e jogos.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const isExpanded = expandedTeam === team.id
            const memberIds = teamMembers[team.id] || []
            const memberCount = memberIds.length

            return (
              <Card key={team.id} className="card-modern-elevated overflow-hidden">
                <CardContent className="p-0">
                  {/* Team header with color stripe */}
                  <div
                    className="h-2 w-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: team.color }}
                        >
                          <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-brand-navy">{team.name}</h3>
                          {isExpanded && (
                            <p className="text-xs text-muted-foreground">
                              {memberCount} {memberCount === 1 ? 'jogador' : 'jogadores'}
                            </p>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(team)}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => confirmDelete(team.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      className="w-full flex items-center justify-center gap-1 mt-3 pt-3 border-t text-xs text-brand-navy hover:text-brand-navy/80 transition-colors"
                      onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {isExpanded ? 'Ocultar elenco' : 'Ver elenco'}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {/* Expanded: member list */}
                    {isExpanded && (
                      <div className="mt-3 space-y-1">
                        {/* Current members */}
                        {memberIds.length > 0 && (
                          <div className="space-y-1 mb-3">
                            {memberIds.map((mid) => (
                              <div
                                key={mid}
                                className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: team.color }}
                                  />
                                  <span className="text-sm font-medium text-brand-navy">
                                    {getMemberName(mid)}
                                  </span>
                                </div>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => toggleMember(team.id, mid)}
                                  >
                                    <X className="h-3 w-3 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {memberIds.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            Nenhum jogador neste time.
                          </p>
                        )}

                        {/* Add member section */}
                        {isAdmin && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                              Adicionar Jogador
                            </p>
                            <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg border p-1">
                              {members
                                .filter((m) => !memberIds.includes(m.id))
                                .map((member) => (
                                  <button
                                    key={member.id}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 text-sm text-left transition-colors"
                                    onClick={() => toggleMember(team.id, member.id)}
                                  >
                                    <Plus className="h-3 w-3 text-[#00C853] shrink-0" />
                                    <span className="text-muted-foreground">{member.name}</span>
                                  </button>
                                ))}
                              {members.filter((m) => !memberIds.includes(m.id)).length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  Todos os membros ja estao no time.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog: Novo Time */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Time</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTeam} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Time *</Label>
              <Input
                placeholder="Ex: Estrela FC"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cor do Time</Label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      newColor === color
                        ? 'border-brand-navy scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-10 h-8 p-0.5 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">Ou escolha uma cor personalizada</span>
              </div>
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Time'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Time */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditingTeam(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Time</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditTeam} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Time *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cor do Time</Label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      editColor === color
                        ? 'border-brand-navy scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-10 h-8 p-0.5 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">Ou escolha uma cor personalizada</span>
              </div>
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
            Tem certeza que deseja excluir este time? Os membros nao serao removidos do grupo, apenas desvinculados do time.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteTeam}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
