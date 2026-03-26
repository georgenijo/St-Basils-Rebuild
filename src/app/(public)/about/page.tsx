import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { breadcrumbSchema } from '@/lib/structured-data'
import { PageHero, SectionHeader, ScrollReveal, Card, JsonLd } from '@/components/ui'

export const metadata: Metadata = {
  title: 'About',
  description:
    "Learn about the history and mission of St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Rooted in the apostolic Syriac Orthodox tradition and serving the Jacobite Malayalee community in New England.",
  openGraph: {
    title: "About | St. Basil's Syriac Orthodox Church",
    description:
      "Learn about the history and mission of St. Basil's Syriac Orthodox Church in Boston, Massachusetts.",
  },
}

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Our History', path: '/about' }])} />

      {/* Hero */}
      <PageHero title="Our Church History" backgroundImage="/images/about/church-exterior.jpg" />

      {/* Founded in Faith */}
      <section className="py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader title="Founded in Faith, Blessed by Providence" as="h2" />
          </ScrollReveal>

          <div className="mx-auto mt-10 max-w-3xl space-y-6 text-base leading-relaxed text-wood-800 md:mt-14">
            <ScrollReveal>
              <p>
                By God&rsquo;s grace and divine providence, St. Basil&rsquo;s Syriac Orthodox Church
                was born from the faithful prayers and earnest desire of Malayalee Jacobite families
                who gathered in 2009. Recognizing the absence of a Jacobite Syriac Orthodox Church
                in Massachusetts, these devoted believers felt called to establish a spiritual home
                where our ancient traditions could flourish.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <p>
                As we reflect on our blessed beginnings, we humbly remember the seven faithful
                families whom the Lord used as the foundation stones of our church: Abraham Varghese
                &amp; Family, Kuriakose Maniattukudiyil &amp; Family, Sinu John Punnesseril &amp;
                Family, Sebeyon Kingsview &amp; Family, John Jacob &amp; Family, Joby Eldo &amp;
                Family, and Roy Varghese &amp; Family (now Fr. Roy Varghese). These devoted
                servants, under the guidance and blessing of His Eminence Mor Titus Yeldho,
                Archbishop and Patriarchal Vicar of the Malankara Archdiocese of the Syrian Orthodox
                Church in North America, answered God&rsquo;s call to plant seeds of faith that
                would flourish into the thriving congregation we know today.
              </p>
            </ScrollReveal>

            {/* Founding Members Images */}
            <ScrollReveal>
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md sm:w-1/2">
                  <Image
                    src="/images/about/founding-members-1.jpeg"
                    alt="Founding members of St. Basil's gathered for an early service"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                </div>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md sm:w-1/2">
                  <Image
                    src="/images/about/founding-members-2.jpeg"
                    alt="Founding families of St. Basil's Syriac Orthodox Church"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <p>
                In those early days, the Lord blessed us with fellowship alongside our sister
                congregation, St. Stephen&rsquo;s Knanaya Church in Maynard, where we were blessed
                to meet the late Rev. Sr. Magdelene Vazhayil and the late Baby Ezhumalil
                (Babychayan), whose faithful service helped guide us to our current sacred dwelling
                place.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <p>
                Through divine appointment, we discovered this holy ground&mdash;then home to the
                Second Baptist Church of Newton under the pastoral care of Pastor John Bergerdorff.
                Pastor John and his beloved wife Ruth opened their hearts and their sanctuary to us
                with Christian hospitality that reflected the love of Christ. Their generous spirit
                allowed God&rsquo;s plan to unfold as they welcomed us to share in worship within
                these walls.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <p>
                On August 30, 2009, our prayers were answered when His Eminence Mor Titus Yeldho
                blessed us with the official commencement of our worship, along with our first
                Vicar, Rev. Fr. Geevarghese Jacob Challissery. Our sacred journey began that evening
                with prayer at our beloved sister church, St. Stephen&rsquo;s, where our
                congregations gathered in fellowship. It was during this evening prayer that His
                Eminence graciously declared that our new church would bear the blessed name of St.
                Basil&rsquo;s, dedicated to Baselious Bava. The following morning brought the
                celebration of our very first Holy Qurbono as an established parish, marking the
                true beginning of our liturgical life.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <p>
                In those early years, the Lord provided us with a faithful shepherd in the late Very
                Rev. Fr. Punnoose Abraham Kallamparambil, whose devoted service became the
                cornerstone of our worship life. For our first seven years, due to logistical
                circumstances, we celebrated the Divine Liturgy on Saturdays rather than Sundays.
                Week after week, without fail, Achen journeyed to be with us, celebrating the sacred
                mysteries and nourishing our souls with the Word of God. From our very beginning
                until the Lord called him home to His heavenly embrace, Rev. Fr. Punnoose&rsquo;s
                unwavering dedication and pastoral love sustained our young congregation through its
                most formative years.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <p>
                By God&rsquo;s abundant mercy, our small fellowship has grown steadily, now
                numbering approximately thirty families who call St. Basil&rsquo;s their spiritual
                home.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <p>
                Years later, the Lord moved Pastor John and Ruth&rsquo;s hearts to offer us an
                extraordinary gift&mdash;the ownership of our beloved church building. On October 1,
                2022, under the blessed leadership of His Eminence Mor Titus Yeldho, we consecrated
                this sacred space as our own, after a major renovation. After much prayer and
                patient perseverance, the Almighty brought this divine plan to completion when the
                church was officially transferred to our name, St. Basil&rsquo;s Syriac Orthodox
                Church, under the Malankara Archdiocese of the Syrian Orthodox Church in North
                America, on October 24, 2024.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Mighty in Faith — Dark Section */}
      <section className="bg-charcoal">
        <div className="flex flex-col md:flex-row">
          {/* Image */}
          <div className="relative aspect-[16/9] w-full md:aspect-auto md:w-1/2">
            <Image
              src="/images/about/group-photo.jpg"
              alt="St. Basil's congregation gathered together"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>

          {/* Content */}
          <div className="flex w-full items-center px-6 py-12 md:w-1/2 md:px-12 md:py-16 lg:px-16">
            <ScrollReveal direction="right">
              <div className="space-y-6">
                <h2 className="font-heading text-[1.75rem] font-semibold leading-[1.3] text-cream-50 md:text-[2.25rem]">
                  Small in Number, Mighty in Faith
                </h2>

                <div className="space-y-4 text-sm leading-relaxed text-cream-50/90 md:text-base">
                  <p>
                    Though we are few in number, we are rich in fellowship and strong in our
                    devotion to our Lord and Savior Jesus Christ. By God&rsquo;s providence, our
                    church&rsquo;s proximity to Boston has become one of our greatest blessings, as
                    we find ourselves surrounded by vibrant young adults and blessed with the
                    children of our faithful members. This youthful energy is truly our
                    strength&mdash;these precious souls represent not only the continuation of our
                    ancient Syriac Orthodox traditions but the bright future that the Lord has
                    planned for St. Basil&rsquo;s.
                  </p>
                  <p>
                    Our church family continues to grow, not merely in membership but in spiritual
                    depth and community bonds. We remain committed to preserving our sacred heritage
                    while nurturing the next generation in faith, ensuring that our children and
                    youth are equipped to carry forward the gospel light into their communities.
                    Whether you are familiar with our ancient liturgy or new to Orthodox worship,
                    whether you are young or old,{' '}
                    <em className="font-medium text-cream-50">
                      you will find in St. Basil&rsquo;s a welcoming spiritual family ready to
                      journey alongside you in faith
                    </em>
                    .
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Our Faith */}
      <section className="py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <Card variant="default" className="px-6 py-10 md:px-12 md:py-14 lg:px-16">
            <ScrollReveal>
              <SectionHeader title="Our Faith" as="h2" />
            </ScrollReveal>

            <div className="mx-auto mt-8 max-w-3xl space-y-6 text-base leading-relaxed text-wood-800">
              <ScrollReveal>
                <p>
                  St. Basil&rsquo;s belongs to the ancient Syriac Orthodox Church, one of the
                  earliest apostolic churches whose foundations trace back to the very dawn of
                  Christianity. It was in Antioch, after all, that the followers of Jesus were
                  called Christians, as Scripture tells us: &ldquo;The disciples were first called
                  Christians in Antioch&rdquo; (Acts 11:26).
                </p>
              </ScrollReveal>

              <ScrollReveal>
                <p>
                  Our church is part of the Oriental Orthodox family, holding fast to the faith
                  established by the first three Ecumenical Councils of Nicea (325 AD),
                  Constantinople (381 AD), and Ephesus (431 AD). We maintain the ancient Christian
                  doctrine that Christ has one incarnate nature from two natures&mdash;fully divine
                  and fully human united without separation or confusion.
                </p>
              </ScrollReveal>

              <ScrollReveal>
                <p>
                  The Syriac Orthodox tradition preserves Christianity in its most Semitic form,
                  employing in our liturgy the Syriac language&mdash;an Aramaic dialect akin to the
                  language spoken by Christ and the Apostles. Through St. Thomas the Apostle&rsquo;s
                  mission to India in 52 AD, our church has maintained an unbroken connection
                  between the ancient faith of Antioch and the Malankara tradition of Kerala, India.
                </p>
              </ScrollReveal>

              <ScrollReveal>
                <p>
                  Our parish belongs to the Malankara Archdiocese of the Syrian Orthodox Church in
                  North America, under the spiritual authority of His Holiness Patriarch Mor
                  Ignatius Aphrem II, the 123rd Patriarch of Antioch and All the East, and the
                  pastoral care of His Eminence Mor Titus Yeldho, our Archbishop and Patriarchal
                  Vicar.
                </p>
              </ScrollReveal>

              <ScrollReveal>
                <p>
                  You can read more about our{' '}
                  <Link
                    href="https://malankara.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
                  >
                    Archdiocese
                  </Link>{' '}
                  and our{' '}
                  <Link
                    href="https://malankara.com/briefoverviewofthechurch.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
                  >
                    Syrian Orthodox church history
                  </Link>
                  .
                </p>
              </ScrollReveal>
            </div>
          </Card>
        </div>
      </section>

      {/* Our Mission */}
      <section className="bg-burgundy-700 py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-center font-heading text-[1.75rem] font-semibold leading-[1.3] text-cream-50 md:text-[2.25rem]">
              Our Mission
            </h2>
          </ScrollReveal>

          <ScrollReveal>
            <p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-relaxed text-cream-50/90">
              The mission of St. Basil&rsquo;s Syriac Orthodox Church is to be vessels of
              God&rsquo;s redemptive grace through Jesus Christ, guided by the Holy Spirit, so that
              all people may find salvation and come to know the truth.{' '}
              <em className="font-medium text-cream-50">We exist to:</em>
            </p>
          </ScrollReveal>

          {/* Mission Pillars */}
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <ScrollReveal delay={0}>
              <div className="text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="mx-auto mb-4 h-8 w-8 text-cream-50"
                  aria-hidden="true"
                >
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
                <p className="text-base leading-relaxed text-cream-50/90">
                  <strong className="text-cream-50">Worship</strong> the Holy Trinity&mdash;Father,
                  Son, and Holy Spirit&mdash;providing our community with authentic Orthodox
                  liturgical worship that sanctifies souls and leads to eternal salvation.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.12}>
              <div className="text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="mx-auto mb-4 h-8 w-8 text-cream-50"
                  aria-hidden="true"
                >
                  <path d="M16.881 4.346A23.112 23.112 0 018.25 6H7.5a5.25 5.25 0 00-.88 10.427 21.593 21.593 0 001.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.592.772-2.468a17.116 17.116 0 01-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0018 11.25c0-2.413-.393-4.735-1.119-6.904zM18.26 3.74a23.22 23.22 0 011.24 7.51 23.22 23.22 0 01-1.24 7.51c-.055.161.044.3.194.358a.75.75 0 00.966-.458A24.72 24.72 0 0021 11.25a24.72 24.72 0 00-1.58-7.91.75.75 0 00-.966-.458c-.15.058-.249.197-.194.358z" />
                </svg>
                <p className="text-base leading-relaxed text-cream-50/90">
                  <strong className="text-cream-50">Proclaim</strong> the fullness of the Gospel:
                  the Incarnation of our Lord Jesus Christ, His life, death, and resurrection, and
                  His promised second coming.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.24}>
              <div className="text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="mx-auto mb-4 h-8 w-8 text-cream-50"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z"
                    clipRule="evenodd"
                  />
                  <path d="M5.082 14.254a8.287 8.287 0 00-1.308 5.135 9.687 9.687 0 01-1.764-.44l-.115-.04a.563.563 0 01-.373-.487l-.01-.121a3.75 3.75 0 013.57-4.047zM20.226 19.389a8.287 8.287 0 00-1.308-5.135 3.75 3.75 0 013.57 4.047l-.01.121a.563.563 0 01-.373.486l-.115.04c-.567.2-1.156.349-1.764.441z" />
                </svg>
                <p className="text-base leading-relaxed text-cream-50/90">
                  <strong className="text-cream-50">Serve</strong> as witnesses to Christ&rsquo;s
                  truth through acts of kindness, fellowship, and love, demonstrating God&rsquo;s
                  mercy to our community and the world.
                </p>
              </div>
            </ScrollReveal>
          </div>

          {/* Closing Text */}
          <ScrollReveal>
            <p className="mx-auto mt-12 max-w-3xl border-t border-cream-50/20 pt-8 text-center text-lg leading-relaxed text-cream-50/90">
              Through ancient liturgy, faithful fellowship, and compassionate service, we strive to
              be a beacon of Christ&rsquo;s light in our community, preserving our sacred traditions
              while welcoming all who seek to know God.
            </p>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
