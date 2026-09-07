import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ClientProviders from "@/components/ClientProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClientProviders>
          <Navigation />
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
