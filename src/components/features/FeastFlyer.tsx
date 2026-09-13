import Image from 'next/image'

export function FeastFlyer() {
  return (
    <section
      aria-labelledby="feast-heading"
      className="flex items-center justify-center overflow-hidden bg-charcoal"
    >
      <div className="sr-only">
        <h2 id="feast-heading">Feast of St. Baselious Yeldho Bava</h2>
        <p>
          St. Basil&apos;s Syriac Orthodox Church, Boston. October 3 and 4, 2026. Chief celebrant:
          His Eminence Archbishop Mor Titus Yeldho.
        </p>
        <h3>Saturday, October 3</h3>
        <ul>
          <li>6 PM: Flag Hoisting</li>
          <li>6:30 PM: Evening Prayer</li>
          <li>8 PM: Devotional Address</li>
          <li>9 PM: Dinner</li>
        </ul>
        <h3>Sunday, October 4</h3>
        <ul>
          <li>8:30 AM: Morning Prayer</li>
          <li>9:30 AM: Holy Qurbano</li>
          <li>12 PM: Benediction and Nercha</li>
          <li>1 PM: Lunch</li>
        </ul>
        <p>
          Perunnal shares are $50 per person. Offerings may be sent by Zelle to
          stbasilsboston.trsr@gmail.com.
        </p>
        <p>
          Contacts: Mark Alexander, Vice President, 914-843-7111; Alex Thomas, Secretary,
          978-460-9470; Joby Eldo, Treasurer, 617-959-2633.
        </p>
      </div>
      <div className="relative aspect-[1188/1545] w-full md:h-[calc(100svh-4rem)] md:w-auto md:max-w-full">
        <Image
          src="/images/feast-st-baselious-yeldho-bava-2026.jpg"
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 65vw"
          className="object-contain"
        />
      </div>
    </section>
  )
}
