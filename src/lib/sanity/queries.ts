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

export const allOfficeBearersQuery = groq`
  *[_type == "officeBearer" && isActive == true] | order(category asc, order asc) {
    _id,
    name,
    role,
    photo,
    photoPosition,
    "photoLqip": photo.asset->metadata.lqip,
    category,
    year,
    order
  }
`

export const allOrganizationsQuery = groq`
  *[_type == "organization" && isActive == true] | order(order asc) {
    _id,
    name,
    slug,
    photo,
    "photoLqip": photo.asset->metadata.lqip,
    description,
    missionStatement,
    scriptureQuote,
    externalLink,
    backgroundColor,
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

export const allUsefulLinksQuery = groq`
  *[_type == "usefulLink" && isActive == true] | order(order asc) {
    _id,
    title,
    "fileUrl": file.asset->url,
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
