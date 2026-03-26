import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const BURGUNDY = '#9B1B3D'
const CREAM = '#FFFDF8'
const GOLD = '#D4A017'

const CATEGORY_LABELS: Record<string, string> = {
  liturgical: 'Liturgical',
  community: 'Community',
  special: 'Special',
}

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`
  const css = await fetch(url, {
    headers: {
      // Request TrueType format (Satori requires .ttf or .woff, not .woff2)
      'User-Agent':
        'Mozilla/5.0 (BB10; Touch) AppleWebKit/537.10+ (KHTML, like Gecko) Version/10.0.9.2372 Mobile Safari/537.10+',
    },
  }).then((res) => res.text())

  const match = css.match(/src: url\((.+?)\) format\('truetype'\)/)
  if (!match) throw new Error(`Could not load font: ${family}`)

  return fetch(match[1]).then((res) => res.arrayBuffer())
}

// Cache font and logo loading at module level
const cormorantSemiBold = loadGoogleFont('Cormorant Garamond', 600)
const dmSansMedium = loadGoogleFont('DM Sans', 500)
const logoBase64 = readFile(join(process.cwd(), 'public', 'logo.png')).then(
  (buf) => `data:image/png;base64,${buf.toString('base64')}`
)

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const [type, slug] = path

  const [cormorantData, dmSansData, logo] = await Promise.all([
    cormorantSemiBold,
    dmSansMedium,
    logoBase64,
  ])

  let title = "St. Basil's Syriac Orthodox Church"
  let subtitle = 'Boston, Massachusetts'
  let badge: string | null = null

  if ((type === 'events' || type === 'announcements') && slug) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    if (type === 'events') {
      const { data: event } = await supabase
        .from('events')
        .select('title, start_at, category')
        .eq('slug', slug)
        .single()

      if (event) {
        title = event.title
        subtitle = formatDate(event.start_at)
        badge = CATEGORY_LABELS[event.category] || null
      }
    } else {
      const { data: announcement } = await supabase
        .from('announcements')
        .select('title, published_at')
        .eq('slug', slug)
        .single()

      if (announcement) {
        title = announcement.title
        subtitle = formatDate(announcement.published_at)
        badge = 'Announcement'
      }
    }
  }

  const fontSize = title.length > 60 ? 38 : title.length > 40 ? 44 : 52

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BURGUNDY,
        padding: '60px 80px',
      }}
    >
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={280} height={54} alt="" style={{ objectFit: 'contain' }} />

      {/* Gold divider */}
      <div
        style={{
          width: 120,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          marginTop: 32,
          marginBottom: 32,
        }}
      />

      {/* Badge */}
      {badge && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: 'DM Sans',
              fontSize: 18,
              fontWeight: 500,
              color: GOLD,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.1em',
            }}
          >
            {badge}
          </span>
        </div>
      )}

      {/* Title */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 960,
        }}
      >
        <h1
          style={{
            fontFamily: 'Cormorant Garamond',
            fontSize,
            fontWeight: 600,
            color: CREAM,
            textAlign: 'center',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {title}
        </h1>
      </div>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: 'DM Sans',
          fontSize: 22,
          fontWeight: 500,
          color: `${CREAM}99`,
          marginTop: 20,
        }}
      >
        {subtitle}
      </p>

      {/* Bottom URL */}
      <p
        style={{
          fontFamily: 'DM Sans',
          fontSize: 16,
          fontWeight: 500,
          color: `${CREAM}66`,
          position: 'absolute',
          bottom: 32,
        }}
      >
        stbasilsboston.org
      </p>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
      fonts: [
        {
          name: 'Cormorant Garamond',
          data: cormorantData,
          style: 'normal' as const,
          weight: 600 as const,
        },
        {
          name: 'DM Sans',
          data: dmSansData,
          style: 'normal' as const,
          weight: 500 as const,
        },
      ],
    }
  )
}
