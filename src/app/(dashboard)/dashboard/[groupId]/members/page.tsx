'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Phone, UserMinus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { GroupMember, MEMBER_ROLES } from '@/lib/types'

export default function MembersPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const router = useRouter()
  const supabase = createClient()
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('member')
  const [saving, setSaving] = useState(false)

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
    })
    if (error) {
      toast.error('Erro ao adicionar membro', { description: error.message })
    } else {
      toast.success('Membro adicionado!')
      setDialogOpen(false)
      setName('')
      setPhone('')
      setRole('member')
      loadMembers()
    }
    setSaving(false)
  }

  async function toggleStatus(member: GroupMember) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    await supabase.from('group_members').update({ status: newStatus }).eq('id', member.id)
    toast.success(newStatus === 'active' ? 'Membro reativado' : 'Membro desativado')
    loadMembers()
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const inactiveMembers = members.filter(m => m.status === 'inactive')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F4B]">Membros</h1>
          <p className="text-muted-foreground">{activeMembers.length} ativos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
                {saving ? 'Salvando...' : 'Adicionar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum membro ainda. Adicione o primeiro!
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id} className={member.status === 'inactive' ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{member.name}</TableCell>
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
                      <Badge variant={member.role === 'admin' ? 'default' : member.role === 'treasurer' ? 'secondary' : 'outline'}>
                        {MEMBER_ROLES[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}
                        className={member.status === 'active' ? 'bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20' : ''}>
                        {member.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatus(member)}
                        title={member.status === 'active' ? 'Desativar' : 'Reativar'}
                      >
                        {member.status === 'active' ? (
                          <UserMinus className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-[#00C853]" />
                        )}
                      </Button>
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
