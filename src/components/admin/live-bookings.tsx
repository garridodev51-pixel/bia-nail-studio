"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/datetime";

/**
 * Com o painel aberto, avisa na hora quando entra uma reserva online e
 * atualiza os números da tela. O banco só envia agendamentos da própria conta.
 */
export function LiveBookings({ professionalId }: { professionalId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`novas-reservas-${professionalId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments", filter: `professional_id=eq.${professionalId}` },
        (payload) => {
          const a = payload.new as { source?: string; client_name?: string; service_name?: string; starts_at?: string };
          if (a.source !== "online") return;
          toast.success("Novo agendamento", {
            description: [a.client_name, a.service_name, a.starts_at && formatDateTime(a.starts_at)].filter(Boolean).join(" · "),
            duration: 15000,
            action: { label: "Ver", onClick: () => router.push("/admin#pendentes") },
          });
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [professionalId, router]);

  return null;
}
