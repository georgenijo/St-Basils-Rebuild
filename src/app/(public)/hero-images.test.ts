import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { isValidElement, type ReactElement, type ReactNode } from 'react'
import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sanityFetch = vi.fn()

vi.mock('@/lib/sanity/client', () => ({
  hasSanityConfig: true,
  getSanityClient: vi.fn(),
  sanityFetch: (options: unknown) => sanityFetch(options),
}))
vi.mock('@/lib/sanity/image', () => ({
  urlFor: () => ({ url: () => 'https://cdn.sanity.io/images/test/production/hero.jpg' }),
  SanityImage: () => null,
}))

import { PageHero } from '@/components/ui'

import OurClergyPage from './our-clergy/page'
import OurOrganizationsPage from './our-organizations/page'
import UsefulLinksPageRoute from './useful-links/page'

type AnyElement = ReactElement<Record<string, unknown>>

// Walks the element tree a page returns without rendering child components.
function collectElements(node: ReactNode, found: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    for (const child of node) collectElements(child, found)
  } else if (isValidElement(node)) {
    const element = node as AnyElement
    found.push(element)
    collectElements(element.props.children as ReactNode, found)
  }
  return found
}

function heroOf(tree: ReactNode) {
  const elements = collectElements(tree)
  const heroes = elements.filter((element) => element.type === PageHero)
  const inlineBackgrounds = elements.filter(
    (element) => (element.props.style as { backgroundImage?: string } | undefined)?.backgroundImage
  )
  return { heroes, inlineBackgrounds }
}

describe('public page heroes use the shared next/image PageHero (#320)', () => {
  beforeEach(() => {
    sanityFetch.mockReset()
  })

  it('Our Clergy renders PageHero with the church exterior instead of a CSS background', async () => {
    sanityFetch.mockResolvedValue([])
    const { heroes, inlineBackgrounds } = heroOf(await OurClergyPage())

    expect(heroes).toHaveLength(1)
    expect(heroes[0].props).toMatchObject({
      title: 'Our Clergy',
      backgroundImage: '/images/about/church-exterior.jpg',
    })
    expect(inlineBackgrounds).toEqual([])
  })

  it('Our Organizations renders PageHero with the group photo instead of a CSS background', async () => {
    sanityFetch.mockResolvedValue([])
    const { heroes, inlineBackgrounds } = heroOf(await OurOrganizationsPage())

    expect(heroes).toHaveLength(1)
    expect(heroes[0].props).toMatchObject({
      title: 'Our Organizations',
      backgroundImage: '/images/about/group-photo.jpg',
    })
    expect(inlineBackgrounds).toEqual([])
  })

  it('Useful Links falls back to the church exterior through PageHero', async () => {
    sanityFetch.mockImplementation(({ fallback }: { fallback: unknown }) =>
      Promise.resolve(fallback)
    )
    const { heroes, inlineBackgrounds } = heroOf(await UsefulLinksPageRoute())

    expect(heroes).toHaveLength(1)
    expect(heroes[0].props).toMatchObject({
      title: 'Useful Links',
      backgroundImage: '/images/about/church-exterior.jpg',
    })
    expect(inlineBackgrounds).toEqual([])
  })

  it('Useful Links keeps the Sanity hero image and title through PageHero', async () => {
    sanityFetch.mockImplementation(({ tags }: { tags: string[] }) =>
      Promise.resolve(
        tags.includes('usefulLinksPage')
          ? { pageTitle: 'Resources', heroImage: { asset: { _ref: 'image-hero-jpg' } } }
          : []
      )
    )
    const { heroes, inlineBackgrounds } = heroOf(await UsefulLinksPageRoute())

    expect(heroes).toHaveLength(1)
    expect(heroes[0].props).toMatchObject({
      title: 'Resources',
      backgroundImage: 'https://cdn.sanity.io/images/test/production/hero.jpg',
    })
    expect(inlineBackgrounds).toEqual([])
  })
})

describe('public hero source images stay within the byte budget (#320)', () => {
  const MAX_BYTES = 400 * 1024
  const heroImages = ['church-exterior.jpg', 'group-photo.jpg']

  for (const name of heroImages) {
    it(`${name} is a resized JPEG of at most 400 KB`, async () => {
      const file = path.join(process.cwd(), 'public/images/about', name)
      const metadata = await sharp(readFileSync(file)).metadata()

      expect(metadata.format).toBe('jpeg')
      expect(statSync(file).size).toBeLessThanOrEqual(MAX_BYTES)
      expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(2400)
      expect(metadata.width ?? 0).toBeGreaterThanOrEqual(1200)
    })
  }
})
