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

interface AnnouncementBroadcastProps {
  title: string
  bodyHtml: string
  slug: string
  unsubscribeToken: string
  siteUrl?: string
}

const CHURCH_NAME = "St. Basil's Syriac Orthodox Church"
const CHURCH_ADDRESS = '73 Ellis Street, Newton, MA 02464'

export function AnnouncementBroadcast({
  title = 'Announcement Title',
  bodyHtml = '<p>Announcement content goes here.</p>',
  slug = 'example-announcement',
  unsubscribeToken = '00000000-0000-0000-0000-000000000000',
  siteUrl = 'https://stbasilsboston.org',
}: AnnouncementBroadcastProps) {
  const readUrl = `${siteUrl}/announcements/${slug}`
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${unsubscribeToken}`

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={headerText}>{CHURCH_NAME}</Text>
          </Section>
          <Section style={content}>
            <Heading style={heading}>{title}</Heading>
            <Hr style={goldDivider} />
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            <Section style={ctaSection}>
              <Link href={readUrl} style={ctaButton}>
                Read on our website
              </Link>
            </Section>
          </Section>
          <Section style={footerSection}>
            <Text style={footerText}>
              {CHURCH_NAME}
              {'\n'}
              {CHURCH_ADDRESS}
            </Text>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={unsubscribeLink}>
                Unsubscribe
              </Link>{' '}
              from future announcements.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AnnouncementBroadcast

// ─── Styles ──────────────────────────────────────────────────────────

const body = {
  backgroundColor: '#f6f6f6',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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

const ctaSection = {
  marginTop: '24px',
}

const ctaButton = {
  display: 'inline-block' as const,
  padding: '10px 24px',
  backgroundColor: '#9B1B3D',
  color: '#FFFDF8',
  textDecoration: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500' as const,
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

const unsubscribeLink = {
  color: '#9ca3af',
  textDecoration: 'underline',
}
