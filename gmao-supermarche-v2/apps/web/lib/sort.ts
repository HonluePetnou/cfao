// Petit utilitaire de tri partagé par les tableaux triables (Localisations,
// Équipements, Gestion des Plans...) — évite de dupliquer la même logique de
// comparaison sur chaque page.

export type SortDir = "asc" | "desc";

// Compare deux valeurs quelconques : nombres numériquement, tout le reste en
// texte (localeCompare "fr" pour trier correctement les accents), les
// valeurs manquantes (null/undefined) toujours en dernier quel que soit le sens.
export function compareValues(a: unknown, b: unknown): number {
  const aMissing = a === null || a === undefined || a === "";
  const bMissing = b === null || b === undefined || b === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr", { sensitivity: "base" });
}

// Ordre de sévérité métier pour "criticité" — un tri alphabétique brut
// donnerait critique/faible/haute/moyenne, ce qui n'a pas de sens pour
// l'utilisateur ; celui-ci suit l'échelle réelle (voir globals.css / badge-*).
const CRITICITE_ORDER: Record<string, number> = { faible: 0, moyenne: 1, haute: 2, critique: 3 };
export function compareCriticite(a: unknown, b: unknown): number {
  const aMissing = a === null || a === undefined || a === "";
  const bMissing = b === null || b === undefined || b === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const aRank = CRITICITE_ORDER[String(a)] ?? 99;
  const bRank = CRITICITE_ORDER[String(b)] ?? 99;
  return aRank - bRank;
}
