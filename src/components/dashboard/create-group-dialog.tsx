'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [dueDay, setDueDay] = useState('10')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name,
        description: description || null,
        monthly_fee_amount: parseFloat(monthlyFee) || 0,
        due_day: parseInt(dueDay) || 10,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      toast.error('Erro ao criar grupo', { description: error.message })
      setLoading(false)
      return
    }

    // Add creator as admin member
    await supabase.from('group_members').insert({
      group_id: group.id,
      profile_id: user.id,
      name: user.user_metadata?.full_name || user.email || 'Admin',
      role: 'admin',
    })

    toast.success('Grupo criado com sucesso!')
    setOpen(false)
    setName('')
    setDescription('')
    setMonthlyFee('')
    setDueDay('10')
    setLoading(false)
    router.push(`/dashboard/${group.id}`)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-[#00C853] hover:bg-[#00A843] text-white" />}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Grupo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo grupo</DialogTitle>
          <DialogDescription>Configure seu grupo de pelada</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Nome do grupo *</Label>
            <Input
              id="group-name"
              placeholder="Ex: Pelada de Terça"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-desc">Descrição</Label>
            <Textarea
              id="group-desc"
              placeholder="Descrição do grupo (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fee">Mensalidade (R$)</Label>
              <Input
                id="fee"
                type="number"
                step="0.01"
                min="0"
                placeholder="100.00"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Dia de vencimento</Label>
              <Input
                id="due"
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full bg-[#00C853] hover:bg-[#00A843] text-white" disabled={loading}>
            {loading ? 'Criando...' : 'Criar Grupo'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
