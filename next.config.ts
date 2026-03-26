import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
    ],
  },
  async redirects() {
    return [
      // Active pages
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/about.html', destination: '/about', permanent: true },
      {
        source: '/spiritual-leader.html',
        destination: '/spiritual-leaders',
        permanent: true,
      },
      {
        source: '/our-clergy.html',
        destination: '/our-clergy',
        permanent: true,
      },
      {
        source: '/office-bearers.html',
        destination: '/office-bearers',
        permanent: true,
      },
      {
        source: '/acolytes-choir.html',
        destination: '/acolytes-choir',
        permanent: true,
      },
      {
        source: '/our-organizations.html',
        destination: '/our-organizations',
        permanent: true,
      },
      {
        source: '/events-calendar.html',
        destination: '/events',
        permanent: true,
      },
      {
        source: '/events-calendar',
        destination: '/events',
        permanent: true,
      },
      {
        source: '/useful-links.html',
        destination: '/useful-links',
        permanent: true,
      },
      {
        source: '/first-time.html',
        destination: '/first-time',
        permanent: true,
      },
      { source: '/giving.html', destination: '/giving', permanent: true },
      {
        source: '/contact-us.html',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/privacy-policy.html',
        destination: '/privacy-policy',
        permanent: true,
      },
      {
        source: '/terms-of-use.html',
        destination: '/terms-of-use',
        permanent: true,
      },

      // Orphaned pages → consolidated under /our-organizations
      {
        source: '/sunday-school.html',
        destination: '/our-organizations',
        permanent: true,
      },
      {
        source: '/stpauls-mensfellow.html',
        destination: '/our-organizations',
        permanent: true,
      },
      {
        source: '/stmarys-womens.html',
        destination: '/our-organizations',
        permanent: true,
      },
      { source: '/youth.html', destination: '/our-organizations', permanent: true },

      // Unused template pages → homepage
      {
        source: '/portfolio-details.html',
        destination: '/',
        permanent: true,
      },
      {
        source: '/starter-page.html',
        destination: '/',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
