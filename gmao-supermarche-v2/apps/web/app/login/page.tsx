"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api } from "@/lib/api";
import { Wrench, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      sessionStorage.setItem("gmao_token", res.token);
      sessionStorage.setItem("gmao_user", JSON.stringify(res.user));
      if (res.user.supermarketId) sessionStorage.setItem("gmao_current_supermarket", res.user.supermarketId);
      const dest = res.user.role === "USER" ? "/demandeur" : res.user.role === "MAINTENANCIER" ? "/maintenancier" : "/dashboard";
      router.push(dest);
    } catch {
      setError("Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          background: "radial-gradient(circle at 20% 50%, #FA5B07 0%, transparent 50%), radial-gradient(circle at 80% 50%, #3B82F6 0%, transparent 50%)",
        }}
      />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="w-full max-w-[420px] relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-48 items-center justify-center bg-white rounded-2xl shadow-lg p-2 mb-4">
            <Image src="/logocfao.png" alt="Logo CFAO" width={180} height={50} className="object-contain" />
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight text-center">GMAO CONSUMER CAMEROUN</h1>
          <p className="text-slate-400 text-xs uppercase tracking-[0.2em] font-medium mt-1">Multi-Supermarché</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-7 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Connexion</h2>
            <p className="text-slate-500 text-sm mt-1">Accédez à votre espace de maintenance</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5 text-sm text-red-700 animate-fade-in">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="admin@gmao.local"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base font-semibold shadow-lg shadow-orange/20"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>


        </div>

        <p className="text-center text-xs text-slate-500/40 mt-6">GMAO CONSUMER CAMEROUN v1.0</p>
      </div>
    </div>
  );
}
