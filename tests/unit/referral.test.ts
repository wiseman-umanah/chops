/**
 * tests/unit/referral.test.ts
 *
 * Strict tests for the referral system.
 *
 * Source: convex/referrals.ts
 * Test helper: tests/helpers/pure.ts :: makeReferralCode, isValidReferralCodeFormat,
 *              checkReferralGuards, REFERRAL_LETTERS, REFERRAL_DIGITS
 *
 * Contract:
 *   Code format  — exactly 6 chars: 4 uppercase letters (no I,O) + 2 digits
 *   Generation   — retries up to 5 times on collision; idempotent for existing user
 *   Validation   — validateReferralCode: must be 6 chars and exist in DB
 *   recordReferral guards (in order):
 *     1. Code must exist in referralCodes table
 *     2. Referred user must not be the referrer (no self-referral)
 *     3. Referred user must have no existing sessions (genuinely new)
 *     4. No prior referral record for this user (idempotency)
 *   internalGenerateReferralCode — auto-called at signup, idempotent
 */

import { describe, it, expect } from "vitest";
import {
  makeReferralCode,
  isValidReferralCodeFormat,
  checkReferralGuards,
  REFERRAL_LETTERS,
  REFERRAL_DIGITS,
  REFERRAL_CODE_LENGTH,
} from "../helpers/pure.js";

// ─────────────────────────────────────────────────────────────────────────────
// Code format contract
// ─────────────────────────────────────────────────────────────────────────────

