import type { Metadata } from 'next';
import 'flag-icons/css/flag-icons.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'What does my team need to qualify? · World Cup 2026 Group Stage',
  description:
    'Pick a team and see, in one plain sentence, exactly what it needs to reach the 2026 World Cup Round of 32. Not a simulator. It computes every permutation for you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
