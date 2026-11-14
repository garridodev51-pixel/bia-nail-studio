import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarClock, CalendarHeart, Clock, Flower2, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandName } from "@/components/brand/brand-name";
import { BookingFlow } from "@/components/booking/booking-flow";
import { ServiceCardContent, serviceCardClass } from "@/components/booking/service-card";
import { SetupNotice } from "@/components/booking/setup-notice";
import {
  getActiveServices,
  getBusinessHours,
  getStudio,
  studioBasePath,
  summarizeHours,
  type PublicService,
  type Studio,
} from "@/lib/data/public";

/** Página inicial de um estúdio. Sem slug, mostra o estúdio principal. */
export async function StudioHomePage({ slug }: { slug?: string }) {
  let studio: Studio | null = null;
  let services: PublicService[] = [];
  let hours: string | null = null;
  let loadError: string | null = null;

  try {
    studio = await getStudio(slug);
    if (studio) {
      [services, hours] = await Promise.all([
        getActiveServices(studio.id),
        getBusinessHours(studio.id).then(summarizeHours),
      ]);
    }
  } catch {
    loadError = "Atualize a página em alguns instantes.";
  }
  if (!studio && !loadError) {
    if (slug) notFound();
    loadError = "Atualize a página em alguns instantes.";
  }

  const base = studio ? studioBasePath(studio) : "";
  const displayName = studio?.display_name ?? "BEATRIZ ABREU";
  const brandName = studio?.brand_name ?? "";
  const welcome = studio?.welcome_message ?? "";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-28 pt-4 sm:px-6 sm:pb-12 lg:px-8 lg:pt-6">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 flex-col">
          <BrandName name={displayName} href={null} className="truncate text-base tracking-[0.18em] sm:text-lg" />
          {brandName && (
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">{brandName}</span>
          )}
        </div>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href={`${base}/agendar`}>
            Agendar <ArrowRight className="size-4" />
          </Link>
        </Button>
      </header>

      {/* Herói: empilhado no celular, duas colunas a partir do notebook */}
      <section className="mt-4 grid overflow-hidden rounded-3xl bg-hero shadow-sm shadow-primary/10 lg:mt-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col items-center px-6 py-10 text-center animate-in fade-in slide-in-from-bottom-2 duration-500 sm:px-10 sm:py-14 lg:items-start lg:py-16 lg:text-left">
          <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-card/80 text-primary shadow-sm" aria-hidden>
            <CalendarHeart className="size-7" />
          </span>
          <h1 className="font-display text-4xl font-semibold leading-tight text-primary-dark sm:text-5xl">Agende seu horário</h1>
          {welcome && <p className="mt-4 max-w-md text-lg leading-relaxed text-foreground/80">{welcome}</p>}
          {hours && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-card/80 px-4 py-2 text-sm font-medium text-primary-dark">
              <Clock className="size-4" aria-hidden /> {hours}
            </p>
          )}
          <Button asChild size="lg" className="mt-8 hidden w-full max-w-xs sm:inline-flex">
            <Link href={`${base}/agendar`}>
              Ver serviços e agendar <ArrowRight />
            </Link>
          </Button>
        </div>

        <ul className="grid grid-cols-3 gap-2 border-t border-card/40 bg-card/50 px-4 py-6 sm:gap-4 sm:px-10 lg:grid-cols-1 lg:content-center lg:gap-4 lg:border-l lg:border-t-0 lg:px-10">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col items-center gap-2 text-center lg:flex-row lg:items-center lg:gap-4 lg:rounded-2xl lg:bg-card/80 lg:p-4 lg:text-left">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm lg:size-12" aria-hidden>
                <Icon className="size-5 lg:size-6" />
              </span>
              <span>
                <span className="block text-xs font-semibold leading-tight text-primary-dark sm:text-sm">{title}</span>
                <span className="mt-0.5 hidden text-sm text-muted-foreground lg:block">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 lg:mt-14" aria-labelledby="servicos">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="servicos" className="font-display text-2xl font-semibold text-primary-dark sm:text-3xl">
              Nossos serviços
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Escolha o procedimento ideal para você.</p>
          </div>
        </div>
        {loadError ? (
          <SetupNotice message={loadError} />
        ) : services.length === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground">Nenhum serviço disponível no momento.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
            {services.map((s) => (
              <li key={s.id} className="flex">
                <Link href={`${base}/agendar?servico=${s.id}`} className={serviceCardClass} aria-label={`Agendar ${s.name}`}>
                  <ServiceCardContent
                    name={s.name}
                    description={s.description}
                    priceCents={s.price_cents}
                    durationMinutes={s.duration_minutes}
                    actionLabel="Agendar"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 flex justify-center">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-primary"
        >
          <Lock className="size-3.5" aria-hidden /> Área da profissional
        </Link>
      </footer>

      {/* Botão fixo no celular: sempre ao alcance do polegar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border/60 bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <Button asChild size="xl">
          <Link href={`${base}/agendar`}>
            Agendar agora <ArrowRight />
          </Link>
        </Button>
      </div>
    </main>
  );
}

const BENEFITS = [
  { icon: UserRound, title: "Atendimento personalizado", text: "Cada detalhe pensado para você." },
  { icon: Flower2, title: "Ambiente acolhedor", text: "Um momento só seu, sem pressa." },
  { icon: CalendarClock, title: "Horários flexíveis", text: "Agende online, a qualquer hora." },
];

/** Fluxo de agendamento de um estúdio. Sem slug, usa o estúdio principal. */
export async function StudioBookingPage({ slug, servico }: { slug?: string; servico?: string }) {
  let studio: Studio | null = null;
  let services: PublicService[] = [];
  try {
    studio = await getStudio(slug);
    if (studio) services = await getActiveServices(studio.id);
  } catch {
    studio = null;
  }
  if (!studio && slug) notFound();
  if (!studio) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-5 py-8">
        <BrandName />
        <SetupNotice />
      </main>
    );
  }
  return (
    <main>
      <BookingFlow
        professionalId={studio.id}
        basePath={studioBasePath(studio)}
        services={services}
        initialServiceId={servico}
        bookingWindowDays={studio.booking_window_days}
        displayName={studio.display_name}
      />
    </main>
  );
}
