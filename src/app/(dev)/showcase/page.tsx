import { Metadata } from 'next'

import {
  Button,
  GoldDivider,
  SectionHeader,
} from '@/components/ui'

export const metadata: Metadata = {
  title: 'Component Showcase',
  description: 'Dev-only showcase of all UI component variants.',
  robots: 'noindex',
}

export default function ShowcasePage() {
  return (
    <main className="min-h-screen bg-cream-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px] space-y-20">
        {/* Page Title */}
        <div className="text-center">
          <h1 className="font-heading text-[2rem] font-semibold text-wood-900 md:text-[3rem]">
            Component Showcase
          </h1>
          <p className="mt-2 font-body text-wood-800/60">
            All UI component variants — dev only
          </p>
        </div>

        {/* GoldDivider */}
        <section className="space-y-6">
          <h2 className="font-heading text-[1.75rem] font-semibold text-wood-900">
            GoldDivider
          </h2>
          <div className="space-y-8 rounded-2xl bg-sand p-8">
            <div>
              <p className="mb-3 font-body text-sm text-wood-800/60">Default</p>
              <GoldDivider />
            </div>
            <div>
              <p className="mb-3 font-body text-sm text-wood-800/60">
                Custom width (max-w-[100px])
              </p>
              <GoldDivider className="max-w-[100px]" />
            </div>
            <div>
              <p className="mb-3 font-body text-sm text-wood-800/60">
                Left-aligned (mx-0)
              </p>
              <GoldDivider className="mx-0" />
            </div>
          </div>
        </section>

        {/* Button */}
        <section className="space-y-6">
          <h2 className="font-heading text-[1.75rem] font-semibold text-wood-900">
            Button
          </h2>

          {/* Variants */}
          <div className="space-y-4 rounded-2xl bg-sand p-8">
            <p className="font-body text-sm text-wood-800/60">Variants</p>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </div>

          {/* Sizes */}
          <div className="space-y-4 rounded-2xl bg-sand p-8">
            <p className="font-body text-sm text-wood-800/60">Sizes</p>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          {/* States */}
          <div className="space-y-4 rounded-2xl bg-sand p-8">
            <p className="font-body text-sm text-wood-800/60">States</p>
            <div className="flex flex-wrap items-center gap-4">
              <Button>Default</Button>
              <Button disabled>Disabled</Button>
              <Button href="/showcase">As Link</Button>
            </div>
          </div>
        </section>

        {/* SectionHeader */}
        <section className="space-y-6">
          <h2 className="font-heading text-[1.75rem] font-semibold text-wood-900">
            SectionHeader
          </h2>

          <div className="space-y-12 rounded-2xl bg-sand p-8">
            <div>
              <p className="mb-4 font-body text-sm text-wood-800/60">
                Centered (default) — h2
              </p>
              <SectionHeader
                title="Our History"
                subtitle="Learn about the rich heritage of St. Basil's"
              />
            </div>

            <div>
              <p className="mb-4 font-body text-sm text-wood-800/60">
                Left-aligned — h2
              </p>
              <SectionHeader
                title="Upcoming Events"
                subtitle="Join us for worship and community gatherings"
                align="left"
              />
            </div>

            <div>
              <p className="mb-4 font-body text-sm text-wood-800/60">
                As h1
              </p>
              <SectionHeader
                as="h1"
                title="Welcome to St. Basil's"
                subtitle="Serving the Jacobite Malayalee community in New England"
              />
            </div>

            <div>
              <p className="mb-4 font-body text-sm text-wood-800/60">
                As h3, no subtitle
              </p>
              <SectionHeader as="h3" title="Quick Links" />
            </div>
          </div>
        </section>

        {/* Placeholder sections for pending components */}
        <section className="space-y-6">
          <h2 className="font-heading text-[1.75rem] font-semibold text-wood-900">
            Pending Components
          </h2>
          <div className="rounded-2xl border border-dashed border-wood-800/20 p-8">
            <ul className="list-inside list-disc space-y-2 font-body text-wood-800/60">
              <li>Card — P1-03 (not yet merged)</li>
              <li>PageHero — P1-05 (not yet merged)</li>
              <li>ScrollReveal — P1-06 (not yet merged)</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  )
}
