'use client'

import { useEffect, useState } from 'react'
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
import { Plus, Phone, UserMinus, UserCheck, Pencil, Trash2, History, Check, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { GroupMember, MEMBER_ROLES, MEMBER_TYPES, FEE_STATUSES } from '@/lib/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface MonthlyFeeRecord {
  id: string
  reference_month: string
  amount: number
  status: string
  paid_at: string | null
}

export default function MembersPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('member')
  const [memberType, setMemberType] = useState('mensalista')
  const [saving, setSaving] = useState(false)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editMember, setEditMember] = useState<GroupMember | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState('member')
  const [editMemberType, setEditMemberType] = useState('mensalista')

  // History dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyMember, setHistoryMember] = useState<GroupMember | null>(null)
  const [feeHistory, setFeeHistory] = useState<MonthlyFeeRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  async function loadMembers() {
    const { data } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('name')
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => { loadMembers() }, [groupId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      name,
      phone: phone || null,
      role,
      member_type: memberType,
    })
    if (error) {
      toast.error('Erro ao adicionar membro', { description: error.message })
    } else {
      toast.success('Membro adicionado!')
      setAddDialogOpen(false)
      setName('')
      setPhone('')
      setRole('member')
      setMemberType('mensalista')
      loadMembers()
    }
    setSaving(false)
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
      })
      .eq('id', editMember.id)
    if (error) {
      toast.error('Erro ao editar membro', { description: error.message })
    } else {
      toast.success('Membro atualizado!')
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
    setEditDialogOpen(true)
  }

  async function toggleStatus(member: GroupMember) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    await supabase.from('group_members').update({ status: newStatus }).eq('id', member.id)
    toast.success(newStatus === 'active' ? 'Membro reativado' : 'Membro desativado')
    loadMembers()
  }

  async function handleDelete(member: GroupMember) {
    if (!confirm(`Tem certeza que deseja excluir ${member.name}? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('group_members').delete().eq('id', member.id)
    if (error) {
      toast.error('Erro ao excluir membro', { description: error.message })
    } else {
      toast.success('Membro excluído!')
      loadMembers()
    }
  }

  async function openHistoryDialog(member: GroupMember) {
    setHistoryMember(member)
    setHistoryDialogOpen(true)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('member_id', member.id)
      .order('reference_month', { ascending: false })
    setFeeHistory(data || [])
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

  const activeMembers = members.filter(m => m.status === 'active')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F4B]">Membros</h1>
          <p className="text-muted-foreground">{activeMembers.length} ativos</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#00C853] hover:bg-[#00A843] text-white" />}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Membro
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Membro</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome do jogador"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(99) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="treasurer">Tesoureiro</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={memberType} onValueChange={(v) => v && setMemberType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensalista">Mensalista</SelectItem>
                    <SelectItem value="avulso">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
                {saving ? 'Salvando...' : 'Adicionar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome do jogador"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(99) 99999-9999"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={editRole} onValueChange={(v) => v && setEditRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="treasurer">Tesoureiro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={editMemberType} onValueChange={(v) => v && setEditMemberType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensalista">Mensalista</SelectItem>
                  <SelectItem value="avulso">Avulso</SelectItem>
                </SelectContent>
              </Select>
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
                Histórico - {historyMember?.name}
              </span>
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : feeHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhuma mensalidade encontrada.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Pgto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeHistory.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell className="capitalize">
                        {format(new Date(fee.reference_month + '-01'), 'MMMM yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        R$ {fee.amount.toFixed(2).replace('.', ',')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={feeStatusColor(fee.status)}
                        >
                          {feeStatusIcon(fee.status)}
                          <span className="ml-1">{FEE_STATUSES[fee.status] || fee.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {fee.paid_at
                          ? format(new Date(fee.paid_at), 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum membro ainda. Adicione o primeiro!
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id} className={member.status === 'inactive' ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="underline cursor-pointer text-[#1B1F4B] hover:text-[#1B1F4B]/70"
                        onClick={() => openHistoryDialog(member)}
                      >
                        {member.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      {member.phone ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {member.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          member.member_type === 'mensalista'
                            ? 'bg-[#00C853]/10 text-[#00C853]'
                            : 'bg-blue-100 text-blue-700'
                        }
                      >
                        {MEMBER_TYPES[member.member_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'admin' ? 'default' : member.role === 'treasurer' ? 'secondary' : 'outline'}>
                        {MEMBER_ROLES[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.status === 'active' ? 'default' : 'secondary'}
                        className={member.status === 'active' ? 'bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20' : ''}
                      >
                        {member.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(member)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleStatus(member)}
                          title={member.status === 'active' ? 'Desativar' : 'Reativar'}
                        >
                          {member.status === 'active' ? (
                            <UserMinus className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-[#00C853]" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(member)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
