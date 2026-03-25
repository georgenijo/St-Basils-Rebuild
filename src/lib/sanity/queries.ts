import { groq } from 'next-sanity'

export const pageContentQuery = groq`
  *[_type == "pageContent" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    body
  }
`

export const acolytesChoirPageQuery = groq`
  *[_type == "acolytesChoirPage"][0] {
    _id,
    pageTitle,
    heroImage,
    description,
    groupPhoto,
    metaDescription
  }
`
