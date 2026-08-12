import { describe, expect, it } from 'vitest';
import { splitAffiliateShare } from '@/server/services/affiliate-service';
import {
  formatReferralCookie,
  isValidReferralCode,
  isWithinWindow,
  parseReferralCookie,
} from '@/lib/affiliate';
import { splitFee } from '@/lib/money';

describe('splitAffiliateShare', () => {
  it('takes the commission out of the seller share, never the platform fee', () => {
    const gross = 10_000;
    const { feeCents, sellerCents } = splitFee(gross, 1500);

    const split = splitAffiliateShare(sellerCents, 2000, gross);

    expect(feeCents).toBe(1500);
    expect(split.affiliateCents).toBe(2000);
    expect(split.sellerCents).toBe(6500);
    // The three shares still account for exactly what the buyer paid.
    expect(feeCents + split.affiliateCents + split.sellerCents).toBe(gross);
  });

  it('rounds the commission down so no cent is conjured out of the total', () => {
    const gross = 999;
    const { sellerCents } = splitFee(gross, 1500);

    const split = splitAffiliateShare(sellerCents, 3333, gross);

    expect(split.affiliateCents).toBe(Math.floor((999 * 3333) / 10_000));
    expect(split.affiliateCents + split.sellerCents).toBe(sellerCents);
  });

  it('never drives the seller negative, even at the maximum rate', () => {
    const gross = 5_000;
    const { sellerCents } = splitFee(gross, 1500);

    const split = splitAffiliateShare(sellerCents, 8000, gross);

    expect(split.sellerCents).toBeGreaterThanOrEqual(0);
    expect(split.affiliateCents).toBeLessThanOrEqual(sellerCents);
  });

  it('rejects a rate outside the permitted range', () => {
    expect(() => splitAffiliateShare(1000, 8001, 10_000)).toThrow(RangeError);
    expect(() => splitAffiliateShare(1000, -1, 10_000)).toThrow(RangeError);
  });

  it('pays nothing on a free product', () => {
    const split = splitAffiliateShare(0, 3000, 0);
    expect(split.affiliateCents).toBe(0);
    expect(split.sellerCents).toBe(0);
  });
});

describe('referral codes', () => {
  it('accepts the generated alphabet and rejects ambiguous characters', () => {
    expect(isValidReferralCode('ABCDEFGHJK')).toBe(true);
    // 0, O, 1, I and L are deliberately absent from the alphabet.
    expect(isValidReferralCode('ABCDEFGHI0')).toBe(false);
    expect(isValidReferralCode('ABCDEFGHJ')).toBe(false);
    expect(isValidReferralCode('abcdefghjk')).toBe(false);
  });
});

describe('referral cookie', () => {
  it('round-trips a code and its click time', () => {
    const clickedAt = new Date(Date.now() - 60_000);
    const parsed = parseReferralCookie(
      formatReferralCookie('ABCDEFGHJK', clickedAt)
    );

    expect(parsed?.code).toBe('ABCDEFGHJK');
    expect(Math.abs((parsed?.clickedAt.getTime() ?? 0) - clickedAt.getTime()))
      .toBeLessThan(1000);
  });

  it('rejects tampered values rather than trusting them', () => {
    expect(parseReferralCookie(undefined)).toBeNull();
    expect(parseReferralCookie('')).toBeNull();
    expect(parseReferralCookie('nope')).toBeNull();
    expect(parseReferralCookie('ABCDEFGHJK')).toBeNull();
    expect(parseReferralCookie('ABCDEFGHJK.abc')).toBeNull();
    expect(parseReferralCookie('short.123456')).toBeNull();
  });

  it('rejects a click stamped in the future', () => {
    const future = new Date(Date.now() + 10 * 60_000);
    expect(parseReferralCookie(formatReferralCookie('ABCDEFGHJK', future)))
      .toBeNull();
  });
});

describe('attribution window', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  it('honours the programme window, not the cookie lifetime', () => {
    expect(isWithinWindow(daysAgo(3), 7)).toBe(true);
    expect(isWithinWindow(daysAgo(10), 7)).toBe(false);
    expect(isWithinWindow(daysAgo(10), 30)).toBe(true);
  });
});
