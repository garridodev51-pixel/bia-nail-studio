import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Permite instalar o painel na tela inicial (necessário para receber
// notificações no iPhone) e abre direto no painel.
const manifest: MetadataRoute.Manifest = {
  name: "Painel de agendamentos",
  short_name: "Agenda",
  description: "Agenda e reservas do estúdio.",
  start_url: "/admin",
  scope: "/",
  display: "standalone",
  background_color: "#f6ecea",
  theme_color: "#A35C5B",
  lang: "pt-BR",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

// Só as páginas do painel apontam para este manifesto (o site das clientes não vira "app" do painel).
export function GET() {
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
