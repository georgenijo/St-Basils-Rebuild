import type { Metadata } from 'next'

import { getThemeSettings } from '@/actions/settings'
import { ThemeCustomizer } from './ThemeCustomizer'

export const metadata: Metadata = {
  title: 'Settings',
}

export default async function SettingsPage() {
  const settings = await getThemeSettings()

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">Theme Settings</h1>
        <p className="mt-1 font-body text-sm text-wood-800/60">
          Customize fonts and homepage section ordering for the public site.
        </p>
      </div>

      <ThemeCustomizer
        currentFonts={settings.fonts}
        currentSectionOrder={settings.section_order}
      />
    </main>
  )
}
