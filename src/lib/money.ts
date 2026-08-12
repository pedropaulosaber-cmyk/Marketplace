/**
 * Money helpers.
 *
 * All monetary values in this system are integer cents (BRL). Floating point
 * arithmetic is never used for money: 0.1 + 0.2 !== 0.3, and a marketplace
 * that rounds a commission wrong is a marketplace that loses money.
 *
 * This module is deliberately free of server-only imports so both Server and
 * Client Components can format prices consistently.
 */

/** Platform commission, in basis points. 1500 bps = 15%. */
export const DEFAULT_FEE_BPS = 1500;

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** `14900` -> `"R$ 149,00"`. Free products render as "Grátis". */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Grátis';
  return BRL.format(cents / 100);
}

/** Always formats a number, even zero. Use for totals and ledgers. */
export function formatMoney(cents: number): string {
  return BRL.format(cents / 100);
}

/** `7970000` -> `"R$ 79,7 mil"`. For dashboard KPI tiles. */
export function formatCompactMoney(cents: number): string {
  return BRL_COMPACT.format(cents / 100);
}

/** `"R$ 1.500 – 7.000"` style range label used on professional cards. */
export function formatRange(minCents: number, maxCents: number): string {
  return `${formatMoney(minCents)} – ${formatMoney(maxCents)}`;
}

/**
 * Splits a gross amount into the platform fee and the seller's share.
 *
 * Rounding is applied to the fee and the remainder goes to the seller, so
 * `fee + seller === gross` holds exactly for every input. The database
 * enforces the same invariant with a check constraint.
 */
export function splitFee(
  grossCents: number,
  feeBps: number = DEFAULT_FEE_BPS
): { feeCents: number; sellerCents: number } {
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new RangeError('grossCents must be a non-negative integer');
  }
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new RangeError('feeBps must be an integer between 0 and 10000');
  }

  const feeCents = Math.round((grossCents * feeBps) / 10_000);
  return { feeCents, sellerCents: grossCents - feeCents };
}

/** Parses user input like "149", "149,90" or "R$ 1.499,90" into cents. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input
    .replace(/\s|R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (cleaned === '') return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}
