import { PortableText } from 'next-sanity'
import type { PortableTextReactComponents } from '@portabletext/react'

import { urlFor } from '@/lib/sanity/image'
import { PageHero } from '@/components/ui'

import type { PageContent } from '@/lib/sanity/types'

const legalComponents: Partial<PortableTextReactComponents> = {
  block: {
    normal: ({ children }) => <p className="mb-6 text-[17px] leading-[1.8]">{children}</p>,
    h2: ({ children }) => (
      <h2 className="mb-4 mt-10 font-heading text-[1.75rem] font-semibold leading-[1.3] text-wood-900 md:text-[2.25rem]">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-3 mt-8 font-heading text-[1.25rem] font-semibold leading-[1.4] text-wood-900 md:text-[1.5rem]">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mb-2 mt-6 font-heading text-lg font-semibold leading-[1.4] text-wood-900">
        {children}
      </h4>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="mb-6 list-disc space-y-2 pl-6 text-[17px] leading-[1.8]">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="mb-6 list-decimal space-y-2 pl-6 text-[17px] leading-[1.8]">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li>{children}</li>,
    number: ({ children }) => <li>{children}</li>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
    link: ({ value, children }) => {
      const href = value?.href || ''
      const isExternal = href.startsWith('http')
      return (
        <a
          href={href}
          className="font-medium text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {children}
        </a>
      )
    },
  },
}

export interface LegalPageLayoutProps {
  page: PageContent
}

export function LegalPageLayout({ page }: LegalPageLayoutProps) {
  const formattedDate = page.effectiveDate
    ? new Date(page.effectiveDate + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <>
      {page.heroStyle === 'parallax-image' && page.heroImage ? (
        <PageHero title={page.title} backgroundImage={urlFor(page.heroImage).url()} />
      ) : (
        <section className="flex items-center justify-center bg-burgundy-700 py-16 md:py-22">
          <h1 className="animate-drop-in px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
            {page.title}
          </h1>
        </section>
      )}

      <section className="py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {formattedDate && (
            <p className="mb-8 text-sm text-wood-800/60">Effective Date: {formattedDate}</p>
          )}

          <div className="font-legal text-justify text-wood-800">
            <PortableText value={page.body} components={legalComponents} />
          </div>
        </div>
      </section>
    </>
  )
}
