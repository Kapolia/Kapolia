import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ClientProviders from "@/components/ClientProviders";

const DESC = "Kapolia repense le recrutement : les candidats se présentent tels qu'ils sont, les recruteurs repèrent les profils qui leur correspondent vraiment."

export const metadata: Metadata = {
  metadataBase: new URL('https://kapolia.com'),
  title: "Kapolia",
  description: DESC,
  openGraph: {
    title: "Kapolia",
    description: DESC,
    siteName: "Kapolia",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kapolia",
    description: DESC,
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="preload" href="/fonts/Lora-600-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/SourceSans3-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* Initialise --kapolia-sidebar-w (panneau) et --kapolia-sidebar-aside-w (barre) avant le premier affichage */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var r=localStorage.getItem('kapolia-sidebar-repliee')==='true';document.documentElement.style.setProperty('--kapolia-sidebar-w',r?'64px':'228px');document.documentElement.style.setProperty('--kapolia-sidebar-aside-w',r?'70px':'228px');}catch(e){document.documentElement.style.setProperty('--kapolia-sidebar-w','228px');document.documentElement.style.setProperty('--kapolia-sidebar-aside-w','228px');}})();` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ClientProviders>
          <Navigation />
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
