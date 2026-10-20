/**
 * Sanitizes raw @convex-dev/auth error messages into user-friendly strings.
 *
 * Raw library errors (e.g. "InvalidAccountId", "Invalid credentials") must
 * never be shown to users — they leak internal details and confuse non-technical
 * users. All auth catch blocks must call sanitizeAuthError(err, flow).
 *
 * Strategy: allowlist known safe patterns; everything else → generic fallback.
 * Unknown future library errors automatically fall through safely.
 */

export type AuthFlow =
  | 'signIn'
  | 'signUp'
  | 'reset'
  | 'reset-verification'
  | 'linkCredential'
  | 'google'

export function sanitizeAuthError(err: unknown, flow: AuthFlow = 'signIn'): string {
  const raw   = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()

  // ── Rate limiting (any flow) ─────────────────────────────────────────────────
  if (lower.includes('too many') || lower.includes('rate limit'))
    return 'Too many attempts. Please wait a moment and try again.'

  // ── Flow-specific known patterns ─────────────────────────────────────────────

  if (flow === 'signIn') {
    // InvalidAccountId = no password account for that email
    // Invalid credentials = wrong password
    // Both map to the same message — never confirm whether the email exists
    if (
      lower.includes('invalidaccountid') ||
      lower.includes('invalid credentials') ||
      lower.includes('invalid email')
    ) return 'Invalid email or password.'
  }

  if (flow === 'signUp') {
    if (
      lower.includes('already exists') ||
      lower.includes('could not sign up') ||
      lower.includes('duplicate')
    ) return 'An account with this email already exists. Try logging in instead.'
  }

  if (flow === 'reset') {
    if (lower.includes('invalidaccountid') || lower.includes('not found'))
      return 'No account found with that email address.'
    if (lower.includes('failed to send') || lower.includes('resend'))
      return 'Could not send the reset email. Please try again.'
  }

  if (flow === 'reset-verification') {
    if (
      lower.includes('invalid code') ||
      lower.includes('expired') ||
      lower.includes('verification')
    ) return 'That code is incorrect or has expired. Please request a new one.'
    if (lower.includes('invalidaccountid'))
      return 'Session expired. Please start the reset process again.'
  }

  if (flow === 'linkCredential') {
    if (lower.includes('already exists'))
      return 'A password is already set on this account.'
  }

  if (flow === 'google') {
    if (lower.includes('popup') || lower.includes('cancelled') || lower.includes('closed'))
      return 'Sign-in was cancelled. Please try again.'
    if (lower.includes('network') || lower.includes('fetch'))
      return 'Network error. Check your connection and try again.'
  }

  // ── Generic internal errors — never expose server internals ──────────────────
  // Anything that looks like a library / server message → safe fallback
  if (
    lower.includes('server error')      ||
    lower.includes('uncaught error')    ||
    lower.includes('internal')          ||
    lower.includes('missing `')         ||
    lower.includes('convex')            ||
    lower.includes('at retriev')        ||   // stack frame
    lower.includes('at async')          ||   // stack frame
    raw.includes('\n')                  ||   // multi-line = stack trace
    raw.includes('    at ')             ||   // stack frame indent
    raw.startsWith('Error:')
  ) return 'Something went wrong. Please try again.'

  // ── Final safety net — only pass through short, plain messages ───────────────
  // If it looks like something a human wrote (short, no stack), show it.
  // Otherwise fall back to generic.
  if (raw.length <= 100 && !raw.includes('Error') && !raw.includes('\n'))
    return raw

  return 'Something went wrong. Please try again.'
}
