import type { SupabaseClient } from '@supabase/supabase-js'

/** Display names for requester / author ids (profiles are admin-readable). */
export async function fetchPeopleNames(
  supabase: Pick<SupabaseClient, 'from'>,
  ids: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
  const names = new Map<string, string>()
  if (unique.length === 0) return names

  const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', unique)
  for (const row of (data ?? []) as {
    id: string
    full_name: string | null
    email: string | null
  }[]) {
    names.set(row.id, row.full_name || row.email || 'Unknown admin')
  }
  return names
}
