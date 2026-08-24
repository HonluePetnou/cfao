export type IntervalUnit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";

/**
 * Ajoute un intervalle calendaire à une date, en respectant la vraie longueur
 * des mois/années (via setMonth/setFullYear) plutôt qu'une approximation en
 * jours fixes (30j/365j) qui dérive progressivement de la date réelle.
 *
 * Utilisé partout où une échéance de plan préventif est calculée, pour que la
 * date projetée dans le calendrier corresponde exactement à la date de la
 * tâche réellement générée par le cron.
 */
export function addInterval(date: Date, unit: IntervalUnit, value: number): Date {
  const next = new Date(date);
  switch (unit) {
    case "DAYS":
      next.setDate(next.getDate() + value);
      break;
    case "WEEKS":
      next.setDate(next.getDate() + value * 7);
      break;
    case "MONTHS":
      next.setMonth(next.getMonth() + value);
      break;
    case "YEARS":
      next.setFullYear(next.getFullYear() + value);
      break;
  }
  return next;
}
