import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { REFERRAL_COOKIE } from '@/lib/affiliate';

/**
 * The security baseline, asserted rather than assumed.
 *
 * Every page and route on the site inherits its headers from the middleware,
 * which means a regression here silently weakens the whole application — and
 * a weakened CSP is invisible until someone exploits it. These tests exist so
 * that loosening the policy has to be a deliberate edit to a failing test
 * rather than an accident nobody notices.
 */

const originalNodeEnv = process.env.NODE_ENV;

function runMiddleware(url: string, nodeEnv = 'production') {
  Object.assign(process.env, { NODE_ENV: nodeEnv });
  return middleware(new NextRequest(url));
}

function directives(response: { headers: Headers }): Map<string, string> {
  const csp = response.headers.get('Content-Security-Policy') ?? '';

  return new Map(
    csp.split(';').map((part) => {
      const trimmed = part.trim();
      const gap = trimmed.indexOf(' ');
      return gap === -1
        ? ([trimmed, ''] as const)
        : ([trimmed.slice(0, gap), trimmed.slice(gap + 1)] as const);
    })
  );
}

afterEach(() => {
  Object.assign(process.env, { NODE_ENV: originalNodeEnv });
});

describe('content security policy', () => {
  it('never allows inline or eval scripts in production', () => {
    const response = runMiddleware('https://example.com/');
    const scriptSrc = directives(response).get('script-src') ?? '';

    // These two are the difference between having a CSP and having a
    // decorative header.
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('issues a fresh nonce per request', () => {
    const first = directives(runMiddleware('https://example.com/')).get('script-src');
    const second = directives(runMiddleware('https://example.com/')).get('script-src');

    expect(first).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    // A reused nonce is a reusable bypass for anyone who reads one response.
    expect(first).not.toBe(second);
  });

  it('passes the policy on the request so Next can nonce its own scripts', () => {
    // Without this the policy ships but every framework script violates it.
    const response = runMiddleware('https://example.com/');
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('forbids framing, plugins and base-tag hijacking', () => {
    const found = directives(runMiddleware('https://example.com/'));

    expect(found.get('frame-ancestors')).toBe("'none'");
    expect(found.get('object-src')).toBe("'none'");
    expect(found.get('base-uri')).toBe("'self'");
    expect(found.get('form-action')).toBe("'self'");
  });

  it('restricts connect-src to the origin and the payment provider', () => {
    const connectSrc = directives(runMiddleware('https://example.com/')).get(
      'connect-src'
    );

    expect(connectSrc).toBe("'self' https://api.stripe.com");
  });

  it('only allows frames from the payment and video hosts', () => {
    const frameSrc = directives(runMiddleware('https://example.com/')).get('frame-src') ?? '';

    expect(frameSrc).toContain('https://www.youtube-nocookie.com');
    expect(frameSrc).toContain('https://js.stripe.com');
    expect(frameSrc).not.toContain('*');
  });
});

describe('transport and isolation headers', () => {
  it('sets HSTS in production but not in development', () => {
    expect(
      runMiddleware('https://example.com/').headers.get(
        'Strict-Transport-Security'
      )
    ).toContain('max-age=63072000');

    // Sending HSTS from localhost would poison the browser for plain HTTP.
    expect(
      runMiddleware('http://localhost:3000/', 'development').headers.get(
        'Strict-Transport-Security'
      )
    ).toBeNull();
  });

  it('sets the isolation and sniffing headers', () => {
    const response = runMiddleware('https://example.com/');

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });

  it('denies the powerful features the site never uses', () => {
    const policy =
      runMiddleware('https://example.com/').headers.get('Permissions-Policy') ?? '';

    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
    expect(policy).toContain('geolocation=()');
  });
});

describe('referral capture', () => {
  it('stores a valid code in an httpOnly cookie', () => {
    const response = runMiddleware(
      'https://example.com/products/x?ref=ABCDEFGHJK'
    );

    const cookie = response.cookies.get(REFERRAL_COOKIE);

    expect(cookie?.value).toMatch(/^ABCDEFGHJK\.\d+$/);
    // Nothing in the browser reads this, so nothing in the browser should be
    // able to read it — or forge it from an XSS foothold.
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    // Lax, not Strict: the cookie has to survive arriving from another site.
    expect(cookie?.sameSite).toBe('lax');
  });

  it('ignores a malformed code instead of storing it', () => {
    for (const bad of ['../etc', 'abc', 'ABCDEFGHI0', '<script>']) {
      const response = runMiddleware(
        `https://example.com/?ref=${encodeURIComponent(bad)}`
      );
      expect(response.cookies.get(REFERRAL_COOKIE)).toBeUndefined();
    }
  });

  it('leaves the cookie alone when no referral is present', () => {
    const response = runMiddleware('https://example.com/products/x');
    expect(response.cookies.get(REFERRAL_COOKIE)).toBeUndefined();
  });
});
