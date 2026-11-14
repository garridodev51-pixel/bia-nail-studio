import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BrandName } from "@/components/brand/brand-name";
import { SignUpForm } from "./sign-up-form";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar no painel",
  robots: { index: false },
  manifest: "/painel.webmanifest",
  appleWebApp: { capable: true, title: "Agenda", statusBarStyle: "default" },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; cadastro?: string }> }) {
  const { erro, cadastro } = await searchParams;
  const signingUp = cadastro !== undefined;
  return (
    <div className="min-h-dvh bg-hero">
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10 md:max-w-md">
      <div className="text-center">
        <BrandName className="text-2xl" />
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary-dark/70">Painel administrativo</p>
      </div>
      <Card>
        <CardContent className="p-6 md:p-8">
          {signingUp ? (
            <SignUpForm />
          ) : (
            <LoginForm initialError={erro === "sem-acesso" ? "Esta conta não tem acesso ao painel." : undefined} />
          )}
          <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
            {signingUp ? "Já tem conta? " : "Ainda não tem conta? "}
            <Link
              href={signingUp ? "/admin/login" : "/admin/login?cadastro"}
              className="font-semibold text-primary hover:underline"
            >
              {signingUp ? "Entrar" : "Criar nova conta"}
            </Link>
          </p>
        </CardContent>
      </Card>
      <Link href="/" className="text-center text-sm text-primary-dark/80 hover:text-primary">
        Voltar para o site
      </Link>
    </main>
    </div>
  );
}
