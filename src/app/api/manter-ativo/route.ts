import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Chamada uma vez por dia pelo agendador da Vercel (vercel.json).
 * Faz uma leitura simples para o projeto gratuito do Supabase não ser
 * pausado por falta de uso.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("professionals").select("id").eq("is_primary", true).limit(1);
    if (error) return NextResponse.json({ ok: false }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
