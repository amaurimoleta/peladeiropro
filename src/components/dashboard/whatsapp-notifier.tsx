'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  MessageCircle,
  Send,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
} from 'lucide-react'
import { useGroupRole } from '@/hooks/use-group-role'
import { format } from 'date-fns'
// ptBR locale available via: import { ptBR } from 'date-fns/locale'

interface WhatsAppNotifierProps {
  groupId: string
}

interface OverdueMember {
  memberId: string
  name: string
  phone: string | null
  monthsOverdue: number
  totalAmount: number
  oldestDueDate: string
}

const DEFAULT_MESSAGE =
  'Fala, {nome}! Passando pra lembrar que voce tem {meses} mensalidade(s) pendente(s) no valor total de R$ {valor}. Faz um PIX pra gente ficar em dia! Chave PIX: {pix}. Valeu, craque! \u26BD'

export function WhatsAppNotifier({ groupId }: WhatsAppNotifierProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [members, setMembers] = useState<OverdueMember[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE)
  const [pixKey, setPixKey] = useState<string | null>(null)
  const { isAdmin, loading: roleLoading } = useGroupRole(groupId)
  const supabase = createClient()

  const fetchOverdueMembers = useCallback(async () => {
    setLoading(true)

    const today = format(new Date(), 'yyyy-MM-dd')

    const [{ data: groupData }, { data: feesData, error: feesError }] = await Promise.all([
      supabase.from('groups').select('pix_key').eq('id', groupId).single(),
      supabase
        .from('monthly_fees')
        .select('*, member:group_members(name, phone)')
        .eq('group_id', groupId)
        .in('status', ['pending', 'overdue'])
        .lt('due_date', today),
    ])

    if (groupData) {
      setPixKey(groupData.pix_key)
    }

    if (feesError) {
      toast.error('Erro ao buscar inadimplentes', { description: feesError.message })
      setLoading(false)
      return
    }

    // Group fees by member
    const memberMap = new Map<string, OverdueMember>()

    for (const fee of feesData || []) {
      const existing = memberMap.get(fee.member_id)
      const memberInfo = fee.member as { name: string; phone: string | null } | null

      if (existing) {
        existing.monthsOverdue += 1
        existing.totalAmount += fee.amount
        if (fee.due_date < existing.oldestDueDate) {
          existing.oldestDueDate = fee.due_date
        }
      } else {
        memberMap.set(fee.member_id, {
          memberId: fee.member_id,
          name: memberInfo?.name || 'Sem nome',
          phone: memberInfo?.phone || null,
          monthsOverdue: 1,
          totalAmount: fee.amount,
          oldestDueDate: fee.due_date,
        })
      }
    }

    const overdueList = Array.from(memberMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    )

    setMembers(overdueList)
    // Pre-select members that have a phone number
    setSelected(new Set(overdueList.filter((m) => m.phone).map((m) => m.memberId)))
    setLoading(false)
  }, [groupId])

  function handleOpen() {
    setOpen(true)
    fetchOverdueMembers()
  }

  function toggleSelect(memberId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  function toggleSelectAll() {
    const selectableMembers = members.filter((m) => m.phone)
    if (selected.size === selectableMembers.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableMembers.map((m) => m.memberId)))
    }
  }

  function formatPhone(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')
    // If no country code, prepend Brazil country code
    if (digits.length <= 11) {
      return `55${digits}`
    }
    return digits
  }

  function buildMessage(member: OverdueMember): string {
    return messageTemplate
      .replace(/\{nome\}/g, member.name)
      .replace(/\{valor\}/g, member.totalAmount.toFixed(2).replace('.', ','))
      .replace(/\{meses\}/g, String(member.monthsOverdue))
      .replace(/\{pix\}/g, pixKey || '(nao configurada)')
  }

  async function handleSend() {
    const selectedMembers = members.filter(
      (m) => selected.has(m.memberId) && m.phone
    )

    if (selectedMembers.length === 0) {
      toast.error('Nenhum membro selecionado com telefone cadastrado')
      return
    }

    setSending(true)

    let opened = 0
    for (const member of selectedMembers) {
      const phone = formatPhone(member.phone!)
      const message = encodeURIComponent(buildMessage(member))
      const url = `https://wa.me/${phone}?text=${message}`
      window.open(url, '_blank')
      opened++
      // Small delay between window opens to avoid browser blocking
      if (opened < selectedMembers.length) {
        await new Promise((resolve) => setTimeout(resolve, 800))
      }
    }

    toast.success(`WhatsApp aberto para ${opened} membro(s)`)
    setSending(false)
  }

  if (roleLoading) return null
  if (!isAdmin) return null

  const selectableCount = members.filter((m) => m.phone).length
  const selectedCount = selected.size

  return (
    <>
      <Button
        onClick={handleOpen}
        className="bg-[#25D366] hover:bg-[#1DA851] text-white"
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Cobrar Inadimplentes via WhatsApp
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              Cobranca via WhatsApp
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-60" />
              <p className="text-sm font-medium">Nenhum inadimplente encontrado!</p>
              <p className="text-xs mt-1">Todos os membros estao em dia.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{members.length} inadimplente(s)</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 accent-[#1B1F4B] cursor-pointer"
                    checked={selectableCount > 0 && selectedCount === selectableCount}
                    onChange={toggleSelectAll}
                  />
                  Selecionar todos
                </label>
              </div>

              {/* Member list */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                {members.map((member) => {
                  const hasPhone = !!member.phone
                  const isSelected = selected.has(member.memberId)

                  return (
                    <label
                      key={member.memberId}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                          : 'bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700'
                      } ${!hasPhone ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 accent-[#1B1F4B] cursor-pointer shrink-0"
                        checked={isSelected}
                        disabled={!hasPhone}
                        onChange={() => toggleSelect(member.memberId)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {member.name}
                          </span>
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {member.monthsOverdue} mes(es)
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {hasPhone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              Sem telefone
                            </span>
                          )}
                          <span className="font-medium text-foreground">
                            R$ {member.totalAmount.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Message template */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Modelo da mensagem</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                    onClick={() => setMessageTemplate(DEFAULT_MESSAGE)}
                  >
                    Restaurar padrao
                  </button>
                </div>
                <Textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{nome}', label: 'Nome' },
                    { tag: '{valor}', label: 'Valor' },
                    { tag: '{meses}', label: 'Meses' },
                    { tag: '{pix}', label: 'PIX' },
                  ].map((v) => (
                    <Badge
                      key={v.tag}
                      variant="secondary"
                      className="text-[10px] cursor-pointer hover:bg-secondary/80"
                      onClick={() =>
                        setMessageTemplate((prev) => prev + v.tag)
                      }
                    >
                      {v.tag} = {v.label}
                    </Badge>
                  ))}
                </div>
                {!pixKey && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Chave PIX nao configurada. Configure nas configuracoes do grupo.
                  </div>
                )}
              </div>

              {/* Preview */}
              {members.length > 0 && selected.size > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    Pre-visualizacao (primeiro selecionado):
                  </span>
                  <div className="bg-[#DCF8C6] dark:bg-[#025C4C] text-[#111B21] dark:text-[#E9EDEF] p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap">
                    {buildMessage(
                      members.find((m) => selected.has(m.memberId))!
                    )}
                  </div>
                </div>
              )}

              {/* Send button */}
              <div className="-mx-4 -mb-4 flex flex-col gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-between sm:items-center">
                <span className="text-xs text-muted-foreground">
                  {selectedCount} de {members.length} selecionado(s)
                </span>
                <Button
                  onClick={handleSend}
                  disabled={sending || selectedCount === 0}
                  className="bg-[#25D366] hover:bg-[#1DA851] text-white"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar para Selecionados
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
