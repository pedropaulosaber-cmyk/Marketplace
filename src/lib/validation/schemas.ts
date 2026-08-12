import { z } from 'zod';
import {
  cuid,
  email,
  longText,
  password,
  personName,
  priceCents,
  rating,
  shortText,
  stringList,
} from './common';

/**
 * Request schemas for every mutation in the application.
 *
 * Note what these schemas deliberately do *not* accept: prices on checkout,
 * `status` on product create, `authorId` anywhere, `role` on registration.
 * Those values are decided by the server. Accepting them from a client is how
 * marketplaces get robbed.
 */

// --- Auth -------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: personName,
    email,
    password,
    confirmPassword: z.string(),
    // Which side of the marketplace the account starts on. Never ADMIN.
    intent: z.enum(['buy', 'sell', 'work']).default('buy'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'É preciso aceitar os termos.' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe sua senha.'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });

export const updateProfileSchema = z.object({
  name: personName,
  headline: shortText(0, 120, 'Título').optional().or(z.literal('')),
  bio: longText(0, 2000, 'Bio').optional().or(z.literal('')),
  company: shortText(0, 100, 'Empresa').optional().or(z.literal('')),
  website: z.string().trim().url('Informe uma URL válida.').max(200).optional().or(z.literal('')),
  location: shortText(0, 100, 'Localização').optional().or(z.literal('')),
});

// --- Products ---------------------------------------------------------------

export const productDraftSchema = z.object({
  name: shortText(4, 120, 'Nome'),
  tagline: shortText(10, 180, 'Descrição curta'),
  descriptionMd: longText(40, 20_000, 'Descrição'),
  categoryId: cuid,
  priceCents,
  videoUrl: z
    .string()
    .trim()
    .url('Informe uma URL de vídeo válida.')
    .max(300)
    .optional()
    .or(z.literal('')),
  tags: stringList(8, 40),
  benefits: stringList(10, 200),
  included: stringList(15, 200),
  requirements: stringList(10, 200),
  compat: stringList(10, 60),
  integrations: stringList(15, 60),
});

export type ProductDraftInput = z.infer<typeof productDraftSchema>;

export const productUpdateSchema = productDraftSchema.partial().extend({
  productId: cuid,
});

/** Admin moderation decision. */
export const moderateProductSchema = z
  .object({
    productId: cuid,
    decision: z.enum(['approve', 'reject']),
    reason: longText(0, 1000, 'Motivo').optional().or(z.literal('')),
  })
  .refine((d) => d.decision === 'approve' || (d.reason && d.reason.length > 4), {
    path: ['reason'],
    message: 'Explique o motivo da rejeição.',
  });

// --- Catalog browsing -------------------------------------------------------

export const productFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  price: z.enum(['all', 'free', 'u100', '100-199', '200']).default('all'),
  rating: z.enum(['all', '4.5', '4.7', '4.9']).default('all'),
  seller: z.enum(['all', 'verified']).default('all'),
  sort: z
    .enum(['rel', 'sold', 'new', 'rating', 'price-l', 'price-h'])
    .default('rel'),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type ProductFilters = z.infer<typeof productFiltersSchema>;

export const professionalFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  field: z.string().trim().max(60).optional(),
  skill: z.string().trim().max(40).optional(),
  avail: z.enum(['all', 'now', 'soon', 'full']).default('all'),
  tier: z.enum(['all', 'low', 'mid', 'high']).default('all'),
  rating: z.enum(['all', '4.7', '4.9']).default('all'),
  sort: z.enum(['rel', 'rating', 'projects', 'avail']).default('rel'),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type ProfessionalFilters = z.infer<typeof professionalFiltersSchema>;

// --- Checkout ---------------------------------------------------------------

/**
 * The buyer names *what* they want, never *what it costs*. Price, fee and
 * total are read from the catalog inside the order transaction.
 */
export const checkoutSchema = z.object({
  productId: cuid,
});

// --- Reviews ----------------------------------------------------------------

export const createReviewSchema = z.object({
  productId: cuid,
  rating,
  comment: longText(10, 2000, 'Comentário'),
});

export const replyReviewSchema = z.object({
  reviewId: cuid,
  body: longText(2, 1500, 'Resposta'),
});

// --- Favorites --------------------------------------------------------------

export const toggleFavoriteSchema = z
  .object({
    productId: cuid.optional(),
    professionalId: cuid.optional(),
  })
  .refine((d) => Boolean(d.productId) !== Boolean(d.professionalId), {
    message: 'Informe exatamente um alvo.',
  });

// --- Demands ----------------------------------------------------------------

export const createDemandSchema = z
  .object({
    title: shortText(10, 140, 'Título'),
    problem: longText(30, 4000, 'Problema'),
    goal: longText(15, 2000, 'Objetivo'),
    details: longText(30, 8000, 'Detalhes'),
    category: shortText(2, 60, 'Categoria'),
    tools: stringList(12, 40),
    budgetMinCents: priceCents,
    budgetMaxCents: priceCents,
    deadlineWeeks: z
      .number()
      .int()
      .min(1, 'Informe o prazo em semanas.')
      .max(104, 'Prazo máximo de 104 semanas.'),
  })
  .refine((d) => d.budgetMaxCents >= d.budgetMinCents, {
    path: ['budgetMaxCents'],
    message: 'O teto do orçamento deve ser maior que o piso.',
  });

// --- Proposals --------------------------------------------------------------

export const createProposalSchema = z.object({
  demandId: cuid,
  priceCents: priceCents.refine((v) => v > 0, 'Informe o valor da proposta.'),
  deliveryWeeks: z.number().int().min(1).max(104),
  approach: longText(40, 5000, 'Abordagem'),
  deliverables: stringList(12, 160),
  notes: longText(0, 2000, 'Observações').optional().or(z.literal('')),
});

export const respondProposalSchema = z.object({
  proposalId: cuid,
  decision: z.enum(['accept', 'reject']),
});

// --- Professional profile ---------------------------------------------------

export const professionalProfileSchema = z
  .object({
    title: shortText(4, 100, 'Título profissional'),
    field: shortText(2, 60, 'Área'),
    bio: longText(40, 3000, 'Bio'),
    location: shortText(2, 100, 'Localização'),
    skills: stringList(12, 40),
    rateMinCents: priceCents,
    rateMaxCents: priceCents,
    availability: z.enum(['NOW', 'SOON', 'FULL']),
  })
  .refine((d) => d.rateMaxCents >= d.rateMinCents, {
    path: ['rateMaxCents'],
    message: 'O teto da faixa deve ser maior que o piso.',
  });

export const portfolioItemSchema = z.object({
  title: shortText(4, 120, 'Título'),
  description: longText(10, 2000, 'Descrição'),
  meta: shortText(2, 80, 'Detalhe'),
});

// --- Messaging --------------------------------------------------------------

export const sendMessageSchema = z.object({
  conversationId: cuid,
  body: longText(1, 4000, 'Mensagem'),
});

export const startConversationSchema = z.object({
  recipientId: cuid,
  subject: shortText(0, 140, 'Assunto').optional().or(z.literal('')),
  body: longText(1, 4000, 'Mensagem'),
  demandId: cuid.optional(),
  productId: cuid.optional(),
});

// --- Uploads ----------------------------------------------------------------

/** 200 MB ceiling on a deliverable; 8 MB on an image. */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
] as const;

