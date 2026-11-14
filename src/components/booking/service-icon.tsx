import { Brush, Footprints, Gem, Hand, Palette, RefreshCw, Sparkles, type LucideIcon } from "lucide-react";

/** Ícone de cada serviço, escolhido pelo nome (sem acento, minúsculo). Ordem importa: o primeiro que casar vence. */
const RULES: [RegExp, LucideIcon][] = [
  [/manutenc/, RefreshCw],
  [/pedicure|\bpe\b|pes\b/, Footprints],
  [/nail ?art|decorac|desenho/, Palette],
  [/esmalt/, Brush],
  [/fibra|gel|tips|alongamento|acrigel|porcelana/, Gem],
  [/manicure|mao|maos|cuticula/, Hand],
];

export function serviceIcon(name: string): LucideIcon {
  const key = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return RULES.find(([re]) => re.test(key))?.[1] ?? Sparkles;
}
