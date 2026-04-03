import { SupabaseClient } from '@supabase/supabase-js'

export async function logAudit(
  supabase: SupabaseClient,
  params: {
    groupId: string
    action: string
    entityType: string
    entityId?: string
    details?: Record<string, any>
  }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    let userName = 'Sistema'
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      userName = profile?.full_name || user.email || 'Desconhecido'
    }

    await supabase.from('audit_logs').insert({
      group_id: params.groupId,
      user_id: user?.id || null,
      user_name: userName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || null,
    })
  } catch (err) {
    console.error('Audit log error:', err)
  }
}
