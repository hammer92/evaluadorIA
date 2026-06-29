import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';

import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  weight: ['400', '600', '700'],
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: { default: 'KnowledgeSync', template: '%s · KnowledgeSync' },
  description: 'Technical Validation System',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFBFB' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1a28' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${hanken.variable} ${jetbrains.variable}`}
    >
      <body className="font-inter antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <ToastProvider />
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
