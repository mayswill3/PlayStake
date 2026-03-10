import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
    <html lang="en" className={inter.variable}>
      <body className="font-sans min-h-screen">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
