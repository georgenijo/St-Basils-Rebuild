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
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [
        {
          type: 'block',
          marks: {
            decorators: [
              { title: 'Bold', value: 'strong' },
              { title: 'Italic', value: 'em' },
              { title: 'Burgundy Highlight', value: 'burgundyHighlight' },
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
      description: 'SEO meta description for the page',
    }),
  ],
  preview: {
    select: { title: 'pageTitle' },
  },
})
