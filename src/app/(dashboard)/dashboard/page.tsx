import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, ArrowRight, Shield, Crown } from 'lucide-react'
import { CreateGroupDialog } from '@/components/dashboard/create-group-dialog'
import { Logo } from '@/components/shared/logo'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user is master
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_master')
    .eq('id', user.id)
    .single()

  const isMaster = profile?.is_master === true

  let groups: any[] = []

  if (isMaster) {
    // Master sees ALL groups
    const { data, error: groupsError } = await supabase
      .from('groups')
      .select('*, group_members(count)')
      .order('created_at', { ascending: false })



    // Fetch creator names
    const creatorIds = [...new Set((data || []).map((g: any) => g.created_by).filter(Boolean))]
    let creatorsMap: Record<string, string> = {}
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds)
      for (const c of creators || []) {
        creatorsMap[c.id] = c.full_name
      }
    }
    groups = (data || []).map((g: any) => ({ ...g, creator_name: creatorsMap[g.created_by] || 'Desconhecido' }))
  } else {
    // Regular user: only their groups
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('profile_id', user.id)
      .eq('status', 'active')

    const memberGroupIds = memberships?.map(m => m.group_id) || []

    const { data: createdGroups } = await supabase
      .from('groups')
      .select('id')
      .eq('created_by', user.id)

    const createdGroupIds = createdGroups?.map(g => g.id) || []
    const allGroupIds = [...new Set([...memberGroupIds, ...createdGroupIds])]

    if (allGroupIds.length > 0) {
      const { data } = await supabase
        .from('groups')
        .select('*, group_members(count)')
        .in('id', allGroupIds)
        .order('created_at', { ascending: false })
      groups = data || []
    }
  }

  return (
    <div className="min-h-screen gradient-surface mesh-bg">
      <header className="glass border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <CreateGroupDialog />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight">
            {isMaster ? 'Todos os Grupos' : 'Seus Grupos'}
          </h1>
          {isMaster && (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1">
              <Crown className="h-3 w-3" />
              Master
            </Badge>
          )}
          {isMaster && (
            <span className="text-sm text-muted-foreground">{groups.length} grupos</span>
          )}
        </div>
        {!groups || groups.length === 0 ? (
          <div className="card-modern-elevated text-center py-16 px-8">
            <div className="h-16 w-16 rounded-2xl gradient-green flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-brand-navy mb-2">Nenhum grupo ainda</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Crie seu primeiro grupo de pelada para começar a gerenciar a tesouraria!</p>
            <CreateGroupDialog />
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group: any) => (
              <Link key={group.id} href={`/dashboard/${group.id}`}>
                <div className="card-modern-elevated p-6 cursor-pointer group h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl gradient-green flex items-center justify-center shadow-md">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-green group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="font-bold text-brand-navy text-lg tracking-tight">{group.name}</h3>
                  <p className="text-muted-foreground text-sm mt-1">{group.description || 'Grupo de pelada'}</p>
                  {isMaster && group.creator_name && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Criado por {group.creator_name}
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{group.group_members?.[0]?.count || 0} membros</span>
                    <span className="font-semibold text-brand-green">R$ {Number(group.monthly_fee_amount).toFixed(2)}/mês</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
