import { Link, Section, Text } from '@react-email/components'
import { EmailLayout, emailStyles } from './components/email-layout'

interface SharesPaidProps {
  count: number
  totalAmount: string
  siteUrl?: string
}

export function SharesPaid({
  count,
  totalAmount,
  siteUrl = 'https://stbasilsboston.org',
}: SharesPaidProps) {
  const portalUrl = `${siteUrl}/member/shares`
  const shareWord = count === 1 ? 'share' : 'shares'
  const verb = count === 1 ? 'has' : 'have'

  return (
    <EmailLayout
      previewText={`Your ${count} ${shareWord} (${totalAmount}) ${verb} been confirmed`}
      heading="Shares Confirmed"
      portalUrl={portalUrl}
      portalLabel="View shares"
      siteUrl={siteUrl}
    >
      <Text style={emailStyles.paragraph}>
        Payment for {count} {shareWord} totaling {totalAmount} {verb} been confirmed. Thank you.
      </Text>
      <Section style={emailStyles.ctaSection}>
        <Link href={portalUrl} style={emailStyles.ctaButton}>
          View shares
        </Link>
      </Section>
    </EmailLayout>
  )
}

export default SharesPaid
