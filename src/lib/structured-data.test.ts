import { describe, it, expect } from 'vitest'

import { churchSchema, eventSchema, articleSchema, breadcrumbSchema } from '@/lib/structured-data'

describe('churchSchema', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema = churchSchema as any

  it('has correct @type and @context', () => {
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@type']).toBe('Church')
  })

  it('includes church name and address', () => {
    expect(schema.name).toContain("St. Basil's")
    expect(schema.address).toMatchObject({
      '@type': 'PostalAddress',
      streetAddress: '73 Ellis Street',
      addressLocality: 'Newton',
      addressRegion: 'MA',
      postalCode: '02464',
    })
  })
})

describe('eventSchema', () => {
  it('generates valid Event JSON-LD with required fields', () => {
    const result = eventSchema({
      title: 'Sunday Qurbono',
      startAt: '2026-03-29T13:15:00.000Z',
      endAt: null,
      location: null,
      description: null,
      slug: 'sunday-qurbono',
    })

    expect(result['@type']).toBe('Event')
    expect(result.name).toBe('Sunday Qurbono')
    expect(result.startDate).toBe('2026-03-29T13:15:00.000Z')
    expect(result.url).toBe('https://stbasilsboston.org/events/sunday-qurbono')
    expect(result).not.toHaveProperty('endDate')
    expect(result).not.toHaveProperty('description')
    expect(result).not.toHaveProperty('location')
  })

  it('includes optional fields when provided', () => {
    const result = eventSchema({
      title: 'Potluck',
      startAt: '2026-04-01T17:00:00.000Z',
      endAt: '2026-04-01T20:00:00.000Z',
      location: 'Parish Hall',
      description: 'Bring a dish to share',
      slug: 'potluck',
    })

    expect(result.endDate).toBe('2026-04-01T20:00:00.000Z')
    expect(result.description).toBe('Bring a dish to share')
    expect(result.location).toMatchObject({
      '@type': 'Place',
      name: 'Parish Hall',
    })
  })
})

describe('articleSchema', () => {
  it('generates valid Article JSON-LD', () => {
    const result = articleSchema({
      title: 'Easter Service Update',
      slug: 'easter-service-update',
      publishedAt: '2026-03-25T12:00:00.000Z',
      bodyText: null,
    })

    expect(result['@type']).toBe('Article')
    expect(result.headline).toBe('Easter Service Update')
    expect(result.url).toBe('https://stbasilsboston.org/announcements/easter-service-update')
    expect(result).not.toHaveProperty('description')
  })

  it('truncates body text to 200 characters for description', () => {
    const longText = 'A'.repeat(300)
    const result = articleSchema({
      title: 'Test',
      slug: 'test',
      publishedAt: '2026-01-01T00:00:00.000Z',
      bodyText: longText,
    })

    expect(result.description).toHaveLength(200)
  })
})

describe('breadcrumbSchema', () => {
  it('includes Home as first item', () => {
    const result = breadcrumbSchema([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = result.itemListElement as any[]
    expect(result['@type']).toBe('BreadcrumbList')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://stbasilsboston.org',
    })
  })

  it('appends items with correct positions', () => {
    const result = breadcrumbSchema([
      { name: 'Events', path: '/events' },
      { name: 'Sunday Qurbono', path: '/events/sunday-qurbono' },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = result.itemListElement as any[]
    expect(items).toHaveLength(3)
    expect(items[1]).toMatchObject({
      position: 2,
      name: 'Events',
      item: 'https://stbasilsboston.org/events',
    })
    expect(items[2]).toMatchObject({
      position: 3,
      name: 'Sunday Qurbono',
      item: 'https://stbasilsboston.org/events/sunday-qurbono',
    })
  })
})
