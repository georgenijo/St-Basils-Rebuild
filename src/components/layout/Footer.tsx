import Link from 'next/link'

import { GoldDivider } from '@/components/ui'
import { NewsletterSignupForm } from '@/components/features/NewsletterSignupForm'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-charcoal text-cream-50">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Church Info */}
          <div>
            <h2 className="font-heading text-xl font-600 text-cream-50">
              St. Basil&#39;s Syriac Orthodox Church
            </h2>
            <address className="mt-4 not-italic leading-relaxed text-cream-50/80">
              73 Ellis Street
              <br />
              Newton, MA 02464
            </address>
          </div>

          {/* Service Times */}
          <div>
            <h2 className="font-heading text-xl font-600 text-cream-50">Sunday Services</h2>
            <dl className="mt-4 space-y-2 text-cream-50/80">
              <div>
                <dt className="font-medium text-cream-50">Morning Prayer</dt>
                <dd>8:30 AM EST</dd>
              </div>
              <div>
                <dt className="font-medium text-cream-50">Holy Qurbono</dt>
                <dd>9:15 AM EST</dd>
              </div>
            </dl>
          </div>

          {/* Links & Social */}
          <div>
            <h2 className="font-heading text-xl font-600 text-cream-50">Quick Links</h2>
            <nav aria-label="Footer navigation" className="mt-4">
              <ul className="space-y-2 text-cream-50/80">
                <li>
                  <Link href="/contact" className="transition-colors hover:text-cream-50">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="transition-colors hover:text-cream-50">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-use" className="transition-colors hover:text-cream-50">
                    Terms of Use
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="mt-6">
              <a
                href="https://www.facebook.com/stbasilsboston"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="St. Basil's on Facebook"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream-50/20 text-cream-50/80 transition-colors hover:border-cream-50/40 hover:text-cream-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 1.09.044 1.613.115V7.93h-1.143c-1.628 0-2.131.891-2.131 2.228v1.49h3.165l-.567 3.667h-2.598v8.376C18.788 23.022 24 18.091 24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.635 3.887 10.36 9.101 11.691Z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Newsletter Signup */}
          <div>
            <h2 className="font-heading text-xl font-600 text-cream-50">Stay Connected</h2>
            <p className="mt-4 text-sm leading-relaxed text-cream-50/80">
              Get church announcements and updates delivered to your inbox.
            </p>
            <NewsletterSignupForm variant="dark" className="mt-4" />
          </div>
        </div>

        <GoldDivider className="my-10" />

        <p className="text-center text-sm text-cream-50/60">
          &copy; {currentYear} St. Basil&#39;s Syriac Orthodox Church. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
