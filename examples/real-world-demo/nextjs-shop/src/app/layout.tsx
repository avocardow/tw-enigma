import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import ScrambleProvider from '../components/ScrambleProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TW-Enigma Demo Shop',
  description: 'Real-world demonstration of TW-Enigma CSS optimization and Scramble privacy protection',
  keywords: 'TW-Enigma, CSS optimization, Tailwind CSS, privacy protection, web performance',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        {/* Scramble will protect any sensitive data in the page */}
        <ScrambleProvider>
          <div id="__scramble-root" data-scramble-enabled="true">
            {children}
          </div>
        </ScrambleProvider>
        
        {/* Demo analytics script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Demo analytics - Scramble will protect this data
              window.__demo_analytics = {
                pageViews: 0,
                userAgent: navigator.userAgent,
                timestamp: Date.now(),
                session: 'demo-session-' + Math.random().toString(36).substr(2, 9)
              };
            `,
          }}
        />
      </body>
    </html>
  );
}