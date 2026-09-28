import { Link, Section, Text } from '@react-email/components'

import { EmailLayout, emailStyles } from './components/email-layout'

interface ChangeRequestNotificationProps {
  title: string
  pagePath: string
  requesterName: string
  description: string
  attachmentCount: number
  requestUrl: string
  siteUrl?: string
}

export function ChangeRequestNotification({
  title = 'Update the homepage flyer',
  pagePath = '/',
  requesterName = 'An administrator',
  description = '',
  attachmentCount = 0,
  requestUrl = 'https://stbasilsboston.org/admin/requests',
  siteUrl = 'https://stbasilsboston.org',
}: ChangeRequestNotificationProps) {
  return (
    <EmailLayout
      previewText={`New website change request: ${title}`}
      heading="New website change request"
      siteUrl={siteUrl}
      portalUrl={requestUrl}
      portalLabel="Open request"
    >
      <Text style={emailStyles.paragraph}>
        {requesterName} submitted a change request for the public website. The website agent will
        pick it up and open a pull request for review. Nothing goes live until the pull request is
        merged.
      </Text>
      <Section>
        <Text style={emailStyles.label}>Title</Text>
        <Text style={emailStyles.value}>{title}</Text>
        <Text style={emailStyles.label}>Page</Text>
        <Text style={emailStyles.value}>{pagePath}</Text>
        <Text style={emailStyles.label}>Requested by</Text>
        <Text style={emailStyles.value}>{requesterName}</Text>
        {description ? (
          <>
            <Text style={emailStyles.label}>Description</Text>
            <Text style={{ ...emailStyles.value, whiteSpace: 'pre-wrap' as const }}>
              {description}
            </Text>
          </>
        ) : null}
        {attachmentCount > 0 ? (
          <>
            <Text style={emailStyles.label}>Attachments</Text>
            <Text style={emailStyles.value}>
              {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
            </Text>
          </>
        ) : null}
      </Section>
      <Section style={emailStyles.ctaSection}>
        <Link href={requestUrl} style={emailStyles.ctaButton}>
          View request
        </Link>
      </Section>
    </EmailLayout>
  )
}

export default ChangeRequestNotification
