'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { themeSettingsSchema, type ThemeSettings } from '@/lib/validators/settings'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

const DEFAULT_FONTS: ThemeSettings['fonts'] = {
  heading: { family: 'Raleway', weights: [300, 400, 600, 700] },
  body: { family: 'Roboto', weights: [400, 500, 700] },
  nav: { family: 'Libre Baskerville', weights: [400, 700] },
}

const DEFAULT_SECTION_ORDER = [
  'hero',
  'service-times',
  'announcements',
  'events',
  'about',
  'contact',
]

export async function getThemeSettings(): Promise<ThemeSettings> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('site_settings')
    .select('fonts, section_order')
    .limit(1)
    .single()

  if (!data) {
    return { fonts: DEFAULT_FONTS, section_order: DEFAULT_SECTION_ORDER }
  }

  return {
    fonts: (data.fonts as ThemeSettings['fonts']) ?? DEFAULT_FONTS,
    section_order: (data.section_order as string[]) ?? DEFAULT_SECTION_ORDER,
  }
}

export async function updateThemeSettings(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Parse JSON fields from FormData
  let rawFonts: unknown
  let rawSectionOrder: unknown

  try {
    rawFonts = JSON.parse(formData.get('fonts') as string)
    rawSectionOrder = JSON.parse(formData.get('section_order') as string)
  } catch {
    return { success: false, message: 'Invalid JSON in form data' }
  }

  // 2. Validate with Zod
  const parsed = themeSettingsSchema.safeParse({
    fonts: rawFonts,
    section_order: rawSectionOrder,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 3. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  // 4. Upsert the singleton row
  const { data: existing } = await supabase.from('site_settings').select('id').limit(1).single()

  if (existing) {
    const { error } = await supabase
      .from('site_settings')
      .update({
        fonts: parsed.data.fonts,
        section_order: parsed.data.section_order,
        updated_by: user.id,
      })
      .eq('id', existing.id)

    if (error) {
      return { success: false, message: 'Failed to update settings' }
    }
  } else {
    const { error } = await supabase.from('site_settings').insert({
      fonts: parsed.data.fonts,
      section_order: parsed.data.section_order,
      updated_by: user.id,
    })

    if (error) {
      return { success: false, message: 'Failed to save settings' }
    }
  }

  // 5. Revalidate all pages so they pick up new fonts
  revalidatePath('/', 'layout')
  return { success: true, message: 'Theme settings saved successfully' }
}