/**
 * Deliverables are archives and documents. Executables, scripts and anything
 * the browser might render inline are excluded — the latter would let a seller
 * serve HTML from our domain.
 */
export const ALLOWED_FILE_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'application/pdf',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/x-yaml',
  'text/yaml',
] as const;

export const uploadRequestSchema = z.object({
  kind: z.enum(['product-image', 'product-file', 'avatar']),
  fileName: z
    .string()
    .min(1)
    .max(200)
    // Reject path separators and traversal outright rather than sanitising:
    // a name that needs sanitising is a name we do not want.
    .refine((v) => !v.includes('/') && !v.includes('\\'), 'Nome inválido.')
    .refine((v) => !v.includes('..'), 'Nome inválido.')
    // Reject C0 control characters (U+0000-U+001F). A NUL or an embedded
    // newline in a filename can truncate paths and forge header lines
    // downstream. Checked by code point rather than by a regex holding literal
    // control characters, which is unreadable and easy to get wrong.
    .refine(
      (v) => ![...v].some((ch) => (ch.codePointAt(0) ?? 0) < 0x20),
      'Nome inválido.'
    ),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
  productId: cuid.optional(),
});

// --- Admin ------------------------------------------------------------------

export const updateUserStatusSchema = z.object({
  userId: cuid,
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: longText(0, 500, 'Motivo').optional().or(z.literal('')),
});

export const grantRoleSchema = z.object({
  userId: cuid,
  role: z.enum(['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN']),
  action: z.enum(['grant', 'revoke']),
});

export const categorySchema = z.object({
  name: shortText(2, 60, 'Nome'),
  parentId: cuid.optional().or(z.literal('')),
  position: z.number().int().min(0).max(999).default(0),
});

// --- Affiliate programme -----------------------------------------------------

/**
 * Commission is capped at 80%: the platform fee is 15%, so anything above that
 * could not be paid out of the seller's share. The same ceiling is enforced by
 * a check constraint in the database — this one exists to give the creator a
 * readable error instead of a failed write.
 */
export const affiliateProgramSchema = z.object({
  productId: cuid,
  enabled: z.coerce.boolean().default(false),
  commissionPercent: z.coerce
    .number({ invalid_type_error: 'Informe a comissão em porcentagem.' })
    .min(1, 'A comissão mínima é 1%.')
    .max(80, 'A comissão máxima é 80%.'),
  cookieDays: z.coerce
    .number({ invalid_type_error: 'Informe a janela de atribuição em dias.' })
    .int('Use um número inteiro de dias.')
    .min(1, 'A janela mínima é 1 dia.')
    .max(365, 'A janela máxima é 365 dias.'),
  autoApprove: z.coerce.boolean().default(true),
  terms: longText(0, 2000, 'Regras').optional().or(z.literal('')),
});

export const joinAffiliateSchema = z.object({ productId: cuid });

export const affiliateDecisionSchema = z.object({
  affiliateId: cuid,
  status: z.enum(['APPROVED', 'REJECTED', 'BLOCKED']),
});
