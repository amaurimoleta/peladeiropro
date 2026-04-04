import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/sidebar'

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (!group) notFound()

  // Membership guard: only active members can access the group dashboard
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .single()

  const isCreator = group.created_by === user.id
  if (!membership && !isCreator) redirect('/dashboard')

  return (
    <div className="flex min-h-screen gradient-surface">
      <Sidebar groupId={groupId} groupName={group.name} />
      <main className="flex-1 lg:pl-0">
        <div className="p-4 lg:p-8 pt-14 lg:pt-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
