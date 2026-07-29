/**
 * Parses a checklist string that can be either:
 * 1. NEW format (JSON): [{ section: string, taches: string[] }]
 * 2. OLD format (plain text, one task per line)
 *
 * Returns a flat array of { section: string, tache: string } items.
 */
export type ChecklistItem = { section: string; tache: string };
export type ChecklistSection = { section: string; taches: string[] };

export function parseChecklist(raw: string | null | undefined): ChecklistItem[] {
  if (!raw || raw.trim() === "") return [];

  // Try JSON format first
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed[0]?.taches) {
      const sections = parsed as ChecklistSection[];
      return sections.flatMap((s) =>
        (s.taches || []).map((t) => ({ section: s.section, tache: t }))
      );
    }
  } catch {
    // Not JSON, fall through to plain text
  }

  // Plain text: one task per line, no sections
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => ({ section: "Général", tache: l }));
}

/**
 * Returns checklist structured by sections (for grouped display).
 */
export function parseChecklistSections(raw: string | null | undefined): ChecklistSection[] {
  const items = parseChecklist(raw);
  const map = new Map<string, string[]>();
  for (const item of items) {
    if (!map.has(item.section)) map.set(item.section, []);
    map.get(item.section)!.push(item.tache);
  }
  return Array.from(map.entries()).map(([section, taches]) => ({ section, taches }));
}
