"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BellOff, BellRing, Send, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { deletePushSubscriptionAction, savePushSubscriptionAction, sendTestNotificationAction } from "@/app/admin/actions";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function NotificationsCard({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // Mantém a inscrição deste aparelho ligada à conta atual.
        const json = sub.toJSON();
        if (json.keys?.p256dh && json.keys.auth) {
          void savePushSubscriptionAction({ endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, userAgent: navigator.userAgent.slice(0, 300) });
        }
      }
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          toast.error("Permita as notificações para receber os avisos.");
          return;
        }
        const reg = await getRegistration();
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(vapidPublicKey) });
        }
        const json = sub.toJSON();
        const res = await savePushSubscriptionAction({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent.slice(0, 300),
        });
        if (!res.ok) {
          await sub.unsubscribe().catch(() => {});
          toast.error(res.error);
          return;
        }
        setState("on");
        toast.success("Notificações ativadas neste aparelho.");
      } catch (e) {
        console.error(e);
        toast.error("Não foi possível ativar as notificações neste navegador.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
      toast.success("Notificações desativadas neste aparelho.");
    });
  }

  function test() {
    startTransition(async () => {
      const res = await sendTestNotificationAction();
      if (res.ok) toast.success(res.data.sent > 1 ? `Teste enviado para ${res.data.sent} aparelhos.` : "Teste enviado.");
      else toast.error(res.error);
    });
  }

  if (!vapidPublicKey) {
    return <Alert variant="warning">As notificações ainda não foram configuradas no servidor do site.</Alert>;
  }

  switch (state) {
    case "loading":
      return <p className="text-sm text-muted-foreground">Verificando este aparelho…</p>;
    case "ios-install":
      return (
        <Alert variant="info">
          <Share />
          <p>
            No iPhone, as notificações funcionam com o painel instalado: toque em <strong>Compartilhar</strong> no Safari, depois em{" "}
            <strong>Adicionar à Tela de Início</strong>. Abra o painel pelo ícone criado e volte aqui para ativar.
          </p>
        </Alert>
      );
    case "unsupported":
      return <Alert variant="warning">Este navegador não aceita notificações. Use o Chrome, Edge, Firefox ou Safari atualizado.</Alert>;
    case "denied":
      return (
        <Alert variant="warning">
          <BellOff />
          <p>As notificações estão bloqueadas para este site. Libere nas configurações do navegador (ícone de cadeado ao lado do endereço) e recarregue a página.</p>
        </Alert>
      );
    case "off":
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Desativadas neste aparelho.</p>
          <Button onClick={enable} loading={pending}>
            <BellRing className="size-5" /> Ativar neste aparelho
          </Button>
        </div>
      );
    case "on":
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <BellRing className="size-4" /> Ativadas neste aparelho
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={test} disabled={pending}>
              <Send className="size-4" /> Enviar teste
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={pending}>
              <BellOff className="size-4" /> Desativar
            </Button>
          </div>
        </div>
      );
  }
}
