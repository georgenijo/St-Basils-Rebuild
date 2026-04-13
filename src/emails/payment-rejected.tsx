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

interface PaymentRejectedProps {
  paymentType: string
  amount: string
  method: string
  referenceMemo: string
  reason: string
}

export function PaymentRejected({
  paymentType,
  amount,
  method,
  referenceMemo,
  reason,
}: PaymentRejectedProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your {paymentType} payment of {amount} could not be confirmed
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Payment Not Confirmed</Heading>
          <Hr style={hr} />
          <Section>
            <Text style={intro}>
              Your {paymentType} payment of {amount} via {method} could not be confirmed.
            </Text>
            <Text style={label}>Reference</Text>
            <Text style={value}>{referenceMemo}</Text>
            <Text style={label}>Reason</Text>
            <Text style={value}>{reason}</Text>
          </Section>
          <Hr style={hr} />
          <Text style={callToAction}>
            If you believe this is an error, please contact the church treasurer.
          </Text>
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

const intro = {
  fontSize: '14px',
  color: '#352618',
  margin: '0 0 16px',
  lineHeight: '1.5',
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

const callToAction = {
  fontSize: '13px',
  color: '#6b7280',
  fontStyle: 'italic' as const,
  margin: '0',
}

const footer = {
  fontSize: '12px',
  color: '#9ca3af',
  textAlign: 'center' as const,
  margin: '0',
  whiteSpace: 'pre-line' as const,
}
