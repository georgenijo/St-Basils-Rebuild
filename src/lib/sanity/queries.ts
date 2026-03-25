import { groq } from 'next-sanity'

export const pageContentQuery = groq`
  *[_type == "pageContent" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    body
  }
`

export const clergyQuery = groq`
  *[_type == "clergy" && isActive == true] | order(category asc, order asc) {
    _id,
    name,
    role,
    photo,
    photoPosition,
    yearsOfService,
    biography,
    category,
    order
  }
`
