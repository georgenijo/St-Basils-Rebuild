'use server'

import { contactSchema } from '@/lib/validators/contact'
import { verifyTurnstileToken } from '@/lib/turnstile'

type ContactState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function submitContactForm(
  prevState: ContactState,
  formData: FormData
): Promise<ContactState> {
  // Honeypot check — bots fill hidden fields
  const honeypot = formData.get('website')
  if (honeypot) {
    // Silently succeed to not tip off bots
    return { success: true, message: 'Thank you for your message. We will be in touch soon.' }
  }

  // Turnstile verification
  const turnstileToken = formData.get('cf-turnstile-response') as string
  if (!turnstileToken) {
    return { success: false, message: 'Please complete the verification challenge.' }
  }

  const turnstileValid = await verifyTurnstileToken(turnstileToken)
  if (!turnstileValid) {
    return { success: false, message: 'Verification failed. Please try again.' }
  }

  // Validate form data
  const result = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
  })

  if (!result.success) {
    const errors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (!errors[field]) errors[field] = []
      errors[field].push(issue.message)
    }
    return { success: false, message: 'Please fix the errors below.', errors }
  }

  // TODO: Send email via Resend once email templates are set up (ticket 4a-02)
  // For now, log the submission
  console.log('Contact form submission:', result.data)

  return {
    success: true,
    message: 'Thank you for your message. We will be in touch soon.',
  }
}
