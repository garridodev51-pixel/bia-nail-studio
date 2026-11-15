"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { deleteWhatsAppAction, saveWhatsAppAction, sendTestWhatsAppAction } from "@/app/admin/actions";
import { maskPhoneInput } from "@/lib/format";

type Saved = { phone: string; enabled: boolean } | null;

/** Número salvo vem como "55" + DDD + número; o campo mostra só DDD + número. */
function localPhone(phone: string) {
  return maskPhoneInput(phone.startsWith("55") ? phone.slice(2) : phone);
}

export function WhatsAppCard({ saved, serverReady }: { saved: Saved; serverReady: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState(saved ? localPhone(saved.phone) : "");
  const [enabled, setEnabled] = useState(saved?.enabled ?? true);
  const [error, setError] = useState<string>();
  const [phoneError, setPhoneError] = useState<string>();
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [removing, startRemove] = useTransition();

  const save = () =>
    startSave(async () => {
      const res = await saveWhatsAppAction({ phone, enabled });
      if (!res.ok) {
        setError(res.error);
        setPhoneError(res.fieldErrors?.phone);
        return;
      }
      setError(undefined);
      setPhoneError(undefined);
      toast.success(enabled ? "WhatsApp salvo. Envie um teste para conferir." : "WhatsApp salvo, avisos pausados.");
      router.refresh();
    });

  const test = () =>
    startTest(async () => {
      const res = await sendTestWhatsAppAction();
      if (res.ok) toast.success("Mensagem de teste enviada. Confira o seu WhatsApp.");
      else toast.error(res.error);
    });

  const remove = () =>
    startRemove(async () => {
      const res = await deleteWhatsAppAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPhone("");
      setEnabled(true);
      toast.success("WhatsApp removido.");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      {!serverReady && (
        <Alert variant="warning">
          O envio pelo WhatsApp ainda não foi ligado no servidor. Você já pode salvar o seu número; os avisos começam assim que ele for ligado.
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor="wa-phone">Seu WhatsApp (com DDD)</Label>
        <Input
          id="wa-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          value={phone}
          onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
          aria-invalid={Boolean(phoneError)}
        />
        {phoneError && <p className="text-sm font-medium text-destructive">{phoneError}</p>}
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border px-4 py-3">
        <span className="flex items-center gap-3">
          <MessageCircle className="size-5 text-primary" aria-hidden />
          <span>
            <span className="block font-semibold">Avisar no WhatsApp</span>
            <span className="text-sm text-muted-foreground">Uma mensagem a cada novo agendamento feito pelo seu link.</span>
          </span>
        </span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Avisar no WhatsApp" />
      </label>

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={save} loading={saving} className="w-full sm:w-fit">
          Salvar
        </Button>
        {saved && (
          <>
            <Button variant="outline" onClick={test} loading={testing} disabled={!serverReady} className="w-full sm:w-fit">
              <Send /> Enviar teste
            </Button>
            <Button variant="ghost" onClick={remove} loading={removing} className="w-full text-destructive sm:ml-auto sm:w-fit">
              <Trash2 /> Remover
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        A mensagem traz nome, telefone, serviço e horário da cliente. Se o WhatsApp falhar, a notificação no celular continua chegando
        normalmente.
      </p>
    </div>
  );
}
