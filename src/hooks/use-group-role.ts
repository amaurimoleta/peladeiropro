'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Role = 'admin' | 'treasurer' | 'member' | null

export function useGroupRole(groupId: string) {
  const [role, setRole] = useState<Role>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRole(null)
        setLoading(false)
        return
      }

      // Check master status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_master')
        .eq('id', user.id)
        .single()

      if (profile?.is_master) {
        setIsMaster(true)
        setRole('admin')
        setLoading(false)
        return
      }

      const { data: member } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .single()

      setRole(member?.role || null)
      setLoading(false)
    }

    fetchRole()
  }, [groupId])

  const isAdmin = role === 'admin' || role === 'treasurer' || isMaster
  const isReadOnly = !isAdmin && role === 'member'

  return { role, isAdmin, isMaster, isReadOnly, loading }
}
