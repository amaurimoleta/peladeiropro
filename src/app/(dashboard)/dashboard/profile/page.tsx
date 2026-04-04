'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/shared/logo'
import { ArrowLeft, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import { MEMBER_ROLES } from '@/lib/types'

interface ProfileData {
  id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
}

interface UserGroup {
  id: string
  name: string
  description: string | null
  role: string
  memberCount: number
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [groups, setGroups] = useState<UserGroup[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setEmail(user.email || '')

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setFullName(profileData.full_name || '')
        setPhone(profileData.phone || '')
      }

      // Fetch groups the user belongs to
      const { data: memberships } = await supabase
        .from('group_members')
        .select('role, group_id, groups(id, name, description, group_members(count))')
        .eq('profile_id', user.id)
        .eq('status', 'active')

      if (memberships) {
        const userGroups: UserGroup[] = memberships.map((m: any) => ({
          id: m.groups.id,
          name: m.groups.name,
          description: m.groups.description,
          role: m.role,
          memberCount: m.groups.group_members?.[0]?.count || 0,
        }))
        setGroups(userGroups)
      }

      setLoading(false)
    }

    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone || null,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Erro ao salvar perfil', { description: error.message })
    } else {
      toast.success('Perfil atualizado com sucesso!')
    }
    setSaving(false)
  }

  function roleGradient(role: string) {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-[#1B1F4B] to-[#2D327A] text-white border-0'
      case 'treasurer':
        return 'bg-gradient-to-r from-[#00C853] to-[#00A843] text-white border-0'
      default:
        return 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border-0'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-surface mesh-bg flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-surface mesh-bg">
      <header className="glass border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-navy transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 relative z-10 space-y-6">
        <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight">Meu Perfil</h1>

        {/* Profile Edit Card */}
        <div className="card-modern-elevated p-6">
          <h2 className="text-lg font-bold text-brand-navy mb-4">Dados Pessoais</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={email} disabled className="bg-gray-50 dark:bg-gray-900" />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
            </div>
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
            <Button
              type="submit"
              className="bg-[#00C853] hover:bg-[#00A843] text-white"
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </div>

        {/* User Groups Card */}
        <div className="card-modern-elevated p-6">
          <h2 className="text-lg font-bold text-brand-navy mb-4">Meus Grupos</h2>
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">Você não participa de nenhum grupo ainda.</p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <Link key={group.id} href={`/dashboard/${group.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl gradient-green flex items-center justify-center shadow-md">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-navy group-hover:text-brand-green transition-colors">
                          {group.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {group.memberCount} membros
                        </p>
                      </div>
                    </div>
                    <Badge className={roleGradient(group.role)}>
                      {MEMBER_ROLES[group.role] || group.role}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
