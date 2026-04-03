'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Copy, ExternalLink, Share2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { PIX_KEY_TYPES, type Group } from '@/lib/types'

export default function SettingsPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
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
      }
      setLoading(false)
    }
    load()
  }, [groupId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('groups').update({
      name,
      description: description || null,
      monthly_fee_amount: parseFloat(monthlyFee) || 0,
      due_day: parseInt(dueDay) || 10,
      pix_key: pixKey || null,
      pix_key_type: pixKeyType || null,
      pix_beneficiary_name: pixBeneficiary || null,
    }).eq('id', groupId)

    if (error) {
      toast.error('Erro ao salvar', { description: error.message })
    } else {
      toast.success('Configuracoes salvas!')
    }
    setSaving(false)
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
      const text = `Prestacao de contas - ${name}\n\n${link}`
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[#1B1F4B] mb-6">Configuracoes</h1>

      {/* Public Link - Prominent */}
      <Card className="mb-6 border-brand-green/20 bg-gradient-to-br from-brand-green/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-green flex items-center justify-center shadow-sm">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Link Publico de Prestacao de Contas</CardTitle>
              <CardDescription>Compartilhe com os membros para transparencia total</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={getPublicLink() || 'Gerando...'}
              className="bg-white font-mono text-sm"
            />
            <Button type="button" variant="outline" size="icon" onClick={copyPublicLink} title="Copiar link">
              <Copy className="h-4 w-4" />
            </Button>
            {group?.public_slug && (
              <a href={`/p/${group.public_slug}`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" size="icon" title="Abrir pagina">
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
            Este link mostra um resumo financeiro do grupo com mensalidades, despesas, saldo e informacoes de PIX.
            Qualquer pessoa com o link pode visualizar - nao precisa de login.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informacoes do Grupo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descricao do grupo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mensalidade (R$)</Label>
                <Input type="number" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dia de vencimento</Label>
                <Input type="number" min="1" max="28" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados PIX</CardTitle>
            <CardDescription>Informacoes de pagamento exibidas na prestacao de contas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de chave</Label>
              <Select value={pixKeyType} onValueChange={(v) => v && setPixKeyType(v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PIX_KEY_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input placeholder="Sua chave PIX" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nome do beneficiario</Label>
              <Input placeholder="Nome que aparece no PIX" value={pixBeneficiary} onChange={(e) => setPixBeneficiary(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configuracoes'}
        </Button>
      </form>
    </div>
  )
}
