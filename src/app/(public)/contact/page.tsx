import type { Metadata } from 'next'

import { PageHero, SectionHeader, Card } from '@/components/ui'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { ContactForm } from '@/components/features/ContactForm'
import { LazyMap } from '@/components/features/LazyMap'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    "Get in touch with St. Basil's Syriac Orthodox Church in Boston. Reach us by phone, email, or visit us at 73 Ellis Street, Newton, MA 02464.",
  openGraph: {
    title: "Contact Us | St. Basil's Syriac Orthodox Church",
    description:
      "Get in touch with St. Basil's Syriac Orthodox Church in Boston. Reach us by phone, email, or visit us.",
  },
}

const contactInfo = [
  {
    title: 'Visit Us',
    detail: '73 Ellis Street\nNewton, MA 02464',
    href: 'https://maps.google.com/?q=73+Ellis+Street+Newton+MA+02464',
    linkLabel: 'Get Directions',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: 'Call Us',
    detail: '(617) 244-0608',
    href: 'tel:+16172440608',
    linkLabel: 'Call Now',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    title: 'Email Us',
    detail: 'info@stbasilsboston.org',
    href: 'mailto:info@stbasilsboston.org',
    linkLabel: 'Send Email',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
]

export default function ContactPage() {
  return (
    <main>
      <PageHero title="Contact Us" backgroundImage="/images/about/church-exterior.jpg" />

      {/* Contact Info Cards */}
      <section className="bg-sand py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader
              title="Get in Touch"
              subtitle="We would love to hear from you. Whether you have a question, need prayer, or want to learn more about our community, please reach out."
            />
          </ScrollReveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {contactInfo.map((info, i) => (
              <ScrollReveal key={info.title} delay={i * 0.12}>
                <Card className="h-full text-center transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <Card.Body className="flex flex-col items-center space-y-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-burgundy-700/10 text-burgundy-700">
                      {info.icon}
                    </div>
                    <h3 className="font-heading text-xl font-semibold text-wood-900">
                      {info.title}
                    </h3>
                    <p className="whitespace-pre-line font-body text-base text-wood-800/80">
                      {info.detail}
                    </p>
                    <a
                      href={info.href}
                      className="font-body text-sm font-medium text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
                      {...(info.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {info.linkLabel}
                    </a>
                  </Card.Body>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Google Maps Embed */}
      <section className="bg-cream-50 py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader title="Find Us" as="h2" />
          </ScrollReveal>

          <ScrollReveal className="mt-10">
            <LazyMap
              src="https://maps.google.com/maps?q=73+Ellis+Street,+Newton,+MA+02464&z=15&output=embed"
              title="St. Basil's Syriac Orthodox Church location at 73 Ellis Street, Newton, MA"
              className="aspect-video shadow-md"
            />
          </ScrollReveal>
        </div>
      </section>

      {/* Contact Form */}
      <section className="bg-sand py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader
              title="Send Us a Message"
              subtitle="Fill out the form below and we will get back to you as soon as possible."
            />
          </ScrollReveal>

          <ScrollReveal className="relative mt-12">
            <ContactForm />
          </ScrollReveal>
        </div>
      </section>

      {/* Service Times */}
      <section className="bg-charcoal py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader
              title="Sunday Services"
              className="[&_h2]:text-cream-50 [&_p]:text-cream-50/60"
            />
          </ScrollReveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <ScrollReveal delay={0}>
              <Card variant="outlined" className="border-cream-50/10 bg-cream-50/5 text-center">
                <Card.Body className="space-y-2">
                  <h3 className="font-heading text-xl font-semibold text-cream-50">
                    Morning Prayer
                  </h3>
                  <p className="font-body text-2xl font-medium text-gold-500">8:30 AM</p>
                </Card.Body>
              </Card>
            </ScrollReveal>
            <ScrollReveal delay={0.12}>
              <Card variant="outlined" className="border-cream-50/10 bg-cream-50/5 text-center">
                <Card.Body className="space-y-2">
                  <h3 className="font-heading text-xl font-semibold text-cream-50">
                    Holy Qurbono
                  </h3>
                  <p className="font-body text-2xl font-medium text-gold-500">9:15 AM</p>
                </Card.Body>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </main>
  )
}
