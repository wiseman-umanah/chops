/**
 * Auth + app error sanitizers.
 *
 * Raw Convex / library errors must never reach the user as-is — they leak
 * internal details and confuse non-technical users.
 *
 * Strategy: allowlist known safe patterns per context; everything else →
 * a calm generic fallback. Unknown future errors fall through safely.
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

// ── App error sanitizer ───────────────────────────────────────────────────────

/**
 * Sanitizes errors thrown by Convex mutations/actions in app flows
 * (payments, session management, profile, payout, etc.).
 *
 * Messages written by YOUR OWN backend code are short, plain English, and
 * safe to show — they pass through. Everything else (Convex internals,
 * network errors, stack traces) → calm generic fallback.
 *
 * @param fallback  Optional custom fallback if you want something more
 *                  specific than "Something went wrong."
 */
export function sanitizeAppError(err: unknown, fallback?: string): string {
  const DEFAULT = fallback ?? 'Something went wrong. Please try again.'
  const raw   = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()

  // ── Always block server/library internals ────────────────────────────────────
  if (
    lower.includes('server error')   ||
    lower.includes('uncaught error') ||
    lower.includes('convex')         ||
    lower.includes('at async')       ||   // stack frame
    raw.includes('    at ')          ||   // stack frame indent
    raw.includes('\n')               ||   // multi-line = stack trace
    raw.startsWith('Error:')         ||
    raw.length > 200
  ) return DEFAULT

  // ── Network / connectivity ───────────────────────────────────────────────────
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch'))
    return 'Connection error. Check your internet and try again.'

  // ── Known app-level messages from YOUR backend — pass through as-is ──────────
  // These are messages you wrote in convex/*.ts that are safe and user-friendly.
  // They're short, plain English, and contain no internal details.
  // Everything else falls through to the generic fallback below.
  const SAFE_PATTERNS = [
    'session not found',
    'not your session',
    'already paid',
    'cannot edit a session',
    'at least one participant',
    'percentages must add up',
    'custom amounts must add up',
    'minimum target amount',
    'minimum contribution',
    'session must be completed',
    'payout for this session is already',
    'failed to register bank account',
    'could not resolve account',
    'insufficient',
    'temporarily unavailable',
    'not authenticated',
    'upload failed',
    'could not save',
    'invalid email',
    'incorrect or expired',
    'already exists',
    'goal amount is required',
  ]

  if (SAFE_PATTERNS.some(p => lower.includes(p))) return raw

  // ── Short plain messages with no suspicious tokens — likely safe ─────────────
  if (
    raw.length <= 120 &&
    !raw.includes('Error') &&
    !raw.includes('\n') &&
    !raw.includes('    ')
  ) return raw

  return DEFAULT
}
