"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente Supabase do navegador (usa a mesma sessão do painel). */
export function createClient() {
  if (!client) {
    const { url, key } = getSupabaseEnv();
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
