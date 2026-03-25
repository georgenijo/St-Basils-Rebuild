import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'clergy',
  title: 'Clergy',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'Position or title (e.g., "Vicar", "Deacon")',
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'photoPosition',
      title: 'Photo Position',
      type: 'string',
      description: 'CSS object-position override (e.g., "center top", "50% 30%")',
    }),
    defineField({
      name: 'yearsOfService',
      title: 'Years of Service',
      type: 'string',
      description: 'e.g., "2010 – Present" or "1995 – 2020"',
    }),
    defineField({
      name: 'biography',
      title: 'Biography',
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
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [
                  {
                    name: 'href',
                    type: 'url',
                    title: 'URL',
                    validation: (Rule) =>
                      Rule.uri({ allowRelative: true, scheme: ['http', 'https', 'mailto', 'tel'] }),
                  },
                ],
              },
            ],
          },
          lists: [],
        },
      ],
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Current', value: 'current' },
          { title: 'Previous', value: 'previous' },
          { title: 'In Memoriam', value: 'memoriam' },
        ],
        layout: 'radio',
      },
      initialValue: 'current',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  orderings: [
    {
      title: 'Category, then Order',
      name: 'categoryOrder',
      by: [
        { field: 'category', direction: 'asc' },
        { field: 'order', direction: 'asc' },
      ],
    },
    {
      title: 'Display Order',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
  preview: {
    select: { title: 'name', subtitle: 'role', category: 'category', media: 'photo' },
    prepare({ title, subtitle, category, media }) {
      const categoryLabel =
        category === 'current' ? 'Current' : category === 'previous' ? 'Previous' : 'In Memoriam'
      return {
        title,
        subtitle: [subtitle, categoryLabel].filter(Boolean).join(' — '),
        media,
      }
    },
  },
})
