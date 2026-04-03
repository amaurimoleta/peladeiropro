'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { GuestPlayer } from '@/lib/types'

export default function GuestsPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const [guests, setGuests] = useState<GuestPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [matchDate, setMatchDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadGuests() {
    const { data } = await supabase
      .from('guest_players')
      .select('*')
      .eq('group_id', groupId)
      .order('match_date', { ascending: false })
    setGuests(data || [])
    setLoading(false)
  }

  useEffect(() => { loadGuests() }, [groupId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('guest_players').insert({
      group_id: groupId,
      name,
      phone: phone || null,
      match_date: matchDate,
      amount: parseFloat(amount) || 0,
    })
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Jogador avulso adicionado!')
      setDialogOpen(false)
      setName('')
      setPhone('')
      setAmount('')
      loadGuests()
    }
    setSaving(false)
  }

  async function markPaid(id: string) {
    await supabase.from('guest_players').update({ paid: true, paid_at: new Date().toISOString() }).eq('id', id)
    toast.success('Pagamento confirmado!')
    loadGuests()
  }

  async function deleteGuest(id: string) {
    await supabase.from('guest_players').delete().eq('id', id)
    toast.success('Removido!')
    loadGuests()
  }

  const totalPaid = guests.filter(g => g.paid).reduce((s, g) => s + Number(g.amount), 0)
  const totalPending = guests.filter(g => !g.paid).reduce((s, g) => s + Number(g.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F4B]">Jogadores Avulsos</h1>
          <p className="text-muted-foreground">
            R$ {totalPaid.toFixed(2)} recebido | R$ {totalPending.toFixed(2)} pendente
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#00C853] hover:bg-[#00A843] text-white" />}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Avulso
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Jogador Avulso</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input placeholder="Nome do jogador" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="(99) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data da pelada *</Label>
                  <Input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" min="0" placeholder="25.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
                {saving ? 'Salvando...' : 'Registrar'}
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
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : guests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum jogador avulso registrado.
                  </TableCell>
                </TableRow>
              ) : (
                guests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell className="font-medium">{guest.name}</TableCell>
                    <TableCell>{format(new Date(guest.match_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
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
