'use server'

import { sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTurnstile } from '@/lib/turnstile'
import { newsletterSchema } from '@/lib/validators/newsletter'
import { NewsletterConfirmation } from '@/emails/newsletter-confirmation'

type NewsletterState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function subscribeNewsletter(
  prevState: NewsletterState,
  formData: FormData
): Promise<NewsletterState> {
  // 1. Honeypot check
  const honeypot = formData.get('website')
  if (honeypot) {
    return { success: false, message: 'Spam detected' }
  }

  // 2. Validate with Zod
  const parsed = newsletterSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 3. Turnstile CAPTCHA verification
  const turnstileToken = formData.get('cf-turnstile-response') as string
  if (!turnstileToken) {
    return { success: false, message: 'Please complete the CAPTCHA' }
  }

  const turnstileValid = await verifyTurnstile(turnstileToken)
  if (!turnstileValid) {
    return { success: false, message: 'CAPTCHA verification failed' }
  }

  const { email } = parsed.data
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stbasilsboston.org'
  const supabase = createAdminClient()

  // 4. Check for existing subscriber
  const { data: existing, error: existingError } = await supabase
    .from('email_subscribers')
    .select('id, confirmed, confirmation_token')
    .eq('email', email)
    .maybeSingle()

  if (existingError) {
    console.error('Failed to look up subscriber:', existingError)
    return { success: false, message: 'Something went wrong. Please try again.' }
  }

  if (existing) {
    if (existing.confirmed) {
      return { success: true, message: 'You are already subscribed.' }
    }

    // Re-send confirmation email for unconfirmed subscribers
    const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${existing.confirmation_token}`
    const { error: emailError } = await sendEmail({
      from: "St. Basil's Church <noreply@stbasilsboston.org>",
      to: email,
      subject: 'Confirm your subscription',
      react: NewsletterConfirmation({ confirmUrl, siteUrl }),
      metadata: {
        template: 'newsletter-confirmation',
        confirmUrl,
        siteUrl,
      },
    })

    if (emailError) {
      return { success: false, message: 'Failed to send confirmation email. Please try again.' }
    }

    return {
      success: true,
      message: 'A confirmation email has been sent. Please check your inbox.',
    }
  }

  // 5. Insert new subscriber
  const { data: subscriber, error: dbError } = await supabase
    .from('email_subscribers')
    .insert({ email })
    .select('confirmation_token')
    .single()

  if (dbError) {
    if (dbError.code === '23505') {
      const { data: conflictedSubscriber, error: conflictError } = await supabase
        .from('email_subscribers')
        .select('confirmation_token, confirmed')
        .eq('email', email)
        .maybeSingle()

      if (conflictError || !conflictedSubscriber) {
        console.error('Failed to recover subscriber after conflict:', conflictError ?? dbError)
        return { success: false, message: 'Something went wrong. Please try again.' }
      }

      if (conflictedSubscriber.confirmed) {
        return { success: true, message: 'You are already subscribed.' }
      }

      const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${conflictedSubscriber.confirmation_token}`
      const { error: emailError } = await sendEmail({
        from: "St. Basil's Church <noreply@stbasilsboston.org>",
        to: email,
        subject: 'Confirm your subscription',
        react: NewsletterConfirmation({ confirmUrl, siteUrl }),
        metadata: {
          template: 'newsletter-confirmation',
          confirmUrl,
          siteUrl,
        },
      })

      if (emailError) {
        console.error('Failed to send confirmation email:', emailError)
        return { success: false, message: 'Failed to send confirmation email. Please try again.' }
      }

      return {
        success: true,
        message: 'A confirmation email has been sent. Please check your inbox.',
      }
    }

    console.error('Failed to create subscriber:', dbError)
    return { success: false, message: 'Something went wrong. Please try again.' }
  }

  // 6. Send confirmation email
  const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${subscriber.confirmation_token}`
  const { error: emailError } = await sendEmail({
    from: "St. Basil's Church <noreply@stbasilsboston.org>",
    to: email,
    subject: 'Confirm your subscription',
    react: NewsletterConfirmation({ confirmUrl, siteUrl }),
    metadata: {
      template: 'newsletter-confirmation',
      confirmUrl,
      siteUrl,
    },
  })

  if (emailError) {
    console.error('Failed to send confirmation email:', emailError)
    return { success: false, message: 'Failed to send confirmation email. Please try again.' }
  }

  return { success: true, message: 'A confirmation email has been sent. Please check your inbox.' }
}
