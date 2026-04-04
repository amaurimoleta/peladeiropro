'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Megaphone,
  Pin,
  PinOff,
  Edit2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import type { Announcement } from '@/lib/types'

function relativeDate(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `ha ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `ha ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `ha ${days}d`
  return `ha ${Math.floor(days / 30)}m`
}

export default function AnnouncementsCard({ groupId }: { groupId: string }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const { isAdmin } = useGroupRole(groupId)
  const supabase = createClient()

  const fetchAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, author:group_members!announcements_author_id_fkey(name)')
      .eq('group_id', groupId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching announcements:', error)
    } else {
      setAnnouncements(data || [])
    }
    setLoading(false)
  }, [groupId])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  function openCreateDialog() {
    setEditingId(null)
    setTitle('')
    setContent('')
    setDialogOpen(true)
  }

  function openEditDialog(announcement: Announcement) {
    setEditingId(announcement.id)
    setTitle(announcement.title)
    setContent(announcement.content)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha o título e o conteudo do aviso.')
      return
    }

    setSaving(true)

    try {
      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
          .eq('id', editingId)

        if (error) throw error

        await logAudit(supabase, {
          groupId,
          action: 'update',
          entityType: 'announcement',
          entityId: editingId,
          details: { title: title.trim() },
        })

        toast.success('Aviso atualizado com sucesso!')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Não autenticado')

        const { data: member } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', groupId)
          .eq('profile_id', user.id)
          .eq('status', 'active')
          .single()

        const { data: created, error } = await supabase
          .from('announcements')
          .insert({
            group_id: groupId,
            author_id: member?.id || null,
            title: title.trim(),
            content: content.trim(),
            pinned: false,
          })
          .select()
          .single()

        if (error) throw error

        await logAudit(supabase, {
          groupId,
          action: 'create',
          entityType: 'announcement',
          entityId: created?.id,
          details: { title: title.trim() },
        })

        toast.success('Aviso publicado com sucesso!')
      }

      setDialogOpen(false)
      setTitle('')
      setContent('')
      setEditingId(null)
      fetchAnnouncements()
    } catch (err) {
      console.error('Error saving announcement:', err)
      toast.error('Erro ao salvar aviso.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Tem certeza que deseja excluir este aviso?')
    if (!confirmed) return

    const { error } = await supabase.from('announcements').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir aviso.')
      return
    }

    await logAudit(supabase, {
      groupId,
      action: 'delete',
      entityType: 'announcement',
      entityId: id,
    })

    toast.success('Aviso excluido.')
    fetchAnnouncements()
  }

  async function handleTogglePin(announcement: Announcement) {
    const newPinned = !announcement.pinned

    const { error } = await supabase
      .from('announcements')
      .update({ pinned: newPinned, updated_at: new Date().toISOString() })
      .eq('id', announcement.id)

    if (error) {
      toast.error('Erro ao atualizar fixacao.')
      return
    }

    await logAudit(supabase, {
      groupId,
      action: newPinned ? 'pin' : 'unpin',
      entityType: 'announcement',
      entityId: announcement.id,
      details: { title: announcement.title },
    })

    toast.success(newPinned ? 'Aviso fixado!' : 'Aviso desafixado.')
    fetchAnnouncements()
  }

  const displayed = expanded ? announcements : announcements.slice(0, 5)

  return (
    <div className="card-modern-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Megaphone className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-bold text-[#1B1F4B]">Mural de Avisos</h2>
        </div>

        {isAdmin && (
          <>
          <Button
            size="sm"
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm hover:opacity-90"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo aviso
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar aviso' : 'Novo aviso'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium text-[#1B1F4B] mb-1.5 block">Título</label>
                  <Input
                    placeholder="Título do aviso"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1B1F4B] mb-1.5 block">Conteudo</label>
                  <Textarea
                    placeholder="Escreva o conteudo do aviso..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                >
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Publicar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Carregando avisos...</p>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Megaphone className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-sm">Nenhum aviso publicado</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayed.map((announcement) => {
              const authorName =
                (announcement as any).author?.name || 'Desconhecido'

              return (
                <div
                  key={announcement.id}
                  className="rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {announcement.pinned && (
                        <Pin className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-[#1B1F4B] leading-snug">
                          {announcement.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                          {announcement.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {authorName} &middot; {relativeDate(announcement.created_at)}
                        </p>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleTogglePin(announcement)}
                          title={announcement.pinned ? 'Desafixar' : 'Fixar'}
                        >
                          {announcement.pinned ? (
                            <PinOff className="h-3.5 w-3.5 text-yellow-500" />
                          ) : (
                            <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditDialog(announcement)}
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDelete(announcement.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {announcements.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-[#1B1F4B]"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Ver todos
                </>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
