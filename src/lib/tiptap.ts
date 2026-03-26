import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'

/**
 * Render Tiptap JSON content to an HTML string.
 * Falls back to wrapping plain text in a paragraph if the input
 * is not valid Tiptap JSON.
 */
export function renderTiptapHTML(content: unknown): string {
  if (!content) return ''

  // Handle string input — could be JSON string or plain text
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      return renderTiptapHTML(parsed)
    } catch {
      return `<p>${escapeHtml(content)}</p>`
    }
  }

  // Handle Tiptap JSON document
  if (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    (content as { type: string }).type === 'doc'
  ) {
    return generateHTML(content as Parameters<typeof generateHTML>[0], [StarterKit])
  }

  return ''
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
