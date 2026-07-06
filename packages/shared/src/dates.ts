export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export const MESES_ABBR = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const;

export interface IsoDateParts {
  y: number;
  mo: number;
  d: number;
}

export function parseIsoDate(iso: string | null | undefined): IsoDateParts | null {
  if (!iso) return null;
  const parts = iso.split('-').map(Number);
  const [y, mo, d] = parts;
  if (!y || !mo || !d) return null;
  return { y, mo, d };
}

/**
 * Postcard date, e.g. "18 de Junho de 2026" — day NOT zero-padded, Portuguese month
 * capitalized, and `year` is whatever year is passed in (the app always passes the
 * *current* year, per design-system/README.md).
 */
export function formatPostcardDate(day: number, month1to12: number, year: number): string {
  const mes = MESES[month1to12 - 1];
  return `${day} de ${mes} de ${year}`;
}

/** Table display date, e.g. "18/06/2026". Returns "—" when there is no date. */
export function formatDisplayDate(iso: string | null | undefined): string {
  const p = parseIsoDate(iso);
  if (!p) return '—';
  return `${String(p.d).padStart(2, '0')}/${String(p.mo).padStart(2, '0')}/${p.y}`;
}
