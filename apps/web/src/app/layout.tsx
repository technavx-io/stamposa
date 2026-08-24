import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, Inter } from 'next/font/google';
import { Providers } from '@/lib/providers';
import { Monitoring } from '@/components/monitoring';
import { ThemeProvider, themeScript } from '@/lib/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/** Display face — used only for headlines, so it stays characterful. */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

/** Utility face for codes, eyebrows and data labels. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-brand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Stamposa — digital loyalty cards for cafés, salons and shops',
    template: '%s · Stamposa',
  },
  description:
    'Replace paper punch cards with a loyalty program that runs itself. Customers join by scanning one QR — no app. Staff stamp from any phone. You keep the customer list.',
  metadataBase: new URL('https://stamposa.com'),
  openGraph: {
    title: 'Stamposa — digital loyalty cards for local businesses',
    description:
      'Replace paper punch cards with a loyalty program that runs itself. No app for customers, no hardware for you.',
    url: 'https://stamposa.com',
    siteName: 'Stamposa',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} ${plexMono.variable}`}>
      <head>
        {/* Set the theme before first paint so dark-mode users never see
            a white flash on load. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-canvas text-body">
        <ThemeProvider>
          <Monitoring />
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
