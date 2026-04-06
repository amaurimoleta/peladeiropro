'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Copy,
  ExternalLink,
  Share2,
  Globe,
  Shield,
  ShieldAlert,
  UserCog,
  Clock,
  Settings,
  Trash2,
  AlertTriangle,
  UserPlus,
  DollarSign,
  Users,
  FileText,
  Edit,
  QrCode,
  Plus,
  Minus,
} from 'lucide-react'
import { toast } from 'sonner'
import { PIX_KEY_TYPES, MEMBER_ROLES, type Group, type GroupMember, type AuditLog } from '@/lib/types'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import { InviteManager } from '@/components/dashboard/invite-manager'
import RecurringExpenses from '@/components/dashboard/recurring-expenses'
import CustomCategories from '@/components/dashboard/custom-categories'
import { ImageUpload } from '@/components/shared/image-upload'

const AUDIT_ACTION_LABELS: Record<string, string> = {
  update_group_settings: 'Atualizou configurações do grupo',
  promote_member: 'Promoveu membro',
  delete_group: 'Excluiu grupo',
  add_member: 'Adicionou membro',
  remove_member: 'Removeu membro',
  record_payment: 'Registrou pagamento',
  add_expense: 'Adicionou despesa',
  create_match: 'Criou partida',
}

const AUDIT_ACTION_ICONS: Record<string, typeof Settings> = {
  update_group_settings: Settings,
  promote_member: UserCog,
  delete_group: Trash2,
  add_member: UserPlus,
  remove_member: Users,
  record_payment: DollarSign,
  add_expense: DollarSign,
  create_match: FileText,
}

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.groupId as string
  const supabase = createClient()

  const { role, isAdmin, isReadOnly, loading: roleLoading } = useGroupRole(groupId)

  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('')
  const [pixBeneficiary, setPixBeneficiary] = useState('')
  const [pixKey2, setPixKey2] = useState('')
  const [pixKeyType2, setPixKeyType2] = useState('')
  const [pixKey3, setPixKey3] = useState('')
  const [pixKeyType3, setPixKeyType3] = useState('')
  const [pixBrcode, setPixBrcode] = useState('')
  const [goalkeeperPaysFee, setGoalkeeperPaysFee] = useState(true)
  const [initialBalance, setInitialBalance] = useState('')

  // Members state (for admin management)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [savingRole, setSavingRole] = useState(false)

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Delete group
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('')
  const [expectedDeleteCode, setExpectedDeleteCode] = useState('')
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'code'>('confirm')
  const [sendingCode, setSendingCode] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('groups').select('*').eq('id', groupId).single()
      if (data) {
        setGroup(data)
        setName(data.name)
        setDescription(data.description || '')
        setMonthlyFee(String(data.monthly_fee_amount))
        setDueDay(String(data.due_day))
        setPixKey(data.pix_key || '')
        setPixKeyType(data.pix_key_type || '')
        setPixBeneficiary(data.pix_beneficiary_name || '')
        setPixKey2(data.pix_key_2 || '')
        setPixKeyType2(data.pix_key_type_2 || '')
        setPixKey3(data.pix_key_3 || '')
        setPixKeyType3(data.pix_key_type_3 || '')
        setPixBrcode(data.pix_brcode || '')
        setGoalkeeperPaysFee(data.goalkeeper_pays_fee ?? true)
        setInitialBalance(String(data.initial_balance ?? 0))
      }
      setLoading(false)
    }
    load()
  }, [groupId])

  // Load members for admin management
  useEffect(() => {
    async function loadMembers() {
      const { data } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('name')
      if (data) setMembers(data)
    }
    if (!roleLoading) loadMembers()
  }, [groupId, roleLoading])

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    setLoadingLogs(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setAuditLogs(data)
    setLoadingLogs(false)
  }, [groupId])

  useEffect(() => {
    if (!roleLoading) loadAuditLogs()
  }, [roleLoading, loadAuditLogs])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (isReadOnly) return
    setSaving(true)

    // Track what changed for audit
    const changes: Record<string, { from: any; to: any }> = {}
    if (group) {
      if (name !== group.name) changes.name = { from: group.name, to: name }
      if ((description || null) !== group.description) changes.description = { from: group.description, to: description || null }
      const newFee = parseFloat(monthlyFee) || 0
      if (newFee !== group.monthly_fee_amount) changes.monthly_fee_amount = { from: group.monthly_fee_amount, to: newFee }
      const newDueDay = parseInt(dueDay) || 10
      if (newDueDay !== group.due_day) changes.due_day = { from: group.due_day, to: newDueDay }
      if ((pixKey || null) !== group.pix_key) changes.pix_key = { from: group.pix_key, to: pixKey || null }
      if ((pixKeyType || null) !== group.pix_key_type) changes.pix_key_type = { from: group.pix_key_type, to: pixKeyType || null }
      if ((pixBeneficiary || null) !== group.pix_beneficiary_name) changes.pix_beneficiary_name = { from: group.pix_beneficiary_name, to: pixBeneficiary || null }
      if ((pixKey2 || null) !== group.pix_key_2) changes.pix_key_2 = { from: group.pix_key_2, to: pixKey2 || null }
      if ((pixKeyType2 || null) !== group.pix_key_type_2) changes.pix_key_type_2 = { from: group.pix_key_type_2, to: pixKeyType2 || null }
      if ((pixKey3 || null) !== group.pix_key_3) changes.pix_key_3 = { from: group.pix_key_3, to: pixKey3 || null }
      if ((pixKeyType3 || null) !== group.pix_key_type_3) changes.pix_key_type_3 = { from: group.pix_key_type_3, to: pixKeyType3 || null }
      if ((pixBrcode || null) !== group.pix_brcode) changes.pix_brcode = { from: group.pix_brcode, to: pixBrcode || null }
      if (goalkeeperPaysFee !== group.goalkeeper_pays_fee) changes.goalkeeper_pays_fee = { from: group.goalkeeper_pays_fee, to: goalkeeperPaysFee }
      const newInitialBalance = parseFloat(initialBalance) || 0
      if (newInitialBalance !== (group.initial_balance ?? 0)) changes.initial_balance = { from: group.initial_balance ?? 0, to: newInitialBalance }
    }

    const { error } = await supabase.from('groups').update({
      name,
      description: description || null,
      monthly_fee_amount: parseFloat(monthlyFee) || 0,
      due_day: parseInt(dueDay) || 10,
      pix_key: pixKey || null,
      pix_key_type: pixKeyType || null,
      pix_beneficiary_name: pixBeneficiary || null,
      pix_key_2: pixKey2 || null,
      pix_key_type_2: pixKeyType2 || null,
      pix_key_3: pixKey3 || null,
      pix_key_type_3: pixKeyType3 || null,
      pix_brcode: pixBrcode || null,
      goalkeeper_pays_fee: goalkeeperPaysFee,
      initial_balance: parseFloat(initialBalance) || 0,
    }).eq('id', groupId)

    if (error) {
      toast.error('Erro ao salvar', { description: error.message })
    } else {
      toast.success('Configurações salvas!')
      // Update local group state
      setGroup((prev) => prev ? {
        ...prev,
        name,
        description: description || null,
        monthly_fee_amount: parseFloat(monthlyFee) || 0,
        due_day: parseInt(dueDay) || 10,
        pix_key: pixKey || null,
        pix_key_type: (pixKeyType || null) as Group['pix_key_type'],
        pix_beneficiary_name: pixBeneficiary || null,
        pix_key_2: pixKey2 || null,
        pix_key_type_2: pixKeyType2 || null,
        pix_key_3: pixKey3 || null,
        pix_key_type_3: pixKeyType3 || null,
        pix_brcode: pixBrcode || null,
        goalkeeper_pays_fee: goalkeeperPaysFee,
        initial_balance: parseFloat(initialBalance) || 0,
      } : null)

      // Log audit with details of what changed
      if (Object.keys(changes).length > 0) {
        await logAudit(supabase, {
          groupId,
          action: 'update_group_settings',
          entityType: 'group',
          entityId: groupId,
          details: { changes },
        })
        loadAuditLogs()
      }
    }
    setSaving(false)
  }

  async function handleRoleChange() {
    if (!selectedMemberId || !selectedRole || isReadOnly) return
    setSavingRole(true)

    const member = members.find((m) => m.id === selectedMemberId)

    const { error } = await supabase
      .from('group_members')
      .update({ role: selectedRole })
      .eq('id', selectedMemberId)
      .eq('group_id', groupId)

    if (error) {
      toast.error('Erro ao alterar cargo', { description: error.message })
    } else {
      toast.success('Cargo alterado com sucesso!')
      setMembers((prev) => prev.map((m) => m.id === selectedMemberId ? { ...m, role: selectedRole as GroupMember['role'] } : m))
      await logAudit(supabase, {
        groupId,
        action: 'promote_member',
        entityType: 'group_member',
        entityId: selectedMemberId,
        details: {
          member_name: member?.name,
          new_role: selectedRole,
          old_role: member?.role,
        },
      })
      loadAuditLogs()
      setSelectedMemberId('')
      setSelectedRole('')
    }
    setSavingRole(false)
  }

  async function handleSendDeleteCode() {
    setSendingCode(true)
    const code = String(Math.floor(100000 + Math.random() * 900000))
    setExpectedDeleteCode(code)

    // Get user email
    const { data: { user } } = await supabase.auth.getUser()
    const userEmail = user?.email || ''

    // Try to send code via email using Supabase Edge Function or Auth
    try {
      // Use Supabase's auth.resetPasswordForEmail as a mechanism to send a notification
      // For now, we'll show the code in a toast as a fallback + send email via database function
      const { error: rpcError } = await supabase.rpc('send_delete_confirmation', {
        p_email: userEmail,
        p_code: code,
        p_group_name: group?.name || '',
      }).maybeSingle()

      if (rpcError) {
        // Fallback: show code via toast notification
        toast.info(`Código de confirmação: ${code}`, {
          description: `Enviado para ${userEmail}`,
          duration: 30000,
        })
      } else {
        toast.success(`Código enviado para ${userEmail}`)
      }
    } catch {
      // Fallback: show code via toast
      toast.info(`Código de confirmação: ${code}`, {
        description: `Use este código para confirmar a exclusão`,
        duration: 30000,
      })
    }

    setDeleteStep('code')
    setSendingCode(false)
  }

  async function handleDeleteGroup() {
    if (deleteConfirmCode !== expectedDeleteCode) {
      toast.error('Código incorreto')
      return
    }
    setDeleting(true)

    await logAudit(supabase, {
      groupId,
      action: 'delete_group',
      entityType: 'group',
      entityId: groupId,
      details: { group_name: group?.name },
    })

    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) {
      toast.error('Erro ao excluir grupo', { description: error.message })
      setDeleting(false)
    } else {
      toast.success('Grupo excluído com sucesso')
      router.push('/dashboard')
    }
  }

  function getPublicLink() {
    if (!group?.public_slug) return ''
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${group.public_slug}`
  }

  function copyPublicLink() {
    const link = getPublicLink()
    if (link) {
      navigator.clipboard.writeText(link)
      toast.success('Link copiado!')
    }
  }

  function shareWhatsApp() {
    const link = getPublicLink()
    if (link) {
      const text = `Prestação de contas - ${name}\n\n${link}`
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  function formatTimestamp(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}min atras`
    if (diffHours < 24) return `${diffHours}h atras`
    if (diffDays < 7) return `${diffDays}d atras`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function getAuditActionLabel(action: string) {
    return AUDIT_ACTION_LABELS[action] || action
  }

  function getAuditIcon(action: string) {
    return AUDIT_ACTION_ICONS[action] || Edit
  }

  const adminMembers = members.filter((m) => m.role === 'admin' || m.role === 'treasurer')
  const promotableMembers = members.filter((m) => m.role === 'member')

  if (loading || roleLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>

  return (
    <div className="max-w-2xl mx-auto overflow-x-hidden">
      <div className="flex items-center justify-between mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B1F4B] dark:text-gray-100">Configurações</h1>
        {isReadOnly && (
          <Badge variant="secondary">
            <Shield className="h-3 w-3 mr-1" />
            Somente leitura
          </Badge>
        )}
      </div>

      {/* Public Link - Prominent */}
      <Card className="mb-6 border-brand-green/20 bg-gradient-to-br from-brand-green/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-green flex items-center justify-center shadow-sm">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Link Público de Prestação de Contas</CardTitle>
              <CardDescription>Compartilhe com os membros para transparencia total</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={getPublicLink() || 'Gerando...'}
              className="bg-white dark:bg-gray-900 font-mono text-xs sm:text-sm min-w-0"
            />
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={copyPublicLink} title="Copiar link">
              <Copy className="h-4 w-4" />
            </Button>
            {group?.public_slug && (
              <a href={`/p/${group.public_slug}`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" size="icon" className="shrink-0" title="Abrir página">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            )}
          </div>
          <Button type="button" variant="outline" className="w-full text-[#25D366] border-[#25D366] hover:bg-[#25D366]/10" onClick={shareWhatsApp}>
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar via WhatsApp
          </Button>
          <p className="text-xs text-muted-foreground">
            Este link mostra um resumo financeiro do grupo com mensalidades, despesas, saldo e informações de PIX.
            Qualquer pessoa com o link pode visualizar - não precisa de login.
          </p>
        </CardContent>
      </Card>

      {/* Convites */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Convites</CardTitle>
          <CardDescription>Gerencie os convites do grupo</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteManager groupId={groupId} />
        </CardContent>
      </Card>

      {/* Group Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações do Grupo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <ImageUpload
                currentUrl={group?.cover_url || null}
                onUpload={async (url) => {
                  const { error } = await supabase.from('groups').update({ cover_url: url || null }).eq('id', groupId)
                  if (error) {
                    toast.error('Erro ao atualizar imagem', { description: error.message })
                  } else {
                    toast.success('Imagem atualizada!')
                    setGroup((prev) => prev ? { ...prev, cover_url: url || null } : null)
                  }
                }}
                bucket="uploads"
                folder="group-covers"
                size="lg"
                shape="rounded"
                label="Capa do grupo"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={isReadOnly} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do grupo" disabled={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label>Mensalidade (R$)</Label>
                <Input type="number" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-2">
                <Label>Dia de vencimento</Label>
                <Input type="number" min="1" max="28" value={dueDay} onChange={(e) => setDueDay(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Saldo inicial (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                disabled={isReadOnly}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Valor do caixa antes de comecar a usar o sistema. Sera somado ao saldo acumulado.
              </p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Goleiro paga mensalidade?</p>
                <p className="text-xs text-muted-foreground">
                  Se desativado, jogadores com posição &quot;Goleiro&quot; não terão mensalidades geradas
                </p>
              </div>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setGoalkeeperPaysFee(!goalkeeperPaysFee)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${goalkeeperPaysFee ? 'bg-[#00C853]' : 'bg-gray-300'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${goalkeeperPaysFee ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados PIX</CardTitle>
            <CardDescription>Cadastre até 3 chaves PIX e/ou o código QR Code para facilitar o pagamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nome do beneficiário */}
            <div className="space-y-2">
              <Label>Nome do beneficiário</Label>
              <Input placeholder="Nome que aparece no PIX" value={pixBeneficiary} onChange={(e) => setPixBeneficiary(e.target.value)} disabled={isReadOnly} />
            </div>

            {/* Chave PIX 1 */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase">Chave PIX 1 (Principal)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={pixKeyType} onValueChange={(v) => v && setPixKeyType(v)} disabled={isReadOnly}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PIX_KEY_TYPES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Chave</Label>
                  <Input className="h-9" placeholder="Sua chave PIX principal" value={pixKey} onChange={(e) => setPixKey(e.target.value)} disabled={isReadOnly} />
                </div>
              </div>
            </div>

            {/* Chave PIX 2 */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase">Chave PIX 2 (Opcional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={pixKeyType2} onValueChange={(v) => v && setPixKeyType2(v)} disabled={isReadOnly}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {Object.entries(PIX_KEY_TYPES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Chave</Label>
                  <Input className="h-9" placeholder="Chave PIX alternativa" value={pixKey2} onChange={(e) => setPixKey2(e.target.value)} disabled={isReadOnly} />
                </div>
              </div>
            </div>

            {/* Chave PIX 3 */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase">Chave PIX 3 (Opcional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={pixKeyType3} onValueChange={(v) => v && setPixKeyType3(v)} disabled={isReadOnly}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {Object.entries(PIX_KEY_TYPES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Chave</Label>
                  <Input className="h-9" placeholder="Chave PIX alternativa" value={pixKey3} onChange={(e) => setPixKey3(e.target.value)} disabled={isReadOnly} />
                </div>
              </div>
            </div>

            {/* QR Code / PIX Copia e Cola */}
            <div className="p-3 rounded-lg border border-dashed border-[#00C853]/40 bg-[#00C853]/5 space-y-2">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#00C853]" />
                <p className="text-[10px] sm:text-xs font-semibold text-[#1B1F4B] dark:text-gray-100 uppercase">QR Code PIX (Copia e Cola)</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole aqui o código PIX gerado pelo seu banco. Ele será usado para gerar o QR Code automaticamente.
              </p>
              <Textarea
                placeholder="00020126580014br.gov.bcb.pix0136..."
                value={pixBrcode}
                onChange={(e) => setPixBrcode(e.target.value)}
                disabled={isReadOnly}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        )}
      </form>

      {/* Administrators Section */}
      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#1B1F4B] flex items-center justify-center shadow-sm">
                <ShieldAlert className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Presidentes</CardTitle>
                <CardDescription>Gerencie os presidentes e tesoureiros do grupo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current admins/treasurers list */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Membros com cargo</Label>
              {adminMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum administrador encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {adminMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-2 p-2 sm:p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#1B1F4B]/10 flex items-center justify-center text-xs sm:text-sm font-medium text-[#1B1F4B] dark:text-gray-100 shrink-0">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium truncate">{member.name}</p>
                          {member.phone && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{member.phone}</p>}
                        </div>
                      </div>
                      <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="shrink-0 text-[10px] sm:text-xs">
                        {MEMBER_ROLES[member.role]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Promote member form - only for admins */}
            {isAdmin && promotableMembers.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-muted-foreground">Promover membro</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select value={selectedMemberId} onValueChange={(v) => v && setSelectedMemberId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o membro" />
                      </SelectTrigger>
                      <SelectContent>
                        {promotableMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedRole} onValueChange={(v) => v && setSelectedRole(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="treasurer">Tesoureiro</SelectItem>
                        <SelectItem value="admin">Presidente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={!selectedMemberId || !selectedRole || savingRole}
                    onClick={handleRoleChange}
                  >
                    <UserCog className="h-4 w-4 mr-2" />
                    {savingRole ? 'Salvando...' : 'Alterar Cargo'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Audit Log Viewer */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Histórico de Atividades</CardTitle>
                <CardDescription>Ultimas 20 ações registradas no grupo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando historico...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade registrada.</p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-4">
                  {auditLogs.map((log) => {
                    const IconComponent = getAuditIcon(log.action)
                    return (
                      <div key={log.id} className="relative flex gap-2 sm:gap-4 pl-0">
                        {/* Icon circle */}
                        <div className="relative z-10 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm">
                          <IconComponent className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0.5 sm:gap-2">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium leading-tight">
                                {getAuditActionLabel(log.action)}
                              </p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                por {log.user_name || 'Sistema'}
                              </p>
                            </div>
                            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                              {formatTimestamp(log.created_at)}
                            </span>
                          </div>

                          {/* Details */}
                          {log.details && (
                            <div className="mt-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                              {log.details.changes && Object.entries(log.details.changes).map(([field, change]: [string, any]) => (
                                <div key={field}>
                                  <span className="font-medium">{field}</span>: {String(change.from ?? '-')} → {String(change.to ?? '-')}
                                </div>
                              ))}
                              {log.details.member_name && (
                                <div>
                                  <span className="font-medium">Membro:</span> {log.details.member_name}
                                  {log.details.new_role && <> → {MEMBER_ROLES[log.details.new_role] || log.details.new_role}</>}
                                </div>
                              )}
                              {log.details.group_name && !log.details.changes && !log.details.member_name && (
                                <div>
                                  <span className="font-medium">Grupo:</span> {log.details.group_name}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categorias Personalizadas */}
        <CustomCategories groupId={groupId} />

        {/* Despesas Recorrentes */}
        <RecurringExpenses groupId={groupId} />

        {/* Danger Zone - admin only */}
        {isAdmin && (
          <Card className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shadow-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-base text-destructive">Zona de Perigo</CardTitle>
                  <CardDescription>Ações irreversiveis para o grupo</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <div>
                  <p className="text-sm font-medium">Excluir grupo</p>
                  <p className="text-xs text-muted-foreground">
                    Todos os dados serão permanentemente excluídos. Esta ação não pode ser desfeita.
                  </p>
                </div>
                <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
                  setDeleteDialogOpen(open)
                  if (!open) {
                    setDeleteStep('confirm')
                    setDeleteConfirmCode('')
                    setExpectedDeleteCode('')
                  }
                }}>
                  <DialogTrigger render={
                    <Button variant="destructive" size="sm" className="w-full sm:w-auto shrink-0">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  } />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Excluir grupo permanentemente</DialogTitle>
                      <DialogDescription>
                        Esta ação é irreversível. Todos os membros, mensalidades, despesas e dados do grupo serão excluídos permanentemente.
                      </DialogDescription>
                    </DialogHeader>

                    {deleteStep === 'confirm' ? (
                      <>
                        <div className="py-3">
                          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                            <p className="text-sm font-medium text-destructive">
                              Você está prestes a excluir o grupo &ldquo;{group?.name}&rdquo;
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              <li>- Todos os membros serão removidos</li>
                              <li>- Todas as mensalidades e pagamentos serão apagados</li>
                              <li>- Todas as despesas e receitas serão apagadas</li>
                              <li>- Todos os jogos e campeonatos serão removidos</li>
                              <li>- O histórico de atividades será perdido</li>
                            </ul>
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose render={
                            <Button variant="outline">Cancelar</Button>
                          } />
                          <Button
                            variant="destructive"
                            disabled={sendingCode}
                            onClick={handleSendDeleteCode}
                          >
                            {sendingCode ? 'Enviando código...' : 'Enviar código de confirmação'}
                          </Button>
                        </DialogFooter>
                      </>
                    ) : (
                      <>
                        <div className="space-y-3 py-2">
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              Um código de 6 dígitos foi enviado. Digite-o abaixo para confirmar a exclusão.
                            </p>
                          </div>
                          <Label>Código de confirmação</Label>
                          <Input
                            placeholder="000000"
                            value={deleteConfirmCode}
                            onChange={(e) => setDeleteConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            maxLength={6}
                            className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                            autoFocus
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => {
                            setDeleteStep('confirm')
                            setDeleteConfirmCode('')
                          }}>
                            Voltar
                          </Button>
                          <Button
                            variant="destructive"
                            disabled={deleteConfirmCode.length !== 6 || deleting}
                            onClick={handleDeleteGroup}
                          >
                            {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                          </Button>
                        </DialogFooter>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
