import { PortableText, type PortableTextComponents } from 'next-sanity'

import { cn } from '@/lib/utils'
import { sanityFetch } from '@/lib/sanity/client'
import { SanityImage } from '@/lib/sanity/image'
import { pageContentBySlugQuery } from '@/lib/sanity/queries'
import { ScrollReveal } from '@/components/ui'

import type { PageContent } from '@/lib/sanity/types'

export interface LegalPageLayoutProps {
  slug: string
}

const portableTextComponents: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="mt-10 mb-4 font-heading text-[1.75rem] font-semibold leading-[1.3] text-wood-900 md:text-[2.25rem]">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-8 mb-3 font-heading text-[1.25rem] font-semibold leading-[1.4] text-wood-900 md:text-[1.5rem]">
        {children}
      </h3>
    ),
    normal: ({ children }) => (
      <p className="mb-4 text-base leading-relaxed text-wood-800">{children}</p>
    ),
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
    link: ({ value, children }) => (
      <a
        href={value?.href}
        target={value?.href?.startsWith('http') ? '_blank' : undefined}
        rel={value?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="font-medium text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
      >
        {children}
      </a>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="mb-4 ml-6 list-disc space-y-2 text-base leading-relaxed text-wood-800">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="mb-4 ml-6 list-decimal space-y-2 text-base leading-relaxed text-wood-800">
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li>{children}</li>,
    number: ({ children }) => <li>{children}</li>,
  },
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export async function LegalPageLayout({ slug }: LegalPageLayoutProps) {
  const page = await sanityFetch<PageContent | null>({
    query: pageContentBySlugQuery,
    params: { slug },
    tags: [`pageContent:${slug}`],
  })

  if (!page) {
    return (
      <section className="py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <p className="text-center text-wood-800">Content not found.</p>
        </div>
      </section>
    )
  }

  const isParallax = page.heroStyle === 'parallax-image' && page.heroImage

  return (
    <>
      {/* Hero */}
      {isParallax ? (
        <section className="relative flex h-[40vh] items-center justify-center overflow-hidden md:h-[60vh]">
          <SanityImage
            image={page.heroImage!}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <h1 className="relative z-10 animate-drop-in px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
            {page.title}
          </h1>
        </section>
      ) : (
        <section className="flex items-center justify-center bg-burgundy-700 py-16 md:py-20">
          <h1 className="animate-drop-in px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
            {page.title}
          </h1>
        </section>
      )}

      {/* Body */}
      <section className="py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <article className="mx-auto max-w-3xl">
              {/* Date info */}
              {(page.effectiveDate || page.lastUpdated) && (
                <div className="mb-8 space-y-1 border-b border-wood-800/10 pb-6 text-sm text-wood-800/60">
                  {page.effectiveDate && (
                    <p>Effective date: {formatDate(page.effectiveDate)}</p>
                  )}
                  {page.lastUpdated && (
                    <p>Last updated: {formatDate(page.lastUpdated)}</p>
                  )}
                </div>
              )}

              {/* Portable Text content */}
              <div className={cn('prose-legal')}>
                <PortableText value={page.body} components={portableTextComponents} />
              </div>
            </article>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
