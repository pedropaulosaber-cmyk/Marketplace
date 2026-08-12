import { z } from 'zod';

/**
 * Shared validation primitives.
 *
 * These schemas run on the server for every mutation. Client-side use is
 * purely for fast feedback — the server never trusts that it happened.
 */

/** Collapses whitespace and trims. Applied before length checks. */
const tidy = (v: string) => v.replace(/\s+/g, ' ').trim();

export const cuid = z.string().cuid({ message: 'Identificador inválido.' });

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Informe um e-mail válido.')
  .max(254, 'E-mail muito longo.')
  .email('Informe um e-mail válido.');

/**
 * Password policy: length over composition rules. NIST 800-63B guidance —
 * long passphrases beat mandatory symbol classes, which mostly produce
 * "Password1!".
 */
export const password = z
  .string()
  .min(10, 'A senha precisa ter pelo menos 10 caracteres.')
  .max(200, 'A senha é longa demais.')
  // Reject the handful of passwords that dominate credential-stuffing lists.
  .refine(
    (v) =>
      ![
        'senha123456',
        'password123',
        '1234567890',
        'automatize1',
        'qwertyuiop',
      ].includes(v.toLowerCase()),
    'Escolha uma senha menos comum.'
  );

export const personName = z
  .string()
  .transform(tidy)
  .pipe(
    z
      .string()
      .min(2, 'Informe seu nome.')
      .max(80, 'Nome muito longo.')
      // Letters, spaces, hyphen, apostrophe. Blocks markup and control chars.
      .regex(
        /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u,
        'Use apenas letras no seu nome.'
      )
  );

/** Short single-line text (titles, headlines). */
export const shortText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform(tidy)
    .pipe(
      z
        .string()
        .min(min, `${label} precisa ter pelo menos ${min} caracteres.`)
        .max(max, `${label} pode ter no máximo ${max} caracteres.`)
    );

/** Multi-line body text. Newlines are preserved; only trailing space is cut. */
export const longText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(min, `${label} precisa ter pelo menos ${min} caracteres.`)
        .max(max, `${label} pode ter no máximo ${max} caracteres.`)
    );

/**
 * URL-safe slug. Generated server-side from the name — accepted from a client
 * only for lookups, never trusted as an ownership key.
 */
export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido.');

/** Money as integer cents. Rejects floats and negatives outright. */
export const priceCents = z
  .number()
  .int('Use um valor em centavos inteiro.')
  .min(0, 'O preço não pode ser negativo.')
  .max(100_000_000, 'Valor acima do limite permitido.');

export const rating = z
  .number()
  .int()
  .min(1, 'A nota vai de 1 a 5.')
  .max(5, 'A nota vai de 1 a 5.');

/** A bounded list of short free-text entries (tags, tools, deliverables). */
export const stringList = (max: number, itemMax = 60) =>
  z
    .array(z.string().transform(tidy).pipe(z.string().min(1).max(itemMax)))
    .max(max, `No máximo ${max} itens.`)
    .default([]);

/**
 * Cursor pagination. Offset pagination degrades badly past a few thousand
 * rows; a cursor keeps every page the same cost.
 */
export const pagination = z.object({
  cursor: cuid.optional(),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export type Pagination = z.infer<typeof pagination>;

/** Builds a URL-safe slug from arbitrary text. Server-side only. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
