import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Send CV - Automação de Emails para Empresas",
  description: "Colete emails de empresas de tecnologia e envie seu currículo automaticamente. Ferramenta de automação para busca de emprego.",
  keywords: ["emprego", "currículo", "automação", "email", "empresas", "tecnologia", "TI"],
  authors: [{ name: "Send CV" }],
  openGraph: {
    title: "Send CV - Automação de Emails",
    description: "Colete emails de empresas e envie seu currículo automaticamente",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
      >
        {children}
      </body>
    </html>
  );
}
