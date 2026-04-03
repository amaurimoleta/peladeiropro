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
import { Plus, Check, Trash2, Pencil, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { MonthNavigator } from '@/components/shared/month-navigator'
import type { GuestPlayer, Match } from '@/lib/types'

export default function GuestsPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [guests, setGuests] = useState<any[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<any>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [matchDate, setMatchDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [matchId, setMatchId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const currentMonth = format(currentDate, 'yyyy-MM')

  async function loadData() {
    setLoading(true)
    const [{ data: guestsData }, { data: matchesData }] = await Promise.all([
      supabase
        .from('guest_players')
        .select('*, match:matches(id, match_date, location)')
        .eq('group_id', groupId)
        .gte('match_date', `${currentMonth}-01`)
        .lte('match_date', `${currentMonth}-31`)
        .order('match_date', { ascending: false }),
      supabase
        .from('matches')
        .select('*')
        .eq('group_id', groupId)
        .gte('match_date', `${currentMonth}-01`)
        .lte('match_date', `${currentMonth}-31`)
        .order('match_date', { ascending: false }),
    ])
    setGuests(guestsData || [])
    setMatches(matchesData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [groupId, currentMonth])

  function resetForm() {
    setName('')
    setPhone('')
    setMatchDate(format(new Date(), 'yyyy-MM-dd'))
    setMatchId('')
    setAmount('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const selectedMatch = matches.find(m => m.id === matchId)
    const { error } = await supabase.from('guest_players').insert({
      group_id: groupId,
      name,
      phone: phone || null,
      match_date: selectedMatch ? selectedMatch.match_date : matchDate,
      match_id: matchId || null,
      amount: parseFloat(amount) || 0,
    })
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Jogador avulso adicionado!')
      setDialogOpen(false)
      resetForm()
      loadData()
    }
    setSaving(false)
  }

  function openEdit(guest: any) {
    setEditingGuest(guest)
    setName(guest.name)
    setPhone(guest.phone || '')
    setMatchDate(guest.match_date)
    setMatchId(guest.match_id || '')
    setAmount(String(guest.amount))
    setEditDialogOpen(true)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingGuest) return
    setSaving(true)
    const selectedMatch = matches.find(m => m.id === matchId)
    const { error } = await supabase.from('guest_players').update({
      name,
      phone: phone || null,
      match_date: selectedMatch ? selectedMatch.match_date : matchDate,
      match_id: matchId || null,
      amount: parseFloat(amount) || 0,
    }).eq('id', editingGuest.id)
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Avulso atualizado!')
      setEditDialogOpen(false)
      setEditingGuest(null)
      resetForm()
      loadData()
    }
    setSaving(false)
  }

  async function markPaid(id: string) {
    await supabase.from('guest_players').update({ paid: true, paid_at: new Date().toISOString() }).eq('id', id)
    toast.success('Pagamento confirmado!')
    loadData()
  }

  async function deleteGuest(id: string) {
    if (!confirm('Remover este jogador avulso?')) return
    await supabase.from('guest_players').delete().eq('id', id)
    toast.success('Removido!')
    loadData()
  }

  const totalPaid = guests.filter(g => g.paid).reduce((s: number, g: any) => s + Number(g.amount), 0)
  const totalPending = guests.filter(g => !g.paid).reduce((s: number, g: any) => s + Number(g.amount), 0)

  const guestForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleEdit : handleAdd} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input placeholder="Nome do jogador" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input placeholder="(99) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {matches.length > 0 && (
        <div className="space-y-2">
          <Label>Jogo (opcional)</Label>
          <Select value={matchId} onValueChange={(v) => v && setMatchId(v)}>
            <SelectTrigger><SelectValue placeholder="Vincular a um jogo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem vinculo</SelectItem>
              {matches.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {format(new Date(m.match_date + 'T12:00:00'), 'dd/MM/yyyy')} {m.location ? `- ${m.location}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {!matchId && (
          <div className="space-y-2">
            <Label>Data da pelada *</Label>
            <Input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
          </div>
        )}
        <div className={`space-y-2 ${matchId ? 'col-span-2' : ''}`}>
          <Label>Valor (R$) *</Label>
          <Input type="number" step="0.01" min="0" placeholder="25.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
        {saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Registrar'}
      </Button>
    </form>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F4B]">Jogadores Avulsos</h1>
          <p className="text-muted-foreground">
            R$ {totalPaid.toFixed(2)} recebido | R$ {totalPending.toFixed(2)} pendente
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm() }}>
          <DialogTrigger render={<Button className="bg-[#00C853] hover:bg-[#00A843] text-white" />}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Avulso
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Jogador Avulso</DialogTitle>
            </DialogHeader>
            {guestForm(false)}
          </DialogContent>
        </Dialog>
      </div>

      <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) { setEditingGuest(null); resetForm() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Jogador Avulso</DialogTitle>
          </DialogHeader>
          {guestForm(true)}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Jogo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : guests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum jogador avulso neste mes.
                  </TableCell>
                </TableRow>
              ) : (
                guests.map((guest: any) => (
                  <TableRow key={guest.id}>
                    <TableCell className="font-medium">{guest.name}</TableCell>
                    <TableCell>{format(new Date(guest.match_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {guest.match ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {guest.match.location || 'Jogo'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>R$ {Number(guest.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      {guest.paid ? (
                        <Badge className="bg-[#00C853]/10 text-[#00C853]"><Check className="h-3 w-3 mr-1" />Pago</Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {!guest.paid && (
                          <Button size="sm" variant="outline" className="text-[#00C853] border-[#00C853]" onClick={() => markPaid(guest.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => openEdit(guest)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteGuest(guest.id)}>
                          <Trash2 className="h-3 w-3" />
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
