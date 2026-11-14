import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Títulos: serifada clássica e delicada · Textos: sem serifa limpa, legível em telas pequenas
const manrope = Manrope({ variable: "--font-sans-base", subsets: ["latin"], display: "swap" });
const cormorant = Cormorant_Garamond({
  variable: "--font-display-base",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "BEATRIZ ABREU · Agendamento", template: "%s · BEATRIZ ABREU" },
  description: "Agende seu horário com Beatriz Abreu, do Bia Nail Studio, em poucos toques.",
};

export const viewport: Viewport = {
  themeColor: "#A35C5B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da pintura para não piscar */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("tema")==="escuro")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={`${manrope.variable} ${cormorant.variable}`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
