import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface ContactNotificationProps {
  name: string
  email: string
  subject: string
  message: string
}

export function ContactNotification({ name, email, subject, message }: ContactNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>New contact form submission: {subject}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>New Contact Form Submission</Heading>
          <Hr style={hr} />
          <Section>
            <Text style={label}>Name</Text>
            <Text style={value}>{name}</Text>
            <Text style={label}>Email</Text>
            <Text style={value}>{email}</Text>
            <Text style={label}>Subject</Text>
            <Text style={value}>{subject}</Text>
            <Text style={label}>Message</Text>
            <Text style={value}>{message}</Text>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            St. Basil&apos;s Syriac Orthodox Church{'\n'}
            73 Ellis Street, Newton, MA 02464
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  backgroundColor: '#f6f6f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '32px',
  borderRadius: '8px',
  maxWidth: '560px',
}

const heading = {
  fontSize: '20px',
  fontWeight: '600' as const,
  color: '#352618',
  margin: '0 0 16px',
}

const hr = {
  borderColor: '#e5e5e5',
  margin: '20px 0',
}

const label = {
  fontSize: '12px',
  fontWeight: '600' as const,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '16px 0 4px',
}

const value = {
  fontSize: '14px',
  color: '#352618',
  margin: '0 0 8px',
  whiteSpace: 'pre-wrap' as const,
}

const footer = {
  fontSize: '12px',
  color: '#9ca3af',
  textAlign: 'center' as const,
  margin: '0',
  whiteSpace: 'pre-line' as const,
}
