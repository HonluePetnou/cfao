"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, X } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

// Normalise pour une recherche insensible aux accents et à la casse
// ("electrogene" doit retrouver "Groupe électrogène").
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Champ de sélection avec suggestions filtrées au fur et à mesure de la
 * saisie — remplace un <select> classique pour les listes longues
 * (équipements, localisations, corps d'état...) où chercher une option en
 * faisant défiler une liste déroulante est pénible.
 *
 * La liste de suggestions est rendue dans un portail (document.body), en
 * position fixe recalculée sur la position réelle du champ : un <select>
 * classique déborderait de sa carte, mais nos cartes de formulaire ont
 * `overflow-hidden` (coins arrondis) qui rognerait purement et simplement
 * une liste positionnée en absolu à l'intérieur du composant.
 */
export default function Combobox({
  options,
  value,
  onChange,
  placeholder = "Rechercher...",
  emptyMessage = "Aucun résultat",
  required,
  disabled,
  className = "",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);

  // Texte affiché dans le champ : le libellé sélectionné tant qu'on ne tape
  // pas, sinon ce que l'utilisateur est en train d'écrire.
  const displayValue = open ? query : selected?.label || "";

  const filtered = useMemo(() => {
    if (!open) return options;
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter(
      (o) => normalize(o.label).includes(q) || (o.sublabel && normalize(o.sublabel).includes(q))
    );
  }, [options, query, open]);

  useEffect(() => {
    setHighlight(0);
  }, [filtered.length, open]);

  const updateRect = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 240 && r.top > spaceBelow;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateRect();
    const onScrollOrResize = () => updateRect();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        rootRef.current && !rootRef.current.contains(target) &&
        !(listRef.current && listRef.current.contains(target))
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectOption = (opt: ComboboxOption) => {
    onChange(opt.value);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  const dropdown = open && rect && mounted
    ? createPortal(
        <div
          ref={listRef}
          style={{
            position: "fixed",
            top: rect.top + (rect.openUp ? -4 : 4),
            left: rect.left,
            width: rect.width,
            transform: rect.openUp ? "translateY(-100%)" : undefined,
          }}
          className="z-[1000] max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-400">{emptyMessage}</p>
          ) : (
            filtered.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  i === highlight ? "bg-orange/10 text-orange" : "text-slate-700"
                } ${opt.value === value ? "font-semibold" : ""}`}
              >
                {opt.label}
                {opt.sublabel && <span className="text-slate-400 text-xs ml-1.5">{opt.sublabel}</span>}
              </button>
            ))
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/10 transition-all disabled:opacity-60"
        />
        {value && !open ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { onChange(""); setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        {/* Champ caché pour que la validation native required="" du <form> continue de fonctionner */}
        {required && (
          <input tabIndex={-1} aria-hidden value={value} required onChange={() => {}} className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none" />
        )}
      </div>

      {dropdown}
    </div>
  );
}
