import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, DM_Mono } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-chakra-petch',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-dm-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'PlayStake - Peer-to-Peer Wagering',
    template: '%s | PlayStake',
  },
  description: 'Real-money peer-to-peer wagering platform for competitive games. Bet against friends in your favorite games.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${chakraPetch.variable} ${dmMono.variable}`}>
      <body className="font-mono min-h-screen">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
