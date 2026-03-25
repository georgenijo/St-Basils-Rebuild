import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'acolytesChoirPage',
  title: 'Acolytes & Choir Page',
  type: 'document',
  fields: [
    defineField({
      name: 'pageTitle',
      title: 'Page Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Image',
      type: 'image',
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [{ title: 'Normal', value: 'normal' }],
          marks: {
            decorators: [
              { title: 'Bold', value: 'strong' },
              { title: 'Italic', value: 'em' },
            ],
            annotations: [
              {
                name: 'burgundyHighlight',
                title: 'Burgundy Highlight',
                type: 'object',
                fields: [
                  defineField({
                    name: 'dummy',
                    title: ' ',
                    type: 'string',
                    hidden: true,
                  }),
                ],
              },
            ],
          },
        },
      ],
    }),
    defineField({
      name: 'groupPhoto',
      title: 'Group Photo',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'metaDescription',
      title: 'Meta Description',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(160),
    }),
  ],
  preview: {
    select: { title: 'pageTitle' },
  },
})
