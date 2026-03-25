import { groq } from 'next-sanity'

export const pageContentQuery = groq`
  *[_type == "pageContent" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    body
  }
`

export const spiritualLeadersQuery = groq`
  *[_type == "spiritualLeader" && isActive == true] | order(order asc) {
    _id,
    name,
    title,
    photo,
    photoPosition,
    biography,
    order
  }
`
