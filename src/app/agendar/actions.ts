"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { bookingNotification, isPushConfigured, sendPush, type PushTarget } from "@/lib/push";
import { bookingWhatsAppText, sendWhatsApp, type WhatsAppTarget } from "@/lib/whatsapp";
import { addDays, isDateKey, todayKey, toDateKey } from "@/lib/datetime";
import { dbErrorCode, dbErrorMessage, GENERIC_ERROR, type ActionResult } from "@/lib/errors";
import { fieldErrors, isoInstantSchema, publicBookingSchema, uuidSchema, type PublicBookingInput } from "@/lib/validation";

export type Slot = { startsAt: string; label: string };

const STUDIO_NOT_FOUND = { ok: false as const, error: "Estúdio não encontrado." };

export async function fetchAvailableDates(professionalId: string, from: string, to: string): Promise<ActionResult<string[]>> {
  if (!uuidSchema.safeParse(professionalId).success) return STUDIO_NOT_FOUND;
  if (!isDateKey(from) || !isDateKey(to) || to < from) return { ok: false, error: "Período inválido." };
  const start = from < todayKey() ? todayKey() : from;
  const end = to > addDays(start, 62) ? addDays(start, 62) : to;
  if (end < start) return { ok: true, data: [] };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_available_dates", { p_professional_id: professionalId, p_from: start, p_to: end });
    if (error) return { ok: false, error: dbErrorMessage(error, "Não foi possível carregar o calendário.") };
    return { ok: true, data: (data ?? []).map(String) };
  } catch {
    return { ok: false, error: "Não foi possível carregar o calendário." };
  }
}

export async function fetchAvailableSlots(professionalId: string, date: string): Promise<ActionResult<Slot[]>> {
  if (!uuidSchema.safeParse(professionalId).success) return STUDIO_NOT_FOUND;
  if (!isDateKey(date)) return { ok: false, error: "Data inválida." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_available_slots", { p_professional_id: professionalId, p_date: date });
    if (error) return { ok: false, error: dbErrorMessage(error, "Não foi possível carregar os horários.") };
    return { ok: true, data: (data ?? []).map((s) => ({ startsAt: new Date(s.starts_at).toISOString(), label: s.label })) };
  } catch {
    return { ok: false, error: "Não foi possível carregar os horários." };
  }
}

/** Revalida no servidor se o horário continua livre (usado ao abrir a confirmação). */
export async function checkSlotAvailable(professionalId: string, startsAt: string): Promise<ActionResult<boolean>> {
  const parsed = isoInstantSchema.safeParse(startsAt);
  if (!parsed.success) return { ok: false, error: "Horário inválido." };
  const result = await fetchAvailableSlots(professionalId, toDateKey(parsed.data));
  if (!result.ok) return result;
  const target = new Date(parsed.data).getTime();
  return { ok: true, data: result.data.some((s) => new Date(s.startsAt).getTime() === target) };
}

export type BookingConfirmation = {
  appointmentId: string;
  serviceName: string;
  priceCents: number;
  startsAt: string;
};

/**
 * Cria a reserva. A confirmação só é devolvida depois que o banco gravou o
 * agendamento; a exclusividade do horário é garantida pela função
 * create_public_booking (lock + índice único), não pela interface.
 */
export async function createBooking(input: PublicBookingInput): Promise<ActionResult<BookingConfirmation>> {
  const parsed = publicBookingSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors)[0] ?? "Confira seus dados.", fieldErrors: errors };
  }
  const { professionalId, serviceId, startsAt, fullName, phone, notes } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_professional_id: professionalId,
      p_service_id: serviceId,
      p_starts_at: startsAt,
      p_full_name: fullName,
      p_phone: phone,
      p_notes: notes,
    });

    if (error) {
      const code = dbErrorCode(error) ?? undefined;
      if (!code) console.error("create_public_booking", error);
      return { ok: false, error: dbErrorMessage(error), code };
    }

    const row = data?.[0];
    if (!row?.appointment_id) return { ok: false, error: GENERIC_ERROR };

    await notifyOwner(supabase, row.appointment_id);

    return {
      ok: true,
      data: {
        appointmentId: row.appointment_id,
        serviceName: row.service_name,
        priceCents: row.service_price_cents,
        startsAt: new Date(row.starts_at).toISOString(),
      },
    };
  } catch (e) {
    console.error("createBooking", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}


type BookingAlerts = {
  client_name: string;
  client_phone: string;
  service_name: string;
  starts_at: string;
  push: PushTarget[];
  whatsapp: WhatsAppTarget | null;
};

/**
 * Avisa a dona do estúdio: notificação no celular/PC (push) e mensagem no
 * WhatsApp. Os destinos são reservados (uma única vez) antes de responder à
 * cliente; o envio acontece depois da resposta, para não atrasar a
 * confirmação. Qualquer falha aqui não afeta a reserva.
 */
async function notifyOwner(supabase: Awaited<ReturnType<typeof createClient>>, appointmentId: string) {
  try {
    const { data, error } = await supabase.rpc("claim_new_booking_alerts", { p_appointment_id: appointmentId });
    if (error) {
      // Banco ainda sem a função nova (migration do WhatsApp não aplicada): mantém só o push.
      if (error.code === "PGRST202" || error.code === "42883") return notifyOwnerPushOnly(supabase, appointmentId);
      console.error("claim_new_booking_alerts", error);
      return;
    }
    const alerts = data as BookingAlerts | null;
    if (!alerts) return;

    const panelUrl = await siteUrl("/admin#pendentes");
    after(async () => {
      await Promise.all([
        (async () => {
          if (!alerts.push.length || !isPushConfigured()) return;
          const payload = bookingNotification({ clientName: alerts.client_name, serviceName: alerts.service_name, startsAt: alerts.starts_at });
          const { gone } = await sendPush(alerts.push, payload);
          if (gone.length) await supabase.rpc("prune_push_subscriptions", { p_appointment_id: appointmentId, p_endpoints: gone });
        })(),
        (async () => {
          if (!alerts.whatsapp) return;
          await sendWhatsApp(
            alerts.whatsapp,
            bookingWhatsAppText({
              clientName: alerts.client_name,
              clientPhone: alerts.client_phone,
              serviceName: alerts.service_name,
              startsAt: alerts.starts_at,
              panelUrl,
            }),
          );
        })(),
      ]);
    });
  } catch (e) {
    console.error("notifyOwner", e);
  }
}

/** Caminho antigo (só push), usado enquanto a migration do WhatsApp não foi aplicada. */
async function notifyOwnerPushOnly(supabase: Awaited<ReturnType<typeof createClient>>, appointmentId: string) {
  if (!isPushConfigured()) return;
  const { data: targets, error } = await supabase.rpc("claim_booking_notification", { p_appointment_id: appointmentId });
  if (error) {
    console.error("claim_booking_notification", error);
    return;
  }
  if (!targets?.length) return;
  const first = targets[0];
  const payload = bookingNotification({ clientName: first.client_name, serviceName: first.service_name, startsAt: first.starts_at });
  after(async () => {
    const { gone } = await sendPush(targets, payload);
    if (gone.length) await supabase.rpc("prune_push_subscriptions", { p_appointment_id: appointmentId, p_endpoints: gone });
  });
}

/** Endereço absoluto do site a partir do pedido atual (funciona em qualquer domínio). */
async function siteUrl(path: string) {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return undefined;
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}${path}`;
  } catch {
    return undefined;
  }
}
