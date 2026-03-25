import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHero, SectionHeader, Button, Card } from '@/components/ui'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

export const metadata: Metadata = {
  title: 'Giving',
  description:
    "Support St. Basil's Syriac Orthodox Church in Boston through tithes, offerings, and donations. Your generosity sustains our ministries and community programs.",
  openGraph: {
    title: "Giving | St. Basil's Syriac Orthodox Church",
    description:
      "Support St. Basil's Syriac Orthodox Church through tithes, offerings, and donations.",
  },
}

const ministries = [
  {
    title: 'Housing Ministry in India',
    description:
      'Through God\u2019s provision and the generosity of our congregation, we have been blessed to contribute toward building homes for families in need throughout India. These modest dwellings provide shelter, dignity, and a foundation for families to build their lives upon, reflecting Christ\u2019s love through practical care.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    title: 'Caring for Our Community',
    description:
      'Our church family believes in supporting one another through life\u2019s most difficult moments. We are moved by Christian love to provide assistance during serious health challenges and times of loss, reflecting our understanding that we are called to bear one another\u2019s burdens and show compassion.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      </svg>
    ),
  },
  {
    title: 'Clergy Housing Support',
    description:
      'Learning of a newly ordained deacon in India facing difficult living conditions, our congregation felt moved to help provide him with a proper home. This space enables him to prepare spiritually for the Divine Liturgy and serve his community with dignity.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
  {
    title: 'Medical Emergency Relief',
    description:
      'We have received heartfelt requests from individuals and families in India facing serious medical challenges\u2014kidney transplants, cancer treatments, and other urgent procedures. Through our congregation\u2019s compassionate giving, we provide financial assistance for life-saving treatments.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        <polyline points="8 13 11 16 16 10" />
      </svg>
    ),
  },
  {
    title: 'Partnership with Solace Charity',
    description:
      'We are honored to support Solace Charity, an organization dedicated to caring for severely ill and underprivileged children in Kerala, India. Solace provides comprehensive support\u2014from funding critical medical procedures to offering emotional support for families.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    title: 'The Pelican Centre Ministry',
    description:
      'The Pelican Centre in Kerala, India, serves as \u201Can open door for the needy and mentally challenged people of our society,\u201D providing rehabilitation and care that enables individuals to lead fuller, more independent lives. Our support reflects our belief that every person deserves compassion and dignity.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8a2 2 0 0 1 2 2v4a2 2 0 0 1-4 0v-4a2 2 0 0 1 2-2z" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
]

export default function GivingPage() {
  return (
    <>
      <PageHero title="Giving" backgroundImage="/images/giving/hero.png" />

      {/* Introduction */}
      <section className="bg-sand py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="space-y-6 text-center">
              <p className="font-body text-base leading-relaxed text-wood-800 md:text-lg">
                Giving is an act of worship and a reflection of God&rsquo;s abundant love for us.
                As we have been blessed, we are called to bless others through our faithful
                stewardship. Your generous offerings support our church&rsquo;s ministry, help us
                care for our community, and enable us to share Christ&rsquo;s love through
                charitable works.
              </p>

              <div className="rounded-2xl border border-gold-500/20 bg-cream-50 p-6">
                <p className="font-body text-base font-medium text-wood-900">
                  For your convenience, offerings may be sent to our Zelle account:
                </p>
                <p className="mt-2 font-heading text-xl font-semibold text-burgundy-700">
                  stbasilsboston.trsr@gmail.com
                </p>
              </div>

              <p className="font-body text-base text-wood-800/60">
                For questions about giving or other ways to support our ministry, please reach out
                through our{' '}
                <Link
                  href="/contact"
                  className="text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
                >
                  Contact Us
                </Link>{' '}
                page.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Our Heart for Service */}
      <section className="bg-charcoal py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader
              title="Our Heart for Service"
              subtitle="Following Christ's call to serve 'the least of these,' St. Basil's has been blessed to support various charitable causes and organizations over the years. Through the faithful generosity of our church family, we have been able to extend God's love beyond our parish walls."
              className="[&_h2]:text-cream-50 [&_p]:text-cream-50/60"
            />
          </ScrollReveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ministries.map((ministry, i) => (
              <ScrollReveal key={ministry.title} delay={i * 0.12}>
                <Card className="h-full transition-shadow duration-300 hover:shadow-lg motion-safe:transition-all motion-safe:hover:-translate-y-1">
                  <Card.Body className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-burgundy-700/10 text-burgundy-700">
                      {ministry.icon}
                    </div>
                    <h3 className="font-heading text-xl font-semibold text-wood-900">
                      {ministry.title}
                    </h3>
                    <p className="font-body text-sm leading-relaxed text-wood-800/80 md:text-base">
                      {ministry.description}
                    </p>
                  </Card.Body>
                </Card>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal className="mt-12 text-center">
            <p className="font-body text-base text-cream-50/60">
              Contact us to learn more about our ongoing outreach efforts.
            </p>
            <Button href="/contact" variant="secondary" className="mt-6 border-cream-50/30 text-cream-50 hover:bg-cream-50/10 hover:text-cream-50">
              Get in Touch
            </Button>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
