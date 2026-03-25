import { groq } from 'next-sanity'

export const pageContentQuery = groq`
  *[_type == "pageContent" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    body
  }
`

export const officeBearersQuery = groq`
  *[_type == "officeBearer" && isActive == true] | order(order asc) {
    _id,
    name,
    role,
    photo,
    photoPosition,
    category,
    year,
    order
  }
`
