'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Trash2, Pencil, MapPin, CalendarDays, Users, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { MonthNavigator } from '@/components/shared/month-navigator'
import type { Match, GuestPlayer } from '@/lib/types'

export default function MatchesPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)

  // New match dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newMatchDate, setNewMatchDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [newLocation, setNewLocation] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit match dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [editMatchDate, setEditMatchDate] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Add guest dialog
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [guestMatchId, setGuestMatchId] = useState<string | null>(null)
  const [guestMatchDate, setGuestMatchDate] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestAmount, setGuestAmount] = useState('')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null)

  const currentMonth = format(currentDate, 'yyyy-MM')

  async function loadMatches() {
    setLoading(true)
    const { data } = await supabase
      .from('matches')
      .select('*, guest_players(*)')
      .eq('group_id', groupId)
      .gte('match_date', `${currentMonth}-01`)
      .lte('match_date', `${currentMonth}-31`)
      .order('match_date', { ascending: false })
    setMatches(data || [])
    setLoading(false)
  }

  useEffect(() => { loadMatches() }, [groupId, currentMonth])

  async function handleAddMatch(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('matches').insert({
      group_id: groupId,
      match_date: newMatchDate,
      location: newLocation || null,
      notes: newNotes || null,
    })
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Jogo criado!')
      setNewDialogOpen(false)
      setNewMatchDate(format(new Date(), 'yyyy-MM-dd'))
      setNewLocation('')
      setNewNotes('')
      loadMatches()
    }
    setSaving(false)
  }

  function openEdit(match: Match) {
    setEditingMatch(match)
    setEditMatchDate(match.match_date)
    setEditLocation(match.location || '')
    setEditNotes(match.notes || '')
    setEditDialogOpen(true)
  }

  async function handleEditMatch(e: React.FormEvent) {
    e.preventDefault()
    if (!editingMatch) return
    setSaving(true)
    const { error } = await supabase
      .from('matches')
      .update({
        match_date: editMatchDate,
        location: editLocation || null,
        notes: editNotes || null,
      })
      .eq('id', editingMatch.id)
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Jogo atualizado!')
      setEditDialogOpen(false)
      setEditingMatch(null)
      loadMatches()
    }
    setSaving(false)
  }

  function confirmDelete(matchId: string) {
    setDeletingMatchId(matchId)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteMatch() {
    if (!deletingMatchId) return
    const { error } = await supabase.from('matches').delete().eq('id', deletingMatchId)
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Jogo removido!')
      setDeleteDialogOpen(false)
      setDeletingMatchId(null)
      loadMatches()
    }
  }

  function openGuestDialog(matchId: string, matchDate: string) {
    setGuestMatchId(matchId)
    setGuestMatchDate(matchDate)
    setGuestName('')
    setGuestPhone('')
    setGuestAmount('')
    setGuestDialogOpen(true)
  }

  async function handleAddGuest(e: React.FormEvent) {
    e.preventDefault()
    if (!guestMatchId) return
    setSaving(true)
    const { error } = await supabase.from('guest_players').insert({
      group_id: groupId,
      match_id: guestMatchId,
      name: guestName,
      phone: guestPhone || null,
      match_date: guestMatchDate,
      amount: parseFloat(guestAmount) || 0,
    })
    if (error) {
      toast.error('Erro', { description: error.message })
    } else {
      toast.success('Jogador avulso adicionado!')
      setGuestDialogOpen(false)
      loadMatches()
    }
    setSaving(false)
  }

  async function markGuestPaid(guestId: string) {
    await supabase
      .from('guest_players')
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq('id', guestId)
    toast.success('Pagamento confirmado!')
    loadMatches()
  }

  async function deleteGuest(guestId: string) {
    await supabase.from('guest_players').delete().eq('id', guestId)
    toast.success('Avulso removido!')
    loadMatches()
  }

  // Summary
  const totalMatches = matches.length
  const allGuests = matches.flatMap((m) => m.guest_players || [])
  const totalGuests = allGuests.length
  const totalCollected = allGuests.filter((g) => g.paid).reduce((s, g) => s + Number(g.amount), 0)
  const totalPending = allGuests.filter((g) => !g.paid).reduce((s, g) => s + Number(g.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F4B]">Jogos</h1>
          <p className="text-muted-foreground">
            {totalMatches} {totalMatches === 1 ? 'jogo' : 'jogos'} | {totalGuests} {totalGuests === 1 ? 'avulso' : 'avulsos'}
          </p>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#00C853] hover:bg-[#00A843] text-white" />}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Jogo
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Jogo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMatch} className="space-y-4">
              <div className="space-y-2">
                <Label>Data do jogo *</Label>
                <Input type="date" value={newMatchDate} onChange={(e) => setNewMatchDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Input placeholder="Ex: Quadra Society ABC" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea placeholder="Notas sobre o jogo" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              </div>
              <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
                {saving ? 'Salvando...' : 'Criar Jogo'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="card-modern-elevated">
          <CardContent className="p-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto mb-1 text-[#1B1F4B]" />
            <p className="text-2xl font-bold text-[#1B1F4B]">{totalMatches}</p>
            <p className="text-xs text-muted-foreground">Jogos</p>
          </CardContent>
        </Card>
        <Card className="card-modern-elevated">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-[#1B1F4B]" />
            <p className="text-2xl font-bold text-[#1B1F4B]">{totalGuests}</p>
            <p className="text-xs text-muted-foreground">Avulsos</p>
          </CardContent>
        </Card>
        <Card className="card-modern-elevated">
          <CardContent className="p-4 text-center">
            <Check className="h-5 w-5 mx-auto mb-1 text-[#00C853]" />
            <p className="text-2xl font-bold text-[#00C853]">R$ {totalCollected.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Recebido</p>
            {totalPending > 0 && (
              <p className="text-xs text-orange-500 mt-1">R$ {totalPending.toFixed(2)} pendente</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Matches list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : matches.length === 0 ? (
        <Card className="card-modern-elevated">
          <CardContent className="text-center py-12 text-muted-foreground">
            Nenhum jogo neste mês.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => {
            const guests = match.guest_players || []
            const isExpanded = expandedMatch === match.id

            return (
              <Card key={match.id} className="card-modern-elevated overflow-hidden">
                <CardContent className="p-0">
                  {/* Match header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarDays className="h-4 w-4 text-[#1B1F4B] shrink-0" />
                          <span className="font-semibold text-[#1B1F4B]">
                            {format(new Date(match.match_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </span>
                          {guests.length > 0 && (
                            <Badge variant="secondary" className="bg-[#1B1F4B]/10 text-[#1B1F4B]">
                              <Users className="h-3 w-3 mr-1" />
                              {guests.length} {guests.length === 1 ? 'avulso' : 'avulsos'}
                            </Badge>
                          )}
                        </div>
                        {match.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{match.location}</span>
                          </div>
                        )}
                        {match.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{match.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button size="sm" variant="ghost" className="text-[#1B1F4B]" onClick={() => openEdit(match)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => confirmDelete(match.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#00C853]"
                          onClick={() => openGuestDialog(match.id, match.match_date)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        {guests.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded guest players */}
                  {isExpanded && guests.length > 0 && (
                    <div className="border-t bg-muted/30 px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Jogadores Avulsos
                      </p>
                      {guests.map((guest) => (
                        <div
                          key={guest.id}
                          className="flex items-center justify-between bg-background rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm text-[#1B1F4B]">{guest.name}</span>
                            {guest.phone && (
                              <span className="text-xs text-muted-foreground ml-2">{guest.phone}</span>
                            )}
                            <span className="text-sm text-muted-foreground ml-2">
                              R$ {Number(guest.amount).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {guest.paid ? (
                              <Badge className="bg-[#00C853]/10 text-[#00C853]">
                                <Check className="h-3 w-3 mr-1" />
                                Pago
                              </Badge>
                            ) : (
                              <>
                                <Badge variant="outline" className="text-orange-500 border-orange-300">
                                  Pendente
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-[#00C853] border-[#00C853] h-7 px-2"
                                  onClick={() => markGuestPaid(guest.id)}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 h-7 px-2"
                              onClick={() => deleteGuest(guest.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit match dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Jogo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditMatch} className="space-y-4">
            <div className="space-y-2">
              <Label>Data do jogo *</Label>
              <Input type="date" value={editMatchDate} onChange={(e) => setEditMatchDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input placeholder="Ex: Quadra Society ABC" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea placeholder="Notas sobre o jogo" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir este jogo? Os jogadores avulsos vinculados também serão removidos.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteMatch}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add guest dialog */}
      <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Jogador Avulso</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGuest} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Nome do jogador" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(99) 99999-9999" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="25.00"
                value={guestAmount}
                onChange={(e) => setGuestAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
              {saving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
