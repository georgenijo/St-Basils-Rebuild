import type { Thing, WithContext } from 'schema-dts'

interface JsonLdProps {
  data: WithContext<Thing> | Record<string, unknown>
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
