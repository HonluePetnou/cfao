"use client";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// Petite flèche d'indication de tri pour un en-tête de colonne cliquable —
// grise et neutre tant que la colonne n'est pas le critère de tri actif,
// orientée et colorée une fois active.
export default function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown size={11} className="text-slate-300" />;
  return dir === "asc" ? <ChevronUp size={11} className="text-orange" /> : <ChevronDown size={11} className="text-orange" />;
}
