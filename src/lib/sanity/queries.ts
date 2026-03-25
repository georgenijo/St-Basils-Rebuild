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

export const allClergyQuery = groq`
  *[_type == "clergy" && isActive == true] | order(category asc, order asc) {
    _id,
    name,
    role,
    photo,
    photoPosition,
    "photoLqip": photo.asset->metadata.lqip,
    yearsOfService,
    biography,
    category,
    order
  }
`

export const allSpiritualLeadersQuery = groq`
  *[_type == "spiritualLeader" && isActive == true] | order(order asc) {
    _id,
    name,
    title,
    photo,
    photoPosition,
    "photoLqip": photo.asset->metadata.lqip,
    biography,
    order
  }
`
