import "server-only";
import { sendNotification, setVapidDetails, type PushSubscription } from "web-push";
import { formatWeekdayShort, toDateKey, toTimeKey } from "@/lib/datetime";

/**
 * Notificações no celular/PC (Web Push, recurso nativo dos navegadores).
 * As chaves VAPID identificam este site para o serviço de push do navegador.
 * Sem elas configuradas, o site funciona normalmente, só não envia avisos.
 */
// Chave pública (pode ir para o navegador). Só a privada precisa ficar na hospedagem.
const DEFAULT_VAPID_PUBLIC_KEY = "BElevBA8-OdQxAVt4KhN-Augfhmtm4AcWzbXekmV4-FCmRSMuX5vEFvSCSwJdlPjeiCaJb0k5zGakhJFy-7WxrM";

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
}

let configured: boolean | null = null;

export function isPushConfigured() {
  if (configured !== null) return configured;
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (!publicKey || !privateKey) return (configured = false);
  try {
    setVapidDetails(process.env.VAPID_SUBJECT || "https://studiozaply-tech-bia-nail-studio.vercel.app", publicKey, privateKey);
    configured = true;
  } catch (e) {
    console.error("Chaves VAPID inválidas", e);
    configured = false;
  }
  return configured;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

/**
 * Envia para cada aparelho. Devolve os endereços que o navegador informou
 * que não existem mais (para serem apagados).
 */
export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<{ sent: number; gone: string[] }> {
  if (!targets.length || !isPushConfigured()) return { sent: 0, gone: [] };
  const body = JSON.stringify(payload);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      const subscription: PushSubscription = { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } };
      try {
        await sendNotification(subscription, body, { TTL: 60 * 60 * 24, urgency: "high", timeout: 8000 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(t.endpoint);
        else console.error("Falha ao enviar notificação", status ?? e);
      }
    }),
  );
  return { sent, gone };
}

/** "Carla Dias · Manicure · sáb 08/11 às 14:30" */
export function bookingNotification(b: { clientName: string; serviceName: string; startsAt: string }): PushPayload {
  const dateKey = toDateKey(b.startsAt);
  const [, month, day] = dateKey.split("-");
  return {
    title: "Novo agendamento 💅",
    body: `${b.clientName} · ${b.serviceName}\n${formatWeekdayShort(dateKey)} ${day}/${month} às ${toTimeKey(b.startsAt)}`,
    url: "/admin#pendentes",
    tag: `agendamento-${b.startsAt}`,
  };
}
