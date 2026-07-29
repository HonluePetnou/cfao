"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (opts: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

// ── Config par type ────────────────────────────────────────────────────────────
const CONFIG: Record<ToastType, { icon: React.FC<any>; bg: string; border: string; iconColor: string; bar: string }> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-white",
    border: "border-l-4 border-l-emerald-500",
    iconColor: "text-emerald-500",
    bar: "bg-emerald-500",
  },
  error: {
    icon: XCircle,
    bg: "bg-white",
    border: "border-l-4 border-l-red-500",
    iconColor: "text-red-500",
    bar: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-white",
    border: "border-l-4 border-l-amber-400",
    iconColor: "text-amber-400",
    bar: "bg-amber-400",
  },
  info: {
    icon: Info,
    bg: "bg-white",
    border: "border-l-4 border-l-blue-500",
    iconColor: "text-blue-500",
    bar: "bg-blue-500",
  },
};

// ── ToastItem ──────────────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = CONFIG[toast.type];
  const Icon = cfg.icon;
  const duration = toast.duration ?? 4000;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Progress bar
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        handleClose();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [duration]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl shadow-lg
        ${cfg.bg} ${cfg.border}
        flex items-start gap-3 px-4 py-3 min-w-[280px] max-w-[360px]
        transition-all duration-300 ease-out
        ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Icon */}
      <div className={`mt-0.5 shrink-0 ${cfg.iconColor}`}>
        <Icon size={20} strokeWidth={2.2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{toast.message}</p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
      >
        <X size={15} />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-[3px] w-full bg-slate-100">
        <div
          className={`h-full ${cfg.bar} transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((opts: Omit<Toast, "id">) => {
    setToasts((prev) => {
      // Évite les doublons exacts si le même toast est déjà présent à l'écran
      const isDuplicate = prev.some((t) => t.title === opts.title && t.message === opts.message);
      if (isDuplicate) return prev;
      
      const id = Math.random().toString(36).slice(2);
      return [...prev.slice(-4), { ...opts, id }]; // max 5 toasts
    });
  }, []);

  const success = useCallback((title: string, message?: string) => addToast({ type: "success", title, message }), [addToast]);
  const error   = useCallback((title: string, message?: string) => addToast({ type: "error",   title, message }), [addToast]);
  const warning = useCallback((title: string, message?: string) => addToast({ type: "warning", title, message }), [addToast]);
  const info    = useCallback((title: string, message?: string) => addToast({ type: "info",    title, message }), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, toast: addToast, success, error, warning, info, dismiss }}>
      {children}

      {/* Toast Container — bottom-right */}
      <div
        className="fixed z-[9999] flex flex-col gap-2 items-end pointer-events-none"
        style={{ bottom: "16px", right: "16px" }}
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
