import { supabase } from '@shared/api/supabase'

export async function getItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
