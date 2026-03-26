import type { WithContext, Church, Event, Article, BreadcrumbList } from 'schema-dts'

const SITE_URL = 'https://stbasilsboston.org'
const ORG_NAME = "St. Basil's Syriac Orthodox Church"

export const churchSchema: WithContext<Church> = {
  '@context': 'https://schema.org',
  '@type': 'Church',
  name: ORG_NAME,
  description: `${ORG_NAME} in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.`,
  url: SITE_URL,
  telephone: '+1-617-527-0527',
  logo: `${SITE_URL}/images/logo.png`,
  image: `${SITE_URL}/images/logo.png`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '73 Ellis Street',
    addressLocality: 'Newton',
    addressRegion: 'MA',
    postalCode: '02464',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 42.3375,
    longitude: -71.2093,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Sunday',
      opens: '08:30',
      closes: '12:00',
      description: 'Morning Prayer at 8:30 AM, Holy Qurbono at 9:15 AM',
    },
  ],
  sameAs: ['https://www.facebook.com/stbasilsboston'],
}

export function eventSchema(event: {
  title: string
  startAt: string
  endAt: string | null
  location: string | null
  description: string | null
  slug: string
}): WithContext<Event> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.startAt,
    ...(event.endAt && { endDate: event.endAt }),
    ...(event.description && { description: event.description }),
    url: `${SITE_URL}/events/${event.slug}`,
    ...(event.location && {
      location: {
        '@type': 'Place',
        name: event.location,
        address: {
          '@type': 'PostalAddress',
          streetAddress: '73 Ellis Street',
          addressLocality: 'Newton',
          addressRegion: 'MA',
          postalCode: '02464',
          addressCountry: 'US',
        },
      },
    }),
    organizer: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: SITE_URL,
    },
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  }
}

export function articleSchema(announcement: {
  title: string
  slug: string
  publishedAt: string
  bodyText: string | null
}): WithContext<Article> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: announcement.title,
    url: `${SITE_URL}/announcements/${announcement.slug}`,
    datePublished: announcement.publishedAt,
    ...(announcement.bodyText && {
      description: announcement.bodyText.slice(0, 200),
    }),
    author: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo.png`,
      },
    },
  }
}

interface BreadcrumbItem {
  name: string
  path: string
}

export function breadcrumbSchema(items: BreadcrumbItem[]): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      ...items.map((item, index) => ({
        '@type': 'ListItem' as const,
        position: index + 2,
        name: item.name,
        item: `${SITE_URL}${item.path}`,
      })),
    ],
  }
}
