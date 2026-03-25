import { groq } from 'next-sanity'

export const pageContentQuery = groq`
  *[_type == "pageContent" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    body
  }
`

export const usefulLinksQuery = groq`
  *[_type == "usefulLink" && isActive == true] | order(order asc) {
    _id,
    title,
    file,
    category,
    order
  }
`

export const usefulLinksPageQuery = groq`
  *[_type == "usefulLinksPage"][0] {
    _id,
    pageTitle,
    heroImage,
    introText,
    sectionTitle
  }
`
