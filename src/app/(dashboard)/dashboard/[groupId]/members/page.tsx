'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Plus, Phone, UserMinus, UserCheck, Pencil, Trash2, History,
  Check, Clock, AlertCircle, Link2, Eye, Shield, MapPin, Users,
  Filter, ArrowUpDown, X, SlidersHorizontal, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { ImageUpload } from '@/components/shared/image-upload'
import { GroupMember, Team, MEMBER_ROLES, MEMBER_TYPES, FEE_STATUSES, PLAYER_POSITIONS } from '@/lib/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'

interface MonthlyFeeRecord {
  id: string
  reference_month: string
  amount: number
  status: string
  paid_at: string | null
}

interface AttendanceStats {
  totalMatches: number
  attended: number
  percentage: number
}

export default function MembersPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { isAdmin, isReadOnly, loading: roleLoading } = useGroupRole(groupId)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)

  // Search, filter & sort state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterPosition, setFilterPosition] = useState('')
  const [filterType, setFilterType] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'position' | 'team' | 'type' | 'joined'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showFilters, setShowFilters] = useState(false)

  // Group info for public link
  const [publicSlug, setPublicSlug] = useState<string | null>(null)

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('member')
  const [memberType, setMemberType] = useState('mensalista')
  const [position, setPosition] = useState('')
  const [teamId, setTeamId] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editMember, setEditMember] = useState<GroupMember | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState('member')
  const [editMemberType, setEditMemberType] = useState('mensalista')
  const [editPosition, setEditPosition] = useState('')
  const [editTeamId, setEditTeamId] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')

  // History dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyMember, setHistoryMember] = useState<GroupMember | null>(null)
  const [feeHistory, setFeeHistory] = useState<MonthlyFeeRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null)

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('name')
    setMembers(data || [])
    setLoading(false)
  }, [groupId])

  const loadTeams = useCallback(async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('group_id', groupId)
      .order('name')
    setTeams(data || [])
  }, [groupId])

  async function loadGroupInfo() {
    const { data } = await supabase
      .from('groups')
      .select('public_slug')
      .eq('id', groupId)
      .single()
    setPublicSlug(data?.public_slug || null)
  }

  useEffect(() => {
    loadMembers()
    loadTeams()
    loadGroupInfo()
  }, [loadMembers, loadTeams])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: inserted, error } = await supabase.from('group_members').insert({
      group_id: groupId,
      name,
      phone: phone || null,
      role,
      member_type: memberType,
      position: position || null,
      team_id: teamId || null,
      avatar_url: avatarUrl || null,
    }).select().single()
    if (error) {
      toast.error('Erro ao adicionar membro', { description: error.message })
    } else {
      toast.success('Membro adicionado!')
      await logAudit(supabase, {
        groupId,
        action: 'add_member',
        entityType: 'group_member',
        entityId: inserted?.id,
        details: { name, role, member_type: memberType, position: position || null },
      })
      setAddDialogOpen(false)
      resetAddForm()
      loadMembers()
    }
    setSaving(false)
  }

  function resetAddForm() {
    setName('')
    setPhone('')
    setRole('member')
    setMemberType('mensalista')
    setPosition('')
    setTeamId('')
    setAvatarUrl('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editMember) return
    setSaving(true)
    const { error } = await supabase
      .from('group_members')
      .update({
        name: editName,
        phone: editPhone || null,
        role: editRole,
        member_type: editMemberType,
        position: editPosition || null,
        team_id: editTeamId || null,
        avatar_url: editAvatarUrl || null,
      })
      .eq('id', editMember.id)
    if (error) {
      toast.error('Erro ao editar membro', { description: error.message })
    } else {
      toast.success('Membro atualizado!')
      await logAudit(supabase, {
        groupId,
        action: 'edit_member',
        entityType: 'group_member',
        entityId: editMember.id,
        details: { name: editName, role: editRole, member_type: editMemberType, position: editPosition || null },
      })
      setEditDialogOpen(false)
      setEditMember(null)
      loadMembers()
    }
    setSaving(false)
  }

  function openEditDialog(member: GroupMember) {
    setEditMember(member)
    setEditName(member.name)
    setEditPhone(member.phone || '')
    setEditRole(member.role)
    setEditMemberType(member.member_type)
    setEditPosition(member.position || '')
    setEditTeamId(member.team_id || '')
    setEditAvatarUrl(member.avatar_url || '')
    setEditDialogOpen(true)
  }

  async function toggleStatus(member: GroupMember) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    await supabase.from('group_members').update({ status: newStatus }).eq('id', member.id)
    toast.success(newStatus === 'active' ? 'Membro reativado' : 'Membro desativado')
    await logAudit(supabase, {
      groupId,
      action: 'toggle_member_status',
      entityType: 'group_member',
      entityId: member.id,
      details: { name: member.name, old_status: member.status, new_status: newStatus },
    })
    loadMembers()
  }

  async function handleDelete(member: GroupMember) {
    if (!confirm(`Tem certeza que deseja excluir ${member.name}? Esta acao nao pode ser desfeita.`)) return
    const { error } = await supabase.from('group_members').delete().eq('id', member.id)
    if (error) {
      toast.error('Erro ao excluir membro', { description: error.message })
    } else {
      toast.success('Membro excluido!')
      await logAudit(supabase, {
        groupId,
        action: 'delete_member',
        entityType: 'group_member',
        entityId: member.id,
        details: { name: member.name },
      })
      loadMembers()
    }
  }

  async function openHistoryDialog(member: GroupMember) {
    setHistoryMember(member)
    setHistoryDialogOpen(true)
    setHistoryLoading(true)
    setAttendanceStats(null)

    const { data: fees } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('member_id', member.id)
      .order('reference_month', { ascending: false })
    setFeeHistory(fees || [])

    const { data: attendance } = await supabase
      .from('match_attendance')
      .select('present')
      .eq('member_id', member.id)

    if (attendance && attendance.length > 0) {
      const totalMatches = attendance.length
      const attended = attendance.filter((a) => a.present).length
      setAttendanceStats({
        totalMatches,
        attended,
        percentage: Math.round((attended / totalMatches) * 100),
      })
    } else {
      setAttendanceStats({ totalMatches: 0, attended: 0, percentage: 0 })
    }

    setHistoryLoading(false)
  }

  function feeStatusIcon(status: string) {
    switch (status) {
      case 'paid': return <Check className="h-3 w-3" />
      case 'pending': return <Clock className="h-3 w-3" />
      case 'overdue': return <AlertCircle className="h-3 w-3" />
      default: return null
    }
  }

  function feeStatusColor(status: string) {
    switch (status) {
      case 'paid': return 'bg-[#00C853]/10 text-[#00C853]'
      case 'pending': return 'bg-yellow-100 text-yellow-700'
      case 'overdue': return 'bg-red-100 text-red-700'
      case 'waived': return 'bg-gray-100 text-gray-600'
      case 'dm_leave': return 'bg-blue-100 text-blue-700'
      default: return ''
    }
  }

  function formatPhone(phone: string): string {
    return phone.replace(/\D/g, '')
  }

  function getTeamById(id: string | null): Team | undefined {
    if (!id) return undefined
    return teams.find(t => t.id === id)
  }

  function copyPublicLink() {
    if (!publicSlug) return
    const url = `${window.location.origin}/p/${publicSlug}`
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const inactiveMembers = members.filter(m => m.status === 'inactive')

  const hasActiveFilters = searchTerm.trim() !== '' || filterTeam !== '' || filterPosition !== '' || filterType !== ''
  const activeFilterCount = [filterTeam, filterPosition, filterType].filter(Boolean).length

  function clearAllFilters() {
    setSearchTerm('')
    setFilterTeam('')
    setFilterPosition('')
    setFilterType('')
  }

  // Apply search, filters then sort
  const displayMembers = (() => {
    let list = showInactive ? members : activeMembers

    // Text search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter(m => {
        const name = m.name.toLowerCase()
        const phone = (m.phone || '').toLowerCase()
        const position = (m.position ? PLAYER_POSITIONS[m.position] || m.position : '').toLowerCase()
        const teamName = (getTeamById(m.team_id)?.name || '').toLowerCase()
        const role = (MEMBER_ROLES[m.role] || m.role).toLowerCase()
        return name.includes(term) || phone.includes(term) || position.includes(term) || teamName.includes(term) || role.includes(term)
      })
    }

    // Filters
    if (filterTeam) {
      list = filterTeam === '_none'
        ? list.filter(m => !m.team_id)
        : list.filter(m => m.team_id === filterTeam)
    }
    if (filterPosition) {
      list = filterPosition === '_none'
        ? list.filter(m => !m.position)
        : list.filter(m => m.position === filterPosition)
    }
    if (filterType) {
      list = list.filter(m => m.member_type === filterType)
    }

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * dir
        case 'position': {
          const pa = a.position || 'zzz'
          const pb = b.position || 'zzz'
          return pa.localeCompare(pb) * dir
        }
        case 'team': {
          const ta = getTeamById(a.team_id)?.name || 'zzz'
          const tb = getTeamById(b.team_id)?.name || 'zzz'
          return ta.localeCompare(tb) * dir
        }
        case 'type':
          return a.member_type.localeCompare(b.member_type) * dir
        case 'joined':
          return (new Date(a.joined_at || a.created_at).getTime() - new Date(b.joined_at || b.created_at).getTime()) * dir
        default:
          return 0
      }
    })

    return list
  })()

  // Position field component reused in add/edit dialogs
  function PositionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <Select value={value} onValueChange={(v) => onChange(v || '')}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a posicao" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none_clear">Sem posicao</SelectItem>
          {Object.entries(PLAYER_POSITIONS).map(([key, label]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <Select value={value} onValueChange={(v) => onChange(v || '')}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o time" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none_clear">Sem time</SelectItem>
          {teams.map(t => (
            <SelectItem key={t.id} value={t.id}>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // WhatsApp SVG icon
  function WhatsAppIcon() {
    return (
      <svg className="h-3.5 w-3.5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    )
  }

  return (
    <div>
      {/* Invite Link Section - visible only for admins */}
      {isAdmin && publicSlug && (
        <Card className="mb-6 border-dashed border-[#1B1F4B]/20">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex-shrink-0 rounded-full bg-[#1B1F4B]/5 p-2">
              <Link2 className="h-5 w-5 text-[#1B1F4B]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1B1F4B]">Link publico do grupo</p>
              <p className="text-xs text-muted-foreground">
                Compartilhe o link publico do grupo para que membros possam ver a prestacao de contas
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={copyPublicLink} className="flex-shrink-0">
              <Link2 className="h-4 w-4 mr-2" />
              Copiar link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1B1F4B]">Membros</h1>
            <p className="text-muted-foreground text-sm">
              {activeMembers.length} ativos{inactiveMembers.length > 0 ? ` | ${inactiveMembers.length} inativos` : ''}
            </p>
          </div>
          {isReadOnly && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              <Eye className="h-3 w-3 mr-1" />
              Somente leitura
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {inactiveMembers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
              className="text-xs"
            >
              {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
            </Button>
          )}
          {isAdmin && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger render={<Button className="bg-[#00C853] hover:bg-[#00A843] text-white" />}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Membro</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="flex justify-center">
                    <ImageUpload
                      currentUrl={avatarUrl || null}
                      onUpload={(url) => setAvatarUrl(url)}
                      bucket="uploads"
                      folder="member-avatars"
                      size="sm"
                      shape="circle"
                      label="Foto"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input placeholder="Nome do jogador" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input placeholder="(99) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Posicao</Label>
                      <PositionSelect value={position} onChange={setPosition} />
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <TeamSelect value={teamId} onChange={setTeamId} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Papel</Label>
                      <Select value={role} onValueChange={(v) => v && setRole(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="treasurer">Tesoureiro</SelectItem>
                          <SelectItem value="admin">Presidente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={memberType} onValueChange={(v) => v && setMemberType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensalista">Mensalista</SelectItem>
                          <SelectItem value="avulso">Avulso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
                    {saving ? 'Salvando...' : 'Adicionar'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="flex justify-center">
              <ImageUpload
                currentUrl={editAvatarUrl || null}
                onUpload={(url) => setEditAvatarUrl(url)}
                bucket="uploads"
                folder="member-avatars"
                size="sm"
                shape="circle"
                label="Foto"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Nome do jogador" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(99) 99999-9999" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Posicao</Label>
                <PositionSelect value={editPosition} onChange={setEditPosition} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <TeamSelect value={editTeamId} onChange={setEditTeamId} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={editRole} onValueChange={(v) => v && setEditRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="treasurer">Tesoureiro</SelectItem>
                    <SelectItem value="admin">Presidente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={editMemberType} onValueChange={(v) => v && setEditMemberType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensalista">Mensalista</SelectItem>
                    <SelectItem value="avulso">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Historico - {historyMember?.name}
              </span>
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : (
            <div className="space-y-4">
              {attendanceStats && (
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-sm font-medium text-[#1B1F4B] mb-2">Presenca em Peladas</p>
                  {attendanceStats.totalMatches === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum registro de presenca.</p>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#1B1F4B]">{attendanceStats.attended}</p>
                        <p className="text-xs text-muted-foreground">Presencas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#1B1F4B]">{attendanceStats.totalMatches}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#00C853]">{attendanceStats.percentage}%</p>
                        <p className="text-xs text-muted-foreground">Frequencia</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {feeHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma mensalidade encontrada.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mes</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Pgto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feeHistory.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="capitalize">
                            {format(new Date(fee.reference_month + '-01T12:00:00'), 'MMMM yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>R$ {fee.amount.toFixed(2).replace('.', ',')}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={feeStatusColor(fee.status)}>
                              {feeStatusIcon(fee.status)}
                              <span className="ml-1">{FEE_STATUSES[fee.status] || fee.status}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {fee.paid_at ? format(new Date(fee.paid_at), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Search, Filters & Sort Bar */}
      {!loading && members.length > 0 && (
        <div className="mb-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, posicao, time..."
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

          {/* Filter toggle + Sort */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`text-xs gap-1.5 ${hasActiveFilters ? 'border-[#1B1F4B] text-[#1B1F4B]' : ''}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="h-4 min-w-4 rounded-full bg-[#1B1F4B] text-white text-[10px] flex items-center justify-center px-1">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <div className="flex items-center gap-1.5">
              <Select value={sortBy} onValueChange={(v) => v && setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <ArrowUpDown className="h-3 w-3 mr-1 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="position">Posicao</SelectItem>
                  <SelectItem value="team">Time</SelectItem>
                  <SelectItem value="type">Tipo</SelectItem>
                  <SelectItem value="joined">Data entrada</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
              >
                <ArrowUpDown className={`h-3.5 w-3.5 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Filter selectors */}
          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-1 min-w-[140px] flex-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Time</label>
                <Select value={filterTeam} onValueChange={(v) => setFilterTeam(v === 'all_clear' ? '' : (v || ''))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_clear">Todos</SelectItem>
                    <SelectItem value="_none">Sem time</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-[140px] flex-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Posicao</label>
                <Select value={filterPosition} onValueChange={(v) => setFilterPosition(v === 'all_clear' ? '' : (v || ''))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_clear">Todas</SelectItem>
                    <SelectItem value="_none">Sem posicao</SelectItem>
                    {Object.entries(PLAYER_POSITIONS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-[140px] flex-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tipo</label>
                <Select value={filterType} onValueChange={(v) => setFilterType(v === 'all_clear' ? '' : (v || ''))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_clear">Todos</SelectItem>
                    <SelectItem value="mensalista">Mensalista</SelectItem>
                    <SelectItem value="avulso">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                >
                  <X className="h-3 w-3" />
                  Limpar
                </Button>
              )}
            </div>
          )}

          {/* Active filters summary + result count */}
          {(hasActiveFilters || displayMembers.length !== (showInactive ? members : activeMembers).length) && (
            <p className="text-xs text-muted-foreground">
              Exibindo {displayMembers.length} de {showInactive ? members.length : activeMembers.length} membros
            </p>
          )}
        </div>
      )}

      {/* Members Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : displayMembers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            {hasActiveFilters ? (
              <>
                <p className="font-medium">Nenhum membro encontrado</p>
                <p className="text-sm mt-1">Tente alterar os filtros</p>
                <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-3">
                  <X className="h-3 w-3 mr-1" />
                  Limpar filtros
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium">Nenhum membro ainda</p>
                <p className="text-sm">Adicione o primeiro membro ao grupo!</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayMembers.map((member) => {
            const memberTeam = getTeamById(member.team_id)
            const isInactive = member.status === 'inactive'

            return (
              <Card
                key={member.id}
                className={`relative overflow-hidden transition-all hover:shadow-md ${isInactive ? 'opacity-60' : ''}`}
              >
                {/* Team color stripe */}
                {memberTeam && (
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: memberTeam.color }} />
                )}

                <CardContent className="p-4">
                  {/* Top row: avatar + name + actions */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.name}
                          className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-[#1B1F4B]/10 flex items-center justify-center text-lg font-bold text-[#1B1F4B] border-2 border-white shadow-sm">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Name + position */}
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#1B1F4B] hover:text-[#1B1F4B]/70 truncate block text-left cursor-pointer"
                        onClick={() => openHistoryDialog(member)}
                        title="Ver historico"
                      >
                        {member.name}
                      </button>
                      {member.position && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {PLAYER_POSITIONS[member.position] || member.position}
                        </p>
                      )}
                      {/* Role badge for admins/treasurers */}
                      {member.role !== 'member' && (
                        <Badge
                          variant={member.role === 'admin' ? 'default' : 'secondary'}
                          className="mt-1 text-[10px] px-1.5 py-0"
                        >
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                          {MEMBER_ROLES[member.role]}
                        </Badge>
                      )}
                    </div>

                    {/* Status indicator */}
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1 ${isInactive ? 'bg-gray-300' : 'bg-[#00C853]'}`} title={isInactive ? 'Inativo' : 'Ativo'} />
                  </div>

                  {/* Info badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {/* Team */}
                    {memberTeam && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        <span className="h-2 w-2 rounded-full mr-1 inline-block" style={{ backgroundColor: memberTeam.color }} />
                        {memberTeam.name}
                      </Badge>
                    )}
                    {/* Type */}
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${
                        member.member_type === 'mensalista'
                          ? 'bg-[#00C853]/10 text-[#00C853]'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {MEMBER_TYPES[member.member_type]}
                    </Badge>
                  </div>

                  {/* Phone + WhatsApp */}
                  {member.phone && (
                    <div className="flex items-center gap-1.5 mt-2.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{member.phone}</span>
                      <a
                        href={`https://wa.me/55${formatPhone(member.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir WhatsApp"
                        className="inline-flex items-center justify-center rounded-full hover:bg-green-100 p-0.5 transition-colors"
                      >
                        <WhatsAppIcon />
                      </a>
                    </div>
                  )}

                  {/* Action buttons (admin only) */}
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-1 mt-3 pt-2.5 border-t">
                      <Button variant="ghost" size="icon-sm" onClick={() => openHistoryDialog(member)} title="Historico">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(member)} title="Editar">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => toggleStatus(member)} title={isInactive ? 'Reativar' : 'Desativar'}>
                        {isInactive ? (
                          <UserCheck className="h-3.5 w-3.5 text-[#00C853]" />
                        ) : (
                          <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(member)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
