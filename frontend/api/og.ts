import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'fs'
import { join } from 'path'

/** Convex dev URL — falls back to prod if env not set */
const CONVEX_URL =
  process.env.CONVEX_URL ??
  process.env.VITE_CONVEX_URL ??
  'https://amicable-roadrunner-898.convex.cloud'

const SITE_URL = process.env.SITE_URL ?? 'https://chop.pxxl.click'

const CRAWLER_RE =
  /WhatsApp|facebookexternalhit|Twitterbot|Slackbot|TelegramBot|LinkedInBot|Discordbot|Pinterest|Googlebot|bingbot|curl|Wget|python-requests/i

const MODE_LABEL: Record<string, string> = {
  food:      'Chop Food',
  'chop-in': 'Chop In',
  bill:      'Chop Bill',
}

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

/** Fetch session from Convex query HTTP endpoint */
async function fetchSession(slug: string) {
  const url = `${CONVEX_URL}/api/query`
  const body = JSON.stringify({
    path: 'sessions:getSessionBySlug',
    args: { slug },
    format: 'json',
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) return null
  const json = await res.json() as { status: string; value?: unknown }
  if (json.status !== 'success') return null
  return json.value as {
    title: string
    mode: string
    totalKobo: number
    participants: { name: string }[]
  } | null
}

function readIndex(): string {
  const indexPath = join(process.cwd(), 'dist', 'index.html')
  return readFileSync(indexPath, 'utf-8')
}

/** Strip any existing og/twitter/title/description meta from the SPA index.html */
function stripExistingMeta(html: string) {
  return html
    .replace(/<title>[^<]*<\/title>/g, '')
    .replace(/<meta\s[^>]*(?:property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>/gi, '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // req.query.slug is populated by vercel.json route capture (empty string for root/generic path)
  const slug = (req.query.slug as string | undefined) ?? ''

  // Non-crawlers: serve the SPA shell as-is
  const ua = req.headers['user-agent'] ?? ''
  if (!CRAWLER_RE.test(ua)) {
    try {
      const html = readIndex()
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(200).send(html)
    } catch {
      return res.status(200).send('<html><body>Loading…</body></html>')
    }
  }

  // ── Crawler path: build OG tags ───────────────────────────────────────────

  const imageUrl = `${SITE_URL}/og-image.webp`

  let title       = 'Chop — Split Bills & Pool Funds via WhatsApp'
  let description = 'No app download. No awkward money talk. Create a Chop session, share the link on WhatsApp, and let everyone settle their share instantly.'
  let pageUrl     = SITE_URL

  if (slug) {
    // Session-specific page — fetch live data
    title       = 'Pay your share — Chop'
    description = 'Someone sent you a Chop link. Open it to pay your share instantly — no app download needed.'
    pageUrl     = `${SITE_URL}/s/${slug}`

    try {
      const session = await fetchSession(slug)
      if (session) {
        const modeLabel        = MODE_LABEL[session.mode] ?? 'Chop'
        const participantCount = session.participants?.length ?? 0
        const amount           = formatNaira(session.totalKobo ?? 0)
        title       = `Pay your share — ${session.title}`
        description = `${modeLabel} · ${amount} split across ${participantCount} ${participantCount === 1 ? 'person' : 'people'}. Open the link to pay your share on Chop — no app download needed.`
      }
    } catch {
      // fallback to generic session tags above
    }
  }

  const ogMeta = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${pageUrl}" />
    <meta property="og:type"         content="website" />
    <meta property="og:url"          content="${pageUrl}" />
    <meta property="og:title"        content="${title}" />
    <meta property="og:description"  content="${description}" />
    <meta property="og:image"        content="${imageUrl}" />
    <meta property="og:image:width"  content="800" />
    <meta property="og:image:height" content="452" />
    <meta property="og:site_name"    content="Chop" />
    <meta property="og:locale"       content="en_NG" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:url"         content="${pageUrl}" />
    <meta name="twitter:title"       content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image"       content="${imageUrl}" />
  `

  try {
    let html = readIndex()
    html = stripExistingMeta(html)
    html = html.replace('</head>', `${ogMeta}\n</head>`)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=60')
    return res.status(200).send(html)
  } catch {
    return res.status(200).send(
      `<!doctype html><html lang="en"><head><meta charset="UTF-8"/>${ogMeta}</head><body><div id="root"></div></body></html>`
    )
  }
}
