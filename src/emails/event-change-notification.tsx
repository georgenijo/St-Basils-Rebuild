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

export type EventChangeType = 'cancelled' | 'modified' | 'restored'

interface EventChangeNotificationProps {
  changeType: EventChangeType
  eventTitle: string
  eventDate: string
  eventTime: string
  changes?: string[]
  reason?: string
  nextOccurrence?: string
  note?: string
  unsubscribeToken: string
  siteUrl?: string
}

const CHURCH_NAME = "St. Basil's Syriac Orthodox Church"
const CHURCH_ADDRESS = '73 Ellis Street, Newton, MA 02464'

function previewText(props: EventChangeNotificationProps): string {
  switch (props.changeType) {
    case 'cancelled':
      return `${props.eventTitle} on ${props.eventDate} has been cancelled`
    case 'modified':
      return `${props.eventTitle} on ${props.eventDate} — schedule change`
    case 'restored':
      return `${props.eventTitle} on ${props.eventDate} is back on`
  }
}

function CancelledContent({
  eventDate,
  eventTime,
  reason,
  nextOccurrence,
}: Pick<EventChangeNotificationProps, 'eventDate' | 'eventTime' | 'reason' | 'nextOccurrence'>) {
  return (
    <>
      <Text style={bodyText}>
        The occurrence scheduled for <strong>{eventDate}</strong> at <strong>{eventTime}</strong>{' '}
        has been cancelled.
      </Text>
      {reason && (
        <Section style={reasonBox}>
          <Text style={reasonLabel}>Reason</Text>
          <Text style={reasonText}>{reason}</Text>
        </Section>
      )}
      {nextOccurrence ? (
        <Text style={bodyText}>
          The next scheduled occurrence is <strong>{nextOccurrence}</strong>.
        </Text>
      ) : (
        <Text style={bodyText}>This was the final scheduled occurrence.</Text>
      )}
    </>
  )
}

function ModifiedContent({
  eventDate,
  changes,
  note,
}: Pick<EventChangeNotificationProps, 'eventDate' | 'changes' | 'note'>) {
  return (
    <>
      <Text style={bodyText}>
        The occurrence on <strong>{eventDate}</strong> has been updated.
      </Text>
      {changes && changes.length > 0 && (
        <Section style={changeListSection}>
          {changes.map((change, i) => (
            <Text key={i} style={changeItem}>
              {change}
            </Text>
          ))}
        </Section>
      )}
      {note && (
        <Text style={noteText}>
          <strong>Note:</strong> {note}
        </Text>
      )}
    </>
  )
}

function RestoredContent({
  eventDate,
  eventTime,
  note,
}: Pick<EventChangeNotificationProps, 'eventDate' | 'eventTime' | 'note'>) {
  return (
    <>
      <Text style={bodyText}>
        Good news! The occurrence on <strong>{eventDate}</strong> at <strong>{eventTime}</strong> is
        back on as scheduled.
      </Text>
      {note && (
        <Text style={noteText}>
          <strong>Note:</strong> {note}
        </Text>
      )}
    </>
  )
}

export function EventChangeNotification({
  changeType = 'cancelled',
  eventTitle = 'Event Title',
  eventDate = 'Sunday, April 19, 2026',
  eventTime = '9:15 AM',
  changes = [],
  reason,
  nextOccurrence,
  note,
  unsubscribeToken = '00000000-0000-0000-0000-000000000000',
  siteUrl = 'https://stbasilsboston.org',
}: EventChangeNotificationProps) {
  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${unsubscribeToken}`

  return (
    <Html>
      <Head />
      <Preview>
        {previewText({ changeType, eventTitle, eventDate, eventTime, unsubscribeToken })}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={headerText}>{CHURCH_NAME}</Text>
          </Section>
          <Section style={content}>
            <Heading style={heading}>{eventTitle}</Heading>
            <Hr style={goldDivider} />
            {changeType === 'cancelled' && (
              <CancelledContent
                eventDate={eventDate}
                eventTime={eventTime}
                reason={reason}
                nextOccurrence={nextOccurrence}
              />
            )}
            {changeType === 'modified' && (
              <ModifiedContent eventDate={eventDate} changes={changes} note={note} />
            )}
            {changeType === 'restored' && (
              <RestoredContent eventDate={eventDate} eventTime={eventTime} note={note} />
            )}
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
              from future notifications.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default EventChangeNotification

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

const bodyText = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#4A3729',
  margin: '0 0 16px',
}

const reasonBox = {
  backgroundColor: '#FEF2F2',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '0 0 16px',
  borderLeft: '3px solid #DC2626',
}

const reasonLabel = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#DC2626',
  margin: '0 0 4px',
}

const reasonText = {
  fontSize: '14px',
  color: '#7F1D1D',
  margin: '0',
  lineHeight: '1.5',
}

const changeListSection = {
  backgroundColor: '#F8F6F3',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '0 0 16px',
}

const changeItem = {
  fontSize: '14px',
  color: '#4A3729',
  margin: '0 0 6px',
  lineHeight: '1.5',
}

const noteText = {
  fontSize: '14px',
  color: '#6B7280',
  fontStyle: 'italic' as const,
  margin: '0 0 16px',
  lineHeight: '1.5',
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
