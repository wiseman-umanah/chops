/**
 * tests/unit/slug.test.ts
 *
 * Strict tests for generateSlug.
 * Source: convex/sessions.ts :: generateSlug
 *
 * Contract:
 *   - Total length: exactly 11 characters
 *   - Starts with "CH-"
 *   - 8-char body contains ONLY characters from SLUG_ALL (SLUG_LETTERS + SLUG_DIGITS)
 *   - I and O are explicitly excluded from the body (confusion avoidance)
 *   - Body contains at minimum 2 letters and 2 digits (guaranteed by construction)
 *   - Statistical: 10,000 samples must produce zero format violations
 *   - Statistical: 10,000 samples must all have at least 2 letters and 2 digits
 */

import { describe, it, expect } from "vitest";
import {
  generateSlug,
  SLUG_PREFIX,
  SLUG_BODY_LENGTH,
  SLUG_LETTERS,
  SLUG_DIGITS,
  SLUG_ALL,
} from "../helpers/pure.js";

// Helpers
const isLetter = (c: string) => SLUG_LETTERS.includes(c);
const isDigit = (c: string) => SLUG_DIGITS.includes(c);

function assertSlugInvariant(slug: string): void {
  // 1. Total length
  expect(slug.length).toBe(
    SLUG_PREFIX.length + SLUG_BODY_LENGTH,
  );

  // 2. Prefix
  expect(slug.startsWith(SLUG_PREFIX)).toBe(true);

  const body = slug.slice(SLUG_PREFIX.length);

  // 3. Body length
  expect(body.length).toBe(SLUG_BODY_LENGTH);

  // 4. All body chars are from the allowed set
  for (const ch of body) {
    expect(SLUG_ALL.includes(ch)).toBe(true);
  }

  // 5. No excluded chars (I or O — visually ambiguous with 1 and 0)
  expect(body.includes("I")).toBe(false);
  expect(body.includes("O")).toBe(false);

  // 6. At least 2 letters
  const letterCount = [...body].filter(isLetter).length;
  expect(letterCount).toBeGreaterThanOrEqual(2);

  // 7. At least 2 digits
  const digitCount = [...body].filter(isDigit).length;
  expect(digitCount).toBeGreaterThanOrEqual(2);
}

describe("generateSlug — format contract", () => {
  it("single slug: total length is 11", () => {
    const slug = generateSlug();
    expect(slug.length).toBe(11);
  });

  it('single slug: starts with "CH-"', () => {
    const slug = generateSlug();
    expect(slug.startsWith("CH-")).toBe(true);
  });

  it("single slug: body is exactly 8 characters", () => {
    const slug = generateSlug();
    expect(slug.slice(3).length).toBe(8);
  });

  it("single slug: body chars are all in the allowed set (letters A-Z minus I,O + digits)", () => {
    const slug = generateSlug();
    const body = slug.slice(3);
    for (const ch of body) {
      expect(SLUG_ALL.includes(ch)).toBe(true);
    }
  });

  it("single slug: body does NOT contain 'I' (excluded for visual clarity)", () => {
    // Run 100 times to reduce fluke probability
    for (let i = 0; i < 100; i++) {
      expect(generateSlug().slice(3).includes("I")).toBe(false);
    }
  });

  it("single slug: body does NOT contain 'O' (excluded for visual clarity)", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateSlug().slice(3).includes("O")).toBe(false);
    }
  });

  it("single slug: body contains at least 2 letters", () => {
    const body = generateSlug().slice(3);
    const letterCount = [...body].filter(isLetter).length;
    expect(letterCount).toBeGreaterThanOrEqual(2);
  });

  it("single slug: body contains at least 2 digits", () => {
    const body = generateSlug().slice(3);
    const digitCount = [...body].filter(isDigit).length;
    expect(digitCount).toBeGreaterThanOrEqual(2);
  });
});

describe("generateSlug — statistical invariants over 10,000 samples", () => {
  const SAMPLE_SIZE = 10_000;

  it(`all ${SAMPLE_SIZE} slugs satisfy every format invariant`, () => {
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      assertSlugInvariant(generateSlug());
    }
  });

  it("all body chars within the defined alphabet — no unexpected characters", () => {
    const illegalChars = new Set<string>();
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      for (const ch of generateSlug().slice(3)) {
        if (!SLUG_ALL.includes(ch)) illegalChars.add(ch);
      }
    }
    expect([...illegalChars]).toEqual([]);
  });

  it("no slug body contains 'I' or 'O' in 10,000 samples", () => {
    const violations: string[] = [];
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const body = generateSlug().slice(3);
      if (body.includes("I") || body.includes("O")) violations.push(body);
    }
    expect(violations).toEqual([]);
  });

  it("slug bodies are shuffled — not always sorted (randomness sanity check)", () => {
    const slugs = Array.from({ length: 100 }, () => generateSlug().slice(3));
    // If the shuffle were broken every slug body would be in sorted order
    const allSorted = slugs.every(
      (s) => s === [...s].sort().join(""),
    );
    // There's a ~1/8! chance of any single being sorted, so all 100 sorted is
    // astronomically unlikely for a correct shuffle
    expect(allSorted).toBe(false);
  });

  it("generates diverse slugs — no two consecutive slugs are identical (uniqueness pressure)", () => {
    let prev = generateSlug();
    for (let i = 0; i < 1_000; i++) {
      const next = generateSlug();
      expect(next).not.toBe(prev);
      prev = next;
    }
  });
});
