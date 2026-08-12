import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  parsePriceToCents,
  splitFee,
  DEFAULT_FEE_BPS,
} from '@/lib/money';

/**
 * Money arithmetic.
 *
 * These are the numbers the platform bills on, so the invariant that matters
 * most is that a split never loses or invents a cent.
 */

describe('splitFee', () => {
  it('splits a round amount at the published 15% rate', () => {
    expect(splitFee(10_000)).toEqual({ feeCents: 1_500, sellerCents: 8_500 });
  });

  it('never loses a cent to rounding, at any amount', () => {
    // Exhaustive over a range that includes every rounding remainder.
    for (let gross = 0; gross <= 5_000; gross += 1) {
      const { feeCents, sellerCents } = splitFee(gross);
      expect(feeCents + sellerCents).toBe(gross);
      expect(feeCents).toBeGreaterThanOrEqual(0);
      expect(sellerCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps the invariant for awkward prices and rates', () => {
    const cases = [
      [14_999, DEFAULT_FEE_BPS],
      [1, DEFAULT_FEE_BPS],
      [333, 3_333],
      [99_999_999, 1],
      [7, 9_999],
    ] as const;

    for (const [gross, bps] of cases) {
      const { feeCents, sellerCents } = splitFee(gross, bps);
      expect(feeCents + sellerCents).toBe(gross);
    }
  });

  it('gives a free product a zero fee', () => {
    expect(splitFee(0)).toEqual({ feeCents: 0, sellerCents: 0 });
  });

  it('rejects a negative or fractional amount rather than silently coercing', () => {
    expect(() => splitFee(-1)).toThrow(RangeError);
    expect(() => splitFee(10.5)).toThrow(RangeError);
  });

  it('rejects a fee rate outside 0–100%', () => {
    expect(() => splitFee(1000, -1)).toThrow(RangeError);
    expect(() => splitFee(1000, 10_001)).toThrow(RangeError);
  });
});

describe('parsePriceToCents', () => {
  it('parses the formats a Brazilian user actually types', () => {
    expect(parsePriceToCents('149')).toBe(14_900);
    expect(parsePriceToCents('149,90')).toBe(14_990);
    expect(parsePriceToCents('1.499,90')).toBe(149_990);
    expect(parsePriceToCents('R$ 1.499,90')).toBe(149_990);
    expect(parsePriceToCents('0')).toBe(0);
  });

  it('returns null for input that is not a price', () => {
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('abc')).toBeNull();
    expect(parsePriceToCents('-50')).toBeNull();
  });
});

describe('formatPrice', () => {
  it('labels a zero price as free rather than R$ 0,00', () => {
    expect(formatPrice(0)).toBe('Grátis');
  });

  it('formats in BRL', () => {
    // Intl separates the symbol with U+00A0, not a plain space.
    expect(formatPrice(14_900).replace(/\u00a0/g, ' ')).toBe('R$ 149,00');
  });
});
