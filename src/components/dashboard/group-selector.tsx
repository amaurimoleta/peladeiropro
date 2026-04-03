'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Users } from 'lucide-react'
import { MEMBER_ROLES } from '@/lib/types'

interface UserGroup {
  id: string
  name: string
  role: string
}

export function GroupSelector({ currentGroupId, currentGroupName }: { currentGroupId: string; currentGroupName: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberships } = await supabase
        .from('group_members')
        .select('role, group_id, groups(id, name)')
        .eq('profile_id', user.id)
        .eq('status', 'active')

      if (memberships) {
        const userGroups: UserGroup[] = memberships.map((m: any) => ({
          id: m.groups.id,
          name: m.groups.name,
          role: m.role,
        }))
        setGroups(userGroups)
      }
    }

    load()
  }, [])

  function handleSelect(groupId: string) {
    setOpen(false)
    router.push(`/dashboard/${groupId}`)
  }

  function handleCreate() {
    setOpen(false)
    router.push('/dashboard')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-200"
      >
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#00C853] to-[#00A843] flex items-center justify-center flex-shrink-0">
          <Users className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-navy dark:text-gray-100 truncate">
            {currentGroupName}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto py-1">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelect(group.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    group.id === currentGroupId ? 'bg-[#00C853]/5' : ''
                  }`}
                >
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#00C853] to-[#00A843] flex items-center justify-center flex-shrink-0">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-navy dark:text-gray-100 truncate">
                      {group.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {MEMBER_ROLES[group.role] || group.role}
                    </p>
                  </div>
                  {group.id === currentGroupId && (
                    <div className="h-2 w-2 rounded-full bg-[#00C853] flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 p-1">
              <button
                type="button"
                onClick={handleCreate}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <div className="h-7 w-7 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Criar novo grupo</p>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
