import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'officeBearer',
  title: 'Office Bearer',
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
      description: 'CSS object-position value (e.g., "center top")',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Executive', value: 'executive' },
          { title: 'Board', value: 'board' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'string',
      description: 'Term year (e.g., "2025")',
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'role',
      year: 'year',
      media: 'photo',
    },
    prepare({ title, subtitle, year, media }) {
      return {
        title,
        subtitle: [subtitle, year].filter(Boolean).join(' · '),
        media,
      }
    },
  },
})
