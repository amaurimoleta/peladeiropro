import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('monthly_fees')
    .update({ status: 'overdue' })
    .eq('status', 'pending')
    .lt('due_date', new Date().toISOString().split('T')[0])
    .select('id')

  return new Response(JSON.stringify({
    updated: data?.length || 0,
    error: error?.message
  }), { headers: { 'Content-Type': 'application/json' } })
})
