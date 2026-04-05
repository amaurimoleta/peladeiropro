import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { I18nProvider } from "@/lib/i18n/provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'PeladeiroPro - Gestão de Tesouraria para Peladas',
    template: '%s | PeladeiroPro',
  },
  description: 'Gerencie mensalidades, despesas e prestação de contas do seu grupo de futebol. Grátis para sempre.',
  keywords: ['pelada', 'futebol', 'tesouraria', 'mensalidade', 'gestão financeira', 'grupo de futebol', 'peladeiro', 'controle financeiro', 'prestação de contas'],
  authors: [{ name: 'PeladeiroPro' }],
  creator: 'PeladeiroPro',
  metadataBase: new URL('https://peladeiropro.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://peladeiropro.vercel.app',
    siteName: 'PeladeiroPro',
    title: 'PeladeiroPro - Agora o seu grupo também pode ser uma SAF',
    description: 'Chega de cobrar no WhatsApp e anotar no caderninho. Gerencie mensalidades, despesas e preste contas com transparência.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PeladeiroPro - Gestão de Tesouraria para Peladas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PeladeiroPro - Gestão de Tesouraria para Peladas',
    description: 'Gerencie mensalidades, despesas e prestação de contas do seu grupo de futebol.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1B1F4B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/logo.svg" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <I18nProvider>
            {children}
          </I18nProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then((reg) => console.log('SW registered:', reg.scope))
                    .catch((err) => console.log('SW registration failed:', err));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
