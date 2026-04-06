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

  // Check if user is master
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_master')
    .eq('id', user.id)
    .single()

  const isMaster = profile?.is_master === true

  // Membership guard: only active members, creator, or master can access
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .single()

  const isCreator = group.created_by === user.id
  if (!membership && !isCreator && !isMaster) redirect('/dashboard')

  return (
    <div className="flex min-h-screen gradient-surface">
      <Sidebar groupId={groupId} groupName={group.name} />
      <main className="flex-1 min-w-0 overflow-x-hidden lg:pl-0">
        <div className="p-4 lg:p-8 pt-14 lg:pt-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
