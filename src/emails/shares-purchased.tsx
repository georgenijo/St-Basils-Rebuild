import { Link, Section, Text } from '@react-email/components'
import { EmailLayout, emailStyles } from './components/email-layout'

interface SharesPurchasedProps {
  count: number
  totalAmount: string
  siteUrl?: string
}

export function SharesPurchased({
  count,
  totalAmount,
  siteUrl = 'https://stbasilsboston.org',
}: SharesPurchasedProps) {
  const portalUrl = `${siteUrl}/member/shares`
  const shareWord = count === 1 ? 'share' : 'shares'
  const verb = count === 1 ? 'has' : 'have'

  return (
    <EmailLayout
      previewText={`${count} ${shareWord} purchased — pending payment`}
      heading="Shares Purchased"
      portalUrl={portalUrl}
      portalLabel="View shares"
      siteUrl={siteUrl}
    >
      <Text style={emailStyles.paragraph}>
        {count} remembrance {shareWord} for {totalAmount} {verb} been recorded. Payment is pending.
      </Text>
      <Text style={emailStyles.paragraph}>
        You will receive another email once your payment has been confirmed.
      </Text>
      <Section style={emailStyles.ctaSection}>
        <Link href={portalUrl} style={emailStyles.ctaButton}>
          View shares
        </Link>
      </Section>
    </EmailLayout>
  )
}

export default SharesPurchased
