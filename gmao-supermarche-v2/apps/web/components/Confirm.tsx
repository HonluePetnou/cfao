"use client";
import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { AlertTriangle, HelpCircle, Trash2, ShieldAlert, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ConfirmType = "danger" | "warning" | "info";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ── Context ───────────────────────────────────────────────────────────────────
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [visible, setVisible] = useState(false);

  const confirm = (opts: ConfirmOptions) => {
    setOptions(opts);
    setActive(true);
    // Slide in
    setTimeout(() => setVisible(true), 10);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const handleCancel = () => {
    setVisible(false);
    setTimeout(() => {
      setActive(false);
      if (resolverRef.current) resolverRef.current(false);
    }, 200);
  };

  const handleConfirm = () => {
    setVisible(false);
    setTimeout(() => {
      setActive(false);
      if (resolverRef.current) resolverRef.current(true);
    }, 200);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && active) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  const type = options?.type ?? "info";

  // Configuration values based on confirmation type
  const typeConfig = {
    danger: {
      icon: Trash2,
      iconClass: "bg-red-100 text-red-600",
      btnClass: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      icon: AlertTriangle,
      iconClass: "bg-amber-100 text-amber-600",
      btnClass: "bg-amber-500 hover:bg-amber-600 focus:ring-amber-500",
    },
    info: {
      icon: HelpCircle,
      iconClass: "bg-blue-100 text-blue-600",
      btnClass: "bg-navy hover:bg-navy/90 focus:ring-slate-800",
    },
  }[type];

  const IconComponent = typeConfig.icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* Modal backdrop */}
      {active && options && (
        <div
          className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          onClick={handleCancel}
        >
          {/* Modal Container */}
          <div
            className={`bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 ease-out ${
              visible ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-4 opacity-0"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header section with closing cross */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${typeConfig.iconClass}`}>
                  <IconComponent size={20} strokeWidth={2.3} />
                </div>
                <h3 className="text-base font-black text-slate-800 leading-none">
                  {options.title}
                </h3>
              </div>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Message Body */}
            <div className="px-6 py-2 text-sm text-slate-500 leading-relaxed">
              {options.message}
            </div>

            {/* Footer / Action Buttons */}
            <div className="px-6 py-5 mt-4 bg-slate-50 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                onClick={handleCancel}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"
              >
                {options.cancelText ?? "Annuler"}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-5 py-2.5 text-sm font-bold text-white rounded-2xl shadow-lg transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${typeConfig.btnClass}`}
              >
                {options.confirmText ?? "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx.confirm;
}
