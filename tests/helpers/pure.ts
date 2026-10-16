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

// ─────────────────────────────────────────────────────────────────────────────
// computeFees  (source: convex/fees.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_FEE_RATE            = 0.02;
export const PLATFORM_FEE_CAP_KOBO        = 200_000;  // ₦2,000
export const BACHS_BANK_TRANSFER_RATE     = 0.015;
export const BACHS_BANK_TRANSFER_CAP_KOBO = 200_000;  // ₦2,000
export const BACHS_WITHDRAWAL_FEE_KOBO    = 5_000;    // ₦50

export interface FeeBreakdown {
  amountDueKobo: number;
  platformFeeKobo: number;
  checkoutAmountKobo: number;
  estimatedBachsFeeKobo: number;
  estimatedTotalKobo: number;
}

export function computeFees(amountDueKobo: number): FeeBreakdown {
  const platformFeeKobo = Math.min(
    Math.round(amountDueKobo * PLATFORM_FEE_RATE),
    PLATFORM_FEE_CAP_KOBO,
  );
  const checkoutAmountKobo = amountDueKobo + platformFeeKobo;
  const estimatedBachsFeeKobo = Math.min(
    Math.round(checkoutAmountKobo * BACHS_BANK_TRANSFER_RATE),
    BACHS_BANK_TRANSFER_CAP_KOBO,
  );
  return {
    amountDueKobo,
    platformFeeKobo,
    checkoutAmountKobo,
    estimatedBachsFeeKobo,
    estimatedTotalKobo: checkoutAmountKobo + estimatedBachsFeeKobo,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payout computation  (source: convex/payouts.ts :: listCompletedChopIn / requestPayout)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the net payout for a chop-in withdrawal after the ₦50 Bachs fee.
 * Source of truth for both listCompletedChopIn and requestPayout.
 */
export function computeChopInPayoutNew(collectedKobo: number): {
  bachsTransferFeeKobo: number;
  feeKobo: number;
  payoutKobo: number;
} {
  const feeKobo = BACHS_WITHDRAWAL_FEE_KOBO;
  return {
    bachsTransferFeeKobo: feeKobo,
    feeKobo,
    payoutKobo: collectedKobo - feeKobo,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral code helpers  (source: convex/referrals.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const REFERRAL_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
export const REFERRAL_DIGITS  = "0123456789";
export const REFERRAL_CODE_LENGTH = 6;

/** Mirrors makeCode() from convex/referrals.ts — 4 letters + 2 digits */
export function makeReferralCode(): string {
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const letters = Array.from({ length: 4 }, () => pick(REFERRAL_LETTERS)).join("");
  const digits  = Array.from({ length: 2 }, () => pick(REFERRAL_DIGITS)).join("");
  return letters + digits;
}

/**
 * Mirrors the shape-validation done in validateReferralCode:
 *   - must be exactly 6 chars
 *   - must match only allowed characters
 */
export function isValidReferralCodeFormat(code: string): boolean {
  if (!code || code.length !== REFERRAL_CODE_LENGTH) return false;
  const allowed = REFERRAL_LETTERS + REFERRAL_DIGITS;
  return [...code.toUpperCase()].every((c) => allowed.includes(c));
}

/**
 * Mirrors the guard logic from recordReferral (pure business rules only):
 *   - code must exist (simulated by codeExists flag)
 *   - referred user must not be the referrer (self-referral guard)
 *   - referred user must have no existing sessions (genuinely new user)
 *   - must not already have a referral record (idempotency)
 */
export interface ReferralGuardInput {
  codeExists: boolean;
  referrerId: string;
  referredId: string;
  referredHasSessions: boolean;
  referralAlreadyRecorded: boolean;
}

export type ReferralGuardResult =
  | { allow: true }
  | { allow: false; reason: "invalid_code" | "self_referral" | "not_new_user" | "duplicate" };

export function checkReferralGuards(input: ReferralGuardInput): ReferralGuardResult {
  if (!input.codeExists) return { allow: false, reason: "invalid_code" };
  if (input.referrerId === input.referredId) return { allow: false, reason: "self_referral" };
  if (input.referredHasSessions) return { allow: false, reason: "not_new_user" };
  if (input.referralAlreadyRecorded) return { allow: false, reason: "duplicate" };
  return { allow: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-participant payment progress helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface ParticipantPaymentRow {
  name: string;
  amountOwed: number;  // pure share, kobo
  status: "pending" | "sent";
}

/** Returns total amount collected from "sent" participants */
export function totalCollected(participants: ParticipantPaymentRow[]): number {
  return participants
    .filter((p) => p.status === "sent")
    .reduce((sum, p) => sum + p.amountOwed, 0);
}

/** Returns total amount still outstanding from "pending" participants */
export function totalOutstanding(participants: ParticipantPaymentRow[]): number {
  return participants
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amountOwed, 0);
}

/** Progress percentage (0–100) for food/bill sessions */
export function sessionProgressPct(participants: ParticipantPaymentRow[]): number {
  if (participants.length === 0) return 0;
  const paid = participants.filter((p) => p.status === "sent").length;
  return Math.round((paid / participants.length) * 100);
}

/** Progress percentage (0–100) for chop-in sessions by collected / goal */
export function chopInProgressPct(collectedKobo: number, goalKobo: number): number {
  if (goalKobo <= 0) return 0;
  return Math.min(100, Math.round((collectedKobo / goalKobo) * 100));
}

// ─────────────────────────────────────────────────────────────────────────────
// Stale / abandoned payment helpers
// (source: convex/crons.ts :: cleanupAbandonedParticipants)
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingParticipantRow {
  _id: string;
  status: "pending" | "sent";
  paymentRef?: string;
  _creationTime: number;   // ms since epoch
}

/** Mirrors the cron filter: pending, no paymentRef, older than cutoff */
export function isAbandonedParticipant(
  row: PendingParticipantRow,
  cutoffMs: number,
): boolean {
  return (
    row.status === "pending" &&
    !row.paymentRef &&
    row._creationTime < cutoffMs
  );
}

/** Returns the 24-hour cutoff timestamp in ms for abandoned participant cleanup */
export function abandonedCutoff(nowMs: number): number {
  return nowMs - 24 * 60 * 60 * 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Latency budget contracts (pure timing helpers — no real I/O)
// ─────────────────────────────────────────────────────────────────────────────

export interface LatencyBudget {
  /** Maximum acceptable round-trip in milliseconds */
  maxMs: number;
  /** Descriptive label for error messages */
  label: string;
}

export const LATENCY_BUDGETS: Record<string, LatencyBudget> = {
  /** Fee computation must be instantaneous — it's pure math */
  FEE_COMPUTATION:    { maxMs: 1,    label: "computeFees() — pure math" },
  /** Slug generation must be fast — called on every session create */
  SLUG_GENERATION:    { maxMs: 1,    label: "generateSlug() — pure random" },
  /** Referral code generation — pure random, 4+2 chars */
  REFERRAL_CODE_GEN:  { maxMs: 1,    label: "makeReferralCode() — pure random" },
  /** Webhook HMAC verification (uses Web Crypto — async but local) */
  WEBHOOK_HMAC:       { maxMs: 50,   label: "computeHmacSha256() — Web Crypto" },
  /** Payment success poll timeout — 90s in production; we verify the contract */
  PAYMENT_POLL_TIMEOUT: { maxMs: 90_000, label: "PaymentSuccessPage poll timeout" },
  /** Abandoned participant cutoff: 24h in ms */
  CLEANUP_CUTOFF_MS:  { maxMs: 86_400_000, label: "abandonedCutoff() — 24h cleanup" },
};

/** Returns true if actualMs is within the given budget */
export function withinLatencyBudget(actualMs: number, budget: LatencyBudget): boolean {
  return actualMs <= budget.maxMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Double-charge detection helper
// Guards against the fee overhaul migration risk:
//   Old sessions: amountOwed already included feePerParticipant baked in.
//   New sessions: amountOwed is pure share; fee added at checkout via computeFees.
// ─────────────────────────────────────────────────────────────────────────────

export interface LegacyParticipantRow {
  amountOwed: number;
  platformFeeKobo?: number;  // set by new initiateCheckout; absent on legacy rows
}

export interface LegacySessionRow {
  feePerParticipant?: number;  // set by old createSession; absent on new sessions
}

/**
 * Returns true if this participant would be double-charged if the new 2%
 * checkout fee were applied naively.
 *
 * Rule: a legacy participant whose session has feePerParticipant set AND
 * whose platformFeeKobo has not been patched yet is at risk.
 * The migration (migrateUnpaidParticipants) strips feePerParticipant from
 * amountOwed before the new initiateCheckout deploys.
 */
export function isDoubleChargeRisk(
  participant: LegacyParticipantRow,
  session: LegacySessionRow,
): boolean {
  return (
    session.feePerParticipant != null &&
    session.feePerParticipant > 0 &&
    participant.platformFeeKobo == null
  );
}

/**
 * Simulates migrateUnpaidParticipants for a single participant:
 * strips the old baked-in feePerParticipant from amountOwed.
 * Returns the clean amountOwed or throws if it would go negative.
 */
export function migrateParticipantAmountOwed(
  participant: LegacyParticipantRow,
  feePerParticipant: number,
): number {
  const clean = participant.amountOwed - feePerParticipant;
  if (clean < 0) {
    throw new Error(
      `Migration would produce negative amountOwed: ${participant.amountOwed} - ${feePerParticipant} = ${clean}`,
    );
  }
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout intent builder — mirrors initiateCheckout's pre-Bachs-call logic
// (source: convex/payments.ts :: initiateCheckout)
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckoutIntent {
  amountDueKobo: number;
  fees: FeeBreakdown;
  /** The NGN decimal string sent to Bachs as pricing.amount */
  bachsAmountStr: string;
  /** customer_bears_fee always true */
  customerBearsFee: true;
}

/**
 * Builds the checkout intent for a food/bill participant.
 * Mirrors the relevant pure portion of initiateCheckout.
 */
export function buildFoodBillCheckoutIntent(amountOwedKobo: number): CheckoutIntent {
  const fees = computeFees(amountOwedKobo);
  return {
    amountDueKobo: amountOwedKobo,
    fees,
    bachsAmountStr: (fees.checkoutAmountKobo / 100).toFixed(2),
    customerBearsFee: true,
  };
}

/**
 * Builds the checkout intent for a chop-in contribution.
 */
export function buildChopInCheckoutIntent(contributionKobo: number): CheckoutIntent {
  const fees = computeFees(contributionKobo);
  return {
    amountDueKobo: contributionKobo,
    fees,
    bachsAmountStr: (fees.checkoutAmountKobo / 100).toFixed(2),
    customerBearsFee: true,
  };
}
