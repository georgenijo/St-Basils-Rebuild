import { groq } from 'next-sanity'

export const pageContentQuery = groq`
  *[_type == "pageContent" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    body
  }
`

export const organizationsQuery = groq`
  *[_type == "organization" && isActive == true] | order(order asc) {
    _id,
    name,
    slug,
    photo,
    description,
    missionStatement,
    scriptureQuote,
    externalLink,
    order,
    backgroundColor
  }
`
