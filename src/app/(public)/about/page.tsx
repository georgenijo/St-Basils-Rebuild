import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { PageHero, SectionHeader } from '@/components/ui'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

export const metadata: Metadata = {
  title: 'Our History',
  description:
    "Learn about the history of St. Basil's Syriac Orthodox Church in Boston — founded in 2009 by faithful Jacobite Malayalee families in Massachusetts.",
}

export default function AboutPage() {
  return (
    <>
      <PageHero title="Our Church History" backgroundImage="/images/about/hero.jpg" />

      {/* History Section */}
      <section className="py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader
              title="Founded in Faith, Blessed by Providence"
              as="h2"
              align="center"
            />
          </ScrollReveal>

          <div className="mt-12 space-y-6 font-body text-base leading-relaxed text-wood-800">
            <ScrollReveal delay={0.12}>
              <p>
                By God&apos;s grace and divine providence, St. Basil&apos;s Syriac Orthodox Church
                was born from the faithful prayers and earnest desire of Malayalee Jacobite families
                who gathered in 2009. Recognizing the absence of a Jacobite Syriac Orthodox Church
                in Massachusetts, these devoted believers felt called to establish a spiritual home
                where our ancient traditions could flourish.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.24}>
              <p>
                As we reflect on our blessed beginnings, we humbly remember the seven faithful
                families whom the Lord used as the foundation stones of our church: Abraham Varghese
                &amp; Family, Kuriakose Maniattukudiyil &amp; Family, Sinu John Punnesseril &amp;
                Family, Sebeyon Kingsview &amp; Family, John Jacob &amp; Family, Joby Eldo &amp;
                Family, and Roy Varghese &amp; Family (now Fr. Roy Varghese). These devoted
                servants, under the guidance and blessing of His Eminence Mor Titus Yeldho,
                Archbishop and Patriarchal Vicar of the Malankara Archdiocese of the Syrian Orthodox
                Church in North America, answered God&apos;s call to plant seeds of faith that would
                flourish into the thriving congregation we know today.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.36}>
              <p>
                In those early days, the Lord blessed us with fellowship alongside our sister
                congregation, St. Stephen&apos;s Knanaya Church in Maynard, where we were blessed
                to meet the late Rev. Sr. Magdelene Vazhayil and the late Baby Ezhumalil
                (Babychayan), whose faithful service helped guide us to our current sacred dwelling
                place.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.48}>
              <p>
                Through divine appointment, we discovered this holy ground—then home to the Second
                Baptist Church of Newton under the pastoral care of Pastor John Bergerdorff. Pastor
                John and his beloved wife Ruth opened their hearts and their sanctuary to us with
                Christian hospitality that reflected the love of Christ. Their generous spirit
                allowed God&apos;s plan to unfold as they welcomed us to share in worship within
                these walls.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.6}>
              <p>
                On August 30, 2009, our prayers were answered when His Eminence Mor Titus Yeldho
                blessed us with the official commencement of our worship, along with our first
                Vicar, Rev. Fr. Geevarghese Jacob Challissery. Our sacred journey began that evening
                with prayer at our beloved sister church, St. Stephen&apos;s, where our
                congregations gathered in fellowship. It was during this evening prayer that His
                Eminence graciously declared that our new church would bear the blessed name of St.
                Basil&apos;s, dedicated to Baselious Bava. The following morning brought the
                celebration of our very first Holy Qurbono as an established parish, marking the
                true beginning of our liturgical life.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.72}>
              <p>
                In those early years, the Lord provided us with a faithful shepherd in the late Very
                Rev. Fr. Punnoose Abraham Kallamparambil, whose devoted service became the
                cornerstone of our worship life. For our first seven years, due to logistical
                circumstances, we celebrated the Divine Liturgy on Saturdays rather than Sundays.
                Week after week, without fail, Achen journeyed to be with us, celebrating the
                sacred mysteries and nourishing our souls with the Word of God. From our very
                beginning until the Lord called him home to His heavenly embrace, Rev. Fr.
                Punnoose&apos;s unwavering dedication and pastoral love sustained our young
                congregation through its most formative years.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.84}>
              <p>
                By God&apos;s abundant mercy, our small fellowship has grown steadily, now numbering
                approximately thirty families who call St. Basil&apos;s their spiritual home.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.96}>
              <p>
                Years later, the Lord moved Pastor John and Ruth&apos;s hearts to offer us an
                extraordinary gift—the ownership of our beloved church building. On October 1, 2022,
                under the blessed leadership of His Eminence Mor Titus Yeldho, we consecrated this
                sacred space as our own, after a major renovation. After much prayer and patient
                perseverance, the Almighty brought this divine plan to completion when the church
                was officially transferred to our name, St. Basil&apos;s Syriac Orthodox Church,
                under the Malankara Archdiocese of the Syrian Orthodox Church in North America, on
                October 24, 2024.
              </p>
            </ScrollReveal>
          </div>

          {/* Founding Members Photos */}
          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <ScrollReveal direction="left">
              <div className="overflow-hidden rounded-2xl">
                <Image
                  src="/images/about/founding-members-1.jpg"
                  alt="Founding members of St. Basil's Syriac Orthodox Church gathered together"
                  width={600}
                  height={400}
                  className="h-auto w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right">
              <div className="overflow-hidden rounded-2xl">
                <Image
                  src="/images/about/founding-members-2.jpg"
                  alt="Early gathering of founding families at St. Basil's"
                  width={600}
                  height={400}
                  className="h-auto w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Mighty in Faith Section — Dark */}
      <section className="relative overflow-hidden py-16 md:py-22 lg:py-28">
        <Image
          src="/images/about/group-photo.jpg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-charcoal/80" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-center font-heading text-[1.75rem] font-semibold leading-[1.3] text-cream-50 md:text-[2.25rem]">
              Small in Number, Mighty in Faith
            </h2>
            <div className="mx-auto my-4 h-[2px] max-w-[200px] bg-linear-to-r from-transparent via-gold-500 to-transparent" />
          </ScrollReveal>

          <div className="mx-auto mt-10 max-w-3xl space-y-6 text-base leading-relaxed text-cream-50/90">
            <ScrollReveal delay={0.12}>
              <p>
                Though we are few in number, we are rich in fellowship and strong in our devotion to
                our Lord and Savior Jesus Christ. By God&apos;s providence, our church&apos;s
                proximity to Boston has become one of our greatest blessings, as we find ourselves
                surrounded by vibrant young adults and blessed with the children of our faithful
                members. This youthful energy is truly our strength—these precious souls represent
                not only the continuation of our ancient Syriac Orthodox traditions but the bright
                future that the Lord has planned for St. Basil&apos;s.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.24}>
              <p>
                Our church family continues to grow, not merely in membership but in spiritual depth
                and community bonds. We remain committed to preserving our sacred heritage while
                nurturing the next generation in faith, ensuring that our children and youth are
                equipped to carry forward the gospel light into their communities. Whether you are
                familiar with our ancient liturgy or new to Orthodox worship, whether you are young
                or old,{' '}
                <em className="font-medium text-cream-50">
                  you will find in St. Basil&apos;s a welcoming spiritual family ready to journey
                  alongside you in faith
                </em>
                .
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Our Faith Section */}
      <section className="bg-sand py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader title="Our Faith" as="h2" align="center" />
          </ScrollReveal>

          <div className="mx-auto mt-10 max-w-3xl space-y-6 text-base leading-relaxed text-wood-800">
            <ScrollReveal delay={0.12}>
              <p>
                St. Basil&apos;s belongs to the ancient Syriac Orthodox Church, one of the earliest
                apostolic churches whose foundations trace back to the very dawn of Christianity. It
                was in Antioch, after all, that the followers of Jesus were called Christians, as
                Scripture tells us:{' '}
                <em>&ldquo;The disciples were first called Christians in Antioch&rdquo;</em> (Acts
                11:26).
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.24}>
              <p>
                Our church is part of the Oriental Orthodox family, holding fast to the faith
                established by the first three Ecumenical Councils of Nicea (325 AD), Constantinople
                (381 AD), and Ephesus (431 AD). We maintain the ancient Christian doctrine that
                Christ has one incarnate nature from two natures—fully divine and fully human united
                without separation or confusion.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.36}>
              <p>
                The Syriac Orthodox tradition preserves Christianity in its most Semitic form,
                employing in our liturgy the Syriac language—an Aramaic dialect akin to the language
                spoken by Christ and the Apostles. Through St. Thomas the Apostle&apos;s mission to
                India in 52 AD, our church has maintained an unbroken connection between the ancient
                faith of Antioch and the Malankara tradition of Kerala, India.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.48}>
              <p>
                Our parish belongs to the Malankara Archdiocese of the Syrian Orthodox Church in
                North America, under the spiritual authority of His Holiness Patriarch Mor Ignatius
                Aphrem II, the 123rd Patriarch of Antioch and All the East, and the pastoral care of
                His Eminence Mor Titus Yeldho, our Archbishop and Patriarchal Vicar.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.6}>
              <p>
                You can read more about our{' '}
                <Link
                  href="https://malankara.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
                >
                  Archdiocese
                </Link>{' '}
                and our{' '}
                <Link
                  href="https://malankara.com/briefoverviewofthechurch.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
                >
                  Syrian Orthodox church history
                </Link>
                .
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Our Mission Section — Burgundy */}
      <section className="bg-burgundy-700 py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-center font-heading text-[1.75rem] font-semibold leading-[1.3] text-cream-50 md:text-[2.25rem]">
              Our Mission
            </h2>
            <div className="mx-auto my-4 h-[2px] max-w-[200px] bg-linear-to-r from-transparent via-gold-500 to-transparent" />
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <p className="mx-auto mt-8 max-w-3xl text-center text-base leading-relaxed text-cream-50/90">
              The mission of St. Basil&apos;s Syriac Orthodox Church is to be vessels of God&apos;s
              redemptive grace through Jesus Christ, guided by the Holy Spirit, so that all people
              may find salvation and come to know the truth.{' '}
              <em className="font-medium text-cream-50">We exist to:</em>
            </p>
          </ScrollReveal>

          {/* Mission Cards */}
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            <ScrollReveal delay={0.24}>
              <div className="rounded-2xl bg-cream-50/10 p-6 text-center backdrop-blur-sm md:p-8">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    fill="currentColor"
                    className="text-gold-500"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"
                    />
                  </svg>
                </div>
                <h3 className="font-heading text-[1.25rem] font-semibold leading-[1.4] text-cream-50 md:text-[1.5rem]">
                  Worship
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cream-50/80">
                  Worship the Holy Trinity—Father, Son, and Holy Spirit—providing our community with
                  authentic Orthodox liturgical worship that sanctifies souls and leads to eternal
                  salvation.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.36}>
              <div className="rounded-2xl bg-cream-50/10 p-6 text-center backdrop-blur-sm md:p-8">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    fill="currentColor"
                    className="text-gold-500"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path d="M13 2.5a1.5 1.5 0 0 1 3 0v11a1.5 1.5 0 0 1-3 0v-11zm-1 .724c-2.067.95-4.539 1.481-7.31 1.57L3.51 4.8C2.065 4.846.69 5.893.09 7.058l.003.006A7 7 0 0 0 0 9.5a1.5 1.5 0 0 0 1.5 1.5c.09 0 .178-.008.265-.022l1.176 3.292a.5.5 0 0 0 .936-.372L2.737 10.6l-.07.006A1.5 1.5 0 0 0 3 9.5v-.118L12 8.17z" />
                  </svg>
                </div>
                <h3 className="font-heading text-[1.25rem] font-semibold leading-[1.4] text-cream-50 md:text-[1.5rem]">
                  Proclaim
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cream-50/80">
                  Proclaim the fullness of the Gospel: the Incarnation of our Lord Jesus Christ, His
                  life, death, and resurrection, and His promised second coming.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.48}>
              <div className="rounded-2xl bg-cream-50/10 p-6 text-center backdrop-blur-sm md:p-8">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    fill="currentColor"
                    className="text-gold-500"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" />
                  </svg>
                </div>
                <h3 className="font-heading text-[1.25rem] font-semibold leading-[1.4] text-cream-50 md:text-[1.5rem]">
                  Serve
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cream-50/80">
                  Serve as witnesses to Christ&apos;s truth through acts of kindness, fellowship,
                  and love, demonstrating God&apos;s mercy to our community and the world.
                </p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.6}>
            <p className="mx-auto mt-12 max-w-3xl text-center text-base leading-relaxed text-cream-50/90">
              Through ancient liturgy, faithful fellowship, and compassionate service, we strive to
              be a beacon of Christ&apos;s light in our community, preserving our sacred traditions
              while welcoming all who seek to know God.
            </p>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
