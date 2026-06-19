import type { Metadata, Viewport } from 'next';
import 'flag-icons/css/flag-icons.min.css';
import './globals.css';

const TITLE = 'What does my team need to qualify? | World Cup 2026 Group Stage';
const DESCRIPTION =
  'Pick a team and see, in one plain sentence, exactly what it needs to reach the 2026 World Cup Round of 32. Not a simulator. It computes every permutation and returns the answer.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'roundof32worldcup2026',
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0e14',
};

// Set the saved theme before paint so there's no flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
