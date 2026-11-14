import { Check, ChevronRight, Clock } from "lucide-react";
import { serviceIcon } from "./service-icon";
import { formatDuration, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  description?: string | null;
  priceCents: number;
  durationMinutes?: number | null;
  selected?: boolean;
  actionLabel?: string;
};

/** Conteúdo visual do cartão de serviço (o elemento clicável é definido por quem usa). */
export function ServiceCardContent({ name, description, priceCents, durationMinutes, selected, actionLabel = "Escolher" }: Props) {
  const duration = formatDuration(durationMinutes);
  const Icon = serviceIcon(name);
  return (
    <div className="flex w-full items-center gap-4">
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors sm:size-14",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-accent/60 bg-secondary/60 text-primary group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground",
        )}
        aria-hidden
      >
        {selected ? <Check className="size-5 sm:size-6" /> : <Icon className="size-5 sm:size-6" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-base font-semibold leading-snug text-foreground">{name}</span>
        {description && <span className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{description}</span>}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-lg font-bold text-primary">{formatPrice(priceCents)}</span>
          {duration && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden /> {duration}
            </span>
          )}
        </span>
      </span>
      {selected ? (
        <span className="hidden shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground min-[380px]:inline-flex" aria-hidden>
          Escolhido
        </span>
      ) : (
        <>
          <span
            className="hidden shrink-0 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-primary-dark transition-colors group-hover:bg-primary group-hover:text-primary-foreground lg:inline-flex"
            aria-hidden
          >
            {actionLabel}
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 lg:hidden" aria-hidden />
        </>
      )}
    </div>
  );
}

export const serviceCardClass =
  "group flex w-full cursor-pointer rounded-2xl border-2 border-transparent bg-card p-4 text-left shadow-sm shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md active:translate-y-0 focus-visible:border-primary";
