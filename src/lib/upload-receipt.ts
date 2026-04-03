import { SupabaseClient } from '@supabase/supabase-js'

export async function uploadReceipt(
  supabase: SupabaseClient,
  file: File,
  groupId: string
): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const fileName = `${groupId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('receipts')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data } = supabase.storage.from('receipts').getPublicUrl(fileName)
  return data.publicUrl
}
