import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

/**
 * Root layout.
 *
 * Manrope is self-hosted through next/font: no request to Google at runtime
 * (better privacy, no third-party in the CSP, no render-blocking round-trip)
 * and `display: swap` so text is visible during font load.
 */
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-manrope',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'AUTOMATIZE — Marketplace de soluções de IA',
    template: '%s · AUTOMATIZE',
  },
  description:
    'Encontre soluções de IA, compre produtos prontos ou contrate especialistas ' +
    'para construir o que sua empresa precisa.',
  applicationName: 'AUTOMATIZE',
  authors: [{ name: 'AUTOMATIZE' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'AUTOMATIZE',
    title: 'AUTOMATIZE — Marketplace de soluções de IA',
    description:
      'Agentes de IA, automações, workflows e templates prontos para usar. ' +
      'Ou contrate um especialista para construir sob medida.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AUTOMATIZE — Marketplace de soluções de IA',
    description:
      'Agentes de IA, automações, workflows e templates prontos para usar.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never lock zoom — pinch-to-zoom is an accessibility requirement.
  maximumScale: 5,
  themeColor: '#2563EB',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body className="min-h-dvh bg-white antialiased">
        {/* First tab stop: lets keyboard users jump the nav. */}
        <a href="#main" className="skip-link">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
