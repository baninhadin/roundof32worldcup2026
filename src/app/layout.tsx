import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import 'flag-icons/css/flag-icons.min.css';
import './globals.css';

const SITE_URL = 'https://roundof32worldcup2026.vercel.app';
const TITLE = 'What does my team need to qualify? | World Cup 2026 Group Stage';
const DESCRIPTION =
  'A plain-English qualification calculator for the 2026 World Cup group stage. Pick a team and see exactly what it needs to reach the Round of 32. Not a simulator, it computes every permutation and gives the answer.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'roundof32worldcup2026',
  keywords: [
    'World Cup 2026',
    'group stage',
    'qualification calculator',
    'Round of 32',
    'tiebreakers',
    'who qualifies',
    'best third-placed teams',
  ],
  authors: [{ name: 'roundof32worldcup2026' }],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'roundof32worldcup2026',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  category: 'sports',
};

export const viewport: Viewport = {
  themeColor: '#0b0e14',
};

// Set the saved theme before paint so there's no flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`;

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'What does my team need to qualify?',
  url: SITE_URL,
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description: DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