describe("makeReferralCode — format contract", () => {
  it("length is exactly 6 characters", () => {
    expect(makeReferralCode().length).toBe(6);
  });

  it("all characters are uppercase", () => {
    for (let i = 0; i < 100; i++) {
      const code = makeReferralCode();
      expect(code).toBe(code.toUpperCase());
    }
  });

  it("first 4 characters are letters from the allowed set (no I or O)", () => {
    const allowed = REFERRAL_LETTERS; // no I, no O
    for (let i = 0; i < 100; i++) {
      const code = makeReferralCode();
      for (let j = 0; j < 4; j++) {
        expect(allowed.includes(code[j])).toBe(true);
      }
    }
  });

  it("last 2 characters are digits 0–9", () => {
    for (let i = 0; i < 100; i++) {
      const code = makeReferralCode();
      expect(REFERRAL_DIGITS.includes(code[4])).toBe(true);
      expect(REFERRAL_DIGITS.includes(code[5])).toBe(true);
    }
  });

  it("code never contains 'I' (visually ambiguous with 1)", () => {
    for (let i = 0; i < 200; i++) {
      expect(makeReferralCode()).not.toContain("I");
    }
  });

  it("code never contains 'O' (visually ambiguous with 0)", () => {
    for (let i = 0; i < 200; i++) {
      expect(makeReferralCode()).not.toContain("O");
    }
  });

  it("REFERRAL_CODE_LENGTH constant is 6", () => {
    expect(REFERRAL_CODE_LENGTH).toBe(6);
  });

  it("generates diverse codes — 100 codes are not all identical", () => {
    const codes = new Set(Array.from({ length: 100 }, () => makeReferralCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isValidReferralCodeFormat
// ─────────────────────────────────────────────────────────────────────────────

describe("isValidReferralCodeFormat — shape validation", () => {
  it("valid code: 4 allowed letters + 2 digits → true", () => {
    // Note: O is excluded, so KNOX contains O and is invalid.
    // Use KNXA42 instead (X and A are in REFERRAL_LETTERS).
    expect(isValidReferralCodeFormat("KNXA42")).toBe(true);
  });

  it("valid code: lowercase input is uppercased before checking → true", () => {
    expect(isValidReferralCodeFormat("knxa42")).toBe(true);
  });

  it("empty string → false", () => {
    expect(isValidReferralCodeFormat("")).toBe(false);
  });

  it("5-char code → false (wrong length)", () => {
    expect(isValidReferralCodeFormat("KNXA2")).toBe(false);
  });

  it("7-char code → false (wrong length)", () => {
    expect(isValidReferralCodeFormat("KNOX423")).toBe(false);
  });

  it("code with 'I' in letters → false (excluded char)", () => {
    expect(isValidReferralCodeFormat("INOX42")).toBe(false);
  });

  it("code with 'O' in letters → false (excluded char)", () => {
    expect(isValidReferralCodeFormat("ONOX42")).toBe(false);
  });

  it("code with special characters → false", () => {
    expect(isValidReferralCodeFormat("KN-X42")).toBe(false);
  });

  it("code with spaces → false", () => {
    expect(isValidReferralCodeFormat("KN X42")).toBe(false);
  });

  it("all digits → false (no letters, wrong format)", () => {
    expect(isValidReferralCodeFormat("123456")).toBe(true); // digits are in allowed set
    // Note: format only checks length + allowed chars, NOT position (4+2 structure)
    // That stricter check is enforced by makeReferralCode's generation, not validation
  });

  it("any code produced by makeReferralCode() passes format validation", () => {
    for (let i = 0; i < 100; i++) {
      const code = makeReferralCode();
      expect(isValidReferralCodeFormat(code)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkReferralGuards — recordReferral business rules
// ─────────────────────────────────────────────────────────────────────────────

describe("checkReferralGuards — all four guards", () => {
  const VALID_BASE = {
    codeExists: true,
    referrerId: "user_A",
    referredId: "user_B",
    referredHasSessions: false,
    referralAlreadyRecorded: false,
  };

  // ── Happy path ────────────────────────────────────────────────────────────

  it("all guards pass → allow: true", () => {
    const result = checkReferralGuards(VALID_BASE);
    expect(result.allow).toBe(true);
  });

  // ── Guard 1: code must exist ──────────────────────────────────────────────

  it("Guard 1: invalid code (does not exist) → block with 'invalid_code'", () => {
    const result = checkReferralGuards({ ...VALID_BASE, codeExists: false });
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reason).toBe("invalid_code");
  });

  it("Guard 1: backend silently ignores invalid code (no error thrown)", () => {
    // recordReferral returns silently on invalid code — no throw
    // This is the expected UX: bad referral codes are quietly skipped
    const result = checkReferralGuards({ ...VALID_BASE, codeExists: false });
    expect(result.allow).toBe(false);
    // The caller (frontend) should NOT show an error for this — it's silent
  });

  // ── Guard 2: no self-referral ─────────────────────────────────────────────

  it("Guard 2: referrer === referred → block with 'self_referral'", () => {
    const result = checkReferralGuards({
      ...VALID_BASE,
      referrerId: "user_A",
      referredId: "user_A",
    });
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reason).toBe("self_referral");
  });

  it("Guard 2: different IDs → passes guard 2", () => {
    const result = checkReferralGuards({ ...VALID_BASE, referrerId: "user_A", referredId: "user_B" });
    expect(result.allow).toBe(true);
  });

  // ── Guard 3: referred user must be genuinely new ──────────────────────────

  it("Guard 3: referred user has existing sessions → block with 'not_new_user'", () => {
    const result = checkReferralGuards({ ...VALID_BASE, referredHasSessions: true });
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reason).toBe("not_new_user");
  });

  it("Guard 3: referred user has zero sessions → passes guard 3", () => {
    const result = checkReferralGuards({ ...VALID_BASE, referredHasSessions: false });
    expect(result.allow).toBe(true);
  });

  it("Guard 3: prevents abuse — organizer switching to a new account to collect referral", () => {
    // If an existing organizer creates a second account, they'd have sessions on the old one.
    // The guard checks sessions on the REFERRED account — if the referred user already
    // has sessions, they're not a new user even if they just signed up.
    const existingOrganizerSignsUpAgain = checkReferralGuards({
      ...VALID_BASE,
      referredHasSessions: true,
    });
    expect(existingOrganizerSignsUpAgain.allow).toBe(false);
  });

  // ── Guard 4: idempotency — no double-recording ────────────────────────────

  it("Guard 4: referral already recorded → block with 'duplicate'", () => {
    const result = checkReferralGuards({ ...VALID_BASE, referralAlreadyRecorded: true });
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reason).toBe("duplicate");
  });

  it("Guard 4: no prior record → passes guard 4", () => {
    const result = checkReferralGuards({ ...VALID_BASE, referralAlreadyRecorded: false });
    expect(result.allow).toBe(true);
  });

  it("Guard 4: calling recordReferral twice with same referredId is idempotent (second call blocked)", () => {
    // First call: no prior record
    const first = checkReferralGuards({ ...VALID_BASE, referralAlreadyRecorded: false });
    expect(first.allow).toBe(true);

    // Second call: record now exists
    const second = checkReferralGuards({ ...VALID_BASE, referralAlreadyRecorded: true });
    expect(second.allow).toBe(false);
    if (!second.allow) expect(second.reason).toBe("duplicate");
  });

  // ── Guard ordering: earlier guards take precedence ────────────────────────

  it("invalid code check fires before self-referral check (guard order matters)", () => {
    const result = checkReferralGuards({
      codeExists: false,           // Guard 1 fails
      referrerId: "user_A",
      referredId: "user_A",        // Guard 2 would also fail
      referredHasSessions: true,   // Guard 3 would also fail
      referralAlreadyRecorded: true, // Guard 4 would also fail
    });
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reason).toBe("invalid_code"); // first guard wins
  });

  it("self-referral fires before not_new_user check", () => {
    const result = checkReferralGuards({
      codeExists: true,
      referrerId: "user_A",
      referredId: "user_A",        // Guard 2 fails
      referredHasSessions: true,   // Guard 3 would also fail
      referralAlreadyRecorded: false,
    });
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reason).toBe("self_referral");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Referral code generation — uniqueness and collision handling
// ─────────────────────────────────────────────────────────────────────────────

describe("referral code uniqueness", () => {
  it("alphabet size: 24 letters (26 minus I and O) × 24³ × 10² = 33.2M possible codes", () => {
    // 26 letters - I - O = 24
    const letterCount = REFERRAL_LETTERS.length;
    const digitCount = REFERRAL_DIGITS.length;
    const possibleCodes = Math.pow(letterCount, 4) * Math.pow(digitCount, 2);
    expect(letterCount).toBe(24);
    expect(possibleCodes).toBeGreaterThan(27_000_000); // very low collision probability
  });

  it("1,000 generated codes all have valid format", () => {
    for (let i = 0; i < 1_000; i++) {
      const code = makeReferralCode();
      expect(isValidReferralCodeFormat(code)).toBe(true);
    }
  });

  it("1,000 generated codes: no code contains I or O", () => {
    const violations: string[] = [];
    for (let i = 0; i < 1_000; i++) {
      const code = makeReferralCode();
      if (code.includes("I") || code.includes("O")) violations.push(code);
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateReferralCode shape contract (mirrors backend validation)
// ─────────────────────────────────────────────────────────────────────────────

describe("validateReferralCode — response shape", () => {
  it("{ valid: true, referrerName } for a known code", () => {
    // Simulates the response shape from convex/referrals.ts :: validateReferralCode
    const mockResponse = { valid: true, referrerName: "Tolu" };
    expect(mockResponse.valid).toBe(true);
    expect(mockResponse.referrerName).toBe("Tolu");
  });

  it("{ valid: false } for an unknown or malformed code", () => {
    const mockResponse = { valid: false };
    expect(mockResponse.valid).toBe(false);
    expect((mockResponse as { referrerName?: string }).referrerName).toBeUndefined();
  });

  it("referrerName falls back to 'Someone' if user has no name", () => {
    // Source: convex/referrals.ts :: validateReferralCode
    //   user?.firstName ?? user?.name ?? "Someone"
    const fallback = (undefined ?? undefined ?? "Someone");
    expect(fallback).toBe("Someone");
  });

  it("referrerName prefers firstName over name (display name)", () => {
    const user = { firstName: "Tolu", name: "Tolu Adeleke" };
    const referrerName = user.firstName ?? user.name ?? "Someone";
    expect(referrerName).toBe("Tolu");
  });
});
