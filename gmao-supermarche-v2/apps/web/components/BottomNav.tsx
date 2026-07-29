"use client";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Ticket, PlusCircle, FileText, User, ShieldCheck } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const raw = typeof window !== "undefined" ? sessionStorage.getItem("gmao_user") : null;
  const user = raw ? JSON.parse(raw) : null;
  const role: string = user?.role || "SUPER_ADMIN";

  const isActive = (href: string) => {
    const [basePath] = href.split("?");
    if (basePath === "/dashboard" || basePath === "/admin") return pathname === basePath;
    return pathname === basePath || pathname.startsWith(basePath + "/");
  };

  const items: ({ label: string; href: string; icon: any } | null)[] = role === "USER"
    ? [
        { label: "Accueil", href: "/demandeur", icon: LayoutDashboard },
        { label: "Historique", href: "/tickets", icon: Ticket },
        null,
        { label: "Nouveau", href: "/demandeur/nouveau", icon: PlusCircle },
        { label: "Paramètres", href: "/demandeur", icon: User },
      ]
    : role === "MAINTENANCIER"
    ? [
        { label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
        { label: "Tickets", href: "/tickets", icon: Ticket },
        null,
        { label: "Préventif", href: "/preventive", icon: ShieldCheck },
        { label: "Profil", href: "/login", icon: User },
      ]
    : [
        { label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
        { label: "Tickets", href: "/tickets", icon: Ticket },
        null,
        { label: "Gestion", href: "/localisations", icon: FileText },
        { label: "Profil", href: "/admin", icon: User },
      ];

  // Pages with their own built-in bottom nav — don't render the Shell one
  if (pathname === "/demandeur" || pathname === "/maintenancier") return null;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 flex items-center justify-around h-16 px-2 shadow-[0_-1px_8px_rgba(0,0,0,0.08)]">
      {items.map((item, i) =>
        item === null ? (
          <button
            key="fab"
            onClick={() => router.push(role === "USER" ? "/demandeur/nouveau" : role === "MAINTENANCIER" ? "/maintenancier/nouveau" : "/tickets/new")}
            className="flex h-13 w-13 items-center justify-center rounded-full bg-orange shadow-lg shadow-orange/30 text-white -mt-5 border-4 border-white"
            style={{ width: 52, height: 52 }}
          >
            <PlusCircle size={26} />
          </button>
        ) : (
          <a
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium px-3 transition-colors ${isActive(item.href) ? "text-orange" : "text-slate-400"}`}
          >
            <item.icon size={21} />
            <span>{item.label}</span>
          </a>
        )
      )}
    </nav>
  );
}
