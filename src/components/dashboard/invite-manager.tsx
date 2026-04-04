'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/hooks/use-group-role'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Link2,
  Copy,
  Trash2,
  Plus,
  Share2,
  CheckCircle2,
  Clock,
  Users,
  Loader2,
} from 'lucide-react'
import type { GroupInvite } from '@/lib/types'

interface InviteManagerProps {
  groupId: string
}

export function InviteManager({ groupId }: InviteManagerProps) {
  const [invites, setInvites] = useState<GroupInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { isAdmin, loading: roleLoading } = useGroupRole(groupId)
  const supabase = createClient()

  const fetchInvites = useCallback(async () => {
    const { data, error } = await supabase
      .from('group_invites')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar convites', { description: error.message })
      return
    }

    setInvites(data || [])
    setLoading(false)
  }, [groupId])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  async function handleCreate() {
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Voce precisa estar logado.')
      setCreating(false)
      return
    }

    // Generate a random token
    const token = crypto.randomUUID().replace(/-/g, '')

    // Set expiry to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: invite, error } = await supabase
      .from('group_invites')
      .insert({
        group_id: groupId,
        token,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        max_uses: 50,
        uses: 0,
      })
      .select()
      .single()

    if (error) {
      toast.error('Erro ao criar convite', { description: error.message })
      setCreating(false)
      return
    }

    toast.success('Link de convite criado!')
    setInvites((prev) => [invite, ...prev])
    setCreating(false)
  }

  async function handleDelete(inviteId: string) {
    const { error } = await supabase
      .from('group_invites')
      .delete()
      .eq('id', inviteId)

    if (error) {
      toast.error('Erro ao excluir convite', { description: error.message })
      return
    }

    toast.success('Convite excluido!')
    setInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }

  function getInviteUrl(token: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/invite/${token}`
  }

  async function handleCopy(invite: GroupInvite) {
    const url = getInviteUrl(invite.token)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(invite.id)
      toast.success('Link copiado!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Erro ao copiar link')
    }
  }

  function handleWhatsApp(invite: GroupInvite) {
    const url = getInviteUrl(invite.token)
    const text = encodeURIComponent(
      `Entra na nossa pelada pelo PeladeiroPro! Clique no link: ${url}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  function isExpired(invite: GroupInvite) {
    return new Date(invite.expires_at) < new Date()
  }

  function isFull(invite: GroupInvite) {
    return invite.uses >= invite.max_uses
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (roleLoading || loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Links de Convite
            </CardTitle>
            <CardDescription>
              Gere links para convidar jogadores para o grupo
            </CardDescription>
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="bg-[#00C853] hover:bg-[#00A843] text-white"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Gerar Link de Convite
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum link de convite criado ainda.</p>
            <p className="text-xs mt-1">Clique em &quot;Gerar Link de Convite&quot; para criar um.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => {
              const expired = isExpired(invite)
              const full = isFull(invite)
              const inactive = expired || full

              return (
                <div
                  key={invite.id}
                  className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border ${
                    inactive
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                      <code className="text-[10px] sm:text-xs bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded font-mono truncate max-w-[120px] sm:max-w-[200px]">
                        {invite.token.slice(0, 8)}...
                      </code>
                      {expired && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Expirado
                        </Badge>
                      )}
                      {full && !expired && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Limite
                        </Badge>
                      )}
                      {!inactive && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatDate(invite.expires_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" />
                        {invite.uses}/{invite.max_uses}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!inactive && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(invite)}
                          className="h-8 w-8 p-0"
                          title="Copiar link"
                        >
                          {copiedId === invite.id ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWhatsApp(invite)}
                          className="h-8 w-8 p-0"
                          title="Compartilhar via WhatsApp"
                        >
                          <Share2 className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(invite.id)}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                      title="Excluir convite"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
