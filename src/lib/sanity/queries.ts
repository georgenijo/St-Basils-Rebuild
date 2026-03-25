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

export const acolytesChoirPageQuery = groq`
  *[_type == "acolytesChoirPage"][0] {
    _id,
    heroImage,
    body,
    groupPhoto,
    groupPhotoAlt,
    metaDescription
  }
`
