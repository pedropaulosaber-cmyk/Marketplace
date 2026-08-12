import { describe, it, expect } from 'vitest';
import {
  checkoutSchema,
  createDemandSchema,
  createReviewSchema,
  registerSchema,
  uploadRequestSchema,
} from '@/lib/validation/schemas';

/**
 * Input validation.
 *
 * The important assertions here are about what the schemas *refuse*: a price
 * on checkout, a role at registration, a traversal in a filename.
 */

describe('registerSchema', () => {
  const valid = {
    name: 'Ana Vasques',
    email: 'ana@empresa.com.br',
    password: 'uma-senha-bem-longa',
    confirmPassword: 'uma-senha-bem-longa',
    intent: 'buy' as const,
    acceptTerms: true as const,
  };

  it('accepts a well-formed registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('normalises the email to lowercase', () => {
    const parsed = registerSchema.parse({ ...valid, email: 'ANA@Empresa.COM.BR' });
    expect(parsed.email).toBe('ana@empresa.com.br');
  });

  it('rejects mismatched password confirmation', () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: 'outra-coisa-completamente',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short password', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'curta',
      confirmPassword: 'curta',
    });
    expect(result.success).toBe(false);
  });

  it('requires the terms checkbox', () => {
    const result = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  it('has no field through which a client could ask for a role', () => {
    const parsed = registerSchema.parse({
      ...valid,
      // A hostile client trying to self-grant.
      role: 'ADMIN',
      roles: ['ADMIN'],
    });

    expect(parsed).not.toHaveProperty('role');
    expect(parsed).not.toHaveProperty('roles');
    // Only the closed intent enum survives.
    expect(parsed.intent).toBe('buy');
  });

  it('rejects an unknown intent instead of trusting it', () => {
    const result = registerSchema.safeParse({ ...valid, intent: 'admin' });
    expect(result.success).toBe(false);
  });
});

describe('checkoutSchema', () => {
  it('accepts only a product id', () => {
    const parsed = checkoutSchema.parse({
      productId: 'clh1234567890abcdefghijk',
      // A client trying to name its own price.
      priceCents: 1,
      totalCents: 0,
      amount: 0,
    });

    expect(parsed).toEqual({ productId: 'clh1234567890abcdefghijk' });
    expect(parsed).not.toHaveProperty('priceCents');
    expect(parsed).not.toHaveProperty('amount');
  });

  it('rejects a malformed product id', () => {
    expect(checkoutSchema.safeParse({ productId: '../../etc/passwd' }).success).toBe(
      false
    );
  });
});

describe('createReviewSchema', () => {
  const base = {
    productId: 'clh1234567890abcdefghijk',
    comment: 'Funcionou exatamente como descrito na página.',
  };

  it('accepts ratings 1 through 5', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(createReviewSchema.safeParse({ ...base, rating }).success).toBe(true);
    }
  });

  it('rejects ratings outside the scale', () => {
    for (const rating of [0, 6, -1, 4.5]) {
      expect(createReviewSchema.safeParse({ ...base, rating }).success).toBe(false);
    }
  });

  it('rejects a comment too short to be useful', () => {
    expect(
      createReviewSchema.safeParse({ ...base, rating: 5, comment: 'bom' }).success
    ).toBe(false);
  });
});

describe('createDemandSchema', () => {
  const valid = {
    title: 'Automação de atendimento no WhatsApp',
    problem:
      'Três corretores revezam o WhatsApp no celular pessoal e nada fica registrado.',
    goal: 'Reduzir o tempo de primeira resposta para menos de dois minutos.',
    details:
      'Precisamos de um agente que responda, qualifique e grave tudo no CRM automaticamente.',
    category: 'Atendimento',
    tools: ['WhatsApp'],
    budgetMinCents: 600_000,
    budgetMaxCents: 1_200_000,
    deadlineWeeks: 6,
  };

  it('accepts a complete demand', () => {
    expect(createDemandSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an inverted budget range', () => {
    const result = createDemandSchema.safeParse({
      ...valid,
      budgetMinCents: 1_200_000,
      budgetMaxCents: 600_000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative budget', () => {
    expect(
      createDemandSchema.safeParse({ ...valid, budgetMinCents: -1 }).success
    ).toBe(false);
  });
});

describe('uploadRequestSchema', () => {
  const base = {
    kind: 'product-file' as const,
    contentType: 'application/zip',
    sizeBytes: 1024,
  };

  it('accepts an ordinary filename', () => {
    expect(
      uploadRequestSchema.safeParse({ ...base, fileName: 'agente-v1.zip' }).success
    ).toBe(true);
  });

  it('rejects path traversal', () => {
    for (const fileName of [
      '../../etc/passwd',
      '..\\..\\windows\\system32',
      'sub/dir/file.zip',
      'a..b/../c',
    ]) {
      expect(uploadRequestSchema.safeParse({ ...base, fileName }).success).toBe(
        false
      );
    }
  });

  it('rejects control characters used to forge headers or truncate paths', () => {
    for (const fileName of [
      'file\u0000.zip',
      'file\u001f.zip',
      'file\nContent-Type: text/html',
      'file\r\n.zip',
    ]) {
      expect(uploadRequestSchema.safeParse({ ...base, fileName }).success).toBe(
        false
      );
    }
  });

  it('rejects a file above the size ceiling', () => {
    expect(
      uploadRequestSchema.safeParse({
        ...base,
        fileName: 'grande.zip',
        sizeBytes: 500 * 1024 * 1024,
      }).success
    ).toBe(false);
  });
});
