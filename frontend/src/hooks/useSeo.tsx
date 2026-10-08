import { Helmet } from 'react-helmet-async'

const SITE_NAME   = 'Chop'
const SITE_URL    = 'https://chop.pxxl.click'
const DEFAULT_IMG = `${SITE_URL}/og-image.png`
const DEFAULT_DESCRIPTION =
  'No app download. No awkward money talk. Create a Chop session, share the link on WhatsApp, and let everyone settle their share directly.'

interface SeoProps {
  title?: string
  description?: string
  image?: string
  /** Canonical path e.g. "/s/CH-XXXXXXXX" — full URL will be composed */
  path?: string
  /** noindex pages (dashboard, settings, etc.) */
  noIndex?: boolean
}

/**
 * Drop-in SEO component. Renders into <head> via react-helmet-async.
 *
 * Usage:
 *   <Seo title="Pay your share — Burger Night" path="/s/CH-ABC123" />
 */
export function Seo({ title, description, image, path, noIndex }: SeoProps) {
  const pageTitle  = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Split Bills & Pool Funds via WhatsApp`
  const pageDesc   = description ?? DEFAULT_DESCRIPTION
  const pageImg    = image ?? DEFAULT_IMG
  const canonical  = path ? `${SITE_URL}${path}` : SITE_URL

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDesc} />
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type"        content="website" />
      <meta property="og:url"         content={canonical} />
      <meta property="og:title"       content={pageTitle} />
      <meta property="og:description" content={pageDesc} />
      <meta property="og:image"       content={pageImg} />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:locale"      content="en_NG" />

      {/* Twitter */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:url"         content={canonical} />
      <meta name="twitter:title"       content={pageTitle} />
      <meta name="twitter:description" content={pageDesc} />
      <meta name="twitter:image"       content={pageImg} />
    </Helmet>
  )
}
