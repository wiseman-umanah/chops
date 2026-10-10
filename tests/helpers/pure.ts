/**
 * tests/helpers/pure.ts
 *
 * Pure-function re-implementations of every piece of business logic in the
 * Convex backend that can be isolated from ctx.db / auth / Bachs API calls.
 *
 * ❗ These must stay byte-for-byte identical to the source in convex/.
 *    When you change the backend logic, update this file too — that's the
 *    discipline: a divergence here is itself a detected bug.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fee logic  (source: convex/sessions.ts :: computeFlatFeePerParticipant)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tier table (total = grand total incl. tax+tip, in kobo):
 *   < ₦5,000  (500_000 kobo)  → ₦100  flat total fee  (10_000 kobo)
 *   < ₦10,000 (1_000_000)     → ₦150  flat total fee  (15_000 kobo)
 *   < ₦20,000 (2_000_000)     → ₦200  flat total fee  (20_000 kobo)
 *   < ₦50,000 (5_000_000)     → 0.75% of total (rounded)
 *   ≥ ₦50,000                 → 0.5%  of total (rounded)
 *
 * Returns the fee per participant (integer kobo).
 */
export function computeFlatFeePerParticipant(
  totalKobo: number,
  participantCount: number,
): number {
  if (participantCount === 0) return 0;

  let totalFee: number;
  if (totalKobo < 500_000) {
    totalFee = 10_000; // ₦100
  } else if (totalKobo < 1_000_000) {
    totalFee = 15_000; // ₦150
  } else if (totalKobo < 2_000_000) {
    totalFee = 20_000; // ₦200
  } else if (totalKobo < 5_000_000) {
    totalFee = Math.round(totalKobo * 0.0075); // 0.75%
  } else {
    totalFee = Math.round(totalKobo * 0.005); // 0.5%
  }

  return Math.round(totalFee / participantCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug generation  (source: convex/sessions.ts :: generateSlug)
// ─────────────────────────────────────────────────────────────────────────────

/** Characters that may appear in the slug body.  I and O are excluded. */
export const SLUG_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const SLUG_DIGITS = "0123456789";
export const SLUG_ALL = SLUG_LETTERS + SLUG_DIGITS;
export const SLUG_PREFIX = "CH-";
export const SLUG_BODY_LENGTH = 8;
export const SLUG_MIN_LETTERS = 2;
export const SLUG_MIN_DIGITS = 2;

export function generateSlug(): string {
  const parts: string[] = [];
  parts.push(SLUG_LETTERS[Math.floor(Math.random() * SLUG_LETTERS.length)]);
  parts.push(SLUG_LETTERS[Math.floor(Math.random() * SLUG_LETTERS.length)]);
  parts.push(SLUG_DIGITS[Math.floor(Math.random() * SLUG_DIGITS.length)]);
  parts.push(SLUG_DIGITS[Math.floor(Math.random() * SLUG_DIGITS.length)]);
  for (let i = 0; i < 4; i++) {
    parts.push(SLUG_ALL[Math.floor(Math.random() * SLUG_ALL.length)]);
  }
  // Fisher-Yates shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return SLUG_PREFIX + parts.join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Kobo → NGN string  (source: convex/payments.ts, convex/payouts.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Converts kobo (integer) to the NGN decimal string Bachs expects. */
export function koboToAmountStr(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Food participant share  (source: convex/sessions.ts :: createSession handler)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a single food-mode participant's amountOwed.
 *
 * @param itemsTotal     Sum of participant's line-item prices in kobo
 * @param totalAmount    Grand total of the session (incl. tax+tip) in kobo
 * @param taxKobo        Tax added to the session in kobo
 * @param tipKobo        Tip added to the session in kobo
 * @param feePerParticipant  Flat fee per participant in kobo
 */
export function computeFoodParticipantOwed(
  itemsTotal: number,
  totalAmount: number,
  taxKobo: number,
  tipKobo: number,
  feePerParticipant: number,
): number {
  const taxTip = taxKobo + tipKobo;
  const itemsSubtotal = totalAmount - taxTip;
  const taxTipRatio = itemsSubtotal > 0 ? taxTip / itemsSubtotal : 0;
  const share = Math.round(itemsTotal * (1 + taxTipRatio));
  return share + feePerParticipant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bill split validation  (source: convex/sessions.ts :: createSession handler)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that percentage-split participants sum to 100 (±0.01 tolerance).
 * Throws exactly the error message the backend throws.
 */
export function validatePercentageSum(
  participants: { sharePercent: number }[],
): void {
  const total = participants.reduce((sum, p) => sum + (p.sharePercent ?? 0), 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error("Percentages must add up to 100");
  }
}

/**
 * Validates that custom-split amounts sum to the total (±1 kobo tolerance).
 * Throws exactly the error message the backend throws.
 */
export function validateCustomAmountSum(
  participants: { amountOwed: number }[],
  totalAmount: number,
): void {
  const sum = participants.reduce((s, p) => s + (p.amountOwed ?? 0), 0);
  if (Math.abs(sum - totalAmount) > 1) {
    throw new Error("Custom amounts must add up to the total bill");
  }
}

/**
 * Computes a bill participant's amountOwed for each split type.
 */
export function computeBillParticipantOwed(
  splitType: "equal" | "percentage" | "custom",
  totalAmount: number,
  participantCount: number,
  sharePercent: number | undefined,
  customAmountOwed: number | undefined,
  feePerParticipant: number,
): number {
  let base = 0;
  if (splitType === "equal") {
    base = Math.round(totalAmount / participantCount);
  } else if (splitType === "percentage") {
    base = Math.round(totalAmount * ((sharePercent ?? 0) / 100));
  } else {
    base = customAmountOwed ?? 0;
  }
  return base + feePerParticipant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chop-in fee computation  (source: convex/payouts.ts :: listCompletedChopIn)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the platform fee and net payout amount for a chop-in session.
 *
 * feePercent is always 10 for chop-in (set in createSession).
 */
export function computeChopInPayout(
  collectedKobo: number,
  feePercent: number,
): { feeKobo: number; payoutKobo: number } {
  const feeKobo = feePercent
    ? Math.round(collectedKobo * (feePercent / 100))
    : 0;
  return { feeKobo, payoutKobo: collectedKobo - feeKobo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fraud detection  (source: convex/sessions.ts :: closeSession handler)
// ─────────────────────────────────────────────────────────────────────────────

export interface FraudCheckInput {
  paidParticipantCount: number;
  collectedKobo: number;
  /** goalAmount if set, else totalAmount */
  goalKobo: number;
}

export interface FraudCheckResult {
  isSuspicious: boolean;
}

/** Pure logic: is this chop-in early-close suspicious? */
export function isSuspiciousEarlyClose(input: FraudCheckInput): boolean {
  const { paidParticipantCount, collectedKobo, goalKobo } = input;
  return (
    paidParticipantCount > 0 &&
    goalKobo > 0 &&
    collectedKobo / goalKobo < 0.5
  );
}

export interface StrikeResult {
  newCount: number;
  newStatus: "active" | "under_review" | "suspended";
}

/**
 * Computes the new earlyCloseCount and accountStatus after one suspicious close.
 *
 * Rules:
 *   - Never downgrade a more severe status (suspended > under_review > active).
 *   - Only escalate to "under_review" at 5+ strikes AND not already at a worse level.
 */
export function applyFraudStrike(
  currentCount: number,
  currentStatus: "active" | "under_review" | "suspended",
): StrikeResult {
  const newCount = currentCount + 1;
  const shouldEscalate =
    newCount >= 5 &&
    currentStatus !== "under_review" &&
    currentStatus !== "suspended";
  const newStatus = shouldEscalate ? "under_review" : currentStatus;
  return { newCount, newStatus };
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook HMAC signature construction & verification
// (source: convex/http_actions.ts :: bachsWebhook)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the signed payload string exactly as the backend does:
 *   "{timestamp}.{rawBody}"
 */
export function buildSignedPayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

/**
 * Computes the HMAC-SHA256 hex signature of a payload using Web Crypto.
 * Mirrors exactly what the backend does to verify Bachs webhook signatures.
 */
export async function computeHmacSha256(
  secret: string,
  payload: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(payload),
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Parses a `X-Bachs-Signature-V2` header value into { t, v1 } parts.
 * Returns null if malformed.
 */
export function parseSignatureHeader(
  header: string,
): { t: string; v1: string } | null {
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq !== -1) parts[part.slice(0, eq)] = part.slice(eq + 1);
  }
  if (!parts["t"] || !parts["v1"]) return null;
  return { t: parts["t"], v1: parts["v1"] };
}

/**
 * Returns whether the given timestamp is within the 300-second replay window.
 */
export function isWithinReplayWindow(
  timestampSeconds: number,
  nowSeconds: number,
): boolean {
  return Math.abs(nowSeconds - timestampSeconds) <= 300;
}

// ─────────────────────────────────────────────────────────────────────────────
// Participant idempotency guard
// (source: convex/participants.ts :: updateParticipantStatus)
// ─────────────────────────────────────────────────────────────────────────────

export interface ParticipantLike {
  status: "pending" | "sent";
  paymentRef?: string;
}

/**
 * Returns true if this is a duplicate webhook call and should be skipped.
 * Matches the backend condition exactly.
 */
export function isDuplicateWebhookCall(participant: ParticipantLike): boolean {
  return participant.status === "sent";
}

// ─────────────────────────────────────────────────────────────────────────────
// payerEmail strip  (source: convex/participants.ts — destructuring pattern)
// ─────────────────────────────────────────────────────────────────────────────

export interface FullParticipantRow {
  _id: string;
  sessionId: string;
  name: string;
  amountOwed: number;
  status: "pending" | "sent";
  paymentRef?: string;
  payerEmail?: string;
}

/**
 * Strips payerEmail from a participant row — mirrors the backend destructuring.
 * Output must NEVER have a `payerEmail` key (not even undefined).
 */
export function stripPayerEmail(
  row: FullParticipantRow,
): Omit<FullParticipantRow, "payerEmail"> {
  const { payerEmail: _pe, ...safe } = row;
  void _pe;
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session lifecycle transition rules
// ─────────────────────────────────────────────────────────────────────────────

export type SessionStatus = "active" | "closed" | "inactive";

/**
 * Rules for what state transitions are legal, as enforced by the backend:
 *
 * createSession      → always "active"
 * closeSession       → "active"  → "closed"   (requires ownership; only organizer)
 * finalizeSession    → "closed"  → "inactive"  (requires status === "closed")
 * setSessionStatus   → any → any              (internal, no restriction)
 *
 * The function returns true if the transition is valid per the backend guards.
 */
export function isValidTransition(
  from: SessionStatus,
  to: SessionStatus,
  callerIsOrganizer: boolean,
): boolean {
  if (to === "closed") {
    // closeSession: organizer only, must be "active"
    return callerIsOrganizer && from === "active";
  }
  if (to === "inactive") {
    // finalizeSession: organizer only, must be "closed"
    return callerIsOrganizer && from === "closed";
  }
  // "active" transitions are internal only (setSessionStatus) — always allowed here
  return true;
}

/**
 * Auto-close rule for food/bill sessions: all participants paid → session closes.
 * Chop-in sessions NEVER auto-close.
 */
export function shouldAutoClose(
  mode: "food" | "bill" | "chop-in",
  allParticipants: { status: string }[],
): boolean {
  if (mode === "chop-in") return false;
  if (allParticipants.length === 0) return false;
  return allParticipants.every((p) => p.status === "sent");
}
