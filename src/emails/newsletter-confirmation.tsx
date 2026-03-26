import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface NewsletterConfirmationProps {
  confirmUrl: string
  siteUrl?: string
}

const CHURCH_NAME = "St. Basil's Syriac Orthodox Church"
const CHURCH_ADDRESS = '73 Ellis Street, Newton, MA 02464'

export function NewsletterConfirmation({
  confirmUrl = 'https://stbasilsboston.org/api/newsletter/confirm?token=example',
  siteUrl = 'https://stbasilsboston.org',
}: NewsletterConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your subscription to {CHURCH_NAME}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={headerText}>{CHURCH_NAME}</Text>
          </Section>
          <Section style={content}>
            <Heading style={heading}>Confirm Your Subscription</Heading>
            <Hr style={goldDivider} />
            <Text style={paragraph}>
              Thank you for subscribing to announcements from {CHURCH_NAME}. Please confirm your
              email address by clicking the button below.
            </Text>
            <Section style={ctaSection}>
              <Link href={confirmUrl} style={ctaButton}>
                Confirm Subscription
              </Link>
            </Section>
            <Text style={smallText}>
              If you didn&apos;t request this, you can safely ignore this email.
            </Text>
          </Section>
          <Section style={footerSection}>
            <Text style={footerText}>
              {CHURCH_NAME}
              {'\n'}
              {CHURCH_ADDRESS}
            </Text>
            <Text style={footerText}>
              <Link href={siteUrl} style={footerLink}>
                stbasilsboston.org
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default NewsletterConfirmation

// ─── Styles ──────────────────────────────────────────────────────────

const body = {
  backgroundColor: '#f6f6f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
  padding: '0',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  borderRadius: '8px',
  maxWidth: '560px',
  overflow: 'hidden' as const,
}

const header = {
  backgroundColor: '#253341',
  padding: '24px 32px',
  textAlign: 'center' as const,
}

const headerText = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#FFFDF8',
  letterSpacing: '0.02em',
  margin: '0',
}

const content = {
  padding: '32px',
}

const heading = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#352618',
  lineHeight: '1.3',
  margin: '0 0 16px',
}

const goldDivider = {
  borderColor: '#D4A017',
  borderWidth: '2px',
  borderStyle: 'solid' as const,
  width: '60px',
  margin: '0 0 24px',
}

const paragraph = {
  fontSize: '14px',
  color: '#4A3729',
  lineHeight: '1.6',
  margin: '0 0 24px',
}

const ctaSection = {
  marginBottom: '24px',
}

const ctaButton = {
  display: 'inline-block' as const,
  padding: '12px 28px',
  backgroundColor: '#9B1B3D',
  color: '#FFFDF8',
  textDecoration: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500' as const,
}

const smallText = {
  fontSize: '12px',
  color: '#9ca3af',
  lineHeight: '1.5',
  margin: '0',
}

const footerSection = {
  padding: '24px 32px',
  borderTop: '1px solid #e5e5e5',
}

const footerText = {
  fontSize: '12px',
  color: '#9ca3af',
  textAlign: 'center' as const,
  margin: '0 0 8px',
  lineHeight: '1.5',
  whiteSpace: 'pre-line' as const,
}

const footerLink = {
  color: '#9ca3af',
  textDecoration: 'underline',
}
