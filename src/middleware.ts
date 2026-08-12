import { NextResponse, type NextRequest } from 'next/server';
import {
  REFERRAL_COOKIE,
  REFERRAL_MAX_AGE_SECONDS,
  REFERRAL_PARAM,
  formatReferralCookie,
  isValidReferralCode,
} from '@/lib/affiliate';

/**
 * Edge middleware: security headers on every response, plus referral capture.
 *
 * Headers are set here rather than in `next.config.ts` because the CSP needs a
 * per-request nonce. A static config can only ship a static policy, which in
 * practice means `unsafe-inline` — and a CSP with `unsafe-inline` on script-src
 * is not a CSP. Doing it per request is what lets the policy stay strict as new
 * pages are added: a new route inherits the whole baseline without its author
 * having to remember anything.
 */

/** Bytes → base64 without Buffer, which the edge runtime does not provide. */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    // `strict-dynamic` lets the nonced Next.js bootstrap load the chunks it
    // needs without us enumerating them, while still refusing anything an
    // injected tag tries to pull in. The host allowlist alongside it is
    // ignored by browsers that understand strict-dynamic and acts as the
    // fallback for those that do not.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      'https:',
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],

    // Tailwind and React both inject style tags at runtime; there is no nonce
    // path for those today, and style injection is a far weaker vector than
    // script injection.
    'style-src': ["'self'", "'unsafe-inline'"],

    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],

    // Only the payment provider and our own origin. Anything else trying to
    // exfiltrate over fetch/XHR/WebSocket is blocked by omission.
    'connect-src': [
      "'self'",
      'https://api.stripe.com',
      ...(isDev ? ['ws:', 'http://localhost:*'] : []),
    ],

    // Product demo videos and the Stripe payment element are the only frames
    // the application ever creates.
    'frame-src': [
      "'self'",
      'https://www.youtube-nocookie.com',
      'https://player.vimeo.com',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
    ],

    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };

  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');

  // Upgrading in development would break plain-HTTP localhost.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

function applySecurityHeaders(
  response: NextResponse,
  csp: string,
  isDev: boolean
): NextResponse {
  response.headers.set('Content-Security-Policy', csp);

  // Belt and braces with frame-ancestors, for anything that predates CSP 2.
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Powerful features nothing on this site uses. Denying them outright means a
  // compromised script cannot silently reach for the camera or the clipboard.
  response.headers.set(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=(self "https://js.stripe.com")',
      'usb=()',
      'interest-cohort=()',
    ].join(', ')
  );

  // Isolates this origin from cross-origin popups and embeds, which is what
  // makes Spectre-style cross-origin reads impractical.
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (!isDev) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';
  const nonce = generateNonce();

  const csp = buildCsp(nonce, isDev);

  // Next reads the policy off the *request* headers to discover the nonce and
  // stamp it onto the framework's own bootstrap scripts. Without this the
  // policy ships but every Next script is blocked by it — the page renders
  // blank with a console full of CSP violations.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers } });

  // --- Referral capture ---------------------------------------------------
  const ref = request.nextUrl.searchParams.get(REFERRAL_PARAM);

  if (ref && isValidReferralCode(ref)) {
    // Last touch wins: overwriting on each valid click is the attribution
    // model sellers expect, and it keeps the cookie to a single value.
    response.cookies.set(REFERRAL_COOKIE, formatReferralCookie(ref, new Date()), {
      // Readable by nothing in the browser — it is only ever consumed server
      // side, so JavaScript has no reason to see it.
      httpOnly: true,
      secure: !isDev,
      // Lax, not Strict: the whole point is to survive arriving from an
      // affiliate's site, email or social post.
      sameSite: 'lax',
      path: '/',
      maxAge: REFERRAL_MAX_AGE_SECONDS,
    });
  }

  return applySecurityHeaders(response, csp, isDev);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation output. Those are
     * served straight from the CDN, carry no user data, and running middleware
     * on them would add latency to every asset on every page.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
