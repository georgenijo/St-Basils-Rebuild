import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sanityFetch = vi.fn()

vi.mock('@/lib/sanity/client', () => ({
  hasSanityConfig: true,
  getSanityClient: () => ({
    config: () => ({ projectId: 'fixture', dataset: 'synthetic' }),
  }),
  sanityFetch: (options: unknown) => sanityFetch(options),
}))

import AcolytesChoirPage from './page'

const heroImage = {
  asset: { _ref: 'image-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-2400x1600-jpg' },
  hotspot: { x: 0.2, y: 0.75, width: 0.1, height: 0.1 },
}

async function renderHero() {
  const markup = renderToStaticMarkup(await AcolytesChoirPage())
  return markup.slice(markup.indexOf('<section'), markup.indexOf('</section>') + 10)
}

describe('Acolytes & Choir responsive hero (#398)', () => {
  beforeEach(() => sanityFetch.mockReset())

  it('renders a decorative optimized photo with responsive sizes and the Sanity hotspot', async () => {
    sanityFetch.mockResolvedValue({ pageTitle: 'Synthetic Choir', heroImage })
    const markup = await renderHero()

    expect(markup).toContain('<img alt=""')
    expect(markup).toContain('sizes="100vw"')
    expect(markup).toContain('srcSet="/_next/image?url=')
    expect(markup).toContain(' 640w, ')
    expect(markup).toContain(' 1920w, ')
    expect(markup).toContain('object-position:20% 75%')
    expect(markup).toContain('object-cover')
    expect(markup).toContain('Synthetic Choir</h1>')
    expect(markup).not.toContain('background-image')
    expect(markup).not.toContain('bg-fixed')
    expect(markup).not.toContain('w%3D1920')
  })

  it('keeps an image without a hotspot centered', async () => {
    sanityFetch.mockResolvedValue({ heroImage: { asset: heroImage.asset } })
    const markup = await renderHero()

    expect(markup).toContain('<img alt=""')
    expect(markup).not.toContain('object-position')
  })

  it.each([null, { pageTitle: 'Synthetic Choir' }])(
    'preserves the charcoal fallback, overlay, heading and responsive height without a photo (%j)',
    async (page) => {
      sanityFetch.mockResolvedValue(page)
      const markup = await renderHero()

      expect(markup).toContain('absolute inset-0 bg-charcoal" aria-hidden="true"')
      expect(markup).toContain('absolute inset-0 bg-black/50" aria-hidden="true"')
      expect(markup).toContain('h-[40vh]')
      expect(markup).toContain('md:h-[60vh]')
      expect(markup).toContain(`${page?.pageTitle || 'Our Acolytes &amp; Choir'}</h1>`)
      expect(markup.match(/<h1 /g)).toHaveLength(1)
      expect(markup).not.toContain('<img')
      expect(markup).not.toContain('background-image')
    }
  )
})
