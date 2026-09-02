"use client";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard, Layers, Settings, Users, Wrench,
  Ticket, ShieldCheck,
  SlidersHorizontal, FileText, ChevronLeft, ChevronRight, LogOut, PlusCircle,
  ClipboardList,
} from "lucide-react";

const SECTIONS: Record<string, { label: string; items: { label: string; href: string; icon: any; badge?: string }[] }[]> = {
  SUPER_ADMIN: [
    {
      label: "GESTION",
      items: [
        { label: "Localisations", href: "/localisations", icon: Layers },
        { label: "Équipements", href: "/equipements", icon: Settings },
        { label: "Utilisateurs", href: "/utilisateurs", icon: Users },
        { label: "Plans préventifs", href: "/preventive", icon: ShieldCheck },
      ],
    },
    {
      label: "MAINTENANCE",
      items: [
        { label: "Tickets", href: "/tickets", icon: Ticket, badge: "live" },
      ],
    },
      {
        label: "PARAMÈTRES",
        items: [
          { label: "Paramètres", href: "/admin", icon: SlidersHorizontal },
          { label: "Journaux", href: "/admin/journaux", icon: FileText },
          { label: "Rondes", href: "/admin/rondes", icon: ClipboardList },
        ],
      },
  ],
  MAINTENANCIER: [
    {
      label: "MES INTERVENTIONS",
      items: [
        { label: "Tableau de bord", href: "/maintenancier", icon: LayoutDashboard },
        { label: "Nouveau ticket", href: "/maintenancier/nouveau", icon: PlusCircle },
        { label: "Faire la ronde", href: "/maintenancier/ronde", icon: ClipboardList },
      ],
    },
  ],
  USER: [
    {
      label: "MES DEMANDES",
      items: [
        { label: "Accueil", href: "/demandeur", icon: LayoutDashboard },
        { label: "Nouveau ticket", href: "/demandeur/nouveau", icon: PlusCircle },
      ],
    },
  ],
  // Lecture seule : visibilité complète sur l'activité (comme SUPER_ADMIN),
  // mais sans "Utilisateurs" (gestion de comptes) ni "Paramètres" (config
  // système) - ce sont des actions d'administration, pas de la visualisation.
  VIEWER: [
    {
      label: "GESTION",
      items: [
        { label: "Localisations", href: "/localisations", icon: Layers },
        { label: "Équipements", href: "/equipements", icon: Settings },
        { label: "Plans préventifs", href: "/preventive", icon: ShieldCheck },
      ],
    },
    {
      label: "MAINTENANCE",
      items: [
        { label: "Tickets", href: "/tickets", icon: Ticket },
      ],
    },
    {
      label: "SUIVI",
      items: [
        { label: "Journaux", href: "/admin/journaux", icon: FileText },
        { label: "Rondes", href: "/admin/rondes", icon: ClipboardList },
      ],
    },
  ],
};

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  ticketCount?: number;
}

export default function Sidebar({ collapsed, setCollapsed, ticketCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const raw = typeof window !== "undefined" ? sessionStorage.getItem("gmao_user") : null;
  const user = raw ? JSON.parse(raw) : null;
  const role: string = user?.role || "SUPER_ADMIN";
  const navSections = SECTIONS[role] || SECTIONS.SUPER_ADMIN;

  const isActive = (href: string) => {
    const [basePath] = href.split("?");
    if (basePath === "/dashboard" || basePath === "/admin") return pathname === basePath;
    return pathname === basePath || pathname.startsWith(basePath + "/");
  };

  const handleLogout = () => {
    sessionStorage.clear();
    router.push("/login");
  };

  return (
    <aside className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-navy z-30 transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-5 -right-3 h-6 w-6 rounded-full bg-orange hover:bg-orange-600 text-white flex items-center justify-center border-2 border-white shadow-md z-40 transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className={`flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-10 w-full shrink-0 items-center justify-center bg-white rounded-xl shadow-lg p-1 overflow-hidden">
          {collapsed ? (
            <Image src="/logocfao.png" alt="Logo" width={32} height={32} className="object-contain" />
          ) : (
            <Image src="/logocfao.png" alt="Logo CFAO" width={140} height={32} className="object-contain" />
          )}
        </div>
      </div>

      <div className="px-3 pt-4 pb-1">
        <a
          href={role === "USER" ? "/demandeur" : role === "MAINTENANCIER" ? "/maintenancier" : "/dashboard"}
          className={`sidebar-link ${(isActive("/dashboard") || isActive("/demandeur") || isActive("/maintenancier")) ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
        >
          <LayoutDashboard size={18} className="shrink-0" />
          {!collapsed && <span>{role === "USER" ? "Mon espace" : role === "MAINTENANCIER" ? "Mes interventions" : "Tableau de bord"}</span>}
        </a>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <p className="sidebar-section">{section.label}</p>
            ) : (
              <div className="my-2 border-t border-white/10" />
            )}
            {section.items.map((item) => (
              <a
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={`sidebar-link relative mb-0.5 ${isActive(item.href) ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && item.badge === "live" && ticketCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                    {ticketCount > 99 ? "99+" : ticketCount}
                  </span>
                )}
                {collapsed && item.badge === "live" && ticketCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-0.5">
        <button onClick={handleLogout} className={`sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 ${collapsed ? "justify-center px-0" : ""}`}>
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
