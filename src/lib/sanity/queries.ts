import { groq } from 'next-sanity'

export const pageContentBySlugQuery = groq`
  *[_type == "pageContent" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    heroStyle,
    heroImage,
    body,
    metaDescription,
    effectiveDate,
    lastUpdated
  }
`

export const allSpiritualLeadersQuery = groq`
  *[_type == "spiritualLeader"] | order(order asc) {
    _id,
    name,
    title,
    photo,
    "photoLqip": photo.asset->metadata.lqip,
    biography,
    order
  }
`
