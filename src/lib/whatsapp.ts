import "server-only";
import { formatWeekdayShort, toDateKey, toTimeKey } from "@/lib/datetime";
import { formatPhone } from "@/lib/format";

/**
 * Aviso no WhatsApp da dona do estúdio pelo WAHA (WhatsApp HTTP API,
 * código aberto: github.com/devlikeapro/waha). O sistema tem UM WhatsApp
 * conectado ao WAHA (por QR Code); cada estúdio só informa o número que
 * recebe os avisos.
 *
 * Variáveis de ambiente (na Vercel e no .env.local):
 *   WAHA_URL      endereço do servidor WAHA, ex.: https://waha-xxxx.up.railway.app
 *   WAHA_API_KEY  a mesma chave configurada no servidor WAHA
 *   WAHA_SESSION  nome da sessão conectada (padrão: "default")
 */
function wahaConfig() {
  const url = process.env.WAHA_URL?.replace(/\/+$/, "");
  const apiKey = process.env.WAHA_API_KEY;
  if (!url || !apiKey) return null;
  return { url, apiKey, session: process.env.WAHA_SESSION || "default" };
}

export function isWhatsAppConfigured() {
  return wahaConfig() !== null;
}

export type WhatsAppTarget = { phone: string };
type SendResult = { ok: boolean; error?: string };

async function waha(path: string, init?: RequestInit) {
  const cfg = wahaConfig()!;
  return fetch(`${cfg.url}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { "X-Api-Key": cfg.apiKey, "Content-Type": "application/json", Accept: "application/json", ...init?.headers },
  });
}

/**
 * Envia texto para um número (formato "55" + DDD + número). Antes, pergunta ao
 * WAHA o identificador certo do contato: no Brasil, contas antigas não têm o
 * nono dígito e o envio direto falharia.
 */
export async function sendWhatsApp(target: WhatsAppTarget, text: string): Promise<SendResult> {
  const cfg = wahaConfig();
  if (!cfg) return { ok: false, error: "O WhatsApp do sistema ainda não foi configurado no servidor." };
  try {
    const check = await waha(`/api/contacts/check-exists?phone=${encodeURIComponent(target.phone)}&session=${encodeURIComponent(cfg.session)}`);
    if (check.status === 401) return fail("WAHA recusou a chave (WAHA_API_KEY).", check.status);
    if (!check.ok) return fail("O WhatsApp do sistema está desconectado. Escaneie o QR Code no painel do WAHA.", check.status, await check.text());
    const found = (await check.json()) as { numberExists?: boolean; chatId?: string };
    if (!found.numberExists || !found.chatId) return { ok: false, error: "Esse número não tem WhatsApp. Confira o DDD e o número." };

    const res = await waha("/api/sendText", {
      method: "POST",
      body: JSON.stringify({ session: cfg.session, chatId: found.chatId, text }),
    });
    if (!res.ok) return fail("Não foi possível enviar pelo WhatsApp do sistema.", res.status, await res.text());
    return { ok: true };
  } catch (e) {
    console.error("WAHA", e);
    return { ok: false, error: "O servidor do WhatsApp não respondeu. Tente de novo em instantes." };
  }
}

function fail(error: string, status: number, body?: string): SendResult {
  console.error("WAHA", status, body?.slice(0, 300));
  return { ok: false, error };
}

/**
 * 💅 *Novo agendamento*
 * Cliente: Carla Dias · (11) 91234-5678
 * Serviço: Fibra
 * Quando: sáb 22/11 às 14:00
 */
export function bookingWhatsAppText(b: {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  startsAt: string;
  panelUrl?: string;
}) {
  const dateKey = toDateKey(b.startsAt);
  const [, month, day] = dateKey.split("-");
  return [
    "💅 *Novo agendamento*",
    "",
    `*Cliente:* ${b.clientName}`,
    `*Telefone:* ${formatPhone(b.clientPhone)}`,
    `*Serviço:* ${b.serviceName}`,
    `*Quando:* ${formatWeekdayShort(dateKey)} ${day}/${month} às ${toTimeKey(b.startsAt)}`,
    ...(b.panelUrl ? ["", `Confirme no painel: ${b.panelUrl}`] : []),
  ].join("\n");
}
