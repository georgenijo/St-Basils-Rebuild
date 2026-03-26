'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCallback } from 'react'

import { cn } from '@/lib/utils'

interface TiptapEditorProps {
  content?: string
  onChange?: (json: string) => void
  error?: boolean
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded px-2 py-1 text-sm transition-colors',
        active ? 'bg-burgundy-700 text-cream-50' : 'text-wood-800 hover:bg-cream-100'
      )}
    >
      {children}
    </button>
  )
}

export function TiptapEditor({ content, onChange, error }: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: content ? tryParseJson(content) : '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none px-4 py-3 min-h-[160px] focus:outline-none font-body text-wood-800',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(JSON.stringify(editor.getJSON()))
    },
  })

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run()
  }, [editor])

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run()
  }, [editor])

  const toggleH2 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run()
  }, [editor])

  const toggleH3 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 3 }).run()
  }, [editor])

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run()
  }, [editor])

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run()
  }, [editor])

  if (!editor) return null

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-cream-50 transition-colors focus-within:border-burgundy-700 focus-within:ring-2 focus-within:ring-burgundy-700/20',
        error && 'border-red-400'
      )}
    >
      <div className="flex flex-wrap gap-1 border-b bg-cream-100/50 px-2 py-1.5">
        <ToolbarButton active={editor.isActive('bold')} onClick={toggleBold} title="Bold">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={toggleItalic} title="Italic">
          <em>I</em>
        </ToolbarButton>
        <div className="mx-1 w-px bg-wood-800/10" />
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={toggleH2}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={toggleH3}
          title="Heading 3"
        >
          H3
        </ToolbarButton>
        <div className="mx-1 w-px bg-wood-800/10" />
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={toggleBulletList}
          title="Bullet List"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="3" cy="6" r="1" fill="currentColor" />
            <circle cx="3" cy="12" r="1" fill="currentColor" />
            <circle cx="3" cy="18" r="1" fill="currentColor" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={toggleOrderedList}
          title="Ordered List"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <text
              x="1"
              y="8"
              fontSize="8"
              fill="currentColor"
              stroke="none"
              fontFamily="sans-serif"
            >
              1
            </text>
            <text
              x="1"
              y="14"
              fontSize="8"
              fill="currentColor"
              stroke="none"
              fontFamily="sans-serif"
            >
              2
            </text>
            <text
              x="1"
              y="20"
              fontSize="8"
              fill="currentColor"
              stroke="none"
              fontFamily="sans-serif"
            >
              3
            </text>
          </svg>
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function tryParseJson(content: string): Record<string, unknown> | string {
  try {
    return JSON.parse(content)
  } catch {
    return content
  }
}
