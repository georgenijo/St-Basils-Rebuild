import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import type { StructureBuilder } from 'sanity/structure'

import { schemaTypes } from '@/sanity/schemas'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!

const singletonTypes = new Set(['usefulLinksPage'])

const structure = (S: StructureBuilder) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Useful Links Page')
        .id('usefulLinksPage')
        .child(
          S.document()
            .schemaType('usefulLinksPage')
            .documentId('usefulLinksPage')
        ),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => !singletonTypes.has(item.getId()!)
      ),
    ])

export default defineConfig({
  name: 'st-basils-boston',
  title: "St. Basil's Syriac Orthodox Church",

  projectId,
  dataset,

  plugins: [
    structureTool({ structure }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    templates: (templates) =>
      templates.filter(({ schemaType }) => !singletonTypes.has(schemaType)),
  },
})
